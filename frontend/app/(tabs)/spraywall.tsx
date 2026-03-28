import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  LayoutChangeEvent,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Rect, Polygon, Ellipse, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { detectHolds, gradeSelection, askCoach, updateHistoryGym } from '../../utils/api';
import { HoldLocation, SprayWallGradeResult } from '../../utils/store';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';

const { width: SCREEN_W } = Dimensions.get('window');

// Design tokens — same palette as the rest of the app
const C = {
  bg: '#09090b',
  card: '#18181b',
  border: '#27272a',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#22d3ee',
  accentDim: 'rgba(34,211,238,0.15)',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#ef4444',
  holdGrey: 'rgba(161,161,170,0.35)',
  holdGreyStroke: 'rgba(161,161,170,0.5)',
  selectedFill: 'rgba(34,211,238,0.3)',
  selectedStroke: '#22d3ee',
};

// Wall angle options (reused from camera.tsx)
const WALL_TYPES = [
  { label: 'Inclined', value: 'inclined' },
  { label: 'Vertical', value: 'vertical' },
  { label: 'Overhang', value: 'overhang' },
];
const OVERHANG_DEGREES = [5, 10, 15, 20, 30, 40, 45, 50, 60];
const SLAB_DEGREES = [5, 10, 15, 20, 25, 30];

type Phase = 'capture' | 'selection' | 'result';

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

