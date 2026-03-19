import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  primary: '#f8fafc',
  secondary: '#94a3b8',
  muted: '#64748b',
  accent: '#22d3ee',
  purple: '#a78bfa',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // New Profile Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [maxGrade, setMaxGrade] = useState('');

  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password) return alert('Please enter both email and password!');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("User registered! Need to save to MongoDB:", {
          uid: userCredential.user.uid, firstName, lastName, username, age, height, weight, maxGrade
        });
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0c1426', '#0f172a', '#162044']}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[styles.title, styles.neonText]}>CLaiMB</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Welcome back, climber.' : 'Join the community.'}
            </Text>
          </View>

          {!isLogin && (
            <View style={styles.row}>
              <TextInput style={[styles.input, styles.halfInput]} placeholder="First Name" placeholderTextColor={C.muted} value={firstName} onChangeText={setFirstName} />
              <TextInput style={[styles.input, styles.halfInput]} placeholder="Last Name" placeholderTextColor={C.muted} value={lastName} onChangeText={setLastName} />
            </View>
          )}

          {!isLogin && (
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor={C.muted} value={username} onChangeText={setUsername} autoCapitalize="none" />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={C.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={C.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!isLogin && (
            <>
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.thirdInput]} placeholder="Age" placeholderTextColor={C.muted} value={age} onChangeText={setAge} keyboardType="numeric" />
                <TextInput style={[styles.input, styles.thirdInput]} placeholder="Height (cm)" placeholderTextColor={C.muted} value={height} onChangeText={setHeight} keyboardType="numeric" />
                <TextInput style={[styles.input, styles.thirdInput]} placeholder="Weight (kg)" placeholderTextColor={C.muted} value={weight} onChangeText={setWeight} keyboardType="numeric" />
              </View>
              <TextInput style={styles.input} placeholder="Max Climbing Grade (e.g., V5)" placeholderTextColor={C.muted} value={maxGrade} onChangeText={setMaxGrade} autoCapitalize="characters" />
            </>
          )}

          <TouchableOpacity
            style={[styles.buttonWrap, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#22d3ee', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchContainer}>
            <Text style={styles.linkText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.linkTextBold}>{isLogin ? 'Sign up' : 'Sign in'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: C.primary,
    marginBottom: 8,
    letterSpacing: 3,
  },
  neonText: {
    textShadowColor: 'rgba(34, 211, 238, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    color: C.secondary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  input: {
    width: '100%',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    color: C.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 15,
  },
  halfInput: {
    width: '48%',
  },
  thirdInput: {
    width: '31%',
  },
  buttonWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  button: {
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  switchContainer: {
    marginTop: 32,
    alignItems: 'center',
    padding: 10,
  },
  linkText: {
    color: C.secondary,
    fontSize: 14,
  },
  linkTextBold: {
    color: C.accent,
    fontWeight: 'bold',
  }
});