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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [gymName, setGymName] = useState('');
  const [loading, setLoading] = useState(false);

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
      const result = await analyzeRoute({
        image_base64: base64,
        gym_name: gymName.trim() || 'Unknown Gym',
      });
      setPendingResult({ ...result, image_base64: base64 });
      router.push('/result');
    } catch (err) {
      Alert.alert('Analysis failed', String(err));
    } finally {
      setLoading(false);
    }
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
              activeOpacity={0.85}
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

            {loading && (
              <View style={styles.analyzingBanner}>
                <ActivityIndicator color={C.accent} size="small" />
                <Text style={styles.analyzingText}>Claude is analyzing your route…</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- Native: Full CameraView ---
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} testID="camera-permission-screen">
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={72} color={C.accent} />
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>Point your phone at a climbing wall to scan and grade the route.</Text>
          <TouchableOpacity
            testID="grant-camera-btn"
            style={styles.ctaBtn}
            onPress={requestPermission}
          >
            <Text style={styles.ctaBtnText}>GRANT ACCESS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryFallback} onPress={pickFromGallery} testID="use-gallery-btn">
            <Text style={styles.galleryFallbackText}>Use Gallery Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container} testID="camera-screen-native">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
      />

      {/* Top controls */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity
          testID="flash-toggle-btn"
          style={styles.iconBtn}
          onPress={() => setFlash(f => (f === 'off' ? 'on' : 'off'))}
        >
          <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          testID="flip-camera-btn"
          style={styles.iconBtn}
          onPress={() => setFacing(f => (f === 'back' ? 'front' : 'back'))}
        >
          <Ionicons name="camera-reverse" size={22} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Instruction */}
      <View style={styles.instruction} pointerEvents="none">
        <Text style={styles.instructionText}>Align the climbing wall in frame</Text>
      </View>

      {/* Corner markers */}
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

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          testID="gallery-btn"
          style={styles.galleryBtn}
          onPress={pickFromGallery}
          disabled={loading}
        >
          <Ionicons name="images-outline" size={26} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          testID="shutter-btn"
          style={[styles.shutter, loading && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#09090b" size="large" />
          ) : (
            <View style={styles.shutterInner} />
          )}
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
            testID="gym-name-input-native"
          />
        </View>
      </KeyboardAvoidingView>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={styles.loadingText}>Analyzing with Claude AI…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  // Web
  webContainer: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 24 },
  webHero: { alignItems: 'center', gap: 12 },
  webIconRing: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 2, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  webTitle: { fontSize: 26, fontWeight: '800', color: C.primary },
  webSub: { fontSize: 14, color: C.secondary, textAlign: 'center' },
  gymInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 400 },
  gymInput: { flex: 1, color: C.primary, fontSize: 15 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: 9999, paddingVertical: 16, paddingHorizontal: 40, width: '100%', maxWidth: 400 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#09090b', letterSpacing: 1 },
  analyzingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, padding: 16 },
  analyzingText: { color: C.accent, fontSize: 14 },
  // Permission
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permTitle: { fontSize: 22, fontWeight: '700', color: C.primary, textAlign: 'center' },
  permSub: { fontSize: 14, color: C.secondary, textAlign: 'center', lineHeight: 22 },
  galleryFallback: { paddingVertical: 12 },
  galleryFallbackText: { color: C.secondary, fontSize: 14 },
  // Native camera
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
});
