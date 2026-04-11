import React, { useCallback, useMemo, useState } from 'react';
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
  TextInput,
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
  total_points: number;
  home_gym_id?: string;
  verified_count?: number;
}

type ArenaScope = 'gym' | 'city' | 'country';

const SCOPE_TABS: { key: ArenaScope; label: string }[] = [
  { key: 'gym', label: '🏋️  Sala Mea' },
  { key: 'city', label: '🏙️  Oraș' },
  { key: 'country', label: '🇷🇴  Țară' },
];

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

/* ── Grade selector options (Dificultate) ─────────── */
const GRADES = [
  { key: 'Galben', label: 'Galben', color: '#eab308', base: 50 },
  { key: 'Verde', label: 'Verde', color: '#22c55e', base: 100 },
  { key: 'Albastru', label: 'Albastru', color: '#3b82f6', base: 250 },
  { key: 'Negru', label: 'Negru', color: '#334155', base: 500 },
] as const;

/* ── Progression options ──────────────────────────── */
const PROGRESSIONS = [
  { key: 'zone', label: 'Doar Zona', mult: 0.5 },
  { key: 'top', label: 'Am dat Top', mult: 1.0 },
  { key: 'flash', label: 'Flash (Din prima)', mult: 1.2 },
] as const;

/* ── Scoring helpers (mirrors backend) ────────────── */
const gradeBase = (g: string) => GRADES.find((x) => x.key === g)?.base ?? 0;
const progMult = (p: string) => PROGRESSIONS.find((x) => x.key === p)?.mult ?? 1;
const estimatePoints = (grade: string, prog: string, verified: boolean) =>
  Math.round(gradeBase(grade) * progMult(prog) * (verified ? 1.0 : 0.5));
const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

