import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { auth } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchPoseHistory, PoseRecord } from '../../utils/api';

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

interface GymNews {
  id: string;
  title: string;
  content: string;
  date: string;
  emoji?: string;
}

function CommunityFeedScreen() {
  const router = useRouter();
  const [gymId, setGymId] = useState<string | null>(null);
  const [gym, setGym] = useState<GymDetail | null>(null);
  const [gymNews, setGymNews] = useState<GymNews[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
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

        // Încarcă știrile sălii
        setNewsLoading(true);
        try {
          const newsRes = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/community/gyms/${storedId}/news`);
          if (newsRes.ok) {
            const newsData: GymNews[] = await newsRes.json();
            setGymNews(newsData);
          }
        } catch { /* știrile sunt opționale */ } finally {
          setNewsLoading(false);
        }
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
    setGymNews([]);
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

        {newsLoading ? (
          <ActivityIndicator color={accent} style={{ marginVertical: 16 }} />
        ) : gymNews.length === 0 ? (
          <View style={commStyles.newsCard}>
            <Text style={commStyles.newsEmoji}>📢</Text>
            <View style={{ flex: 1 }}>
              <Text style={commStyles.newsText}>Nicio noutate momentan.</Text>
            </View>
          </View>
        ) : (
          gymNews.map((item) => (
            <View key={item.id} style={[commStyles.newsCard, { borderColor: accent + '40' }]}>
              <Text style={commStyles.newsEmoji}>{item.emoji || '📢'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[commStyles.newsTitle, { color: accent }]}>{item.title}</Text>
                <Text style={commStyles.newsText}>{item.content}</Text>
                <Text style={commStyles.newsTime}>{item.date}</Text>
              </View>
            </View>
          ))
        )}

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
  newsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
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
  return variant === 'community' ? <CommunityFeedScreen /> : <CoachDashboard />;
}

/* ── Coach palette extension ─────────────────────────────── */
const K = {
  bg: '#0d0d12',
  card: '#18181b',
  cardBorder: '#27272a',
  primary: '#f0f0f5',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#a855f7',
  accentDim: 'rgba(168,85,247,0.12)',
  accentBorder: 'rgba(168,85,247,0.30)',
  neon: '#39ff14',
  neonDim: 'rgba(57,255,20,0.12)',
  neonBorder: 'rgba(57,255,20,0.30)',
  green: '#22c55e',
  ctaRed: '#ef4444',
};

/* ── Helper: today's date formatted ──────────────────────── */
const todayFormatted = () => {
  const d = new Date();
  return d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
};

/* ── Helper: relative time ───────────────────────────────── */
const timeAgo = (dateStr: string) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'chiar acum';
  if (diffMin < 60) return `acum ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `acum ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `acum ${diffD}z`;
};

/* ── CoachDashboard ──────────────────────────────────────── */
function CoachDashboard() {
  const router = useRouter();
  const userEmail = auth.currentUser?.email;
  const userName = userEmail ? userEmail.split('@')[0] : null;

  const [totalSessions, setTotalSessions] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Breathing animation for CTA ──
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // ── Fetch pose history on every focus ──
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        try {
          setLoading(true);
          const data = await fetchPoseHistory();
          if (cancelled) return;

          const records: PoseRecord[] = data.records || [];
          setTotalSessions(records.length);

          if (records.length > 0) {
            // Sort descending by analyzed_at
            const sorted = [...records].sort(
              (a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime()
            );
            setLastAnalysis(sorted[0].analyzed_at);

            // Average of final_overall_score from last 5 sessions
            const last5 = sorted.slice(0, 5);
            const avg = last5.reduce((sum, r) => sum + (r.final_overall_score ?? r.efficiency_score ?? 0), 0) / last5.length;
            setAverageScore(Math.round(avg));
          } else {
            setAverageScore(0);
            setLastAnalysis(null);
          }
        } catch (err) {
          console.error('Dashboard fetch error:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      load();
      return () => { cancelled = true; };
    }, [])
  );

  // ── Score color ──
  const scoreColor = averageScore >= 70 ? K.neon : averageScore >= 40 ? '#fbbf24' : K.ctaRed;

  // ── AI Insight text ──
  const insightText =
    averageScore === 0 && totalSessions === 0
      ? 'Nu ai nicio sesiune înregistrată. Lansează prima ta analiză video și descoperă-ți potențialul!'
      : averageScore < 60
        ? 'AI Insight: Scorurile tale recente indică ezitări. Focusează-te azi pe Quiet Feet și echilibru.'
        : 'AI Insight: Ritmul tău este bun! Încearcă rute cu mișcări mai dinamice azi.';

  return (
    <SafeAreaView style={coachStyles.container}>
      <ScrollView
        contentContainerStyle={coachStyles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header & Greeting ────────────────────────── */}
        <View style={coachStyles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={coachStyles.greeting}>
              Salut, Cățărătorule! 🧗‍♂️
            </Text>
            <Text style={coachStyles.dateLine}>
              {todayFormatted()} — Hai să urcăm!
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={coachStyles.avatar}>
              <Text style={coachStyles.avatarLetter}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : 'G'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => signOut(auth)}
              style={coachStyles.logoutBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="log-out-outline" size={20} color={K.ctaRed} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Quick Stats Row ──────────────────────────── */}
        <View style={coachStyles.statsRow}>
          <LinearGradient
            colors={['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.04)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={coachStyles.statCard}
          >
            <Ionicons name="barbell-outline" size={22} color={K.accent} />
            <Text style={coachStyles.statValue}>
              {loading ? '—' : totalSessions}
            </Text>
            <Text style={coachStyles.statLabel}>Sesiuni Totale</Text>
          </LinearGradient>

          <LinearGradient
            colors={['rgba(57,255,20,0.12)', 'rgba(57,255,20,0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={coachStyles.statCard}
          >
            <Ionicons name="time-outline" size={22} color={K.neon} />
            <Text style={[coachStyles.statValue, { color: K.neon }]}>
              {loading ? '—' : lastAnalysis ? timeAgo(lastAnalysis) : 'N/A'}
            </Text>
            <Text style={coachStyles.statLabel}>Ultima Analiză</Text>
          </LinearGradient>
        </View>

        {/* ── Scorul Tău (Main Progress Bar) ───────────── */}
        <View style={coachStyles.progressCard}>
          <View style={coachStyles.progressHeader}>
            <Ionicons name="analytics-outline" size={20} color={K.accent} />
            <Text style={coachStyles.progressTitle}>Scorul Tău</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={K.accent} size="large" style={{ marginVertical: 24 }} />
          ) : (
            <>
              <Text style={[coachStyles.scoreBig, { color: scoreColor }]}>
                {averageScore}%
              </Text>

              <View style={coachStyles.barTrack}>
                <LinearGradient
                  colors={[K.accent, K.neon]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    coachStyles.barFill,
                    { width: `${Math.min(averageScore, 100)}%` },
                  ]}
                />
              </View>

              <Text style={coachStyles.progressHint}>
                Eficiența ta medie (ultimele 5 urcări)
              </Text>
            </>
          )}
        </View>

        {/* ── Dynamic AI Insight ───────────────────────── */}
        <LinearGradient
          colors={['rgba(168,85,247,0.18)', 'rgba(57,255,20,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={coachStyles.insightCard}
        >
          <View style={coachStyles.insightHeader}>
            <Ionicons name="sparkles" size={20} color={K.neon} />
            <Text style={coachStyles.insightBadge}>AI Insight</Text>
          </View>
          <Text style={coachStyles.insightText}>{insightText}</Text>
        </LinearGradient>

        {/* ── Breathing CTA Button ─────────────────────── */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={coachStyles.ctaBtn}
            onPress={() => router.push('/(tabs)/camera')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[K.accent, K.neon]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={coachStyles.ctaGradient}
            >
              <Ionicons name="videocam" size={22} color="#fff" />
              <Text style={coachStyles.ctaText}>Lansează Analiza Video</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── AI Model Badge ───────────────────────────── */}
        <View style={coachStyles.aiBadge}>
          <View style={coachStyles.aiBadgeDot} />
          <Text style={coachStyles.aiBadgeText}>
            YOLO11 Pose · Gemini AI · Real-time Feedback
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Coach Styles ─────────────────────────────────────────── */
const coachStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.bg,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  greeting: {
    color: K.primary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  dateLine: {
    color: K.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: K.accentDim,
    borderWidth: 2,
    borderColor: K.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: K.accent,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: K.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: K.cardBorder,
  },

  /* Quick Stats Row */
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: K.cardBorder,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: K.accent,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  statLabel: {
    color: K.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* AI Insight Card */
  insightCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: K.accentBorder,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#a855f7',
        shadowOpacity: 0.15,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightBadge: {
    color: K.neon,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  insightText: {
    color: K.primary,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  /* Progress Card */
  progressCard: {
    backgroundColor: K.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: K.cardBorder,
    padding: 20,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressTitle: {
    color: K.secondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  scoreBig: {
    fontSize: 56,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 62,
    marginBottom: 14,
  },
  barTrack: {
    width: '100%',
    height: 12,
    backgroundColor: K.cardBorder,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressHint: {
    color: K.muted,
    fontSize: 12,
    textAlign: 'center',
  },

  /* CTA Button */
  ctaBtn: {
    marginBottom: 16,
    borderRadius: 9999,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#a855f7',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 12 },
    }),
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 9999,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* AI Badge */
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: K.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'center',
  },
  aiBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: K.neon,
  },
  aiBadgeText: {
    fontSize: 11,
    color: K.secondary,
  },
});
