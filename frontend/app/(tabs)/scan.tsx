import React, { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');
const FRAME = W * 0.65;

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [success, setSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setSuccess(false);
    }, [])
  );

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);

      try {
        const parsed = JSON.parse(data);
        if (parsed.type !== 'gym_join' || !parsed.gym_id) {
          Alert.alert('Cod invalid', 'Acesta nu este un cod QR valid pentru CLaiMB.', [
            { text: 'Scanează din nou', onPress: () => setScanned(false) },
          ]);
          return;
        }

        await AsyncStorage.setItem('@current_gym_id', parsed.gym_id);
        setSuccess(true);

        setTimeout(() => {
          router.replace('/');
        }, 1500);
      } catch {
        Alert.alert('Cod invalid', 'QR-ul scanat nu este recunoscut de aplicație.', [
          { text: 'Scanează din nou', onPress: () => setScanned(false) },
        ]);
      }
    },
    [scanned, router],
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Se verifică permisiunile...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permContainer}>
        <Ionicons name="camera-outline" size={64} color="#475569" />
        <Text style={styles.permTitle}>Cameră necesară</Text>
        <Text style={styles.permText}>
          Avem nevoie de acces la cameră pentru a scana codul QR al sălii.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permBtnText}>Acordă permisiunea</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backLinkText}>Înapoi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay with transparent cutout */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayRow}>
          <View style={styles.overlaySide} />
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.hint}>Îndreaptă camera spre codul QR al sălii</Text>
        </View>
      </View>

      {/* Close button */}
      <SafeAreaView style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.navigate('/')} activeOpacity={0.75}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Success overlay */}
      {success && (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={52} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Check-in reușit!</Text>
            <Text style={styles.successSub}>Te redirecționăm spre Feed...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  permContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permTitle: { color: '#fafafa', fontSize: 22, fontWeight: '800', marginTop: 8 },
  permText: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backLink: { marginTop: 4 },
  backLinkText: { color: '#475569', fontWeight: '600', fontSize: 14 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  overlayRow: { flexDirection: 'row', height: FRAME },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  overlayBottom: {
    flex: 1.4,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    paddingTop: 28,
  },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500', textAlign: 'center' },

  frame: { width: FRAME, height: FRAME },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#22d3ee',
    borderWidth: 3,
  },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCard: { alignItems: 'center', gap: 16 },
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { color: '#fafafa', fontSize: 26, fontWeight: '900' },
  successSub: { color: '#94a3b8', fontSize: 15, fontWeight: '500' },
});
