import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  FlatList,
  TextInput,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { askCoach, ChatMessagePayload } from '../../utils/api';

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

/* ── Chat message type ──────────────────────────────────── */
interface ChatMsg {
  role: 'user' | 'model';
  text: string;
}

const WELCOME_MESSAGE: ChatMsg = {
  role: 'model',
  text: 'Salut! Sunt AI Coach-ul tău. Cu ce tehnică te pot ajuta azi?',
};

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

  // AI Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  /* ── AI: send handler ──────────────────────────────────── */
  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? inputText).trim();
      if (!msg || isLoading) return;
      Keyboard.dismiss();

      const userMsg: ChatMsg = { role: 'user', text: msg };
      const updatedMessages = [...messages, userMsg];

      setMessages(updatedMessages);
      setInputText('');
      setIsLoading(true);

      try {
        const payload: ChatMessagePayload[] = updatedMessages
          .filter((m) => m !== WELCOME_MESSAGE || updatedMessages.indexOf(m) !== 0)
          .map((m) => ({ role: m.role, text: m.text }));

        const data = await askCoach({ messages: payload });
        const modelMsg: ChatMsg = { role: 'model', text: data.reply };
        setMessages((prev) => [...prev, modelMsg]);
      } catch (err: any) {
        const errorMsg: ChatMsg = {
          role: 'model',
          text: 'Oops, nu am putut comunica cu serverul. Încearcă din nou.',
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputText, isLoading, messages],
  );

  /* ── Quick chip tap ────────────────────────────────────── */
  const handleChipTap = (name: string) => {
    const prompt = `Explică-mi tehnica: ${name}`;
    handleSend(prompt);
  };

  /* ── Render: single chat bubble ───────────────────────── */
  const renderBubble = ({ item }: { item: ChatMsg }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowModel]}>
        {!isUser && (
          <View style={s.avatarWrap}>
            <Ionicons name="sparkles" size={14} color={C.accent} />
          </View>
        )}
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleModel]}>
          <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  /* ── Render: AI Coach ──────────────────────────────────── */
  const renderAICoach = () => (
    <KeyboardAvoidingView
      style={s.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Quick Chips */}
      <View style={s.chipsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
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
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderBubble}
        keyExtractor={(_, idx) => String(idx)}
        contentContainerStyle={s.chatList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          isLoading ? (
            <View style={[s.bubbleRow, s.bubbleRowModel]}>
              <View style={s.avatarWrap}>
                <Ionicons name="sparkles" size={14} color={C.accent} />
              </View>
              <View style={[s.bubble, s.bubbleModel]}>
                <ActivityIndicator size="small" color={C.accent} />
                <Text style={[s.bubbleText, { marginLeft: 8 }]}>AI Coach scrie...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Input Bar */}
      <View style={s.inputBar}>
        <TextInput
          style={s.chatInput}
          placeholder="Scrie un mesaj..."
          placeholderTextColor={C.muted}
          value={inputText}
          onChangeText={setInputText}
          editable={!isLoading}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[s.sendCircle, (!inputText.trim() || isLoading) && s.sendCircleDisabled]}
          onPress={() => handleSend()}
          activeOpacity={0.8}
          disabled={!inputText.trim() || isLoading}
        >
          <Ionicons name="send" size={20} color="#0d0d12" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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

      {/* ── Content ──────────────────────────────────────── */}
      {activeTab === 'ai' ? (
        renderAICoach()
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderLocal()}
        </ScrollView>
      )}
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

  /* ── Chat Layout ── */
  chatContainer: {
    flex: 1,
  },
  chipsBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  chipRow: {
    paddingHorizontal: 16,
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
  chatList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },

  /* ── Chat Bubbles ── */
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowModel: {
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: C.accentBorder,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: '#7c3aed',
    borderBottomRightRadius: 4,
  },
  bubbleModel: {
    backgroundColor: C.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bubbleText: {
    color: C.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#fff',
  },

  /* ── Input Bar ── */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    backgroundColor: C.bg,
    gap: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    color: C.primary,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircleDisabled: {
    opacity: 0.4,
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
