import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useWarmUpBrowser } from '../utils/useWarmUpBrowser'; // Îl vom crea imediat

// Asta e necesar pentru a închide corect browser-ul după logarea cu Google pe Android/iOS
WebBrowser.maybeCompleteAuthSession();

const C = {
  bg: '#09090b',
  card: '#18181b',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  accent: '#22d3ee', // Albastrul tău Cyan
};

export default function LoginScreen() {
  // Hook pentru a încălzi browserul (face deschiderea instantanee)
  useWarmUpBrowser();

  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const [isLoading, setIsLoading] = React.useState(false);

  const onPressGoogle = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const { createdSessionId, setActive } = await startOAuthFlow();

      if (createdSessionId && setActive) {
        // Logarea a reușit! Setăm sesiunea activă.
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.error('OAuth error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startOAuthFlow]);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.iconRing}>
          <Ionicons name="analytics" size={60} color={C.accent} />
        </View>
        <Text style={styles.title}>CLaiMB</Text>
        <Text style={styles.subtitle}>Your AI Bouldering Coach</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={onPressGoogle}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#09090b" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#09090b" />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'space-between',
    padding: 24,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: C.secondary,
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    gap: 20,
    paddingBottom: 40,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: C.accent,
    borderRadius: 9999,
    paddingVertical: 18,
    width: '100%',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#09090b',
  },
  termsText: {
    color: '#52525b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});