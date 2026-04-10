import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/* ── Types ───────────────────────────────────────────────── */
type ActiveTab = 'ai' | 'local';
type LocalSubTab = 'techniques' | 'routes';

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  bg: '#0d0d12',
  card: '#18181b',
  cardBorder: '#27272a',
  primary: '#f0f0f5',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#a855f7',
  accentDim: 'rgba(168,85,247,0.12)',
  accentBorder: 'rgba(168,85,247,0.30)',
  inputBg: '#1e1e24',
  pillBg: '#1c1c24',
  pillActive: '#7c3aed',
  thumbBg: '#27272a',
};

/* ── Quick-suggest chips ─────────────────────────────────── */
const QUICK_CHIPS = ['Heel Hook', 'Drop Knee', 'Dyno', 'Crimp', 'Flagging'];

/* ── Mock AI responses per technique ─────────────────────── */
const TECHNIQUE_RESPONSES: Record<string, string> = {
  'Heel Hook':
    'Heel Hook: Plasează călcâiul pe o priză și trage activ cu posteriorul piciorului. Ține centrul de greutate aproape de perete și evită să te bazezi doar pe brațe — lasă piciorul să facă treaba grea.',
  'Drop Knee':
    'Drop Knee: Rotește genunchiul interior în jos și pivotează pe șoldul opus. Acest lucru generează torque și îți permite să ajungi mai departe pe prize laterale fără a folosi forță suplimentară din brațe.',
  Dyno: 'Dyno: Pregătește-te cu o mișcare de balans din picioare, apoi explodează coordonat cu tot corpul. Țintește cu privirea priza finală înainte de a sări și încearcă să prinzi cu ambele mâini simultan.',
  Crimp:
    'Crimp: Închide degetele strâns pe priză cu prima falangă hiperextinsă. Folosește crimp-ul cu jumătate de prindere (half-crimp) pentru a proteja tendoanele. Nu uita: precizia picioarelor reduce 80% din presiunea pe degete.',
  Flagging:
    'Flagging: Întinde un picior în lateral sau în spate fără a-l plasa pe o priză, pentru a contracara efectul de barn-door. Flagging-ul inside se face pe același perete, iar outside — pe peretele opus direcției mișcării.',
};

/* ── Generic mock responses (for free-text queries) ──────── */
const GENERIC_RESPONSES = [
  'Pentru prizele de tip sloper, încearcă să îți ții centrul de greutate cât mai jos și folosește palma completă pentru frecare maximă.',
  'Când te confrunți cu un overhang, menține brațele întinse cât mai mult posibil pentru a economisi energie și mută-ți șoldurile aproape de perete.',
  'Pe traseele cu prize mici (crimps), concentrează-te pe precizia picioarelor — 80% din putere ar trebui să vină de la picioare, nu de la brațe.',
  'La secțiunile tehnice, vizualizează întreaga secvență de mișcări înainte de a începe. Cititul traseului îți salvează timp și energie.',
];

/* ── Local: Technique videos placeholder ─────────────────── */
const LOCAL_TECHNIQUES = [
  { title: 'Cum să faci Drop Knee', author: 'Antrenor Alex', duration: '3:24' },
  { title: 'Heel Hook pe overhang', author: 'Antrenor Maria', duration: '4:10' },
  { title: 'Flagging pentru începători', author: 'Coach Radu', duration: '2:55' },
  { title: 'Gaston — când și cum', author: 'Antrenor Alex', duration: '5:02' },
];

/* ── Local: Solved routes placeholder ────────────────────── */
const LOCAL_ROUTES = [
  { title: 'V4 Roșu — Panoul 3', author: 'Antrenor Alex', grade: 'V4' },
  { title: 'Soluție pentru Crux-ul de la V6', author: 'Coach Radu', grade: 'V6' },
  { title: 'V3 Albastru — Parcursul de încălzire', author: 'Antrenor Maria', grade: 'V3' },
  { title: 'V5 Galben — Secvența dinamică', author: 'Coach Radu', grade: 'V5' },
];

