import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

const API = process.env.EXPO_PUBLIC_API_URL;

interface RecentClimb {
  route_id: string;
  gym_id: string;
  color: string;
  grade: string;
  style: string;
  points_awarded: number;
  date: string;
}

interface UserStats {
  user_id: string;
  total_ascents: number;
  total_points: number;
  recent_climbs: RecentClimb[];
}

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#475569',
  accent: '#22d3ee',
  error: '#ef4444',
};

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Cățărător';
  const email = user?.email || '—';

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const fetchStats = async () => {
        if (!user?.uid) { setLoading(false); return; }
        try {
          setLoading(true);
          setError(false);
          const res = await fetch(`${API}/community/users/${user.uid}/stats`);
          if (!res.ok) throw new Error('stats fetch failed');
          const data: UserStats = await res.json();
          if (active) setUserStats(data);
        } catch {
          if (active) setError(true);
        } finally {
          if (active) setLoading(false);
        }
      };
      fetchStats();
      return () => { active = false; };
    }, [user?.uid])
  );

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('@current_gym_id');
      await signOut(auth);
      router.replace('/');
    } catch (e) {
      Alert.alert('Eroare', 'Nu am putut face delogarea.');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.avatar}>
            <Ionicons name="person" size={44} color={C.accent} />
          </View>
          <Text style={s.name}>{displayName}</Text>
          <Text style={s.email}>{email}</Text>
        </View>

        {/* ── Stats Grid ─────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="flash" size={22} color="#facc15" />
            {loading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: 6 }} />
            ) : (
              <Text style={s.statValue}>
                {error ? '—' : (userStats?.total_points ?? 0).toLocaleString('ro-RO')}
              </Text>
            )}
            <Text style={s.statLabel}>Puncte Totale</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="trending-up" size={22} color="#22c55e" />
            {loading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: 6 }} />
            ) : (
              <Text style={s.statValue}>
                {error ? '—' : (userStats?.total_ascents ?? 0)}
              </Text>
            )}
            <Text style={s.statLabel}>Urcări</Text>
          </View>
        </View>

        {/* ── PRO Upsell Banner ──────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert(
              'Premium',
              'Aici se va deschide fluxul de plată Stripe/Apple Pay.',
            )
          }
        >
          <LinearGradient
            colors={['#2563eb', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.proBanner}
          >
            <View style={s.proIconWrap}>
              <Ionicons name="diamond" size={28} color="#fff" />
            </View>
            <Text style={s.proTitle}>Blocat la un traseu?</Text>
            <Text style={s.proSub}>
              Deblochează CLaiMB AI Coach. Filmează-ți urcarea și lasă
              inteligența artificială să-ți analizeze unghiurile, prizele și
              greșelile.
            </Text>
            <View style={s.proBtn}>
              <Text style={s.proBtnText}>🌟  Treci la PRO</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Ultimele Urcări ─────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ULTIMELE URCĂRI</Text>
          {loading ? (
            <ActivityIndicator color={C.accent} style={{ marginVertical: 16 }} />
          ) : !userStats?.recent_climbs?.length ? (
            <View style={s.infoCard}>
              <Text style={s.emptyText}>
                Nu ai logat niciun traseu încă. Mergi în Arenă și începe aventura!
              </Text>
            </View>
          ) : (
            <View style={s.infoCard}>
              {userStats.recent_climbs.map((climb, idx) => (
                <React.Fragment key={climb.route_id + idx}>
                  {idx > 0 && <View style={s.divider} />}
                  <View style={s.climbRow}>
                    <View style={[s.climbDot, { backgroundColor: climb.color.toLowerCase() }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.climbGrade}>{climb.grade}</Text>
                      <Text style={s.climbMeta}>{climb.style} · {climb.points_awarded} pts</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.dim} />
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* ── Account Info ───────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>CONT</Text>
          <View style={s.infoCard}>
            <InfoRow
              icon="finger-print-outline"
              label="User ID"
              value={user?.uid ? `${user.uid.substring(0, 12)}…` : '—'}
            />
            <View style={s.divider} />
            <InfoRow
              icon={user?.emailVerified ? 'shield-checkmark' : 'shield-outline'}
              iconColor={user?.emailVerified ? C.accent : C.dim}
              label="Status"
              value={user?.emailVerified ? 'Verificat' : 'Activ'}
            />
            <View style={s.divider} />
            <InfoRow
              icon="calendar-outline"
              label="Înregistrat"
              value={
                user?.metadata.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleDateString('ro-RO')
                  : '—'
              }
            />
          </View>
        </View>

        {/* ── Sign Out ───────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>SETĂRI</Text>
          <TouchableOpacity style={s.signOutCard} onPress={handleSignOut} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={20} color={C.error} />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Helper ────────────────────────────────────────────── */
function InfoRow({
  icon,
  label,
  value,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  iconColor?: string;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoLeft}>
        <Ionicons name={icon} size={16} color={iconColor ?? C.muted} />
        <Text style={s.infoLabel}>{label}</Text>
      </View>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

/* ── Styles ────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48 },

  /* Header */
  header: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.card, borderWidth: 2, borderColor: C.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  name: { color: C.text, fontSize: 24, fontWeight: '900' },
  email: { color: C.muted, fontSize: 14, fontWeight: '600', marginTop: 4 },

  /* Stats grid */
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 6,
  },
  statValue: { color: C.text, fontSize: 26, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 12, fontWeight: '700' },

  /* PRO banner */
  proBanner: {
    borderRadius: 20, padding: 28, marginBottom: 28,
    alignItems: 'center',
  },
  proIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  proTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  proSub: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500',
    textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 20,
    paddingHorizontal: 4,
  },
  proBtn: {
    backgroundColor: '#fff', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14,
  },
  proBtnText: { color: '#2563eb', fontSize: 16, fontWeight: '900' },

  /* Sections */
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, color: C.dim, fontWeight: '800', letterSpacing: 1.5,
    marginBottom: 10, marginLeft: 4,
  },

  /* Info card */
  infoCard: { backgroundColor: C.card, borderRadius: 16, padding: 18 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { color: C.muted, fontSize: 13, fontWeight: '600' },
  infoValue: { color: C.text, fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  /* Recent climbs */
  emptyText: {
    color: C.muted, fontSize: 14, fontWeight: '500',
    textAlign: 'center', lineHeight: 21, paddingVertical: 8,
  },
  climbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4,
  },
  climbDot: {
    width: 12, height: 12, borderRadius: 6,
  },
  climbGrade: { color: C.text, fontSize: 15, fontWeight: '800' },
  climbMeta: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },

  /* Sign out */
  signOutCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  signOutText: { color: C.error, fontSize: 16, fontWeight: '600' },
});
