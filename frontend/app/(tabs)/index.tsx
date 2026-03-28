import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchStats, fetchHistory } from '../../utils/api';
import { auth } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import DrawerMenu from '../../components/DrawerMenu';


const C = {
  bg: '#0f172a',
  card: '#1e293b',
  modal: '#334155',
  border: '#334155',
  primary: '#f8fafc',
  secondary: '#94a3b8',
  muted: '#64748b',
  accent: '#22d3ee',
  purple: '#a78bfa',
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
  const [allRoutes, setAllRoutes] = useState<RecentRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        fetchStats(),
        fetchHistory(),
      ]);
      setStats(statsData);
      setRecent((historyData.routes || []).slice(0, 3));
      setAllRoutes(historyData.routes || []);
    } catch {
      setStats({ total_routes: 0, best_grade: null, grades: {} });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Generate charting data via useMemo filtering the entire history timeline sequentially
  const chartData = useMemo(() => {
    if (!allRoutes || allRoutes.length === 0) return null;
    
    // Filter to only include routes from the last 14 days
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const recentRoutes = allRoutes.filter(r => new Date(r.analyzed_at) >= twoWeeksAgo);

    if (recentRoutes.length === 0) return null;

    // Reverse array to chronologically sort (oldest -> newest) based on timestamp
    const sorted = [...recentRoutes].sort((a, b) => 
      new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime()
    );
    
    const labels = sorted.map(r => {
      const d = new Date(r.analyzed_at);
      return d.getDate().toString();
    });

    const data = sorted.map(r => parseInt(r.grade.replace('V', ''), 10) || 0);

    return {
      labels: labels.length > 0 ? labels : [''],
      datasets: [
        {
          data: data.length > 0 ? data : [0],
          color: (opacity = 1) => `rgba(34, 211, 238, ${opacity})`,
          strokeWidth: 3
        }
      ]
    };
  }, [allRoutes]);

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
        <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setDrawerVisible(true)}>
              <Ionicons name="menu" size={22} color={C.primary} />
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>CLaiMB AI Coach</Text>
              <Text style={styles.numeUser}>
                {auth.currentUser?.email || 'Guest Climber'}
              </Text>
            </View>
          </View>

          {/* Partea dreaptă: Avatar + Buton Logout */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>

            {/* Buton Avatar (Apăsabil) */}
            <TouchableOpacity
              style={[styles.avatarWrap, { overflow: 'hidden' }]}
              onPress={() => router.push('/profile')}
            >
              {auth.currentUser?.photoURL ? (
                <Image
                  source={{ uri: auth.currentUser.photoURL }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {auth.currentUser?.email
                    ? auth.currentUser.email.charAt(0).toUpperCase()
                    : 'G'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => signOut(auth)}
              style={styles.logoutBtn}
            >
              <Ionicons name="log-out-outline" size={20} color={C.error} />
            </TouchableOpacity>
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
            color={C.purple}
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          testID="scan-route-btn"
          style={styles.ctaBtn}
          onPress={() => router.push('/(tabs)/camera')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#22d3ee', '#6366f1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.ctaBtnText}>SCAN A ROUTE</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Pose Analysis CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.push('/pose')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#a78bfa', '#f59e0b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Ionicons name="body-outline" size={22} color="#fff" />
            <Text style={styles.ctaBtnText}>ANALYZE CLIMBING POSE</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* AI Badge */}
        <View style={styles.aiBadge}>
          <View style={styles.aiBadgeDot} />
          <Text style={styles.aiBadgeText}>
            Google Gemini 3.1 · Hold Detection · V-Scale Grading
          </Text>
        </View>

        {/* Track your progress Graph */}
        {chartData && chartData.datasets[0].data.length > 0 && (
          <View style={styles.chartContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Track your progress!</Text>
            </View>
            <LineChart
              data={chartData}
              width={Dimensions.get('window').width - 40}
              height={180}
              yAxisLabel="V"
              yAxisSuffix=""
              fromZero={true}
              chartConfig={{
                backgroundColor: C.card,
                backgroundGradientFrom: C.card,
                backgroundGradientTo: C.card,
                decimalPlaces: 0, 
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "4",
                  strokeWidth: "2",
                  stroke: C.bg
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: C.border,
              }}
            />
          </View>
        )}

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
            { icon: 'camera', text: 'Photograph the climbing wall', color: C.accent },
            { icon: 'eye', text: 'AI detects holds & maps positions', color: C.purple },
            { icon: 'star', text: 'Receive V-scale grade + coach tips', color: C.success },
          ].map((item, i) => (
            <View key={i} style={styles.howRow}>
              <View style={[styles.howIconWrap, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
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
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
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
  hamburgerBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  greeting: { fontSize: 22, fontWeight: '800', color: C.primary, letterSpacing: -0.5 },
  numeUser: { fontSize: 14, color: C.secondary, marginTop: 4 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent + '22', borderWidth: 2, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: C.accent },
  logoutBtn: { padding: 8, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.border },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: C.secondary, textAlign: 'center' },
  ctaBtn: { marginBottom: 12, borderRadius: 9999, overflow: 'hidden' },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.purple + '18', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center', marginBottom: 28, borderWidth: 1, borderColor: C.purple + '30' },
  aiBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  aiBadgeText: { fontSize: 11, color: C.secondary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.primary },
  seeAll: { fontSize: 13, color: C.accent },
  chartContainer: { marginBottom: 24 },
  emptyCard: { backgroundColor: C.card, borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, marginBottom: 24, borderWidth: 1, borderColor: C.border },
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
  howCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.accent + '25' },
  howTitle: { fontSize: 14, fontWeight: '700', color: C.primary, marginBottom: 14 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  howIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  howText: { fontSize: 13, color: C.secondary, flex: 1 },
});