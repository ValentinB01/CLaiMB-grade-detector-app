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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // IMPORTANT: Aici pui IP-ul/URL-ul real al backend-ului tău (ex: http://192.168.1.100:8000)
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.129:8000'; 
          
          const response = await fetch(`${API_URL}/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: currentUser.uid,
              email: currentUser.email || 'no-email@claimb.com',
              display_name: currentUser.displayName || 'Cățărător Anonim',
            }),
          });
          
          if (response.ok) {
            const dbUser = await response.json();
            console.log("Sincronizare MongoDB reușită! Status cont PRO:", dbUser.is_pro);
          }
        } catch (error) {
          console.error("Eroare la sincronizarea cu backend-ul:", error);
        }
      }

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
          <Stack.Screen name="gym/[id]" options={{ headerShown: false, presentation: 'card' }} />
        </Stack>
      ) : (
        // Dacă NU avem user, arătăm direct ecranul de Login pe tot ecranul
        <LoginScreen />
      )}
    </>
  );
}