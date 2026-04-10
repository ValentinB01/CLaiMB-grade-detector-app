import React, { useState, useCallback } from 'react';
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

/* ── Component ─────────────────────────────────────────────── */
export default function SpraywallScreen() {
  // Image & analysis state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [holds, setHolds] = useState<HoldLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [imgAspect, setImgAspect] = useState(1);
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });

  // Route builder state
  const [selectedHolds, setSelectedHolds] = useState<number[]>([]);

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
      setSelectedHolds([]);

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

  /* ── Toggle hold selection ───────────────────────────────── */
  const toggleHold = (idx: number) => {
    setSelectedHolds((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  /* ── AI Route Generator ──────────────────────────────────── */
  const generateRandomRoute = () => {
    if (holds.length < 3) {
      Alert.alert('Not enough holds', 'Need at least 3 detected holds to generate a route.');
      return;
    }

    // Sort by Y (top of image = 0, bottom = 1)
    const indexed = holds.map((h, i) => ({ ...h, idx: i }));
    indexed.sort((a, b) => a.y - b.y);

    const total = indexed.length;
    const topZone = indexed.slice(0, Math.max(1, Math.floor(total * 0.25)));
    const midZone = indexed.slice(
      Math.floor(total * 0.25),
      Math.floor(total * 0.75),
    );
    const bottomZone = indexed.slice(Math.floor(total * 0.75));

    const pick = (arr: typeof indexed, n: number) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(n, shuffled.length));
    };

    const finish = pick(topZone, 1);
    const middle = pick(midZone, Math.min(midZone.length, 3 + Math.floor(Math.random() * 2)));
    const start = pick(bottomZone, Math.min(bottomZone.length, 2));

    const route = [...finish, ...middle, ...start].map((h) => h.idx);
    const unique = [...new Set(route)];

    setSelectedHolds(unique);
  };

  const clearRoute = () => setSelectedHolds([]);

  /* ── Render helpers ──────────────────────────────────────── */
  const imageMaxW = SCREEN_W - 32;
  const imageH = imageMaxW / imgAspect;

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

          const isSelected = selectedHolds.includes(idx);
          const strokeColor = isSelected ? C.neon : 'rgba(255,255,255,0.3)';
          const fillColor = isSelected ? C.neon + '22' : 'transparent';
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
                  fill={C.neon}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {hold.hold_type}
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
              {selectedHolds.length} selected
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

        {/* Hint */}
        {!loading && holds.length > 0 && (
          <Text style={styles.hint}>Tap holds to add them to your route</Text>
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

            {selectedHolds.length > 0 && (
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
});
