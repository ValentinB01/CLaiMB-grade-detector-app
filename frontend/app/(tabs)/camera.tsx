import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { analyzeRoute } from '../../utils/api';
import { setPendingResult } from '../../utils/store';

const C = {
  bg: '#09090b',
  card: '#18181b',
  border: '#27272a',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#22d3ee',
};

// Definim opțiunile de unghiuri pentru fiecare tip
const WALL_TYPES = [
  { label: 'Inclined', value: 'inclined' },
  { label: 'Vertical', value: 'vertical' },
  { label: 'Overhang', value: 'overhang' }
];

const OVERHANG_DEGREES = [5, 10, 15, 20, 30, 40, 45, 50, 60];
const SLAB_DEGREES = [5, 10, 15, 20, 25, 30];

export default function CameraScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [gymName, setGymName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // State-uri pentru unghiul dinamic
  const [wallType, setWallType] = useState<'inclined' | 'vertical' | 'overhang'>('vertical');
  const [wallDegree, setWallDegree] = useState<number>(0);

  // Funcție care construiește string-ul final pentru Gemini
  const getWallAngleString = () => {
    if (wallType === 'vertical') return "Vertical (0 degrees)";
    if (wallType === 'inclined') return `Inclined (leaning back ${wallDegree} degrees)`;
    return `${wallDegree}-degree Overhang`;
  };

  const handleCapture = async () => {
    if (loading) return;

    if (Platform.OS === 'web') {
      await pickFromGallery();
      return;
    }

    if (!permission?.granted) {
      Alert.alert('Camera permission required', 'Please grant camera access to scan routes.');
      return;
    }

    try {
      setLoading(true);
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.6,
        base64: true,
        exif: false,
      });
      if (photo?.base64) {
        await submitAnalysis(photo.base64);
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
        quality: 0.6,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0].base64) {
        await submitAnalysis(result.assets[0].base64);
      } else {
        setLoading(false);
      }
    } catch (err) {
      Alert.alert('Gallery error', String(err));
      setLoading(false);
    }
  };

  const submitAnalysis = async (base64: string) => {
    try {
      const finalAngle = getWallAngleString();
      const result = await analyzeRoute({
        image_base64: base64,
        gym_name: gymName.trim() || 'Unknown Gym',
        wall_angle: finalAngle, // Trimitem textul curat către backend
      });
      setPendingResult({ ...result, image_base64: base64 });
      router.push('/result');
    } catch (err) {
      Alert.alert('Analysis failed', String(err));
    } finally {
      setLoading(false);
    }
  };

  // Funcție de schimbare a tipului de perete și resetare a gradelor default
  const handleTypeChange = (type: 'inclined' | 'vertical' | 'overhang') => {
    setWallType(type);
    if (type === 'vertical') setWallDegree(0);
    else if (type === 'inclined') setWallDegree(10);
    else setWallDegree(30);
  };

  // --- WEB: no CameraView ---
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container} testID="camera-screen-web">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.webContainer}>
            <View style={styles.webHero}>
              <View style={styles.webIconRing}>
                <Ionicons name="camera" size={56} color={C.accent} />
              </View>
              <Text style={styles.webTitle}>Scan a Route</Text>
              <Text style={styles.webSub}>Upload a climbing wall photo for AI analysis</Text>
            </View>

            {/* Selector Unghi Web */}
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
              
              {/* Sub-meniu grade Web */}
              {wallType !== 'vertical' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.degreeScrollWeb} contentContainerStyle={{ gap: 8 }}>
                  {(wallType === 'overhang' ? OVERHANG_DEGREES : SLAB_DEGREES).map(deg => (
                    <TouchableOpacity 
                      key={deg} 
                      style={[styles.degBtn, wallDegree === deg && styles.degBtnActive]}
                      onPress={() => setWallDegree(deg)}
                    >
                      <Text style={[styles.degBtnText, wallDegree === deg && styles.degBtnTextActive]}>{deg}°</Text>
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
                testID="gym-name-input"
              />
            </View>

            <TouchableOpacity
              testID="pick-image-btn"
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

  // --- Native: Full CameraView ---
  if (!permission) {
    return <View style={styles.container}><ActivityIndicator color={C.accent} /></View>;
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
    <View style={styles.container} testID="camera-screen-native">
      {isFocused && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />
      )}

      {/* Top controls */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setFlash(f => (f === 'off' ? 'on' : 'off'))}>
          <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setFacing(f => (f === 'back' ? 'front' : 'back'))}>
          <Ionicons name="camera-reverse" size={22} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.instruction} pointerEvents="none">
        <Text style={styles.instructionText}>Align the climbing wall in frame</Text>
      </View>

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

      {/* Selector de Unghi Plutitor */}
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
        
        {/* Sub-meniul orizontal cu grade (doar pe Native) */}
        {wallType !== 'vertical' && (
          <View style={styles.degreeWrapperNative}>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
              {(wallType === 'overhang' ? OVERHANG_DEGREES : SLAB_DEGREES).map(deg => (
                <TouchableOpacity 
                  key={deg} 
                  style={[styles.degBtnNative, wallDegree === deg && styles.degBtnActiveNative]}
                  onPress={() => setWallDegree(deg)}
                >
                  <Text style={[styles.degBtnTextNative, wallDegree === deg && styles.degBtnTextActiveNative]}>{deg}°</Text>
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

        <TouchableOpacity style={[styles.shutter, loading && styles.shutterDisabled]} onPress={handleCapture} disabled={loading}>
          {loading ? <ActivityIndicator color="#09090b" size="large" /> : <View style={styles.shutterInner} />}
        </TouchableOpacity>

        <View style={{ width: 56 }} />
      </View>

      {/* Gym name input */}
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
        </View>
      </KeyboardAvoidingView>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={styles.loadingText}>Coach AI is analyzing…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
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
  bottomBar: { position: 'absolute', bottom: 120, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 0 },
  galleryBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', borderWidth: 4, borderColor: C.accent, alignItems: 'center', justifyContent: 'center', marginHorizontal: 'auto', flex: 1 },
  shutterDisabled: { opacity: 0.5 },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  gymBar: { position: 'absolute', bottom: 60, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 40, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  gymInputNative: { flex: 1, color: '#fff', fontSize: 13 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.85)', alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: C.accent, fontSize: 16, fontWeight: '600' },
  
  // Stiluri Angle Selector Web
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
  
  // Stiluri Angle Selector Native (Peste cameră)
  angleContainerNative: { position: 'absolute', bottom: 220, left: 0, right: 0, alignItems: 'center' },
  angleBtnNative: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'transparent' },
  angleBtnActiveNative: { borderColor: C.accent, backgroundColor: 'rgba(34,211,238,0.2)' },
  angleBtnTextNative: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  
  // Design-ul pentru butoanele de grade de pe telefon
  degreeWrapperNative: { width: '100%', marginTop: 12, height: 36 },
  degBtnNative: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#52525b' },
  degBtnActiveNative: { backgroundColor: C.accent, borderColor: C.accent },
  degBtnTextNative: { color: '#a1a1aa', fontSize: 13, fontWeight: '700' },
  degBtnTextActiveNative: { color: '#09090b' },
});