import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

          <View style={styles.container}>
            <Text style={[styles.title, styles.neonText]}>COMMUNITY</Text>
            <Text style={styles.subtitle}>Work in progress...</Text>
          </View>
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
});
