import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  LayoutChangeEvent,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { detectHolds } from '../../utils/api';
import { HoldLocation } from '../../utils/store';

const { width: SCREEN_W } = Dimensions.get('window');

/* ── Palette ───────────────────────────────────────────────── */
const C = {
  bg: '#0d0d12',
  card: '#16161d',
  border: '#27272a',
  primary: '#f0f0f5',
  secondary: '#9ca3af',
  muted: '#4b5563',
  accent: '#a855f7',
  neon: '#4ade80',
  electric: '#3b82f6',
  danger: '#ef4444',
};

/* ── Hold roles ────────────────────────────────────────────── */
type HoldRole = 'start' | 'hand' | 'finish';
const ROLE_COLORS: Record<HoldRole, string> = {
  start: C.electric,
  hand: C.neon,
  finish: C.danger,
};
const ROLE_LABELS: Record<HoldRole, string> = {
  start: 'START',
  hand: 'HAND',
  finish: 'FINISH',
};
const ROLE_CYCLE: (HoldRole | null)[] = [null, 'start', 'hand', 'finish', null];
const MIN_HOLDS = 4;
const MAX_HOLDS = 15;
const REACH_RADIUS = 0.25;
const REACH_RADIUS_WIDE = 0.35;
const START_CLUSTER_DIST = 0.15;
const ZIGZAG_DOWN = 0.05;
const ZIGZAG_DOWN_WIDE = 0.08;
const FINISH_ZONE_Y = 0.15;
const START_ZONE_Y = 0.75;

interface EvaluationResult {
  grade: string;
  reasoning: string;
  difficultyScore: number;
}

