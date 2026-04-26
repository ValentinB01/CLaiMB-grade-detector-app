import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebaseConfig';

const API = process.env.EXPO_PUBLIC_API_URL;

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  primary: '#fafafa',
  secondary: '#94a3b8',
  accent: '#22d3ee',
  accentDim: 'rgba(34, 211, 238, 0.12)',
  danger: '#f87171',
};

const STORAGE_KEY_GYM_ID = 'home_gym_id';
const STORAGE_KEY_GYM_NAME = 'home_gym_name';

interface Gym {
  gym_id: string;
  name: string;
  address?: string;
  logo_url?: string;
}

export default function CommunityScreen() {
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [selectedGymName, setSelectedGymName] = useState<string | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Witness modal
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [witnessPin, setWitnessPin] = useState('');
  const [witnessLoading, setWitnessLoading] = useState(false);

  const submitWitnessPin = async () => {
    if (witnessPin.length !== 4) {
      Alert.alert('PIN invalid', 'Introdu un cod de 4 cifre.');
      return;
    }
    setWitnessLoading(true);
    try {
      const raw = await AsyncStorage.getItem(`@pin_${witnessPin}`);
      if (!raw) {
        Alert.alert('PIN invalid', 'Codul nu a fost găsit. Verifică și încearcă din nou.');
        setWitnessLoading(false);
        return;
      }
      const { ascent_id } = JSON.parse(raw);
      const witnessUid = auth.currentUser?.uid;
      if (!witnessUid) {
        Alert.alert('Eroare', 'Trebuie să fii autentificat.');
        setWitnessLoading(false);
        return;
      }
      const res = await fetch(`${API}/api/routes/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: ascent_id, witness_user_id: witnessUid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `${res.status}`);
      }
      await AsyncStorage.removeItem(`@pin_${witnessPin}`);
      setShowWitnessModal(false);
      setWitnessPin('');
      Alert.alert('🎉 Validare reușită!', 'Urcarea prietenului tău a fost confirmată!');
    } catch (e: any) {
      Alert.alert('Eroare', e.message ?? 'Nu am putut valida.');
    } finally {
      setWitnessLoading(false);
    }
  };

  const fetchGyms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/community/gyms`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Gym[] = await res.json();
      setGyms(data);
    } catch {
      setError('Nu s-au putut încărca sălile. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem(STORAGE_KEY_GYM_ID);
        const storedName = await AsyncStorage.getItem(STORAGE_KEY_GYM_NAME);
        if (storedId) {
          setSelectedGymId(storedId);
          setSelectedGymName(storedName);
          setLoading(false);
        } else {
          await fetchGyms();
        }
      } catch {
        setError('Nu s-a putut citi sala salvată.');
        setLoading(false);
      }
    })();
  }, [fetchGyms]);

  const handleSelectGym = async (gym: Gym) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_GYM_ID, gym.gym_id);
      await AsyncStorage.setItem(STORAGE_KEY_GYM_NAME, gym.name);
      setSelectedGymId(gym.gym_id);
      setSelectedGymName(gym.name);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva sala selectată.');
    }
  };

  const handleChangeGym = async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEY_GYM_ID, STORAGE_KEY_GYM_NAME]);
      setSelectedGymId(null);
      setSelectedGymName(null);
      await fetchGyms();
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut reseta sala.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {selectedGymId ? (
        <>
          <View style={styles.gymHeader}>
            <Text style={styles.gymHeaderText} numberOfLines={1}>
              {'📍 Sala curentă: '}
              <Text style={styles.gymHeaderName}>{selectedGymName}</Text>
            </Text>
            <TouchableOpacity onPress={handleChangeGym} style={styles.changeBtn} activeOpacity={0.7}>
              <Text style={styles.changeBtnText}>Schimbă sala</Text>
            </TouchableOpacity>
          </View>

          {/* Witness button */}
          <TouchableOpacity
            style={styles.witnessRow}
            activeOpacity={0.75}
            onPress={() => { setWitnessPin(''); setShowWitnessModal(true); }}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#4ade80" />
            <Text style={styles.witnessRowText}>Validează un prieten</Text>
            <Ionicons name="chevron-forward" size={16} color={C.secondary} />
          </TouchableOpacity>

          <View style={styles.container}>
            <Text style={[styles.title, styles.neonText]}>COMMUNITY</Text>
            <Text style={styles.subtitle}>Work in progress...</Text>
          </View>

          {/* Witness validation modal */}
          <Modal visible={showWitnessModal} transparent animationType="slide" onRequestClose={() => setShowWitnessModal(false)}>
            <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                <Ionicons name="eye-outline" size={40} color="#4ade80" style={{ alignSelf: 'center', marginBottom: 8 }} />
                <Text style={styles.modalTitle}>Validează un prieten</Text>
                <Text style={styles.modalSub}>Introdu codul PIN de 4 cifre</Text>
                <TextInput
                  style={styles.pinInput}
                  value={witnessPin}
                  onChangeText={(t) => setWitnessPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="• • • •"
                  placeholderTextColor="#475569"
                  textAlign="center"
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, witnessPin.length !== 4 && { opacity: 0.5 }]}
                  activeOpacity={0.75}
                  disabled={witnessLoading || witnessPin.length !== 4}
                  onPress={submitWitnessPin}
                >
                  {witnessLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Confirmă Validarea</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowWitnessModal(false)} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>Anulează</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Se încarcă sălile...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchGyms} style={styles.retryBtn} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>Încearcă din nou</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.listContainer}>
          <Text style={[styles.title, styles.neonText]}>COMMUNITY</Text>
          <Text style={styles.subtitle}>Alege sala ta pentru a continua</Text>
          <FlatList
            data={gyms}
            keyExtractor={(item) => item.gym_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.gymCard}
                onPress={() => handleSelectGym(item)}
                activeOpacity={0.75}
              >
                <View style={styles.gymCardIcon}>
                  <Text style={styles.gymCardIconText}>🏟️</Text>
                </View>
                <View style={styles.gymCardInfo}>
                  <Text style={styles.gymCardName}>{item.name}</Text>
                  {item.address ? (
                    <Text style={styles.gymCardAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.gymCardArrow}>›</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  listContainer: {
    flex: 1,
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  gymHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  gymHeaderText: {
    color: C.secondary,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    marginRight: 10,
  },
  gymHeaderName: {
    color: C.accent,
    fontWeight: '700',
  },
  changeBtn: {
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  changeBtnText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  neonText: {
    textShadowColor: 'rgba(34, 211, 238, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 14,
    color: C.secondary,
    fontWeight: '600',
    marginBottom: 20,
  },
  loadingText: {
    color: C.secondary,
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: C.danger,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: C.accentDim,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: C.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  gymCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  gymCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  gymCardIconText: {
    fontSize: 20,
  },
  gymCardInfo: {
    flex: 1,
  },
  gymCardName: {
    color: C.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  gymCardAddress: {
    color: C.secondary,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '400',
  },
  gymCardArrow: {
    color: C.accent,
    fontSize: 26,
    fontWeight: '300',
    marginLeft: 8,
  },

  /* Witness button row */
  witnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  witnessRowText: {
    flex: 1,
    color: '#4ade80',
    fontWeight: '700',
    fontSize: 14,
  },

  /* Witness modal */
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: { color: C.primary, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  modalSub: { color: C.secondary, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  pinInput: {
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#475569',
    color: C.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 12,
    paddingVertical: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  modalCancelBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { color: '#475569', fontWeight: '700', fontSize: 15 },
});