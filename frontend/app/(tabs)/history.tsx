<<<<<<< HEAD
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { LineChart } from 'react-native-chart-kit';
import { fetchPoseHistory, deletePoseHistory, PoseRecord } from '../../utils/api';
=======
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchHistory, deleteHistory, updateHistoryStatus } from '../../utils/api';
import DrawerMenu from '../../components/DrawerMenu';
>>>>>>> main

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
  purple: '#a78bfa',
};

<<<<<<< HEAD
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
          data: sorted.map(r => r.final_overall_score),
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
=======
interface RouteRecord {
  id: string;
  gym_name: string;
  grade: string;
  analyzed_at: string;
  status: 'Project' | 'Sent' | 'Topped';
  notes?: string;
  analysis_id?: string;
}


export default function HistoryScreen() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
>>>>>>> main
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedGym, setSelectedGym] = useState<string | null>(null);
  const router = useRouter();

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

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      'Șterge Analiza',
      'Ești sigur că vrei să ștergi definitiv acest raport din istoric?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePoseHistory(id);
              setRecords(prev => prev.filter(item => item.id !== id));
            } catch {
              Alert.alert('Eroare', 'Nu am putut șterge analiza. Încearcă din nou.');
            }
          },
        },
<<<<<<< HEAD
      ]
    );
  }, []);
=======
      },
    ]);
  };

  const handleStatusChange = async (id: string, status: 'Project' | 'Sent' | 'Topped') => {
    try {
      await updateHistoryStatus(id, status);
      setRoutes(prev =>
        prev.map(route =>
          route.id === id ? { ...route, status } : route
        )
      );
    } catch {
      Alert.alert('Error', 'Could not update route status.');
    }
  };

  const gradeColor = (grade: string) => {
    const n = parseInt(grade.replace('V', ''));
    if (n <= 2) return C.success;
    if (n <= 5) return C.accent;
    if (n <= 7) return C.warning;
    return C.error;
  };

  const uniqueGyms = Array.from(new Set(routes.map(r => r.gym_name))).filter(Boolean);
  const filteredRoutes = selectedGym ? routes.filter(r => r.gym_name === selectedGym) : routes;
>>>>>>> main

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
<<<<<<< HEAD
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
            const overallColor = scoreColor(item.final_overall_score);

            return (
              <View style={styles.card} testID={`vault-card-${item.id}`}>
                {/* Delete button */}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={C.muted} />
                </TouchableOpacity>

                {/* Top row: ring + date */}
                <View style={styles.cardTop}>
                  <EfficiencyRing score={item.final_overall_score} />

                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>Analiza Video</Text>
                    <Text style={styles.dateText}>{formatDate(item.analyzed_at)}</Text>

                    {/* Metrics chips */}
                    <View style={styles.metrics}>
                      <View style={styles.chip}>
                        <Ionicons name="videocam-outline" size={11} color={C.muted} />
                        <Text style={styles.chipText}>{item.total_active_frames} cadre</Text>
                      </View>
                      <View style={[styles.chip, { borderColor: overallColor + '44' }]}>
                        <Ionicons name="fitness-outline" size={11} color={overallColor} />
                        <Text style={[styles.chipText, { color: overallColor }]}>
                          {item.frames_with_straight_arms}/{item.total_active_frames} eficiente
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Sub-score indicators */}
                <View style={styles.subScoreRow}>
                  <Text style={[styles.subScoreItem, { color: scoreColor(item.efficiency_score) }]}>
                    B: {item.efficiency_score}%
                  </Text>
                  <Text style={styles.subScoreSep}>|</Text>
                  <Text style={[styles.subScoreItem, { color: scoreColor(item.balance_score) }]}>
                    E: {item.balance_score}%
                  </Text>
                  <Text style={styles.subScoreSep}>|</Text>
                  <Text style={[styles.subScoreItem, { color: scoreColor(item.fluidity_score) }]}>
                    F: {item.fluidity_score}%
                  </Text>
                </View>

                {/* Consolidated feedback */}
                {item.consolidated_feedback ? (
                  <View style={styles.feedbackWrap}>
                    <Ionicons name="sparkles" size={13} color={C.accent} />
                    <Text style={styles.feedbackText} numberOfLines={4}>
                      {item.consolidated_feedback}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
=======
    <SafeAreaView style={styles.container}>
      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border }} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={20} color={C.primary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, styles.neonText]}>CLIMB LOG</Text>
            <Text style={styles.subtitle}>{routes.length} sessions analyzed</Text>
          </View>
        </View>
      </View>

      {uniqueGyms.length > 0 && (
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[null, ...uniqueGyms]}
            keyExtractor={(item) => item || 'all'}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterBtn, selectedGym === item && styles.filterBtnActive]}
                onPress={() => setSelectedGym(item)}
              >
                <Text style={[styles.filterBtnText, selectedGym === item && styles.filterBtnTextActive]}>
                  {item || 'All Gyms'}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.filterList}
          />
        </View>
