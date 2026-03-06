import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getPendingResult, clearPendingResult, AnalysisResult, HoldLocation } from '../utils/store';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  bg: '#09090b',
  card: '#18181b',
  border: '#27272a',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#22d3ee',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#ef4444',
};

const HOLD_COLORS: Record<string, string> = {
  start:   '#4ade80',
  finish:  '#f472b6',
  hand:    '#22d3ee',
  foot:    '#fbbf24',
  unknown: '#a1a1aa',
};

function holdColor(type: string) {
  return HOLD_COLORS[type] ?? HOLD_COLORS.unknown;
}

function gradeColor(grade: string) {
  const n = parseInt(grade.replace('V', ''));
  if (n <= 2) return C.success;
  if (n <= 5) return C.accent;
  if (n <= 7) return C.warning;
  return C.error;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? C.success : pct >= 60 ? C.accent : C.warning;
  return (
    <View style={styles.confWrap}>
      <View style={styles.confTrack}>
        <View style={[styles.confFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.confLabel, { color }]}>{pct}%</Text>
    </View>
  );
}

export default function ResultScreen() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });
  const [selectedHold, setSelectedHold] = useState<HoldLocation | null>(null);

  useEffect(() => {
    const r = getPendingResult();
    if (r) setResult(r);
    return () => clearPendingResult();
  }, []);

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noResult}>
          <Ionicons name="alert-circle-outline" size={56} color={C.muted} />
          <Text style={styles.noResultText}>No analysis found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const gColor = gradeColor(result.grade);

  const imageUri = result.image_base64
    ? `data:image/jpeg;base64,${result.image_base64}`
    : null;

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImgLayout({ width, height });
  };

  return (
    <SafeAreaView style={styles.container} testID="result-screen">
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="back-btn"
          style={styles.backCircle}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Route Analysis</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Image + SVG overlay */}
        <View style={styles.imageContainer} testID="image-overlay-container">
          {imageUri ? (
            <View onLayout={onImageLayout} style={styles.imageWrap}>
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="cover"
              />
              {imgLayout.width > 0 && result.holds.length > 0 && (
                <Svg
                  style={StyleSheet.absoluteFill}
                  width={imgLayout.width}
                  height={imgLayout.height}
                  viewBox={`0 0 ${imgLayout.width} ${imgLayout.height}`}
                >
                  {result.holds.map((hold, idx) => {
                    const cx = hold.x * imgLayout.width;
                    const cy = hold.y * imgLayout.height;
                    const r = hold.radius * Math.min(imgLayout.width, imgLayout.height);
                    const color = holdColor(hold.hold_type);
                    const isSelected = selectedHold === hold;
                    return (
                      <React.Fragment key={idx}>
                        <Circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={color + '33'}
                          stroke={color}
                          strokeWidth={isSelected ? 3 : 2}
                          opacity={isSelected ? 1 : 0.85}
                          onPress={() => setSelectedHold(isSelected ? null : hold)}
                        />
                        {isSelected && (
                          <SvgText
                            x={cx}
                            y={cy - r - 4}
                            fontSize={10}
                            fill={color}
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
              )}
            </View>
          ) : (
            <View style={[styles.imageWrap, styles.noImagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color={C.muted} />
              <Text style={styles.noImageText}>Image unavailable</Text>
            </View>
          )}

          {/* Grade badge overlay */}
          <View style={[styles.gradeBadgeOverlay, { borderColor: gColor, backgroundColor: '#09090bcc' }]}>
            <Text style={[styles.gradeOverlayText, { color: gColor }]}>{result.grade}</Text>
          </View>
        </View>

        {/* Hold legend */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll} contentContainerStyle={styles.legend}>
          {Object.entries(HOLD_COLORS).map(([type, color]) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{type}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Selected hold info */}
        {selectedHold && (
          <View style={styles.holdInfoCard} testID="hold-info-card">
            <Text style={styles.holdInfoTitle}>
              {selectedHold.hold_type.charAt(0).toUpperCase() + selectedHold.hold_type.slice(1)} Hold
            </Text>
            <Text style={styles.holdInfoText}>
              Color: {selectedHold.color ?? '—'} · Confidence: {Math.round(selectedHold.confidence * 100)}%
            </Text>
          </View>
        )}

        {/* Grade card */}
        <View style={styles.gradeCard} testID="grade-card">
          <View style={styles.gradeRow}>
            <View>
              <Text style={styles.gradeCardLabel}>Route Grade</Text>
              <Text style={[styles.gradeCardValue, { color: gColor }]}>{result.grade}</Text>
            </View>
            <View style={styles.holdsCountBox}>
              <Text style={styles.holdsCountNum}>{result.holds.length}</Text>
              <Text style={styles.holdsCountLabel}>holds</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.confTitle}>AI Confidence</Text>
          <ConfidenceBar value={result.confidence} />

          <View style={styles.divider} />

          <View style={styles.gymRow}>
            <Ionicons name="location-outline" size={14} color={C.muted} />
            <Text style={styles.gymText}>{result.gym_name}</Text>
          </View>
        </View>

        {/* Coach notes */}
        {result.notes && (
          <View style={styles.notesCard} testID="coach-notes-card">
            <View style={styles.notesHeader}>
              <Ionicons name="sparkles" size={16} color={C.accent} />
              <Text style={styles.notesTitle}>Coach Notes</Text>
            </View>
            <Text style={styles.notesText}>{result.notes}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            testID="scan-another-btn"
            style={styles.primaryAction}
            onPress={() => router.replace('/(tabs)/camera')}
          >
            <Ionicons name="camera" size={18} color="#09090b" />
            <Text style={styles.primaryActionText}>SCAN ANOTHER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="view-history-btn"
            style={styles.secondaryAction}
            onPress={() => router.replace('/(tabs)/history')}
          >
            <Ionicons name="time-outline" size={18} color={C.primary} />
            <Text style={styles.secondaryActionText}>VIEW HISTORY</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
  scroll: { paddingBottom: 40 },
  imageContainer: { position: 'relative', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  imageWrap: { width: '100%', aspectRatio: 3 / 4 },
  image: { width: '100%', height: '100%' },
  noImagePlaceholder: { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: C.muted, fontSize: 14, marginTop: 8 },
  gradeBadgeOverlay: { position: 'absolute', top: 16, right: 16, borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  gradeOverlayText: { fontSize: 28, fontWeight: '900' },
  legendScroll: { marginHorizontal: 16, marginBottom: 8 },
  legend: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: C.secondary, textTransform: 'capitalize' },
  holdInfoCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.accent + '44' },
  holdInfoTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
  holdInfoText: { fontSize: 12, color: C.secondary, marginTop: 2 },
  gradeCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  gradeCardLabel: { fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 1 },
  gradeCardValue: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  holdsCountBox: { alignItems: 'center', backgroundColor: C.border, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  holdsCountNum: { fontSize: 28, fontWeight: '800', color: C.primary },
  holdsCountLabel: { fontSize: 11, color: C.secondary },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  confTitle: { fontSize: 12, color: C.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  confWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confTrack: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  confFill: { height: '100%', borderRadius: 3 },
  confLabel: { fontSize: 13, fontWeight: '700', minWidth: 36 },
  gymRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gymText: { fontSize: 13, color: C.secondary },
  notesCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  notesTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
  notesText: { fontSize: 14, color: C.secondary, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  primaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 9999, paddingVertical: 14 },
  primaryActionText: { fontSize: 13, fontWeight: '800', color: '#09090b', letterSpacing: 0.5 },
  secondaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.card, borderRadius: 9999, paddingVertical: 14, borderWidth: 1, borderColor: C.border },
  secondaryActionText: { fontSize: 13, fontWeight: '700', color: C.primary },
  noResult: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noResultText: { fontSize: 16, color: C.secondary },
  backBtn: { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  backBtnText: { color: C.primary, fontSize: 14 },
});
