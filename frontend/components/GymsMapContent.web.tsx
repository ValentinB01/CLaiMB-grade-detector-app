import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f8fafc',
  secondary: '#94a3b8',
  muted: '#64748b',
  accent: '#22d3ee',
};

export default function GymsMapContent() {
  const router = useRouter();
  
  return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
      <Ionicons name="desktop-outline" size={64} color={C.muted} />
      <Text style={{ color: C.secondary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
        Interactive Native Maps are not supported in PC Web Browsers.
      </Text>
      <Text style={{ color: C.primary, fontSize: 16, marginTop: 8, textAlign: 'center' }}>
        Please scan the QR code and run the app on your iPhone or Android device!
      </Text>
      <TouchableOpacity style={{ marginTop: 24, backgroundColor: C.accent, padding: 12, borderRadius: 12 }} onPress={() => router.back()}>
        <Text style={{ color: '#000', fontWeight: 'bold' }}>GO BACK</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
});
