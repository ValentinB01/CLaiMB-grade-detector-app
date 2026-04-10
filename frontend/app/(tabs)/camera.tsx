import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { analyzePose, PoseAnalysisResult } from '../../utils/api';

const C = {
  bg: '#0d0d12',
  card: '#18181b',
  cardBorder: '#27272a',
  primary: '#f0f0f5',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#a855f7',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  recRed: '#ef4444',
};

type AppState = 'idle' | 'camera' | 'analyzing' | 'result';

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  const [appState, setAppState] = useState<AppState>('idle');
  const [recording, setRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [result, setResult] = useState<PoseAnalysisResult | null>(null);

  const scoreColor = (score: number) => {
    if (score >= 80) return C.green;
    if (score >= 50) return C.orange;
    return C.red;
  };

  // ── Permissions ──
  const ensurePermissions = async (): Promise<boolean> => {
    let cam = camPerm;
    let mic = micPerm;

    if (!cam?.granted) {
      cam = await requestCamPerm();
    }
    if (!mic?.granted) {
      mic = await requestMicPerm();
    }

    if (!cam?.granted) {
      Alert.alert('Permisiuni necesare', 'Acorda acces la camera pentru a filma.');
      return false;
    }
    // Microphone is optional — video can still record without audio
    return true;
  };

  // ── Open Camera ──
  const openCamera = async () => {
    const ok = await ensurePermissions();
    if (ok) setAppState('camera');
  };

  // ── Record toggle ──
  const toggleRecording = async () => {
    if (!cameraRef.current) return;

    if (recording) {
      cameraRef.current.stopRecording();
      // onRecordingComplete below handles the URI
    } else {
      setRecording(true);
      try {
        const video = await cameraRef.current.recordAsync();
        if (video?.uri) {
          setVideoUri(video.uri);
          setAppState('analyzing');
          await submitVideo(video.uri, 'live_recording.mp4');
        }
      } catch (err: any) {
        Alert.alert('Eroare filmare', err?.message || String(err));
        setAppState('idle');
      } finally {
        setRecording(false);
      }
    }
  };

  // ── Gallery picker ──
  const pickFromGallery = async () => {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.7,
        allowsEditing: false,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      const asset = pickerResult.assets[0];
      const uri = asset.uri;
      const fileName = asset.fileName || uri.split('/').pop() || 'climbing_video.mp4';

      setVideoUri(uri);
      setAppState('analyzing');
      await submitVideo(uri, fileName);
    } catch (err: any) {
      Alert.alert('Eroare galerie', err?.message || String(err));
      setAppState('idle');
    }
  };

  // ── Submit to backend ──
  const submitVideo = async (uri: string, fileName: string) => {
    try {
      const data = await analyzePose(uri, fileName);
      setResult(data);
      setAppState('result');
    } catch (err: any) {
      Alert.alert('Analiza esuata', err?.message || String(err));
      setAppState('idle');
    }
  };

  // ── Reset ──
  const resetStudio = () => {
    setAppState('idle');
    setResult(null);
    setVideoUri(null);
    setRecording(false);
  };

  // ═══════════════════════════════════════════════════════════
  //  STATE: CAMERA (full-screen video recording)
  // ═══════════════════════════════════════════════════════════
  if (appState === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="video"
        />

        {/* Close button */}
        <SafeAreaView style={styles.cameraTopBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              if (recording) cameraRef.current?.stopRecording();
              setRecording(false);
              setAppState('idle');
            }}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Recording indicator */}
        {recording && (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        )}

        {/* Instruction */}
        <View style={styles.cameraInstruction} pointerEvents="none">
          <Text style={styles.cameraInstructionText}>
            {recording ? 'Filmeaza-ti urcarea. Apasa din nou pentru a opri.' : 'Apasa butonul rosu pentru a incepe filmarea'}
          </Text>
        </View>

        {/* Record button */}
        <View style={styles.cameraBottomBar}>
          <TouchableOpacity
            style={[styles.recordBtn, recording && styles.recordBtnActive]}
            onPress={toggleRecording}
            activeOpacity={0.7}
          >
            <View style={[styles.recordInner, recording && styles.recordInnerActive]} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  STATE: ANALYZING
  // ═══════════════════════════════════════════════════════════
  if (appState === 'analyzing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.analyzingWrap}>
          <View style={styles.pulseRing}>
            <Ionicons name="body-outline" size={48} color={C.accent} />
          </View>
          <Text style={styles.analyzingTitle}>
            AI Coach proceseaza miscarile tale...
          </Text>
          <Text style={styles.analyzingSub}>
            Calculam unghiurile bratelor cu YOLO11 Pose.{'\n'}
            Acest lucru poate dura cateva momente.
          </Text>
          <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  STATE: RESULT
  // ═══════════════════════════════════════════════════════════
  if (appState === 'result' && result) {
    const score = result.analysis.efficiency_score;
    const color = scoreColor(score);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.resultScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.resultHeader}>
            <Ionicons name="analytics-outline" size={28} color={C.accent} />
            <Text style={styles.resultHeaderTitle}>Rezultat Analiza</Text>
          </View>

          {/* AI Coach Card */}
          <View style={styles.coachCard}>
            <View style={styles.coachCardHeader}>
              <Ionicons name="sparkles" size={20} color={C.accent} />
              <Text style={styles.coachCardTitle}>AI Coach Feedback</Text>
            </View>

            {/* Efficiency Score */}
            <View style={styles.scoreSection}>
              <Text style={styles.scoreLabel}>Eficienta Bratelor</Text>
              <Text style={[styles.scoreBig, { color }]}>{score}%</Text>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${score}%`, backgroundColor: color },
                  ]}
                />
              </View>

              <View style={styles.scoreMetaRow}>
                <Text style={styles.scoreMeta}>
                  {result.analysis.frames_with_straight_arms} / {result.analysis.total_active_frames} cadre eficiente
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Feedback Text */}
            <View style={styles.feedbackSection}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.secondary} />
              <Text style={styles.feedbackText}>{result.analysis.feedback}</Text>
            </View>
          </View>

          {/* Video Metadata Card */}
          <View style={styles.metaCard}>
            <Text style={styles.metaCardTitle}>Detalii Video</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Rezolutie</Text>
              <Text style={styles.metaValue}>
                {result.metadata.width} x {result.metadata.height}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>FPS procesat</Text>
              <Text style={styles.metaValue}>{result.metadata.fps.toFixed(1)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Cadre analizate</Text>
              <Text style={styles.metaValue}>{result.metadata.total_frames}</Text>
            </View>
          </View>

          {/* Finish / New Analysis */}
          <TouchableOpacity style={styles.finishBtn} onPress={resetStudio}>
            <Ionicons name="refresh" size={20} color="#0d0d12" />
            <Text style={styles.finishBtnText}>Analizeaza alta urcare</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  STATE: IDLE (home of the studio)
  // ═══════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.container} testID="coaching-studio">
      <View style={styles.idleWrap}>
        {/* Hero */}
        <View style={styles.heroIcon}>
          <LinearGradient
            colors={['rgba(168,85,247,0.20)', 'rgba(57,255,20,0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Ionicons name="videocam" size={52} color={C.accent} />
          </LinearGradient>
        </View>

        <Text style={styles.idleTitle}>Analizeaza o Urcare</Text>
        <Text style={styles.idleSub}>
          Filmeaza live sau incarca un clip din galerie.{'\n'}
          AI Coach-ul va analiza tehnica ta de escalada.
        </Text>

        {/* CTA Buttons */}
        <View style={styles.ctaGroup}>
          {/* Live Camera */}
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={openCamera}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaIconWrap}
            >
              <Ionicons name="radio-button-on" size={28} color="#fff" />
            </LinearGradient>
            <View style={styles.ctaTextWrap}>
              <Text style={styles.ctaTitle}>Deschide Camera</Text>
              <Text style={styles.ctaSub}>Filmare Live</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.muted} />
          </TouchableOpacity>

          {/* Gallery */}
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={pickFromGallery}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[C.accent, '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaIconWrap}
            >
              <Ionicons name="folder-open" size={26} color="#fff" />
            </LinearGradient>
            <View style={styles.ctaTextWrap}>
              <Text style={styles.ctaTitle}>Incarca din Galerie</Text>
              <Text style={styles.ctaSub}>Selecteaza un video existent</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.muted} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── IDLE ──
  idleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  heroIcon: { marginBottom: 28 },
  heroGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.30)',
  },
  idleTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: C.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  idleSub: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 36,
  },
  ctaGroup: { width: '100%', gap: 14 },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 14,
  },
  ctaIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTextWrap: { flex: 1 },
  ctaTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
  ctaSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  // ── CAMERA ──
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.recRed,
  },
  recText: {
    color: C.recRed,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cameraInstruction: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cameraInstructionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    textAlign: 'center',
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  recordBtnActive: {
    borderColor: C.recRed,
  },
  recordInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.recRed,
  },
  recordInnerActive: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },

  // ── ANALYZING ──
  analyzingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  pulseRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  analyzingTitle: {
    color: C.primary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  analyzingSub: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── RESULT ──
  resultScroll: { padding: 20, paddingBottom: 40 },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  resultHeaderTitle: {
    color: C.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  coachCard: {
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#a855f7',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },
  coachCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  coachCardTitle: {
    color: C.accent,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreSection: { alignItems: 'center', marginBottom: 4 },
  scoreLabel: {
    color: C.secondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  scoreBig: { fontSize: 56, fontWeight: '900', lineHeight: 62 },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#27272a',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  scoreMetaRow: { marginTop: 8 },
  scoreMeta: { color: C.muted, fontSize: 12 },
  divider: { height: 1, backgroundColor: '#27272a', marginVertical: 16 },
  feedbackSection: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  feedbackText: {
    flex: 1,
    color: C.secondary,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  metaCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 20,
  },
  metaCardTitle: {
    color: C.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaLabel: { color: C.muted, fontSize: 13 },
  metaValue: { color: C.primary, fontSize: 13, fontWeight: '600' },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 9999,
    paddingVertical: 16,
  },
  finishBtnText: {
    color: '#0d0d12',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});