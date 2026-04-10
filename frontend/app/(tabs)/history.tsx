import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { LineChart } from 'react-native-chart-kit';
import { fetchPoseHistory, PoseRecord } from '../../utils/api';

const C = {
  bg: '#09090b',
  card: '#18181b',
  cardHighlight: '#1e1e24',
  border: '#27272a',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#a855f7',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#ef4444',
};

const RING_SIZE = 64;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function scoreColor(score: number): string {
  if (score >= 80) return C.success;
  if (score >= 50) return C.warning;
  return C.error;
}

function EfficiencyRing({ score }: { score: number }) {
  const color = scoreColor(score);
  const progress = Math.min(score, 100) / 100;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={C.border}
          strokeWidth={RING_STROKE}
          fill="transparent"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={color}
          strokeWidth={RING_STROKE}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={[styles.ringScore, { color }]}>{score}%</Text>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 64;

function EvolutionChart({ records }: { records: PoseRecord[] }) {
  const chartData = useMemo(() => {
    const sorted = [...records]
      .sort((a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime())
      .slice(-7);

    return {
      labels: sorted.map(r => formatShortDate(r.analyzed_at)),
      datasets: [
        {
          data: sorted.map(r => r.efficiency_score),
          strokeWidth: 2.5,
        },
      ],
    };
  }, [records]);

  if (records.length < 2) {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Evolutia Tehnicii (%)</Text>
        <View style={styles.chartFallback}>
          <Ionicons name="analytics-outline" size={28} color={C.muted} />
          <Text style={styles.chartFallbackText}>
            Mai ai nevoie de inca o analiza pentru a vedea graficul de progres.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Evolutia Tehnicii (%)</Text>
      <LineChart
        data={chartData}
        width={CHART_WIDTH}
        height={180}
        yAxisSuffix="%"
        fromZero
        yAxisInterval={1}
        withDots
        bezier
        chartConfig={{
          backgroundGradientFrom: '#121212',
          backgroundGradientTo: '#121212',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
          labelColor: () => C.secondary,
          propsForDots: {
            r: '5',
            strokeWidth: '2',
            stroke: C.accent,
          },
          propsForBackgroundLines: {
            stroke: C.border,
            strokeDasharray: '4,4',
          },
          style: { borderRadius: 12 },
        }}
        style={{ borderRadius: 12 }}
      />
    </View>
  );
}

export default function VaultScreen() {
  const [records, setRecords] = useState<PoseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPoseHistory();
      setRecords(data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="vault-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="lock-closed" size={22} color={C.accent} />
          <Text style={styles.title}>The Vault</Text>
        </View>
        <Text style={styles.subtitle}>
          {records.length > 0
            ? `${records.length} analiz${records.length !== 1 ? 'e' : 'a'} video`
            : 'Progresul tau, pastrat in siguranta'}
        </Text>
      </View>

      {records.length === 0 ? (
        /* ── Empty State ── */
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="folder-open-outline" size={56} color={C.muted} />
          </View>
          <Text style={styles.emptyTitle}>Seiful este gol</Text>
          <Text style={styles.emptySub}>
            Mergi in sectiunea Analyze pentru a rula prima ta analiza de postura!
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<EvolutionChart records={records} />}
          renderItem={({ item }) => {
            const color = scoreColor(item.efficiency_score);

            return (
              <View style={styles.card} testID={`vault-card-${item.id}`}>
                {/* Top row: ring + date */}
                <View style={styles.cardTop}>
                  <EfficiencyRing score={item.efficiency_score} />

                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>Analiza Video</Text>
                    <Text style={styles.dateText}>{formatDate(item.analyzed_at)}</Text>

                    {/* Metrics chips */}
                    <View style={styles.metrics}>
                      <View style={styles.chip}>
                        <Ionicons name="videocam-outline" size={11} color={C.muted} />
                        <Text style={styles.chipText}>{item.total_active_frames} cadre</Text>
                      </View>
                      <View style={[styles.chip, { borderColor: color + '44' }]}>
                        <Ionicons name="fitness-outline" size={11} color={color} />
                        <Text style={[styles.chipText, { color }]}>
                          {item.frames_with_straight_arms}/{item.total_active_frames} eficiente
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Feedback preview */}
                {item.feedback ? (
                  <View style={styles.feedbackWrap}>
                    <Ionicons name="sparkles" size={13} color={C.accent} />
                    <Text style={styles.feedbackText} numberOfLines={3}>
                      {item.feedback}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: C.primary, letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: C.secondary, marginTop: 4, marginLeft: 30 },

  /* List */
  list: { padding: 16, gap: 14 },

  /* Card */
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.primary },
  dateText: { fontSize: 12, color: C.secondary, marginTop: 2 },

  /* Metrics */
  metrics: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.border + '88',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: { fontSize: 11, color: C.muted },

  /* Ring */
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontSize: 15, fontWeight: '800' },

  /* Feedback */
  feedbackWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    backgroundColor: C.cardHighlight,
    padding: 12,
    borderRadius: 12,
  },
  feedbackText: { fontSize: 12, color: C.secondary, lineHeight: 18, flex: 1 },

  /* Chart */
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.primary,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  chartFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  chartFallbackText: {
    fontSize: 13,
    color: C.muted,
    flex: 1,
    lineHeight: 18,
  },

  /* Empty state */
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.secondary },
  emptySub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
});
