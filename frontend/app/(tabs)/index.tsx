import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchStats, fetchHistory } from '../../utils/api';
import { auth } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';

const C = {
  bg: '#09090b',
  card: '#18181b',
  modal: '#27272a',
  border: '#27272a',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#22d3ee',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#ef4444',
};

interface Stats {
  total_routes: number;
  best_grade: string | null;
  grades: Record<string, number>;
}

interface RecentRoute {
  id: string;
  gym_name: string;
  grade: string;
  holds_count: number;
  analyzed_at: string;
  confidence: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        fetchStats(),
        fetchHistory(),
      ]);
      setStats(statsData);
      setRecent((historyData.routes || []).slice(0, 3));
    } catch {
      setStats({ total_routes: 0, best_grade: null, grades: {} });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const gradeColor = (grade: string) => {
    const n = parseInt(grade.replace('V', ''));
    if (n <= 2) return C.success;
    if (n <= 5) return C.accent;
    if (n <= 7) return C.warning;
    return C.error;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return '—'; }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* Header */}
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>ClAImb AI Coach</Text>
            <Text style={styles.subGreeting}>
              {auth.currentUser?.email || 'Guest Climber'}
            </Text>
          </View>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {auth.currentUser?.email 
                ? auth.currentUser.email.charAt(0).toUpperCase() 
                : 'G'}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Total Routes"
            value={String(stats?.total_routes ?? 0)}
            icon="analytics"
            color={C.accent}
          />
          <StatCard
            label="Best Grade"
            value={stats?.best_grade ?? '—'}
            icon="trophy"
            color={C.warning}
          />
          <StatCard
            label="AI Model"
            value="4-6"
            icon="flash"
            color={C.success}
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          testID="scan-route-btn"
          style={styles.ctaBtn}
          onPress={() => router.push('/(tabs)/camera')}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={22} color="#09090b" />
          <Text style={styles.ctaBtnText}>SCAN A ROUTE</Text>
          <Ionicons name="arrow-forward" size={18} color="#09090b" />
        </TouchableOpacity>

        {/* AI Badge */}
        <View style={styles.aiBadge}>
          <View style={styles.aiBadgeDot} />
          <Text style={styles.aiBadgeText}>
            Claude Sonnet 4-6 · Hold Detection · V-Scale Grading
          </Text>
        </View>

        {/* Recent Climbs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Climbs</Text>
          {recent.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')} testID="see-all-btn">
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          )}
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="camera-outline" size={36} color={C.muted} />
            <Text style={styles.emptyTitle}>No climbs yet</Text>
            <Text style={styles.emptySubtitle}>Tap "Scan a Route" to analyze your first climb</Text>
          </View>
        ) : (
          recent.map((route) => (
            <View key={route.id} style={styles.routeCard} testID={`recent-route-${route.id}`}>
              <View style={styles.routeLeft}>
                <View style={[styles.gradeBadge, { backgroundColor: gradeColor(route.grade) + '22', borderColor: gradeColor(route.grade) }]}>
                  <Text style={[styles.gradeText, { color: gradeColor(route.grade) }]}>{route.grade}</Text>
                </View>
                <View style={styles.routeInfo}>
                  <Text style={styles.gymName} numberOfLines={1}>{route.gym_name}</Text>
                  <Text style={styles.routeMeta}>
                    {route.holds_count} holds · {Math.round(route.confidence * 100)}% confidence
                  </Text>
                </View>
              </View>
              <Text style={styles.routeDate}>{formatDate(route.analyzed_at)}</Text>
            </View>
          ))
        )}

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            { icon: 'camera', text: 'Photograph the climbing wall' },
            { icon: 'eye', text: 'AI detects holds & maps positions' },
            { icon: 'star', text: 'Receive V-scale grade + coach tips' },
          ].map((item, i) => (
            <View key={i} style={styles.howRow}>
              <View style={styles.howIconWrap}>
                <Ionicons name={item.icon as any} size={16} color={C.accent} />
              </View>
              <Text style={styles.howText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '33' }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
  numeUser: {fontSize: 14, color: C.secondary, marginTop:4},
  subGreeting: { fontSize: 14, color: C.secondary, marginTop: 2 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent + '22', borderWidth: 2, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: C.accent },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: C.secondary, textAlign: 'center' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: 9999, paddingVertical: 16, marginBottom: 12 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#09090b', letterSpacing: 1 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center', marginBottom: 28 },
  aiBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  aiBadgeText: { fontSize: 11, color: C.secondary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.primary },
  seeAll: { fontSize: 13, color: C.accent },
  emptyCard: { backgroundColor: C.card, borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, marginBottom: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.secondary },
  emptySubtitle: { fontSize: 13, color: C.muted, textAlign: 'center' },
  routeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  routeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  gradeBadge: { width: 52, height: 52, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gradeText: { fontSize: 16, fontWeight: '800' },
  routeInfo: { flex: 1 },
  gymName: { fontSize: 14, fontWeight: '600', color: C.primary },
  routeMeta: { fontSize: 12, color: C.secondary, marginTop: 2 },
  routeDate: { fontSize: 12, color: C.muted },
  howCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  howTitle: { fontSize: 14, fontWeight: '700', color: C.primary, marginBottom: 14 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  howIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.accent + '15', alignItems: 'center', justifyContent: 'center' },
  howText: { fontSize: 13, color: C.secondary, flex: 1 },
});
