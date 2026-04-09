import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';

const API = process.env.EXPO_PUBLIC_API_URL;
const { width: W } = Dimensions.get('window');

/* ── Types ──────────────────────────────────────────── */
interface Route {
  route_id: string;
  gym_id: string;
  color: string;
  grade: string;
  points: number;
}

interface LeaderEntry {
  rank: number;
  user_id: string;
  name: string;
  points: number;
  gym_name?: string;
}

type LbScope = 'local' | 'global';

type Tab = 'leaderboard' | 'routes';

/* ── Color map for hold-color dots ──────────────────── */
const HOLD_COLORS: Record<string, string> = {
  roșu: '#ef4444',
  rosu: '#ef4444',
  red: '#ef4444',
  albastru: '#3b82f6',
  blue: '#3b82f6',
  verde: '#22c55e',
  green: '#22c55e',
  galben: '#eab308',
  yellow: '#eab308',
  portocaliu: '#f97316',
  orange: '#f97316',
  roz: '#ec4899',
  pink: '#ec4899',
  alb: '#f1f5f9',
  white: '#f1f5f9',
  negru: '#334155',
  black: '#334155',
  mov: '#a855f7',
  purple: '#a855f7',
};

const resolveHoldColor = (c: string) =>
  HOLD_COLORS[c.toLowerCase().trim()] ?? '#64748b';

/* ── Ascent style options ───────────────────────────── */
const STYLES = [
  { key: 'Flash', label: '⚡ Flash', desc: '+50 pct bonus', accent: '#facc15' },
  { key: 'Redpoint', label: '🔴 Redpoint', desc: 'Punctaj standard', accent: '#ef4444' },
  { key: 'Zone', label: '🟡 Zone', desc: '½ puncte', accent: '#f97316' },
  { key: 'Attempt', label: '💨 Attempt', desc: '0 pct', accent: '#64748b' },
] as const;

/* ── Podium medal colors ────────────────────────────── */
const MEDAL: Record<number, { icon: string; color: string }> = {
  1: { icon: 'trophy', color: '#facc15' },
  2: { icon: 'trophy-outline', color: '#cbd5e1' },
  3: { icon: 'trophy-outline', color: '#d97706' },
};