>>>>>>> main
      )}

<<<<<<< HEAD
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

  /* Sub-scores */
  subScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    backgroundColor: C.cardHighlight,
    borderRadius: 10,
  },
  subScoreItem: {
    fontSize: 12,
    fontWeight: '700',
  },
  subScoreSep: {
    fontSize: 12,
    color: C.muted,
  },

  /* Delete button */
  deleteBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
    borderRadius: 8,
  },

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
=======
      <FlatList
        data={filteredRoutes}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/result', params: { id: item.analysis_id || item.id } })}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.gradeCircle, { borderColor: gradeColor(item.grade) }]}>
                <Text style={[styles.gradeText, { color: gradeColor(item.grade) }]}>{item.grade}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gymName}>{item.gym_name}</Text>
                <Text style={styles.date}>{new Date(item.analyzed_at).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={18} color={C.error} />
              </TouchableOpacity>
            </View>

            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={styles.statusRow}>
                {(['Project', 'Sent', 'Topped'] as const).map(statusOption => {
                  const isActive = item.status === statusOption;
                  return (
                    <TouchableOpacity
                      key={statusOption}
                      style={[styles.statusBtn, isActive && styles.statusBtnActive]}
                      onPress={() => handleStatusChange(item.id, statusOption)}
                    >
                      <Text style={[styles.statusBtnText, isActive && styles.statusBtnTextActive]}>
                        {statusOption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {item.notes ? (
              <View style={styles.notesWrap}>
                <Ionicons name="chatbubble-outline" size={12} color={C.muted} />
                <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { padding: 24, paddingBottom: 12 },
  filterContainer: { marginBottom: 12 },
  filterList: { paddingHorizontal: 24, gap: 10 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  filterBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterBtnText: { color: C.secondary, fontSize: 13, fontWeight: '700' },
  filterBtnTextActive: { color: '#000' },
  title: { fontSize: 32, fontWeight: '900', color: C.primary },
  neonText: { textShadowColor: 'rgba(34, 211, 238, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  subtitle: { fontSize: 14, color: C.secondary, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  gradeCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.accent,
  },
  gradeText: { color: C.accent, fontWeight: '900', fontSize: 18 },
  gymName: { color: C.primary, fontWeight: '700', fontSize: 16 },
  date: { color: C.secondary, fontSize: 12, marginTop: 2 },
  statusSection: { marginBottom: 10 },
  statusLabel: { fontSize: 12, color: C.secondary, marginBottom: 6, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: C.border, borderWidth: 1, borderColor: C.border,
  },
  statusBtnActive: { backgroundColor: 'rgba(34,211,238,0.14)', borderColor: C.accent },
  statusBtnText: { fontSize: 12, color: C.secondary, fontWeight: '600' },
  statusBtnTextActive: { color: C.accent },
  notesWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  notes: { fontSize: 12, color: C.muted, flex: 1 },
});
>>>>>>> main