/* ── Component ─────────────────────────────────────────────── */
export default function SpraywallScreen() {
  // Image & analysis state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [holds, setHolds] = useState<HoldLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [imgAspect, setImgAspect] = useState(1);
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });

  // Route builder state
  const [selectedHolds, setSelectedHolds] = useState<Record<number, HoldRole>>({});

  // Evaluation state
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const insightAnim = useRef(new Animated.Value(0)).current;

  // Clear evaluation when route changes
  useEffect(() => {
    setEvaluationResult(null);
  }, [selectedHolds]);

  // Animate insights card on new evaluation
  useEffect(() => {
    if (evaluationResult) {
      insightAnim.setValue(0);
      Animated.timing(insightAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [evaluationResult]);

  /* ── Pick image & detect holds ───────────────────────────── */
  const pickAndAnalyze = async () => {
    try {
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets[0].base64) {
        setLoading(false);
        return;
      }

      const base64 = result.assets[0].base64;
      setImageBase64(base64);
      setSelectedHolds({});

      const response = await detectHolds({
        image_base64: base64,
      });

      setHolds(response.holds ?? []);
    } catch (err) {
      Alert.alert('Detection failed', String(err));
    } finally {
      setLoading(false);
    }
  };

  /* ── Measure rendered image layout ───────────────────────── */
  const onImageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImgLayout({ width, height });
  }, []);

  /* ── Toggle hold selection (cycle: start → hand → finish → off) */
  const toggleHold = (idx: number) => {
    setSelectedHolds((prev) => {
      const current = prev[idx] ?? null;
      const nextIdx = ROLE_CYCLE.indexOf(current) + 1;
      const next = ROLE_CYCLE[nextIdx] ?? null;

      if (next === null) {
        const { [idx]: _, ...rest } = prev;
        return rest;
      }

      if (!(idx in prev) && Object.keys(prev).length >= MAX_HOLDS) {
        Alert.alert('Limită atinsă', `Maxim ${MAX_HOLDS} prize per traseu.`);
        return prev;
      }

      return { ...prev, [idx]: next };
    });
  };

  /* ── AI Route Generator (Reachability + Zig-Zag) ───────── */
  const generateRandomRoute = () => {
    if (holds.length < 7) {
      Alert.alert('Prea puține prize', 'Sunt necesare minim 7 prize detectate.');
      return;
    }

    const indexed = holds.map((h, i) => ({ ...h, idx: i }));
    const eucl = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    // Target route length: 7–10 holds
    const targetLength = Math.floor(Math.random() * 4) + 7;

    // 1. Start clustering — bottom 25 %
    const bottomPool = indexed.filter((h) => h.y >= START_ZONE_Y);
    if (bottomPool.length < 1) {
      Alert.alert('Zone insuficiente', 'Nu sunt destule prize în zona de start.');
      return;
    }

    const route: Record<number, HoldRole> = {};
    const used = new Set<number>();

    // Start Hold 1: random from bottom
    const start1 = bottomPool[Math.floor(Math.random() * bottomPool.length)];
    route[start1.idx] = 'start';
    used.add(start1.idx);

    // Start Hold 2: closest neighbour within START_CLUSTER_DIST
    const s2Candidates = bottomPool
      .filter((h) => h.idx !== start1.idx)
      .sort((a, b) => eucl(a, start1) - eucl(b, start1));

    if (s2Candidates.length > 0 && eucl(s2Candidates[0], start1) < START_CLUSTER_DIST) {
      route[s2Candidates[0].idx] = 'start';
      used.add(s2Candidates[0].idx);
    }

    // 2. Build zig-zag chain toward the top
    const startIdxs = Object.keys(route).map(Number);
    let current = startIdxs
      .map((i) => indexed[i])
      .reduce((a, b) => (a.y < b.y ? a : b));

    const handTarget = targetLength - 1; // leave 1 slot for finish

    while (Object.keys(route).length < handTarget) {
      // Normal search: allow slight downward (zig-zag)
      let candidates = indexed.filter((h) => {
        if (used.has(h.idx)) return false;
        if (h.y > current.y + ZIGZAG_DOWN) return false;
        const d = eucl(h, current);
        return d > 0.04 && d <= REACH_RADIUS;
      });

      // Fallback: widen radius & downward tolerance
      if (candidates.length === 0) {
        candidates = indexed.filter((h) => {
          if (used.has(h.idx)) return false;
          if (h.y > current.y + ZIGZAG_DOWN_WIDE) return false;
          const d = eucl(h, current);
          return d > 0.04 && d <= REACH_RADIUS_WIDE;
        });
      }

      if (candidates.length === 0) break;

      // Score: reward upward movement + random lateral variation
      candidates.sort((a, b) => {
        const sa = a.y - Math.random() * 0.08;
        const sb = b.y - Math.random() * 0.08;
        return sa - sb;
      });

      const pool = candidates.slice(
        0,
        Math.max(1, Math.ceil(candidates.length * 0.6)),
      );
      const next = pool[Math.floor(Math.random() * pool.length)];

      route[next.idx] = 'hand';
      used.add(next.idx);
      current = next;
    }

    // 3. Finish — prefer top 15 %, fallback to highest unused
    const finishPool = indexed
      .filter((h) => !used.has(h.idx) && h.y <= FINISH_ZONE_Y)
      .sort((a, b) => eucl(a, current) - eucl(b, current));

    if (finishPool.length > 0) {
      const reachable = finishPool.filter(
        (h) => eucl(h, current) <= REACH_RADIUS_WIDE,
      );
      const pick = reachable.length > 0 ? reachable[0] : finishPool[0];
      route[pick.idx] = 'finish';
    } else {
      // Fallback: absolute highest unused hold
      const highest = indexed
        .filter((h) => !used.has(h.idx))
        .sort((a, b) => a.y - b.y);
      if (highest.length > 0) route[highest[0].idx] = 'finish';
    }

    if (Object.keys(route).length < MIN_HOLDS) {
      Alert.alert(
        'Rută incompletă',
        'Nu s-a putut genera o rută cu suficiente prize accesibile. Încearcă din nou.',
      );
      return;
    }

    setSelectedHolds(route);
  };

  const clearRoute = () => setSelectedHolds({});

  /* ── Crux-based Route Grader ──────────────────────────────── */
  const estimateRouteGrade = () => {
    const indices = Object.keys(selectedHolds).map(Number);
    if (indices.length < MIN_HOLDS) return;

    // 1. Chronological sequence: Start (bottom) → Finish (top)
    const chain = indices
      .map((i) => ({ ...holds[i], idx: i }))
      .sort((a, b) => b.y - a.y);

    // 2. Crux Reach — longest single move
    let maxDist = 0;
    let cruxMoveIdx = 0;
    const distances: number[] = [];
    for (let i = 1; i < chain.length; i++) {
      const dx = chain[i].x - chain[i - 1].x;
      const dy = chain[i].y - chain[i - 1].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      distances.push(d);
      if (d > maxDist) {
        maxDist = d;
        cruxMoveIdx = i;
      }
    }

    // 3. Crux Hold — smallest hold in route
    let minArea = Infinity;
    let cruxHoldIdx = 0;
    const areas: number[] = [];
    for (let i = 0; i < chain.length; i++) {
      const w = chain[i].width ?? chain[i].radius * 2;
      const h = chain[i].height ?? chain[i].radius * 2;
      const area = w * h;
      areas.push(area);
      if (area < minArea) {
        minArea = area;
        cruxHoldIdx = i;
      }
    }

    // 4. Base score (0–100) from crux extremes
    //    maxDist typically 0.05–0.50 normalised → map to 0–50
    //    minArea typically 0.0002–0.04 normalised → invert & map to 0–50
    const WEIGHT_REACH = 50;
    const WEIGHT_HOLD = 50;
    const reachScore = Math.min(maxDist / 0.45, 1) * WEIGHT_REACH;
    const holdScore = (1 - Math.min(minArea / 0.03, 1)) * WEIGHT_HOLD;
    let score = reachScore + holdScore;

    // 5. Modifiers
    // Endurance: long routes tire you out
    const enduranceBonus = chain.length > 10
      ? Math.min((chain.length - 10) * 1.5, 8)
      : 0;
    score += enduranceBonus;

    // Traverse: large lateral moves with little vertical progress
    let traverseBonus = 0;
    for (let i = 1; i < chain.length; i++) {
      const lateralDx = Math.abs(chain[i].x - chain[i - 1].x);
      const verticalDy = Math.abs(chain[i].y - chain[i - 1].y);
      if (lateralDx > 0.15 && verticalDy < 0.05) {
        traverseBonus += 3;
      }
    }
    traverseBonus = Math.min(traverseBonus, 10);
    score += traverseBonus;

    // Clamp final score 0–100
    score = Math.max(0, Math.min(Math.round(score), 100));

    // 6. V-Scale mapping (0–100 → V0–V10)
    const V_THRESHOLDS = [15, 25, 35, 44, 52, 60, 68, 76, 84, 92];
    let grade = 0;
    for (let i = 0; i < V_THRESHOLDS.length; i++) {
      if (score >= V_THRESHOLDS[i]) grade = i + 1;
    }
    const vGrade = `V${grade}`;

    // 7. Dynamic reasoning — identify dominant crux factor
    const reachDominant = reachScore >= holdScore;
    let reasoning: string;

    if (reachDominant) {
      reasoning =
        `🔥 Crux-ul traseului este o mișcare ${maxDist > 0.30 ? 'foarte lungă/dinamică' : 'lungă'} ` +
        `(mișcarea ${cruxMoveIdx}→${cruxMoveIdx + 1}, ${(maxDist * 100).toFixed(1)}% din perete).`;
    } else {
      const cruxPos = cruxHoldIdx === 0 ? 'la start' : cruxHoldIdx === chain.length - 1 ? 'la finish' : 'la mijlocul traseului';
      reasoning =
        `🔥 Dificultatea este dată de o priză foarte mică (crimp/micro) ${cruxPos} ` +
        `(arie: ${(minArea * 10000).toFixed(1)} u²).`;
    }

    if (traverseBonus > 0) {
      reasoning += `\n↔️ Traseu cu mișcări laterale semnificative (+${traverseBonus}p).`;
    }
    if (enduranceBonus > 0) {
      reasoning += `\n� Bonus anduranță: ${chain.length} prize (+${enduranceBonus.toFixed(1)}p).`;
    }

    reasoning +=
      `\n\n📏 Crux reach: ${(maxDist * 100).toFixed(1)}%` +
      `\n📐 Crux hold: ${(minArea * 10000).toFixed(1)} u²` +
      `\n🧗 Prize în traseu: ${chain.length}` +
      `\n🎯 Scor: ${score}/100`;

    setEvaluationResult({ grade: vGrade, reasoning, difficultyScore: score });
  };

  /* ── Render helpers ──────────────────────────────────────── */
  const imageMaxW = SCREEN_W - 32;
  const imageH = imageMaxW / imgAspect;
  const selectedCount = Object.keys(selectedHolds).length;
  const isRouteValid = selectedCount >= MIN_HOLDS && selectedCount <= MAX_HOLDS;

  const renderHoldOverlay = () => {
    if (imgLayout.width === 0 || holds.length === 0) return null;

    return (
      <Svg
        style={StyleSheet.absoluteFill}
        width={imgLayout.width}
        height={imgLayout.height}
      >
        {holds.map((hold, idx) => {
          const cx = hold.x * imgLayout.width;
          const cy = hold.y * imgLayout.height;

          const baseW = hold.width
            ? hold.width * imgLayout.width
            : hold.radius * 2 * imgLayout.width;
          const baseH = hold.height
            ? hold.height * imgLayout.height
            : hold.radius * 2 * imgLayout.height;

          const boxW = baseW * 0.9;
          const boxH = baseH * 0.9;
          const rectX = cx - boxW / 2;
          const rectY = cy - boxH / 2;

          const role = selectedHolds[idx] as HoldRole | undefined;
          const isSelected = !!role;
          const roleColor = role ? ROLE_COLORS[role] : '';
          const strokeColor = isSelected ? roleColor : 'rgba(255,255,255,0.3)';
          const fillColor = isSelected ? roleColor + '22' : 'transparent';
          const sw = isSelected ? 3.5 : 1.5;

          return (
            <React.Fragment key={idx}>
              <Rect
                x={rectX}
                y={rectY}
                width={boxW}
                height={boxH}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={sw}
                rx={4}
                onPress={() => toggleHold(idx)}
              />
              {isSelected && (
                <SvgText
                  x={cx}
                  y={rectY - 5}
                  fontSize={9}
                  fill={roleColor}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {role ? ROLE_LABELS[role] : hold.hold_type}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    );
  };

  /* ── Empty state ─────────────────────────────────────────── */
  if (!imageBase64 && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <View style={styles.heroIcon}>
            <Ionicons name="apps-outline" size={52} color={C.accent} />
          </View>
          <Text style={styles.heroTitle}>Spray Wall Builder</Text>
          <Text style={styles.heroSub}>
            Upload a photo of your spray wall. AI detects every hold, then you
            tap to build or auto-generate routes.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={pickAndAnalyze}>
            <Ionicons name="image-outline" size={20} color="#fff" />
            <Text style={styles.ctaBtnText}>Upload Wall Photo</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── Main UI ─────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Route Builder</Text>
          <TouchableOpacity style={styles.reloadBtn} onPress={pickAndAnalyze}>
            <Ionicons name="camera-outline" size={18} color={C.accent} />
            <Text style={styles.reloadText}>New Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="ellipse" size={8} color={C.neon} />
            <Text style={styles.statText}>
              {selectedCount} selected
            </Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="ellipse" size={8} color={C.electric} />
            <Text style={styles.statText}>
              {holds.length} holds detected
            </Text>
          </View>
        </View>

        {/* Image + holds overlay */}
        {loading ? (
          <View style={[styles.imagePlaceholder, { height: 300 }]}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingLabel}>Detecting holds…</Text>
          </View>
        ) : (
          <View
            style={[
              styles.imageWrap,
              { width: imageMaxW, height: imageH, maxHeight: 520 },
            ]}
            onLayout={onImageLayout}
          >
            <Image
              source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              onLoad={(e) => {
                const { width, height } = e.nativeEvent.source;
                if (width && height) setImgAspect(width / height);
              }}
            />
            {renderHoldOverlay()}
          </View>
        )}

        {/* Validation hint */}
        {!loading && holds.length > 0 && (
          <Text style={[styles.hint, isRouteValid && styles.hintValid]}>
            {selectedCount === 0
              ? 'Apasă pe prize pentru a construi un traseu'
              : selectedCount < MIN_HOLDS
                ? `Ai selectat ${selectedCount} prize. Minim ${MIN_HOLDS} pentru un traseu valid.`
                : `✓ Traseu valid — ${selectedCount} prize selectate`}
          </Text>
        )}

        {/* Action buttons */}
        {!loading && holds.length > 0 && (
          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={generateRandomRoute}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[C.neon, C.electric]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateGradient}
              >
                <Text style={styles.generateIcon}>🎲</Text>
                <Text style={styles.generateText}>Generate Auto Route</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gradeBtn, !isRouteValid && styles.gradeBtnDisabled]}
              onPress={() => {
                if (!isRouteValid) return;
                estimateRouteGrade();
              }}
              activeOpacity={isRouteValid ? 0.8 : 1}
            >
              <Text style={styles.gradeIcon}>🌟</Text>
              <Text style={[styles.gradeText, !isRouteValid && styles.gradeTextDisabled]}>
                Evaluează Gradul
              </Text>
            </TouchableOpacity>

            {selectedCount > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={clearRoute}
                activeOpacity={0.7}
              >
                <Text style={styles.clearIcon}>🗑️</Text>
                <Text style={styles.clearText}>Clear Route</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Route Insights */}
        {!loading && holds.length > 0 && (
          <View style={styles.insightsWrap}>
            <Text style={styles.insightsTitle}>Route Insights</Text>
            {evaluationResult ? (
              <Animated.View
                style={[
                  styles.insightsCard,
                  {
                    opacity: insightAnim,
                    transform: [
                      {
                        translateY: insightAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.insightsHeader}>
                  <Text style={styles.insightsGrade}>
                    {evaluationResult.grade}
                  </Text>
                  <View style={styles.insightsMeta}>
                    <Text style={styles.insightsDiffLabel}>Dificultate</Text>
                    <View style={styles.progressTrack}>
                      <LinearGradient
                        colors={[C.neon, C.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressFill,
                          { width: `${evaluationResult.difficultyScore}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.insightsDiffValue}>
                      {evaluationResult.difficultyScore}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.insightsReasoning}>
                  {evaluationResult.reasoning}
                </Text>
              </Animated.View>
            ) : (
              <Text style={styles.insightsPlaceholder}>
                Selectează prizele și apasă pe evaluare pentru a vedea
                dificultatea.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 16, paddingBottom: 40 },

  /* Empty state */
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  heroIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(168,85,247,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: C.primary },
  heroSub: {
    fontSize: 14,
    color: C.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: 9999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.primary },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  reloadText: { fontSize: 13, color: C.accent, fontWeight: '600' },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  statText: { fontSize: 12, color: C.secondary, fontWeight: '600' },

  /* Image */
  imageWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignSelf: 'center',
  },
  imagePlaceholder: {
    borderRadius: 16,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'stretch',
  },
  loadingLabel: { fontSize: 14, color: C.secondary, fontWeight: '600' },

  /* Hint */
  hint: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },

  /* Actions */
  actionsWrap: {
    gap: 12,
    marginTop: 20,
  },
  generateBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  generateIcon: { fontSize: 20 },
  generateText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0d0d12',
    letterSpacing: 0.3,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.danger + '60',
    backgroundColor: C.danger + '10',
  },
  clearIcon: { fontSize: 16 },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.danger,
  },
  hintValid: {
    color: C.neon,
    fontStyle: 'normal',
    fontWeight: '600',
  },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.accent + '80',
    backgroundColor: C.accent + '18',
  },
  gradeBtnDisabled: {
    opacity: 0.4,
  },
  gradeIcon: { fontSize: 18 },
  gradeText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.accent,
  },
  gradeTextDisabled: {
    color: C.muted,
  },

  /* Route Insights */
  insightsWrap: {
    marginTop: 24,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.primary,
    marginBottom: 12,
  },
  insightsCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.accent + '50',
    padding: 20,
    gap: 16,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  insightsGrade: {
    fontSize: 44,
    fontWeight: '900',
    color: C.neon,
    letterSpacing: -1,
  },
  insightsMeta: {
    flex: 1,
    gap: 6,
  },
  insightsDiffLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%' as any,
    borderRadius: 4,
  },
  insightsDiffValue: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
  },
  insightsReasoning: {
    fontSize: 13,
    color: C.secondary,
    lineHeight: 20,
  },
  insightsPlaceholder: {
    fontSize: 13,
    color: C.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});