/* ================================================================ */
export default function ArenaScreen() {
  const [gymId, setGymId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');

  // Routes
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const [lbScope, setLbScope] = useState<LbScope>('local');

  // Ascent modal
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ── Load gym id on focus ─────────────────────────── */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const id = await AsyncStorage.getItem('@current_gym_id');
        if (active) {
          setGymId(id);
          if (id) {
            fetchRoutes(id);
            fetchLeaderboard(id);
          }
        }
      })();
      return () => { active = false; };
    }, []),
  );

  /* ── Fetch helpers ────────────────────────────────── */
  const fetchRoutes = async (gid: string) => {
    setRoutesLoading(true);
    setRoutesError(null);
    try {
      const res = await fetch(`${API}/community/gyms/${gid}/routes`);
      if (!res.ok) throw new Error(`${res.status}`);
      setRoutes(await res.json());
    } catch (e: any) {
      setRoutesError('Nu am putut încărca traseele.');
    } finally {
      setRoutesLoading(false);
    }
  };

  const fetchLeaderboard = async (gid: string, scope: LbScope = 'local') => {
    setLbLoading(true);
    setLbError(null);
    try {
      const url = scope === 'global'
        ? `${API}/community/leaderboard/global`
        : `${API}/community/gyms/${gid}/leaderboard`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      setLeaderboard(await res.json());
    } catch (e: any) {
      setLbError('Nu am putut încărca clasamentul.');
    } finally {
      setLbLoading(false);
    }
  };

  const switchScope = (scope: LbScope) => {
    if (scope === lbScope) return;
    setLbScope(scope);
    if (gymId) fetchLeaderboard(gymId, scope);
  };

  /* ── Log ascent ───────────────────────────────────── */
  const logAscent = async (style: string) => {
    if (!selectedRoute || !gymId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/community/ascents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: auth.currentUser?.uid ?? 'anonymous',
          gym_id: gymId,
          route_id: selectedRoute.route_id,
          style,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setSelectedRoute(null);
      Alert.alert('✅ Urcarea a fost înregistrată!', `Stil: ${style}`);
      fetchLeaderboard(gymId, lbScope);
    } catch {
      Alert.alert('Eroare', 'Nu am putut salva urcarea. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── No gym selected ──────────────────────────────── */
  if (gymId === null) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="qr-code-outline" size={48} color="#475569" />
          </View>
          <Text style={s.emptyTitle}>Nu ești într-o sală activă</Text>
          <Text style={s.emptySub}>
            Scanează QR-ul de la recepție pentru a intra în Arenă.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Main render ──────────────────────────────────── */
  return (
    <SafeAreaView style={s.safe}>
      {/* Segmented control */}
      <View style={s.segWrap}>
        <TouchableOpacity
          style={[s.segBtn, activeTab === 'leaderboard' && s.segActive]}
          onPress={() => setActiveTab('leaderboard')}
          activeOpacity={0.8}
        >
          <Text style={[s.segText, activeTab === 'leaderboard' && s.segTextActive]}>
            🏆  Clasament
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.segBtn, activeTab === 'routes' && s.segActive]}
          onPress={() => setActiveTab('routes')}
          activeOpacity={0.8}
        >
          <Text style={[s.segText, activeTab === 'routes' && s.segTextActive]}>
            🧗  Trasee
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Routes tab ───────────────────────────────── */}
      {activeTab === 'routes' && (
        <>
          {routesLoading ? (
            <Loader />
          ) : routesError ? (
            <ErrorMsg msg={routesError} onRetry={() => fetchRoutes(gymId)} />
          ) : routes.length === 0 ? (
            <EmptyList msg="Niciun traseu activ momentan." />
          ) : (
            <FlatList
              data={routes}
              keyExtractor={(r) => r.route_id}
              contentContainerStyle={s.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.routeCard}
                  activeOpacity={0.75}
                  onPress={() => setSelectedRoute(item)}
                >
                  <View style={[s.colorDot, { backgroundColor: resolveHoldColor(item.color) }]} />
                  <View style={s.routeInfo}>
                    <Text style={s.routeGrade}>{item.grade}</Text>
                    <Text style={s.routeColor}>{item.color}</Text>
                  </View>
                  <View style={s.routeRight}>
                    <Text style={s.routePts}>{item.points} pct</Text>
                    <Ionicons name="chevron-forward" size={16} color="#475569" />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}

      {/* ── Leaderboard tab ──────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <>
          {/* Scope pills */}
          <View style={s.scopeWrap}>
            <TouchableOpacity
              style={[s.scopeBtn, lbScope === 'local' && s.scopeActive]}
              onPress={() => switchScope('local')}
              activeOpacity={0.8}
            >
              <Text style={[s.scopeText, lbScope === 'local' && s.scopeTextActive]}>
                📍 Sala Mea
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.scopeBtn, lbScope === 'global' && s.scopeActive]}
              onPress={() => switchScope('global')}
              activeOpacity={0.8}
            >
              <Text style={[s.scopeText, lbScope === 'global' && s.scopeTextActive]}>
                🇷🇴 România
              </Text>
            </TouchableOpacity>
          </View>

          {lbLoading ? (
            <Loader />
          ) : lbError ? (
            <ErrorMsg msg={lbError} onRetry={() => fetchLeaderboard(gymId, lbScope)} />
          ) : leaderboard.length === 0 ? (
            <EmptyList msg="Clasamentul este gol. Fii primul care urcă!" />
          ) : (
            <FlatList
              data={leaderboard}
              keyExtractor={(e) => e.user_id}
              contentContainerStyle={s.listContent}
              ListHeaderComponent={<Podium top={leaderboard.slice(0, 3)} isGlobal={lbScope === 'global'} />}
              renderItem={({ item }) => {
                if (item.rank <= 3) return null;
                return (
                  <View style={s.lbRow}>
                    <Text style={s.lbRank}>{item.rank}</Text>
                    <View style={s.lbNameWrap}>
                      <Text style={s.lbName} numberOfLines={1}>{item.name}</Text>
                      {lbScope === 'global' && item.gym_name ? (
                        <Text style={s.lbGym} numberOfLines={1}>{item.gym_name}</Text>
                      ) : null}
                    </View>
                    <Text style={s.lbPts}>{item.points} pct</Text>
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Ascent modal ─────────────────────────────── */}
      <Modal
        visible={selectedRoute !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRoute(null)}
      >
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Cum ai urcat?</Text>
            {selectedRoute && (
              <Text style={s.modalSub}>
                {selectedRoute.grade} · {selectedRoute.color} · {selectedRoute.points} pct bază
              </Text>
            )}
            <View style={s.modalOpts}>
              {STYLES.map((st) => (
                <TouchableOpacity
                  key={st.key}
                  style={s.modalOptBtn}
                  activeOpacity={0.75}
                  disabled={submitting}
                  onPress={() => logAscent(st.key)}
                >
                  <Text style={[s.modalOptLabel, { color: st.accent }]}>{st.label}</Text>
                  <Text style={s.modalOptDesc}>{st.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={s.modalCancel}
              onPress={() => setSelectedRoute(null)}
              activeOpacity={0.7}
            >
              <Text style={s.modalCancelText}>Anulează</Text>
            </TouchableOpacity>
            {submitting && (
              <ActivityIndicator style={{ marginTop: 12 }} color="#22d3ee" />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Podium component ─────────────────────────────────── */
function Podium({ top, isGlobal }: { top: LeaderEntry[]; isGlobal: boolean }) {
  if (top.length === 0) return null;
  const ordered = [top[1], top[0], top[2]].filter(Boolean);
  const heights = { 1: 110, 2: 85, 3: 68 };

  return (
    <View style={s.podiumWrap}>
      {ordered.map((e) => {
        const m = MEDAL[e.rank] ?? { icon: 'trophy-outline', color: '#64748b' };
        return (
          <View key={e.user_id} style={s.podiumCol}>
            <Ionicons name={m.icon as any} size={e.rank === 1 ? 32 : 24} color={m.color} />
            <Text style={[s.podiumName, e.rank === 1 && s.podiumNameFirst]} numberOfLines={1}>
              {e.name}
            </Text>
            {isGlobal && e.gym_name ? (
              <Text style={s.podiumGym} numberOfLines={1}>{e.gym_name}</Text>
            ) : null}
            <Text style={s.podiumPts}>{e.points} pct</Text>
            <View
              style={[
                s.podiumBar,
                { height: heights[e.rank as 1 | 2 | 3] ?? 60, backgroundColor: m.color + '30' },
              ]}
            >
              <Text style={[s.podiumRank, { color: m.color }]}>#{e.rank}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── Small helper components ──────────────────────────── */
function Loader() {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#22d3ee" />
    </View>
  );
}

function ErrorMsg({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <View style={s.center}>
      <Ionicons name="cloud-offline-outline" size={40} color="#475569" />
      <Text style={s.errText}>{msg}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.75}>
        <Text style={s.retryText}>Reîncearcă</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyList({ msg }: { msg: string }) {
  return (
    <View style={s.center}>
      <Ionicons name="file-tray-outline" size={40} color="#475569" />
      <Text style={s.errText}>{msg}</Text>
    </View>
  );
}

/* ── Styles ───────────────────────────────────────────── */
const C = {
  bg: '#0f172a',
  card: '#1e293b',
  accent: '#22d3ee',
  text: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#475569',
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  /* Empty state */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: C.muted, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },

  /* Segmented control */
  segWrap: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    backgroundColor: C.card, borderRadius: 14, padding: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segActive: { backgroundColor: C.accent + '22' },
  segText: { color: C.dim, fontWeight: '700', fontSize: 14 },
  segTextActive: { color: C.accent },

  /* Scope pills */
  scopeWrap: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, gap: 8,
  },
  scopeBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card,
  },
  scopeActive: { backgroundColor: C.accent + '22' },
  scopeText: { color: C.dim, fontWeight: '700', fontSize: 13 },
  scopeTextActive: { color: C.accent },

  /* Lists */
  listContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },

  /* Route card */
  routeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 14, padding: 16, marginTop: 10,
  },
  colorDot: { width: 18, height: 18, borderRadius: 9 },
  routeInfo: { flex: 1, marginLeft: 14 },
  routeGrade: { color: C.text, fontSize: 17, fontWeight: '800' },
  routeColor: { color: C.muted, fontSize: 13, marginTop: 2 },
  routeRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routePts: { color: C.accent, fontWeight: '700', fontSize: 14 },

  /* Leaderboard row */
  lbRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, padding: 14, marginTop: 8,
  },
  lbRank: { color: C.dim, fontWeight: '800', fontSize: 15, width: 32, textAlign: 'center' },
  lbNameWrap: { flex: 1, marginLeft: 6 },
  lbName: { color: C.text, fontSize: 15, fontWeight: '600' },
  lbGym: { color: C.dim, fontSize: 12, fontWeight: '500', marginTop: 1 },
  lbPts: { color: C.accent, fontWeight: '700', fontSize: 14 },

  /* Podium */
  podiumWrap: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    marginTop: 12, marginBottom: 18, paddingHorizontal: 8,
  },
  podiumCol: { alignItems: 'center', flex: 1, marginHorizontal: 4 },
  podiumName: { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 6, maxWidth: W / 3 - 20 },
  podiumNameFirst: { fontSize: 15 },
  podiumGym: { color: C.dim, fontSize: 10, fontWeight: '500', marginTop: 1, maxWidth: W / 3 - 20, textAlign: 'center' },
  podiumPts: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  podiumBar: {
    width: '100%', borderRadius: 10, marginTop: 8,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10,
  },
  podiumRank: { fontSize: 20, fontWeight: '900' },

  /* Modal */
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: C.card, borderRadius: 20, padding: 24,
  },
  modalTitle: { color: C.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  modalSub: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 18 },
  modalOpts: { gap: 10 },
  modalOptBtn: {
    backgroundColor: C.bg, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modalOptLabel: { fontSize: 16, fontWeight: '800' },
  modalOptDesc: { color: C.muted, fontSize: 13, fontWeight: '600' },
  modalCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: C.dim, fontWeight: '700', fontSize: 15 },

  /* Utility */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errText: { color: C.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retryBtn: {
    backgroundColor: C.accent + '22', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  retryText: { color: C.accent, fontWeight: '700', fontSize: 14 },
});
