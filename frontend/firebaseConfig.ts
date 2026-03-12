import { initializeApp } from 'firebase/app';
// Folosim un sistem de auth special conceput pentru React Native / Expo care memorează login-ul
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Aici vei pune datele tale din consola Firebase (le putem pune mai târziu, acum doar pregătim terenul)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "dummy-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Așa îi spunem Firebase-ului să țină minte user-ul chiar dacă închide aplicația
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});