/* ── Component ───────────────────────────────────────────── */
export default function BetaScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ai');
  const [localSubTab, setLocalSubTab] = useState<LocalSubTab>('techniques');

  // AI state
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  /* ── AI: send handler ──────────────────────────────────── */
  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? query).trim();
      if (!msg || isLoading) return;
      Keyboard.dismiss();
      setQuery(msg);
      setIsLoading(true);
      setAiResponse(null);

      // Check if message matches a known technique
      const matchedKey = Object.keys(TECHNIQUE_RESPONSES).find((k) =>
        msg.toLowerCase().includes(k.toLowerCase()),
      );

      setTimeout(() => {
        if (matchedKey) {
          setAiResponse(
            TECHNIQUE_RESPONSES[matchedKey] +
              '\n\nAi întrebări despre cum să o aplici?',
          );
        } else {
          const idx = Math.floor(Math.random() * GENERIC_RESPONSES.length);
          setAiResponse(
            GENERIC_RESPONSES[idx] + '\n\nAi întrebări despre cum să o aplici?',
          );
        }
        setIsLoading(false);
      }, 1500);
    },
    [query, isLoading],
  );

  /* ── Quick chip tap ────────────────────────────────────── */
  const handleChipTap = (name: string) => {
    const prompt = `Explică-mi tehnica: ${name}`;
    setQuery(prompt);
    handleSend(prompt);
  };

  /* ── Render: AI Coach ──────────────────────────────────── */
  const renderAICoach = () => (
    <>
      {/* Header */}
      <View style={s.headerWrap}>
        <Ionicons name="sparkles" size={28} color={C.accent} />
        <Text style={s.title}>AI Beta Coach</Text>
      </View>
      <Text style={s.subtitle}>
        Alege o tehnică rapidă sau descrie problema ta de pe traseu.
      </Text>

      {/* Quick Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
        style={s.chipScroll}
      >
        {QUICK_CHIPS.map((name) => (
          <TouchableOpacity
            key={name}
            style={s.chip}
            onPress={() => handleChipTap(name)}
            activeOpacity={0.75}
            disabled={isLoading}
          >
            <Ionicons name="flash-outline" size={14} color={C.accent} />
            <Text style={s.chipText}>{name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input Card */}
      <View style={s.inputCard}>
        <TextInput
          style={s.textInput}
          placeholder="Ex: Nu reușesc să țin sloperii pe overhang..."
          placeholderTextColor={C.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={query}
          onChangeText={setQuery}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!query.trim() || isLoading) && s.sendBtnDisabled]}
          onPress={() => handleSend()}
          activeOpacity={0.8}
          disabled={!query.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#0d0d12" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#0d0d12" />
          )}
          <Text style={s.sendBtnText}>
            {isLoading ? 'Se gândește...' : 'Trimite'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* AI Response */}
      {aiResponse && (
        <View style={s.responseCard}>
          <View style={s.responseHeader}>
            <Ionicons name="sparkles" size={18} color={C.accent} />
            <Text style={s.responseLabel}>Răspuns AI Coach</Text>
          </View>
          <Text style={s.responseText}>{aiResponse}</Text>
        </View>
      )}
    </>
  );

  /* ── Render: Local ─────────────────────────────────────── */
  const renderLocal = () => (
    <>
      {/* Header */}
      <View style={s.headerWrap}>
        <Ionicons name="location-outline" size={28} color={C.accent} />
        <Text style={s.title}>Local</Text>
      </View>
      <Text style={s.subtitle}>
        Conținut de la antrenorii din sala ta — tehnici video și trasee rezolvate.
      </Text>

      {/* Sub-selector */}
      <View style={s.subBar}>
        <TouchableOpacity
          style={[s.subPill, localSubTab === 'techniques' && s.subPillActive]}
          onPress={() => setLocalSubTab('techniques')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              s.subPillText,
              localSubTab === 'techniques' && s.subPillTextActive,
            ]}
          >
            Tehnici de bază
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.subPill, localSubTab === 'routes' && s.subPillActive]}
          onPress={() => setLocalSubTab('routes')}
          activeOpacity={0.75}
        >
          <Text
            style={[
              s.subPillText,
              localSubTab === 'routes' && s.subPillTextActive,
            ]}
          >
            Trasee Rezolvate
          </Text>
          <View style={s.betaBadge}>
            <Text style={s.betaBadgeText}>Beta</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {localSubTab === 'techniques'
        ? LOCAL_TECHNIQUES.map((item, idx) => (
            <View key={idx} style={s.videoCard}>
              {/* Thumbnail placeholder */}
              <View style={s.thumb}>
                <Ionicons name="play-circle-outline" size={32} color={C.accent} />
                {item.duration && (
                  <View style={s.durationBadge}>
                    <Text style={s.durationText}>{item.duration}</Text>
                  </View>
                )}
              </View>
              <View style={s.videoBody}>
                <Text style={s.videoTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={s.videoAuthor}>{item.author}</Text>
              </View>
            </View>
          ))
        : LOCAL_ROUTES.map((item, idx) => (
            <View key={idx} style={s.videoCard}>
              <View style={s.gradeWrap}>
                <Text style={s.gradeText}>{item.grade}</Text>
              </View>
              <View style={s.videoBody}>
                <Text style={s.videoTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={s.videoAuthor}>{item.author}</Text>
              </View>
            </View>
          ))}
    </>
  );

  /* ── Content map ───────────────────────────────────────── */
  const CONTENT: Record<ActiveTab, () => React.JSX.Element> = {
    ai: renderAICoach,
    local: renderLocal,
  };

  /* ── Main render ───────────────────────────────────────── */
  return (
    <SafeAreaView style={s.container}>
      {/* ── Top Selector ─────────────────────────────────── */}
      <View style={s.topBar}>
        {([
          { key: 'ai' as ActiveTab, emoji: '🤖', label: 'AI Coach' },
          { key: 'local' as ActiveTab, emoji: '📍', label: 'Local' },
        ]).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.topPill, active && s.topPillActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={s.topPillEmoji}>{tab.emoji}</Text>
              <Text style={[s.topPillText, active && s.topPillTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Scrollable Content ───────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {CONTENT[activeTab]()}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Styles ───────────────────────────────────────────────── */
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
  },

  /* ── Top Bar (2 main pills) ── */
  topBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.pillBg,
    borderRadius: 9999,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  topPillActive: {
    backgroundColor: C.pillActive,
    borderColor: C.pillActive,
    ...Platform.select({
      ios: {
        shadowColor: '#7c3aed',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  topPillEmoji: {
    fontSize: 18,
  },
  topPillText: {
    color: C.muted,
    fontSize: 15,
    fontWeight: '800',
  },
  topPillTextActive: {
    color: '#fff',
  },

  /* ── Header ── */
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  title: {
    color: C.primary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: C.secondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },

  /* ── Quick Chips ── */
  chipScroll: {
    marginBottom: 16,
    marginHorizontal: -20,
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accentDim,
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  chipText: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Input Card ── */
  inputCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  textInput: {
    backgroundColor: C.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    color: C.primary,
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
    minHeight: 100,
    marginBottom: 14,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 9999,
    paddingVertical: 14,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#0d0d12',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* ── AI Response Card ── */
  responseCard: {
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.accentBorder,
    padding: 18,
    marginBottom: 16,
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
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  responseLabel: {
    color: C.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  responseText: {
    color: C.primary,
    fontSize: 15,
    lineHeight: 23,
  },

  /* ── Local Sub-Bar ── */
  subBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.pillBg,
    borderRadius: 9999,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  subPillActive: {
    backgroundColor: C.accentDim,
    borderColor: C.accentBorder,
  },
  subPillText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  subPillTextActive: {
    color: C.accent,
  },
  betaBadge: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  betaBadgeText: {
    color: C.accent,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* ── Video / Route Card ── */
  videoCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    alignItems: 'center',
  },
  thumb: {
    width: 80,
    height: 60,
    borderRadius: 12,
    backgroundColor: C.thumbBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  gradeWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    color: C.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  videoBody: {
    flex: 1,
  },
  videoTitle: {
    color: C.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  videoAuthor: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