export default function SprayWallScreen() {
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const { selected_gym } = useLocalSearchParams<{ selected_gym?: string }>();

  // Phase management
  const [phase, setPhase] = useState<Phase>('capture');

  // Capture phase state
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [gymName, setGymName] = useState('');
  const [loading, setLoading] = useState(false);
  const [wallType, setWallType] = useState<'inclined' | 'vertical' | 'overhang'>('vertical');
  const [wallDegree, setWallDegree] = useState<number>(0);

  // Selection phase state
  const [imageBase64, setImageBase64] = useState('');
  const [allHolds, setAllHolds] = useState<HoldLocation[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0 });
  const [imgAspect, setImgAspect] = useState<number>(3 / 4);
  const [grading, setGrading] = useState(false);

  // Result phase state
  const [result, setResult] = useState<SprayWallGradeResult | null>(null);

  // --- COACH CHAT STATE ---
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'coach'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  React.useEffect(() => {
    if (selected_gym) {
      if (phase === 'capture') {
        setGymName(selected_gym);
      } else if (phase === 'result' && result) {
        setResult(prev => prev ? { ...prev, gym_name: selected_gym } : null);
        if (result.analysis_id) {
          updateHistoryGym(result.analysis_id, selected_gym).catch(e => console.error(e));
        }
      }
    }
  }, [selected_gym, phase, !!result]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !result || isTyping) return;
    const userText = chatInput.trim();
    setChatInput('');
    Keyboard.dismiss();

    const newMessages = [...chatMessages, { role: 'user' as const, text: userText }];
    setChatMessages(newMessages);
    setIsTyping(true);

    try {
      const activeHolds = Array.from(selectedIndices).map(idx => allHolds[idx]).filter(Boolean);
      const res = await askCoach({
        image_base64: imageBase64,
        holds: activeHolds,
        prompt: userText,
        history: chatMessages,
        gym_name: result.gym_name,
        wall_angle: result.wall_angle || 'vertical'
      });
      setChatMessages([...newMessages, { role: 'coach', text: res.reply }]);
    } catch (e: any) {
      setChatMessages([...newMessages, { role: 'coach', text: `Error: ${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const MarkdownText = ({ text, style }: { text: string; style?: any }) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <Text style={style}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={i} style={{ fontWeight: 'bold', color: '#fff' }}>{part.slice(2, -2)}</Text>;
          }
           return part;
        })}
      </Text>
    );
  };

  const getWallAngleString = () => {
    if (wallType === 'vertical') return 'Vertical (0 degrees)';
    if (wallType === 'inclined') return `Inclined (leaning back ${wallDegree} degrees)`;
    return `${wallDegree}-degree Overhang`;
  };

  const handleTypeChange = (type: 'inclined' | 'vertical' | 'overhang') => {
    setWallType(type);
    if (type === 'vertical') setWallDegree(0);
    else if (type === 'inclined') setWallDegree(10);
    else setWallDegree(30);
  };

  // -----------------------------------------------------------------------
  // CAPTURE PHASE
  // -----------------------------------------------------------------------
  const handleCapture = async () => {
    if (loading) return;
    if (Platform.OS === 'web') {
      await pickFromGallery();
      return;
    }
    if (!permission?.granted) {
      Alert.alert('Camera permission required', 'Please grant camera access.');
      return;
    }
    try {
      setLoading(true);
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.3,
        base64: true,
        exif: false,
      });
      if (photo?.base64) {
        await submitDetection(photo.base64);
      }
    } catch (err) {
      Alert.alert('Capture failed', String(err));
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.3,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0].base64) {
        await submitDetection(result.assets[0].base64);
      } else {
        setLoading(false);
      }
    } catch (err) {
      Alert.alert('Gallery error', String(err));
      setLoading(false);
    }
  };

  const submitDetection = async (base64: string) => {
    try {
      const data = await detectHolds({ image_base64: base64 });
      setImageBase64(base64);
      setAllHolds(data.holds || []);
      setSelectedIndices(new Set());
      setPhase('selection');
    } catch (err) {
      Alert.alert('Detection failed', String(err));
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // SELECTION PHASE
  // -----------------------------------------------------------------------
  const toggleHold = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleGradeRoute = async () => {
    if (selectedIndices.size < 2) {
      Alert.alert('Select more holds', 'Please select at least 2 holds to define your route.');
      return;
    }

    try {
      setGrading(true);
      const data = await gradeSelection({
        image_base64: imageBase64,
        selected_hold_indices: Array.from(selectedIndices).sort((a, b) => a - b),
        holds: allHolds,
        wall_angle: getWallAngleString(),
        gym_name: gymName.trim() || 'Unknown Gym',
      });
      setResult(data);
      setPhase('result');
    } catch (err) {
      Alert.alert('Grading failed', String(err));
    } finally {
      setGrading(false);
    }
  };

  const resetToCapture = () => {
    setPhase('capture');
    setImageBase64('');
    setAllHolds([]);
    setSelectedIndices(new Set());
    setResult(null);
    setImgLayout({ width: 0, height: 0 });
  };

  const resetToSelection = () => {
    setPhase('selection');
    setSelectedIndices(new Set());
    setResult(null);
  };

  const onImageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImgLayout({ width, height });
  };

  // =======================================================================
  // PHASE: CAPTURE
  // =======================================================================
  if (phase === 'capture') {
    // ---- WEB version ----
    if (Platform.OS === 'web') {
      return (
        <SafeAreaView style={styles.container} testID="spray-wall-web">
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <View style={styles.webContainer}>
              <View style={styles.webHero}>
                <View style={styles.webIconRing}>
                  <Ionicons name="grid-outline" size={56} color={C.accent} />
                </View>
                <Text style={styles.webTitle}>Spray Wall</Text>
                <Text style={styles.webSub}>
                  Upload a spray wall photo, select your holds, get graded!
                </Text>
              </View>

              {/* Wall angle selector */}
              <View style={styles.angleContainerWeb}>
                <Text style={styles.angleTitle}>Wall Angle:</Text>
                <View style={styles.angleButtons}>
                  {WALL_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.angleBtn, wallType === t.value && styles.angleBtnActive]}
                      onPress={() => handleTypeChange(t.value as any)}
                    >
                      <Text style={[styles.angleBtnText, wallType === t.value && styles.angleBtnTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {wallType !== 'vertical' && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.degreeScrollWeb}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {(wallType === 'overhang' ? OVERHANG_DEGREES : SLAB_DEGREES).map((deg) => (
                      <TouchableOpacity
                        key={deg}
                        style={[styles.degBtn, wallDegree === deg && styles.degBtnActive]}
                        onPress={() => setWallDegree(deg)}
                      >
                        <Text style={[styles.degBtnText, wallDegree === deg && styles.degBtnTextActive]}>
                          {deg}°
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.gymInputWrap}>
                <Ionicons name="location-outline" size={16} color={C.muted} />
                <TextInput
                  style={styles.gymInput}
                  placeholder="Gym name (optional)"
                  placeholderTextColor={C.muted}
                  value={gymName}
                  onChangeText={setGymName}
                  testID="spray-gym-input"
                />
                <TouchableOpacity onPress={() => router.push('/gyms-map?from=spraywall')} style={{ backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="map" size={16} color={C.accent} />
                  <Text style={{color: C.accent, fontSize: 13, fontWeight: '700'}}>
                    {gymName ? `Selected: ${gymName.substring(0, 10)}...` : 'MAP'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                testID="spray-pick-image"
                style={styles.ctaBtn}
                onPress={pickFromGallery}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#09090b" />
                ) : (
                  <>
                    <Ionicons name="images" size={20} color="#09090b" />
                    <Text style={styles.ctaBtnText}>CHOOSE PHOTO</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      );
    }

    // ---- NATIVE camera version ----
    if (!permission) {
      return (
        <View style={styles.container}>
          <ActivityIndicator color={C.accent} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={72} color={C.accent} />
            <Text style={styles.permTitle}>Camera Access Needed</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={requestPermission}>
              <Text style={styles.ctaBtnText}>GRANT ACCESS</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.container} testID="spray-wall-native">
        {isFocused && (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />
        )}

        {/* Top controls */}
        <SafeAreaView style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}>
            <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
            <Ionicons name="camera-reverse" size={22} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.instruction} pointerEvents="none">
          <Text style={styles.instructionText}>Align the spray wall in frame</Text>
        </View>

        {/* Frame corners */}
        <View style={styles.frame} pointerEvents="none">
          {['tl', 'tr', 'bl', 'br'].map((corner) => (
            <View
              key={corner}
              style={[
                styles.corner,
                corner.includes('t') ? styles.cornerTop : styles.cornerBottom,
                corner.includes('l') ? styles.cornerLeft : styles.cornerRight,
              ]}
            />
          ))}
        </View>

        {/* Wall angle selector */}
        <View style={styles.angleContainerNative}>
          <View style={styles.angleButtons}>
            {WALL_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.angleBtnNative, wallType === t.value && styles.angleBtnActiveNative]}
                onPress={() => handleTypeChange(t.value as any)}
              >
                <Text style={[styles.angleBtnTextNative, wallType === t.value && styles.angleBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {wallType !== 'vertical' && (
            <View style={styles.degreeWrapperNative}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
              >
                {(wallType === 'overhang' ? OVERHANG_DEGREES : SLAB_DEGREES).map((deg) => (
                  <TouchableOpacity
                    key={deg}
                    style={[styles.degBtnNative, wallDegree === deg && styles.degBtnActiveNative]}
                    onPress={() => setWallDegree(deg)}
                  >
                    <Text style={[styles.degBtnTextNative, wallDegree === deg && styles.degBtnTextActiveNative]}>
                      {deg}°
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery} disabled={loading}>
            <Ionicons name="images-outline" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shutter, loading && styles.shutterDisabled]}
            onPress={handleCapture}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#09090b" size="large" /> : <View style={styles.shutterInner} />}
          </TouchableOpacity>
          <View style={{ width: 56 }} />
        </View>

        {/* Gym name */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.gymBar}>
            <Ionicons name="location-outline" size={14} color={C.muted} />
            <TextInput
              style={styles.gymInputNative}
              placeholder="Gym name"
              placeholderTextColor={C.muted}
              value={gymName}
              onChangeText={setGymName}
            />
            <TouchableOpacity onPress={() => router.push('/gyms-map?from=spraywall')} style={{ backgroundColor: 'rgba(34,211,238,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <Ionicons name="map" size={14} color={C.accent} />
              <Text style={{color: C.accent, fontSize: 13, fontWeight: '800'}}>
                {gymName ? `Selected: ${gymName.substring(0, 8)}...` : 'MAP'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.loadingText}>Detecting holds…</Text>
          </View>
        )}
      </View>
    );
  }

  // =======================================================================
  // PHASE: SELECTION — Interactive hold picker
  // =======================================================================
  if (phase === 'selection') {
    const imageUri = `data:image/jpeg;base64,${imageBase64}`;
    const selectedCount = selectedIndices.size;

    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.selectionHeader}>
          <TouchableOpacity style={styles.backCircle} onPress={resetToCapture}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Select Your Route</Text>
            <Text style={styles.headerSub}>
              {selectedCount} hold{selectedCount !== 1 ? 's' : ''} selected · {allHolds.length} detected
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setSelectedIndices(new Set())}
            disabled={selectedCount === 0}
          >
            <Ionicons name="refresh" size={18} color={selectedCount > 0 ? C.accent : C.muted} />
          </TouchableOpacity>
        </View>

        {/* Image + hold overlay with Zoom */}
        <View style={{ flex: 1, paddingBottom: 100 }}>
          <View style={{ flex: 1, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: '#000' }}>
            <ReactNativeZoomableView
              maxZoom={5}
              minZoom={1}
              zoomStep={0.5}
              initialZoom={1}
              bindToBorders={true}
            >
              <View onLayout={onImageLayout} style={{ width: '100%', aspectRatio: imgAspect, justifyContent: 'center' }}>
                <Image
                  source={{ uri: imageUri }}
                  style={[styles.image, { aspectRatio: imgAspect }]}
                  resizeMode="contain"
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source;
                    if (width && height) setImgAspect(width / height);
                  }}
                />

              {imgLayout.width > 0 && allHolds.length > 0 && (
                <Svg style={StyleSheet.absoluteFill} width={imgLayout.width} height={imgLayout.height}>
                  {allHolds.map((hold, idx) => {
                    const cx = hold.x * imgLayout.width;
                    const cy = hold.y * imgLayout.height;

                    const baseW = hold.width ? hold.width * imgLayout.width : hold.radius * 2 * imgLayout.width;
                    const baseH = hold.height ? hold.height * imgLayout.height : hold.radius * 2 * imgLayout.height;

                    const boxW = baseW * 0.90;
                    const boxH = baseH * 0.90;
                    const rectX = cx - boxW / 2;
                    const rectY = cy - boxH / 2;

                    const isSelected = selectedIndices.has(idx);

                    return (
                      <React.Fragment key={idx}>
                        {hold.polygon && hold.polygon.length > 0 ? (
                          <Polygon
                            points={hold.polygon.map(p => `${p.x * imgLayout.width},${p.y * imgLayout.height}`).join(' ')}
                            fill={isSelected ? C.selectedFill : C.holdGrey}
                            stroke={isSelected ? C.selectedStroke : C.holdGreyStroke}
                            strokeWidth={isSelected ? 3 : 1.5}
                            onPress={() => toggleHold(idx)}
                          />
                        ) : (
                          <Ellipse
                            cx={cx}
                            cy={cy}
                            rx={boxW / 2}
                            ry={boxH / 2}
                            fill={isSelected ? C.selectedFill : C.holdGrey}
                            stroke={isSelected ? C.selectedStroke : C.holdGreyStroke}
                            strokeWidth={isSelected ? 3 : 1.5}
                            onPress={() => toggleHold(idx)}
                          />
                        )}
                        {isSelected && (
                          <SvgText
                            x={cx}
                            y={rectY - 5}
                            fontSize={11}
                            fill={C.accent}
                            textAnchor="middle"
                            fontWeight="bold"
                          >
                            {Array.from(selectedIndices).sort((a, b) => a - b).indexOf(idx) + 1}
                          </SvgText>
                        )}
                      </React.Fragment>
                    );
                  })}
                </Svg>
              )}
              </View>
            </ReactNativeZoomableView>
          </View>

          {/* Tip */}
          <View style={styles.tipCard}>
            <Ionicons name="finger-print" size={18} color={C.accent} />
            <Text style={styles.tipText}>
              Pinch to zoom. Tap holds to build your route. 
            </Text>
          </View>
        </View>

        {/* Grade button */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[
              styles.gradeCta,
              selectedCount < 2 && styles.gradeCtaDisabled,
            ]}
            onPress={handleGradeRoute}
            disabled={selectedCount < 2 || grading}
          >
            {grading ? (
              <ActivityIndicator color="#09090b" />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={selectedCount >= 2 ? '#09090b' : C.muted} />
                <Text style={[styles.gradeCtaText, selectedCount < 2 && styles.gradeCtaTextDisabled]}>
                  GRADE MY ROUTE ({selectedCount})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // =======================================================================
  // PHASE: RESULT
  // =======================================================================
  if (phase === 'result' && result) {
    const gColor = gradeColor(result.grade);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultHeader}>
          <TouchableOpacity style={styles.backCircle} onPress={resetToSelection}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Spray Wall Result</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          {/* Grade Card */}
          <View style={styles.gradeCard}>
            <View style={styles.gradeRow}>
              <View>
                <Text style={styles.gradeCardLabel}>YOUR ROUTE</Text>
                <Text style={[styles.gradeCardValue, { color: gColor }]}>{result.grade}</Text>
              </View>
              <View style={styles.holdsCountBox}>
                <Text style={styles.holdsCountNum}>{result.selected_holds_count}</Text>
                <Text style={styles.holdsCountLabel}>holds</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.confTitle}>AI CONFIDENCE</Text>
            <ConfidenceBar value={result.confidence} />
          </View>

          {/* Coaching Notes */}
          {result.coaching_notes ? (
            <View style={styles.notesCard}>
              <View style={styles.notesHeader}>
                <Ionicons name="sparkles" size={16} color={C.accent} />
                <Text style={styles.notesTitle}>Coach Analysis</Text>
              </View>
              <Text style={styles.notesText}>{result.coaching_notes}</Text>
            </View>
          ) : null}

          {/* --- LOCATION SETTINGS --- */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={styles.confTitle}>GYM LOCATION & WALL</Text>
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 8 }}
              onPress={() => router.push('/gyms-map?from=spraywall')}
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

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(167,139,250,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Ionicons name="speedometer" size={24} color="#a78bfa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.primary, fontSize: 16, fontWeight: '700' }}>Wall Angle</Text>
                <Text style={{ color: C.secondary, fontSize: 13, marginTop: 2 }}>{result.wall_angle}</Text>
              </View>
            </View>
          </View>

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

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryAction} onPress={resetToCapture}>
              <LinearGradient
                colors={['#22d3ee', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryActionGradient}
              >
                <Ionicons name="camera" size={18} color="#09090b" />
                <Text style={styles.primaryActionText}>NEW WALL</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} onPress={resetToSelection}>
              <Ionicons name="create-outline" size={18} color={C.primary} />
              <Text style={styles.secondaryActionText}>RE-SELECT</Text>
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

  // Fallback
  return (
    <View style={styles.container}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}

// ==========================================================================
// STYLES
// ==========================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ---- Capture Phase (Web) ----
  webContainer: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 24 },
  webHero: { alignItems: 'center', gap: 12 },
  webIconRing: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 2, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  webTitle: { fontSize: 26, fontWeight: '800', color: C.primary },
  webSub: { fontSize: 14, color: C.secondary, textAlign: 'center' },
  gymInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 400 },
  gymInput: { flex: 1, color: C.primary, fontSize: 15 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: 9999, paddingVertical: 16, paddingHorizontal: 40, width: '100%', maxWidth: 400 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#09090b', letterSpacing: 1 },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permTitle: { fontSize: 22, fontWeight: '700', color: C.primary, textAlign: 'center' },
  angleContainerWeb: { alignItems: 'center', marginBottom: 12, width: '100%', maxWidth: 400 },
  angleTitle: { color: C.secondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  angleButtons: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  angleBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  angleBtnActive: { borderColor: C.accent, backgroundColor: 'rgba(34,211,238,0.1)' },
  angleBtnText: { color: C.secondary, fontSize: 14, fontWeight: '600' },
  angleBtnTextActive: { color: C.accent },
  degreeScrollWeb: { marginTop: 12, width: '100%' },
  degBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.border },
  degBtnActive: { backgroundColor: C.accent },
  degBtnText: { color: C.secondary, fontSize: 13, fontWeight: '600' },
  degBtnTextActive: { color: '#09090b' },

  // ---- Capture Phase (Native) ----
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 20, paddingTop: 8, zIndex: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  instruction: { position: 'absolute', top: '12%', left: 0, right: 0, alignItems: 'center' },
  instructionText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  frame: { ...StyleSheet.absoluteFillObject, margin: 40 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: C.accent, borderWidth: 2.5 },
  cornerTop: { top: 0 },
  cornerBottom: { bottom: 0 },
  cornerLeft: { left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerRight: { right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  angleContainerNative: { position: 'absolute', bottom: 220, left: 0, right: 0, alignItems: 'center' },
  angleBtnNative: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'transparent' },
  angleBtnActiveNative: { borderColor: C.accent, backgroundColor: 'rgba(34,211,238,0.2)' },
  angleBtnTextNative: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  degreeWrapperNative: { width: '100%', marginTop: 12, height: 36 },
  degBtnNative: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#52525b' },
  degBtnActiveNative: { backgroundColor: C.accent, borderColor: C.accent },
  degBtnTextNative: { color: '#a1a1aa', fontSize: 13, fontWeight: '700' },
  degBtnTextActiveNative: { color: '#09090b' },
  bottomBar: { position: 'absolute', bottom: 120, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 0 },
  galleryBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', borderWidth: 4, borderColor: C.accent, alignItems: 'center', justifyContent: 'center', marginHorizontal: 'auto', flex: 1 },
  shutterDisabled: { opacity: 0.5 },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  gymBar: { position: 'absolute', bottom: 60, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 40, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  gymInputNative: { flex: 1, color: '#fff', fontSize: 13 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.85)', alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: C.accent, fontSize: 16, fontWeight: '600' },

  // ---- Selection Phase ----
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerCenter: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.primary },
  headerSub: { fontSize: 12, color: C.secondary, marginTop: 2 },
  backCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  clearBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  selectionScroll: { paddingBottom: 100 },
  imageContainer: { position: 'relative', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  imageWrap: { width: '100%' },
  image: { width: '100%', height: '100%' },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  tipText: { flex: 1, fontSize: 13, color: C.secondary, lineHeight: 18 },

  // ---- Grade CTA ----
  bottomAction: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  gradeCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: 9999, paddingVertical: 16 },
  gradeCtaDisabled: { backgroundColor: C.border },
  gradeCtaText: { fontSize: 15, fontWeight: '800', color: '#09090b', letterSpacing: 1 },
  gradeCtaTextDisabled: { color: C.muted },

  // ---- Result Phase ----
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  resultScroll: { paddingHorizontal: 0, paddingBottom: 40 },
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
  confLabel: { fontSize: 13, fontWeight: '700' },
  notesCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  notesTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
  notesText: { fontSize: 14, color: C.secondary, lineHeight: 22 },
  metaCard: { marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border, gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13, color: C.secondary },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  primaryAction: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  primaryActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  primaryActionText: { fontSize: 13, fontWeight: '800', color: '#09090b' },
  secondaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.card, borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: C.border },
  secondaryActionText: { fontSize: 13, fontWeight: '700', color: C.primary },

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
