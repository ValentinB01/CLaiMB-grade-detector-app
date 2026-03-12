import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password) return alert('Te rog introdu email și parola!');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      alert('Eroare: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CLaiMB</Text>
      <Text style={styles.subtitle}>{isLogin ? 'Loghează-te pentru a continua' : 'Creează un cont nou'}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#a1a1aa"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Parolă"
        placeholderTextColor="#a1a1aa"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{isLogin ? 'Intră' : 'Înregistrează-te'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{ marginTop: 20 }}>
        <Text style={styles.linkText}>{isLogin ? 'Nu ai cont? Creează unul.' : 'Ai deja cont? Loghează-te.'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b', padding: 20 },
  title: { fontSize: 40, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#a1a1aa', marginBottom: 40, textAlign: 'center' },
  input: { width: '100%', backgroundColor: '#27272a', color: 'white', padding: 15, borderRadius: 10, marginBottom: 15 },
  button: { backgroundColor: '#ffffff', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10, width: '100%', alignItems: 'center' },
  buttonText: { color: '#000000', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#a1a1aa', fontSize: 14, textDecorationLine: 'underline' }
});