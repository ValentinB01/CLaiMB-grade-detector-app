import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import LoginScreen from '../components/LoginScreen';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Asta "ascultă" în fundal dacă te-ai logat sau delogat
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {user ? (
        // Dacă AVEM user, arătăm aplicația (camerele, tab-urile)
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090b' } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="result" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        </Stack>
      ) : (
        // Dacă NU avem user, arătăm direct ecranul de Login pe tot ecranul
        <LoginScreen />
      )}
    </>
  );
}