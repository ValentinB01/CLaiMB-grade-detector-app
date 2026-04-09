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
<<<<<<< Updated upstream
=======
import DrawerMenu from '../../components/DrawerMenu';
import AsyncStorage from '@react-native-async-storage/async-storage';

>>>>>>> Stashed changes

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

interface GymDetail {
  gym_id: string;
  name: string;
  primary_color?: string;
  address?: string;
}

const DUMMY_NEWS = [
  { id: '1', emoji: '🧗', text: 'S-au montat 5 trasee noi galbene pe panoul principal!', time: 'Acum 2 ore' },
  { id: '2', emoji: '🏆', text: 'Competiție internă Sâmbătă, 12 Aprilie — înscrie-te acum!', time: 'Ieri' },
];

function CommunityFeedScreen() {
  const router = useRouter();
  const [gymId, setGymId] = useState<string | null>(null);
  const [gym, setGym] = useState<GymDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGym = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const storedId = await AsyncStorage.getItem('@current_gym_id');
      setGymId(storedId);
      if (storedId) {
        const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/community/gyms/${storedId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GymDetail = await res.json();
        setGym(data);
      }
    } catch {
      setError('Nu s-au putut încărca datele sălii.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadGym(); }, [loadGym]));

  const handleLeaveGym = async () => {
    await AsyncStorage.removeItem('@current_gym_id');
    setGymId(null);
    setGym(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={commStyles.container}>
        <ActivityIndicator color={C.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!gymId) {
    return (
      <SafeAreaView style={commStyles.container}>
        <View style={commStyles.welcomeWrap}>
          <Text style={commStyles.welcomeEmoji}>🧗</Text>
          <Text style={commStyles.welcomeTitle}>Bun venit în CLaiMB!</Text>
          <Text style={commStyles.welcomeSub}>
            Scanează codul QR de la recepția sălii tale pentru a debloca feed-ul și clasamentele locale.
          </Text>
          <View style={commStyles.arrowHint}>
            <Text style={commStyles.arrowHintText}>Apasă butonul central</Text>
            <Ionicons name="arrow-down-circle" size={36} color={C.accent} style={{ marginTop: 10 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const accent = gym?.primary_color || C.accent;

  return (
    <SafeAreaView style={commStyles.container}>
      <View style={commStyles.gymHeader}>
        <View style={{ flex: 1 }}>
          <Text style={commStyles.gymHeaderLabel}>📍 SALA CURENTĂ</Text>
          <Text style={commStyles.gymHeaderName} numberOfLines={1}>{gym?.name ?? '...'}</Text>
        </View>
        <TouchableOpacity style={commStyles.leaveBtn} onPress={handleLeaveGym} activeOpacity={0.75}>
          <Ionicons name="exit-outline" size={15} color="#f87171" />
          <Text style={commStyles.leaveBtnText}>Leave</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={commStyles.scroll} showsVerticalScrollIndicator={false}>
        {error && (
          <View style={commStyles.errorBanner}>
            <Text style={commStyles.errorText}>{error}</Text>
          </View>
        )}

        <LinearGradient
          colors={[accent + '30', accent + '08']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[commStyles.wbCard, { borderColor: accent + '55' }]}
        >
          <Text style={commStyles.wbGreeting}>👋 Bun venit înapoi!</Text>
          <Text style={[commStyles.wbGymName, { color: accent }]} numberOfLines={1}>
            {gym?.name}
          </Text>
          {gym?.address && (
            <Text style={commStyles.wbAddress} numberOfLines={1}>📍 {gym.address}</Text>
          )}
        </LinearGradient>

        <View style={commStyles.sectionHeader}>
          <Text style={commStyles.sectionTitle}>🗞 Noutăți din sală</Text>
        </View>

        {DUMMY_NEWS.map((item) => (
          <View key={item.id} style={commStyles.newsCard}>
            <Text style={commStyles.newsEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={commStyles.newsText}>{item.text}</Text>
              <Text style={commStyles.newsTime}>{item.time}</Text>
            </View>
          </View>
        ))}

        <View style={commStyles.sectionHeader}>
          <Text style={commStyles.sectionTitle}>⚡ Acțiuni rapide</Text>
        </View>
        <View style={commStyles.quickRow}>
          <TouchableOpacity style={commStyles.quickCard} onPress={() => router.navigate('/arena' as any)} activeOpacity={0.8}>
            <Ionicons name="trophy-outline" size={26} color="#fbbf24" />
            <Text style={commStyles.quickLabel}>Clasament</Text>
          </TouchableOpacity>
          <TouchableOpacity style={commStyles.quickCard} onPress={() => router.navigate('/explore' as any)} activeOpacity={0.8}>
            <Ionicons name="compass-outline" size={26} color={C.accent} />
            <Text style={commStyles.quickLabel}>Explorează</Text>
          </TouchableOpacity>
          <TouchableOpacity style={commStyles.quickCard} onPress={() => router.navigate('/scan' as any)} activeOpacity={0.8}>
            <Ionicons name="qr-code-outline" size={26} color="#a78bfa" />
            <Text style={commStyles.quickLabel}>Check-in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const commStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  welcomeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  welcomeEmoji: { fontSize: 72 },
  welcomeTitle: { fontSize: 26, fontWeight: '900', color: C.primary, textAlign: 'center', letterSpacing: -0.5 },
  welcomeSub: { fontSize: 15, color: C.secondary, textAlign: 'center', lineHeight: 23 },
  arrowHint: { alignItems: 'center', marginTop: 16, gap: 4 },
  arrowHintText: { color: C.accent, fontWeight: '700', fontSize: 14 },
  gymHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  gymHeaderLabel: { color: C.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  gymHeaderName: { color: C.primary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  leaveBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { color: '#f87171', fontSize: 13, textAlign: 'center' },
  wbCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 24 },
  wbGreeting: { color: C.secondary, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  wbGymName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  wbAddress: { color: C.secondary, fontSize: 13 },
  sectionHeader: { marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
  newsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  newsEmoji: { fontSize: 22 },
  newsText: { color: C.primary, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  newsTime: { color: C.muted, fontSize: 12, marginTop: 4 },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  quickLabel: { color: C.secondary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

export default function HomeScreen() {
  const variant = process.env.EXPO_PUBLIC_VARIANT || 'coach';
  return variant === 'community' ? <CommunityFeedScreen /> : <CoachHomeScreen />;
}

function CoachHomeScreen() {
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
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>ClAImb AI Coach</Text>
            <Text style={styles.numeUser}>
              {auth.currentUser?.email || 'Guest Climber'}
            </Text>
          </View>
          
          {/* Partea dreaptă: Avatar + Buton Logout */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {auth.currentUser?.email 
                  ? auth.currentUser.email.charAt(0).toUpperCase() 
                  : 'G'}
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => signOut(auth)}
              style={{ padding: 8, backgroundColor: C.card, borderRadius: 8, borderWidth: 1, borderColor: C.border }}
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
            Google Gemini 3.1 · Hold Detection · V-Scale Grading
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
