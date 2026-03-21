import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getPendingResult,
  clearPendingResult,
  AnalysisResult,
  HoldLocation
} from '../utils/store';
import { askCoach, fetchAnalysisById, updateHistoryGym } from '../utils/api';
import DrawerMenu from '../components/DrawerMenu';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  bg: '#0f172a',
  card: '#1e293b',
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

const HOLD_COLORS: Record<string, string> = {
  start: '#4ade80',
  finish: '#f472b6',
  hand: '#22d3ee',
  foot: '#fbbf24',
  unknown: '#94a3b8',
};

function holdColor(type: string) {
  return HOLD_COLORS[type] ?? HOLD_COLORS.unknown;
}

function gradeColor(grade: string) {
  if (!grade) return C.primary;
  const n = parseInt(grade.replace('V', ''), 10);
  if (isNaN(n)) return C.primary;
  if (n <= 2) return C.success;
  if (n <= 5) return C.accent;
  if (n <= 7) return C.warning;
  return C.error;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? C.success : pct >= 60 ? C.accent : C.warning;
  return (
    <View style={styles.confWrap}>
      <View style={styles.confTrack}>
        <View style={[styles.confFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.confLabel, { color }]}>{pct}%</Text>
    </View>
  );
}

export default function ResultScreen() {
  const router = useRouter();
  const { id, selected_gym } = useLocalSearchParams<{ id: string, selected_gym?: string }>();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });
  const [selectedHold, setSelectedHold] = useState<HoldLocation | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [imgAspect, setImgAspect] = useState<number>(3 / 4);
  const [activeRouteIdx, setActiveRouteIdx] = useState(0);

  // --- COACH CHAT STATE ---
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'coach'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !result || isTyping) return;
    const userText = chatInput.trim();
    setChatInput('');
    Keyboard.dismiss();

    const newMessages = [...chatMessages, { role: 'user' as const, text: userText }];
    setChatMessages(newMessages);
    setIsTyping(true);

    try {
      const routes = result.detected_routes || [];
      const hasRoutes = routes.length > 0;
      const currentRoute = hasRoutes ? routes[activeRouteIdx < routes.length ? activeRouteIdx : 0] : null;
      
      const activeHolds = hasRoutes && currentRoute
        ? currentRoute.holds_ids.map(id => result.holds[id]).filter(Boolean)
        : result.holds || [];

      // Send the request
      const res = await askCoach({
        image_base64: result.image_base64 || '',
        holds: activeHolds,
        prompt: userText,
        history: chatMessages,
        gym_name: result.gym_name,
        wall_angle: (result as any).wall_angle || 'vertical' // Type cast in case wall_angle isn't in AnalysisResult schema type locally
      });

      setChatMessages([...newMessages, { role: 'coach', text: res.reply }]);
    } catch (e: any) {
      setChatMessages([...newMessages, { role: 'coach', text: `Error: ${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const syncGymUpdate = async (recordId: string, gymName: string) => {
    try {
      await updateHistoryGym(recordId, gymName);
      console.log(`✅ Gym updated in DB: ${gymName}`);
    } catch (e) {
      console.error("Failed to sync gym update:", e);
    }
  };

  useEffect(() => {
    if (id) {
      fetchAnalysisById(id)
        .then(setResult)
        .catch(err => console.error("Error loading history item:", err));
    } else {
      const r = getPendingResult();
      if (r) setResult(r);
    }
  }, [id]);

  useEffect(() => {
    if (selected_gym && result) {
      // 1. Update local state for immediate UI feedback
      setResult(prev => prev ? { ...prev, gym_name: selected_gym } : null);
      
      // 2. Persist to DB if we have an ID
      const recordId = id || result.analysis_id;
      if (recordId) {
        syncGymUpdate(recordId, selected_gym);
      }
    }
  }, [selected_gym, !!result]);

  const MarkdownText = ({ text, style }: { text: string; style?: any }) => {
    // Simple regex to split by bold groups **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <Text style={style}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <Text key={i} style={{ fontWeight: 'bold', color: '#fff' }}>
                {part.slice(2, -2)}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noResult}>
          <Ionicons name="alert-circle-outline" size={56} color={C.muted} />
          <Text style={styles.noResultText}>No analysis found</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const routes = result.detected_routes || [];
  const hasRoutes = routes.length > 0;
  const validRouteIdx = activeRouteIdx < routes.length ? activeRouteIdx : 0;
  const currentRoute = hasRoutes ? routes[validRouteIdx] : null;

  const displayGrade = currentRoute ? currentRoute.estimated_grade : result.grade;
  const displayNotes = currentRoute ? currentRoute.reasoning : result.notes;
  const gColor = gradeColor(displayGrade);

  const imageUri = result.image_base64
    ? `data:image/jpeg;base64,${result.image_base64}`
    : null;

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImgLayout({ width, height });
  };

  return (
    <SafeAreaView style={styles.container}>
      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.backCircle} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={18} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.backCircle} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.topTitle}>Route Analysis</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Imagine + Overlays */}
        <View style={styles.imageContainer}>
          {imageUri ? (
            <View onLayout={onImageLayout} style={[styles.imageWrap, { aspectRatio: imgAspect }]}>
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="cover"
                onLoad={(e) => {
                  const { width, height } = e.nativeEvent.source;
                  if (width && height) {
                    setImgAspect(width / height);
                  }
                }}
              />

              {imgLayout.width > 0 && result.holds && result.holds.length > 0 && (
                <Svg
                  style={StyleSheet.absoluteFill}
                  width={imgLayout.width}
                  height={imgLayout.height}
                >
                  {result.holds.map((hold, idx) => {
                    const cx = hold.x * imgLayout.width;
                    const cy = hold.y * imgLayout.height;

                    const baseW = hold.width ? hold.width * imgLayout.width : hold.radius * 2 * imgLayout.width;
                    const baseH = hold.height ? hold.height * imgLayout.height : hold.radius * 2 * imgLayout.height;

                    const boxW = baseW * 0.90;
                    const boxH = baseH * 0.90;

                    const rectX = cx - boxW / 2;
                    const rectY = cy - boxH / 2;

                    const activeIdxPos = currentRoute ? currentRoute.holds_ids.indexOf(idx) : idx;
                    const isInActiveRoute = activeIdxPos !== -1;
                    const displayNum = activeIdxPos + 1;

                    const baseColor = holdColor(hold.hold_type);
                    const drawColor = isInActiveRoute ? baseColor : C.muted;
                    const opacity = isInActiveRoute ? 1 : 0.15;

                    const isSelected = selectedHold === hold;

                    return (
                      <React.Fragment key={idx}>
                        <Rect
                          x={rectX}
                          y={rectY}
                          width={boxW}
                          height={boxH}
                          fill={drawColor + '33'}
                          stroke={drawColor}
                          strokeWidth={isSelected ? 3 : 2}
                          opacity={opacity}
                          rx={4}
                          onPress={() => setSelectedHold(isSelected ? null : hold)}
                        />
                        {isInActiveRoute && (
                          <SvgText
                            x={cx}
                            y={cy + 4}
                            fontSize={12}
                            fill="#ffffff"
                            stroke="#000000"
                            strokeWidth={1}
                            textAnchor="middle"
                            fontWeight="900"
                          >
                            {displayNum}
                          </SvgText>
                        )}
                      </React.Fragment>
                    );
                  })}
                </Svg>
              )}
            </View>
          ) : (
            <View style={[styles.imageWrap, styles.noImagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color={C.muted} />
              <Text style={styles.noImageText}>Image unavailable</Text>
            </View>
          )}

          <View style={[styles.gradeBadgeOverlay, { borderColor: gColor, backgroundColor: '#0f172acc' }]}>
            <Text style={[styles.gradeOverlayText, { color: gColor }]}>{displayGrade}</Text>
          </View>
        </View>

        {/* --- LOCATION BOX (Gym Card) --- */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={styles.confTitle}>GYM LOCATION</Text>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}
            onPress={() => router.push({ pathname: '/gyms-map', params: { from: 'result', current_id: id || '' } })}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(34,211,238,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Ionicons name="location" size={24} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.primary, fontSize: 16, fontWeight: '700' }}>
                {result.gym_name && result.gym_name !== 'Unknown Gym' ? result.gym_name : 'No gym selected'}
              </Text>
              <Text style={{ color: C.secondary, fontSize: 13, marginTop: 2 }}>Tap map to set location</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(34,211,238,0.15)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="map" size={18} color={C.accent} />
              <Text style={{ color: C.accent, fontSize: 14, fontWeight: '800' }}>MAP</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* --- SELECTOR DE TRASEE (SLIDER) --- */}
        {hasRoutes && (
          <View style={styles.routeSelector}>
            <Text style={styles.selectorTitle}>Available Routes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeList}>
              {routes.map((route, index) => {
                const isActive = validRouteIdx === index;
                const routeGColor = gradeColor(route.estimated_grade);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.routeCard,
                      isActive && { borderColor: routeGColor, backgroundColor: C.card }
                    ]}
                    onPress={() => setActiveRouteIdx(index)}
                  >
                    <Text style={[styles.routeColorText, { color: isActive ? C.primary : C.secondary }]}>
                      {route.color}
                    </Text>
                    <Text style={[styles.routeGradeText, { color: routeGColor }]}>
                      {route.estimated_grade}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Legendă culori prize */}
        {!hasRoutes && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendScroll} contentContainerStyle={styles.legend}>
            {Object.entries(HOLD_COLORS).map(([type, color]) => (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{type}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Info Priză Selectată */}
        {selectedHold && (
          <View style={styles.holdInfoCard}>
            <Text style={styles.holdInfoTitle}>
              {selectedHold.hold_type.charAt(0).toUpperCase() + selectedHold.hold_type.slice(1)} Hold
            </Text>
            <Text style={styles.holdInfoText}>
              Confidence: {Math.round((selectedHold.confidence || 0) * 100)}%
            </Text>
          </View>
        )}

        {/* Detalii Traseu Selectat */}
        <View style={styles.gradeCard}>
          <View style={styles.gradeRow}>
            <View>
              <Text style={styles.gradeCardLabel}>
                {currentRoute ? `${currentRoute.color} ROUTE` : 'GENERAL GRADE'}
              </Text>
              <Text style={[styles.gradeCardValue, { color: gColor }]}>{displayGrade}</Text>
            </View>
            <View style={styles.holdsCountBox}>
              <Text style={styles.holdsCountNum}>
                {currentRoute ? currentRoute.holds_ids.length : (result.holds?.length || 0)}
              </Text>
              <Text style={styles.holdsCountLabel}>holds</Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.confTitle}>AI Confidence</Text>
          <ConfidenceBar value={result.confidence} />
        </View>

        {/* Note de la Coach */}
        {displayNotes ? (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <Ionicons name="sparkles" size={16} color={C.purple} />
              <Text style={styles.notesTitle}>Coach Analysis</Text>
            </View>
            <Text style={styles.notesText}>{displayNotes}</Text>
          </View>
        ) : null}

        {/* Buton Chat Coach */}
        <TouchableOpacity style={styles.askCoachBtn} onPress={() => setChatVisible(true)}>
          <LinearGradient
            colors={['#8b5cf6', '#d946ef']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.askCoachGradient}
          >
            <Ionicons name="chatbubbles" size={20} color="#fff" />
            <Text style={styles.askCoachBtnText}>ASK COACH FOR BETA</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Butoane Acțiuni */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => router.replace('/(tabs)/camera')}>
            <LinearGradient
              colors={['#22d3ee', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryActionGradient}
            >
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={styles.primaryActionText}>NEW SCAN</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.replace('/(tabs)/history')}>
            <Ionicons name="time-outline" size={18} color={C.primary} />
            <Text style={styles.secondaryActionText}>HISTORY</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* --- CHAT MODAL --- */}
      <Modal visible={chatVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>CLaiMB Coach</Text>
              <TouchableOpacity onPress={() => setChatVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
              {chatMessages.length === 0 && (
                <View style={styles.chatEmpty}>
                  <Ionicons name="chatbubbles-outline" size={48} color={C.muted} />
                  <Text style={styles.chatEmptyText}>Ask about hand placements, body tension, or sequence details.</Text>
                </View>
              )}
              {chatMessages.map((msg, idx) => (
                <View key={idx} style={[styles.msgBubble, msg.role === 'user' ? styles.msgUser : styles.msgCoach]}>
                  {msg.role === 'coach' && <Ionicons name="sparkles" size={14} color="#fff" style={{ marginRight: 6 }} />}
                  <MarkdownText 
                    text={msg.text} 
                    style={[styles.msgText, msg.role === 'user' ? { color: '#000' } : { color: '#f8fafc' }]} 
                  />
                </View>
              ))}
              {isTyping && (
                <View style={[styles.msgBubble, styles.msgCoach, { width: 60, alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              )}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Ask for beta..."
                placeholderTextColor={C.muted}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
                maxLength={400}
              />
              <TouchableOpacity style={[styles.chatSendBtn, !chatInput.trim() && { opacity: 0.5 }]} onPress={handleSendChat} disabled={!chatInput.trim() || isTyping}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
  scroll: { paddingBottom: 40 },
  imageContainer: { position: 'relative', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  imageWrap: { width: '100%' },
  image: { width: '100%', height: '100%' },
  gradeBadgeOverlay: { position: 'absolute', top: 16, right: 16, borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  gradeOverlayText: { fontSize: 28, fontWeight: '900' },
  routeSelector: { marginBottom: 16 },
  selectorTitle: { fontSize: 11, color: C.secondary, marginLeft: 16, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  routeList: { paddingHorizontal: 16, gap: 12 },
  routeCard: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', minWidth: 100 },
  routeColorText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  routeGradeText: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  holdInfoCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.accent + '44' },
  holdInfoTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
  holdInfoText: { fontSize: 12, color: C.secondary, marginTop: 2 },
  gradeCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  gradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  gradeCardLabel: { fontSize: 12, color: C.secondary, letterSpacing: 1, textTransform: 'uppercase' },
  gradeCardValue: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  holdsCountBox: { alignItems: 'center', backgroundColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  holdsCountNum: { fontSize: 24, fontWeight: '800', color: C.primary },
  holdsCountLabel: { fontSize: 10, color: C.secondary },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  confTitle: { fontSize: 11, color: C.secondary, textTransform: 'uppercase', marginBottom: 8 },
  confWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confTrack: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3 },
  confFill: { height: '100%', borderRadius: 3 },
  confLabel: { fontSize: 13, fontWeight: '700', color: C.primary },
  notesCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.purple + '30' },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  notesTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
  notesText: { fontSize: 14, color: C.secondary, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  primaryAction: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  primaryActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  primaryActionText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  secondaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.card, borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: C.border },
  secondaryActionText: { fontSize: 13, fontWeight: '700', color: C.primary },
  noResult: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  noResultText: { color: C.secondary },
  backBtn: { marginTop: 10, padding: 10 },
  backBtnText: { color: C.accent },
  legendScroll: { marginHorizontal: 16, marginBottom: 12 },
  legend: { gap: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: C.secondary },
  noImagePlaceholder: { backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  noImageText: { color: C.muted, marginTop: 10 },
  
  askCoachBtn: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden' },
  askCoachGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  askCoachBtnText: { fontSize: 13, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  chatContainer: { backgroundColor: C.bg, height: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: C.border },
  chatTitle: { fontSize: 18, fontWeight: '700', color: C.primary },
  closeBtn: { padding: 4 },
  chatScroll: { flex: 1, backgroundColor: '#0b1120' },
  chatContent: { padding: 16, gap: 12 },
  chatEmpty: { alignItems: 'center', marginTop: 40 },
  chatEmptyText: { color: C.muted, textAlign: 'center', marginTop: 12, marginHorizontal: 20 },
  msgBubble: { padding: 12, borderRadius: 16, maxWidth: '85%' },
  msgUser: { backgroundColor: '#e2e8f0', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgCoach: { backgroundColor: C.card, alignSelf: 'flex-start', borderBottomLeftRadius: 4, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: C.border },
  msgText: { fontSize: 15, lineHeight: 22 },
  chatInputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.bg, alignItems: 'flex-end', gap: 10 },
  chatInput: { flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: C.primary, fontSize: 15, borderWidth: 1, borderColor: C.border },
  chatSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' }
});