/* ── Ascent style options (legacy, kept for route-tap modal) */
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
  const [userCity, setUserCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const [arenaScope, setArenaScope] = useState<ArenaScope>('gym');

  // Current user derived data (for sticky footer)
  const currentUid = auth.currentUser?.uid;
  const currentUserEntry = useMemo(
    () => leaderboard.find((e) => e.user_id === currentUid) ?? null,
    [leaderboard, currentUid],
  );
  const aheadEntry = useMemo(() => {
    if (!currentUserEntry || currentUserEntry.rank <= 1) return null;
    return leaderboard.find((e) => e.rank === currentUserEntry.rank - 1) ?? null;
  }, [leaderboard, currentUserEntry]);
  const pointsToNext = useMemo(() => {
    if (!currentUserEntry || !aheadEntry) return null;
    return aheadEntry.total_points - currentUserEntry.total_points + 1;
  }, [currentUserEntry, aheadEntry]);

  // Routes (kept for manual-add flow)
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  // Ascent modal (route-tap)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Manual add form
  const [showAddModal, setShowAddModal] = useState(false);
  const [selGrade, setSelGrade] = useState('Verde');
  const [selProg, setSelProg] = useState('top');
  const livePoints = useMemo(() => estimatePoints(selGrade, selProg, false), [selGrade, selProg]);
  const livePointsVerified = useMemo(() => estimatePoints(selGrade, selProg, true), [selGrade, selProg]);

  // PIN verification flow
  const [showPinModal, setShowPinModal] = useState(false);
  const [generatedPin, setGeneratedPin] = useState('');
  const [pendingAscentId, setPendingAscentId] = useState<string | null>(null);

  // Witness modal
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [witnessPin, setWitnessPin] = useState('');
  const [witnessLoading, setWitnessLoading] = useState(false);

  /* ── Load gym id + user profile on focus ────────────── */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const id = await AsyncStorage.getItem('@current_gym_id');
        // Fetch user profile to get city/country
        const uid = auth.currentUser?.uid;
        let city: string | null = null;
        let country: string | null = null;
        if (uid) {
          try {
            const profileRes = await fetch(`${API}/users/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid,
                email: auth.currentUser?.email ?? '',
                display_name: auth.currentUser?.displayName ?? 'Climber',
              }),
            });
            if (profileRes.ok) {
              const profile = await profileRes.json();
              city = profile.city ?? null;
              country = profile.country ?? null;
            }
          } catch {}
        }
        if (active) {
          setGymId(id);
          setUserCity(city);
          setUserCountry(country);
          if (id) {
            fetchRoutes(id);
            fetchArenaLeaderboard('gym', id, city, country);
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

  const fetchArenaLeaderboard = async (
    scope: ArenaScope,
    gid: string | null,
    city: string | null,
    country: string | null,
  ) => {
    setLbLoading(true);
    setLbError(null);
    try {
      let url = `${API}/api/leaderboard?scope=${scope}`;
      if (scope === 'gym' && gid) url += `&gym_id=${encodeURIComponent(gid)}`;
      else if (scope === 'city' && city) url += `&city=${encodeURIComponent(city)}`;
      else if (scope === 'country' && country) url += `&country=${encodeURIComponent(country)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      setLeaderboard(await res.json());
    } catch {
      setLbError('Nu am putut încărca clasamentul.');
    } finally {
      setLbLoading(false);
    }
  };

  const switchArenaScope = (scope: ArenaScope) => {
    if (scope === arenaScope) return;
    setArenaScope(scope);
    fetchArenaLeaderboard(scope, gymId, userCity, userCountry);
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
      fetchArenaLeaderboard(arenaScope, gymId, userCity, userCountry);
    } catch {
      Alert.alert('Eroare', 'Nu am putut salva urcarea. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Save manual ascent (new scoring) ────────────── */
  const saveManualAscent = async (requestVerify: boolean) => {
    if (!gymId) return;
    setSubmitting(true);
    try {
      const uid = auth.currentUser?.uid ?? 'anonymous';
      const res = await fetch(`${API}/community/ascents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          gym_id: gymId,
          route_id: `manual_${Date.now()}`,
          style: selProg === 'flash' ? 'Flash' : selProg === 'zone' ? 'Zone' : 'Redpoint',
          grade: selGrade,
          progression: selProg,
          verified_status: 'unverified',
          points_awarded: livePoints,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();

      if (requestVerify) {
        const pin = generatePin();
        setGeneratedPin(pin);
        setPendingAscentId(data.ascent_id ?? null);
        await AsyncStorage.setItem(`@pin_${pin}`, JSON.stringify({
          ascent_id: data.ascent_id,
          owner_uid: uid,
          created: Date.now(),
        }));
        setShowAddModal(false);
        setShowPinModal(true);
      } else {
        setShowAddModal(false);
        Alert.alert('✅ Urcare salvată!', `+${livePoints} puncte (neverificată)`);
      }
      if (gymId) fetchArenaLeaderboard(arenaScope, gymId, userCity, userCountry);
    } catch {
      Alert.alert('Eroare', 'Nu am putut salva urcarea. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Witness: validate PIN ─────────────────────────── */
  const submitWitnessPin = async () => {
    if (witnessPin.length !== 4) {
      Alert.alert('PIN invalid', 'Introdu un cod de 4 cifre.');
      return;
    }
    setWitnessLoading(true);
    try {
      const raw = await AsyncStorage.getItem(`@pin_${witnessPin}`);
      if (!raw) {
        Alert.alert('PIN invalid', 'Codul nu a fost găsit. Verifică și încearcă din nou.');
        setWitnessLoading(false);
        return;
      }
      const { ascent_id, owner_uid } = JSON.parse(raw);
      const witnessUid = auth.currentUser?.uid;
      if (!witnessUid) {
        Alert.alert('Eroare', 'Trebuie să fii autentificat.');
        setWitnessLoading(false);
        return;
      }
      const res = await fetch(`${API}/api/routes/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: ascent_id,
          witness_user_id: witnessUid,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `${res.status}`);
      }
      await AsyncStorage.removeItem(`@pin_${witnessPin}`);
      setShowWitnessModal(false);
      setWitnessPin('');
      Alert.alert('🎉 Validare reușită!', 'Urcarea prietenului tău a fost confirmată. Primește 100% din puncte!');
    } catch (e: any) {
      Alert.alert('Eroare', e.message ?? 'Nu am putut valida. Încearcă din nou.');
    } finally {
      setWitnessLoading(false);
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
      {/* ── Header ──────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>ARENA</Text>
        <Text style={s.headerSub}>Clasament & Competiție</Text>
      </View>

      {/* ── 3-scope segmented control ───────────────── */}
      <View style={s.segWrap}>
        {SCOPE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.segBtn, arenaScope === tab.key && s.segActive]}
            onPress={() => switchArenaScope(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.segText, arenaScope === tab.key && s.segTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Action buttons ──────────────────────────── */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.addBtn}
          activeOpacity={0.75}
          onPress={() => { setSelGrade('Verde'); setSelProg('top'); setShowAddModal(true); }}
        >
          <Ionicons name="add-circle-outline" size={16} color={C.accent} />
          <Text style={s.addBtnText}>Adaugă</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.witnessBtn}
          activeOpacity={0.75}
          onPress={() => { setWitnessPin(''); setShowWitnessModal(true); }}
        >
          <Ionicons name="eye-outline" size={16} color="#4ade80" />
          <Text style={s.witnessBtnText}>Validează</Text>
        </TouchableOpacity>
      </View>

      {/* ── Leaderboard content ─────────────────────── */}
      {lbLoading ? (
        <Loader />
      ) : lbError ? (
        <ErrorMsg msg={lbError} onRetry={() => fetchArenaLeaderboard(arenaScope, gymId, userCity, userCountry)} />
      ) : leaderboard.length === 0 ? (
        <EmptyList msg="Clasamentul este gol. Fii primul care urcă!" />
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(e) => e.user_id}
          contentContainerStyle={[s.listContent, { paddingBottom: currentUserEntry ? 100 : 32 }]}
          ListHeaderComponent={<Podium top={leaderboard.slice(0, 3)} />}
          renderItem={({ item }) => {
            if (item.rank <= 3) return null;
            const isMe = item.user_id === currentUid;
            return (
              <View style={[s.lbRow, isMe && s.lbRowMe]}>
                <Text style={[s.lbRank, isMe && s.lbRankMe]}>{item.rank}</Text>
                <View style={s.lbAvatar}>
                  <Text style={s.lbAvatarText}>
                    {item.name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={s.lbNameWrap}>
                  <Text style={[s.lbName, isMe && s.lbNameMe]} numberOfLines={1}>
                    {item.name}{isMe ? ' (Tu)' : ''}
                  </Text>
                  {(item.verified_count ?? 0) > 0 && (
                    <View style={s.verifiedBadge}>
                      <Ionicons name="shield-checkmark" size={10} color="#4ade80" />
                      <Text style={s.verifiedBadgeText}>{item.verified_count} verificate</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.lbPts, isMe && s.lbPtsMe]}>{item.total_points} pct</Text>
              </View>
            );
          }}
        />
      )}

      {/* ── Sticky footer — current user ────────────── */}
      {currentUserEntry ? (
        <View style={s.stickyFooter}>
          <View style={s.footerInner}>
            <Text style={s.footerRank}>#{currentUserEntry.rank}</Text>
            <View style={s.footerNameWrap}>
              <Text style={s.footerName} numberOfLines={1}>Tu</Text>
              {pointsToNext != null && pointsToNext > 0 ? (
                <Text style={s.footerHint}>
                  Mai ai nevoie de {pointsToNext} pct pentru a urca un loc
                </Text>
              ) : currentUserEntry.rank === 1 ? (
                <Text style={s.footerHintGold}>Ești pe primul loc!</Text>
              ) : null}
            </View>
            <Text style={s.footerPts}>{currentUserEntry.total_points} pct</Text>
          </View>
        </View>
      ) : leaderboard.length > 0 ? (
        <View style={s.stickyFooter}>
          <View style={s.footerInner}>
            <Ionicons name="arrow-up-circle-outline" size={20} color={C.muted} />
            <Text style={s.footerHintOnly}>Adaugă urcări pentru a apărea în clasament!</Text>
          </View>
        </View>
      ) : null}

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

      {/* ── Manual Add modal ──────────────────────────── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Adaugă o urcare</Text>
            <Text style={s.modalSub}>Selectează dificultatea și progresul</Text>

            {/* Grade selector */}
            <Text style={s.sectionLabel}>Dificultate</Text>
            <View style={s.gradeRow}>
              {GRADES.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  style={[
                    s.gradeChip,
                    { borderColor: g.color },
                    selGrade === g.key && { backgroundColor: g.color + '30' },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setSelGrade(g.key)}
                >
                  <View style={[s.gradeChipDot, { backgroundColor: g.color }]} />
                  <Text style={[s.gradeChipText, selGrade === g.key && { color: g.color }]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Progression segmented control */}
            <Text style={s.sectionLabel}>Progresie</Text>
            <View style={s.progRow}>
              {PROGRESSIONS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[s.progChip, selProg === p.key && s.progChipActive]}
                  activeOpacity={0.7}
                  onPress={() => setSelProg(p.key)}
                >
                  <Text style={[s.progChipText, selProg === p.key && s.progChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live points estimate */}
            <View style={s.estimateBox}>
              <Text style={s.estimateLabel}>Valoare estimată</Text>
              <Text style={s.estimateValue}>{livePoints} puncte</Text>
              <Text style={s.estimateHint}>
                Cu validare: {livePointsVerified} puncte
              </Text>
            </View>

            {/* Buttons */}
            <View style={s.addModalBtns}>
              <TouchableOpacity
                style={s.saveBtnPrimary}
                activeOpacity={0.75}
                disabled={submitting}
                onPress={() => saveManualAscent(false)}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.saveBtnPrimaryText}>Salvează ({livePoints} pct)</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.verifyRequestBtn}
                activeOpacity={0.75}
                disabled={submitting}
                onPress={() => saveManualAscent(true)}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color="#4ade80" />
                <Text style={s.verifyRequestBtnText}>Cere Validare (Martor)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.modalCancel} onPress={() => setShowAddModal(false)} activeOpacity={0.7}>
              <Text style={s.modalCancelText}>Anulează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── PIN display modal ─────────────────────────── */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Ionicons name="shield-checkmark" size={48} color="#4ade80" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={s.modalTitle}>Cod de Validare</Text>
            <Text style={s.pinCode}>{generatedPin}</Text>
            <Text style={[s.modalSub, { marginTop: 12, lineHeight: 20 }]}>
              Roagă prietenul tău să introducă acest cod în aplicația lui pentru a-ți valida urcarea și a primi 100% din puncte.
            </Text>
            <TouchableOpacity
              style={[s.saveBtnPrimary, { marginTop: 20 }]}
              activeOpacity={0.75}
              onPress={() => setShowPinModal(false)}
            >
              <Text style={s.saveBtnPrimaryText}>Am înțeles</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Witness validation modal ──────────────────── */}
      <Modal visible={showWitnessModal} transparent animationType="slide" onRequestClose={() => setShowWitnessModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Ionicons name="eye-outline" size={40} color="#4ade80" style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={s.modalTitle}>Validează un prieten</Text>
            <Text style={s.modalSub}>Introdu codul PIN de 4 cifre primit de la prietenul tău</Text>
            <TextInput
              style={s.pinInput}
              value={witnessPin}
              onChangeText={(t) => setWitnessPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="• • • •"
              placeholderTextColor="#475569"
              textAlign="center"
            />
            <TouchableOpacity
              style={[s.saveBtnPrimary, witnessPin.length !== 4 && { opacity: 0.5 }]}
              activeOpacity={0.75}
              disabled={witnessLoading || witnessPin.length !== 4}
              onPress={submitWitnessPin}
            >
              {witnessLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnPrimaryText}>Confirmă Validarea</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.modalCancel} onPress={() => setShowWitnessModal(false)} activeOpacity={0.7}>
              <Text style={s.modalCancelText}>Anulează</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Podium component ─────────────────────────────────── */
function Podium({ top }: { top: LeaderEntry[] }) {
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
            {(e.verified_count ?? 0) > 0 && (
              <View style={s.podiumVerified}>
                <Ionicons name="shield-checkmark" size={10} color="#4ade80" />
                <Text style={s.podiumVerifiedText}>{e.verified_count}</Text>
              </View>
            )}
            <Text style={s.podiumPts}>{e.total_points} pct</Text>
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

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: {
    color: C.accent, fontSize: 28, fontWeight: '900', letterSpacing: 3,
    textShadowColor: C.accent + '66', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  headerSub: { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 2 },

  /* Empty state */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: C.muted, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 22 },

  /* 3-scope segmented control */
  segWrap: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 8, marginBottom: 6,
    backgroundColor: C.card, borderRadius: 14, padding: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segActive: { backgroundColor: C.accent + '22' },
  segText: { color: C.dim, fontWeight: '700', fontSize: 13 },
  segTextActive: { color: C.accent },

  /* Action row */
  actionRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 6, gap: 8,
  },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: C.accent + '14', borderWidth: 1, borderColor: C.accent + '33',
    borderRadius: 12, paddingVertical: 9,
  },
  addBtnText: { color: C.accent, fontWeight: '700', fontSize: 13 },
  witnessBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
    borderRadius: 12, paddingVertical: 9,
  },
  witnessBtnText: { color: '#4ade80', fontWeight: '700', fontSize: 13 },

  /* Lists */
  listContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },

  /* Leaderboard row (4+) */
  lbRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 14, padding: 14, marginTop: 8,
  },
  lbRowMe: { borderWidth: 1, borderColor: C.accent + '55' },
  lbRank: { color: C.dim, fontWeight: '800', fontSize: 16, width: 34, textAlign: 'center' },
  lbRankMe: { color: C.accent },
  lbAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.dim + '44',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  lbAvatarText: { color: C.text, fontWeight: '800', fontSize: 15 },
  lbNameWrap: { flex: 1 },
  lbName: { color: C.text, fontSize: 15, fontWeight: '600' },
  lbNameMe: { color: C.accent, fontWeight: '800' },
  lbPts: { color: C.accent, fontWeight: '700', fontSize: 14 },
  lbPtsMe: { fontWeight: '900' },

  /* Verified badge (inline in row) */
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2,
  },
  verifiedBadgeText: { color: '#4ade80', fontSize: 10, fontWeight: '700' },

  /* Podium */
  podiumWrap: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    marginTop: 12, marginBottom: 18, paddingHorizontal: 8,
  },
  podiumCol: { alignItems: 'center', flex: 1, marginHorizontal: 4 },
  podiumName: { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 6, maxWidth: W / 3 - 20, textAlign: 'center' },
  podiumNameFirst: { fontSize: 15 },
  podiumVerified: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  podiumVerifiedText: { color: '#4ade80', fontSize: 9, fontWeight: '700' },
  podiumPts: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  podiumBar: {
    width: '100%', borderRadius: 10, marginTop: 8,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10,
  },
  podiumRank: { fontSize: 20, fontWeight: '900' },

  /* Sticky footer */
  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.dim + '44',
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 12,
  },
  footerInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerRank: { color: C.accent, fontSize: 22, fontWeight: '900', width: 52 },
  footerNameWrap: { flex: 1 },
  footerName: { color: C.text, fontSize: 16, fontWeight: '800' },
  footerHint: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  footerHintGold: { color: '#facc15', fontSize: 11, fontWeight: '700', marginTop: 2 },
  footerPts: { color: C.accent, fontSize: 18, fontWeight: '900' },
  footerHintOnly: { color: C.muted, fontSize: 13, fontWeight: '600', flex: 1 },

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

  /* Grade selector */
  sectionLabel: { color: C.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 14, marginBottom: 8, textTransform: 'uppercase' as const },
  gradeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  gradeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, backgroundColor: C.bg,
  },
  gradeChipDot: { width: 14, height: 14, borderRadius: 7 },
  gradeChipText: { color: C.text, fontWeight: '700', fontSize: 14 },

  /* Progression control */
  progRow: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 12, padding: 3 },
  progChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  progChipActive: { backgroundColor: C.accent + '22' },
  progChipText: { color: C.dim, fontWeight: '700', fontSize: 12 },
  progChipTextActive: { color: C.accent },

  /* Estimate box */
  estimateBox: {
    backgroundColor: C.bg, borderRadius: 14, padding: 16, marginTop: 16, alignItems: 'center',
    borderWidth: 1, borderColor: C.accent + '30',
  },
  estimateLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  estimateValue: { color: C.accent, fontSize: 28, fontWeight: '900', marginTop: 4 },
  estimateHint: { color: '#4ade80', fontSize: 12, fontWeight: '600', marginTop: 4 },

  /* Add modal buttons */
  addModalBtns: { gap: 10, marginTop: 16 },
  saveBtnPrimary: {
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnPrimaryText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  verifyRequestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#4ade80', borderRadius: 14, paddingVertical: 13,
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  verifyRequestBtnText: { color: '#4ade80', fontWeight: '700', fontSize: 14 },

  /* PIN code display */
  pinCode: {
    color: C.text, fontSize: 48, fontWeight: '900', letterSpacing: 16,
    textAlign: 'center', marginTop: 12,
  },

  /* PIN input (witness) */
  pinInput: {
    backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.dim,
    color: C.text, fontSize: 32, fontWeight: '800', letterSpacing: 12,
    paddingVertical: 16, marginVertical: 16,
  },

  /* Utility */
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errText: { color: C.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retryBtn: {
    backgroundColor: C.accent + '22', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  retryText: { color: C.accent, fontWeight: '700', fontSize: 14 },
});
