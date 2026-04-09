import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API = process.env.EXPO_PUBLIC_API_URL;

interface Gym {
  gym_id: string;
  name: string;
  address?: string;
  logo_url?: string;
  primary_color: string;
  is_active: boolean;
}

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#475569',
  accent: '#22d3ee',
};

export default function ExploreScreen() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGyms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/community/gyms`);
      if (!res.ok) throw new Error(`${res.status}`);
      setGyms(await res.json());
    } catch {
      setError('Nu am putut încărca lista de săli.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const handlePress = (gym: Gym) => {
    Alert.alert(
      'Vizitează Sala',
      `Mergi la recepția ${gym.name} și scanează codul QR pentru a debloca traseele și clasamentul!`,
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Descoperă Săli</Text>
        <Text style={s.subtitle}>Găsește următoarea ta provocare în România.</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={C.dim} />
          <Text style={s.errText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchGyms} activeOpacity={0.75}>
            <Text style={s.retryText}>Reîncearcă</Text>
          </TouchableOpacity>
        </View>
      ) : gyms.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="business-outline" size={40} color={C.dim} />
          <Text style={s.errText}>Nicio sală disponibilă momentan.</Text>
        </View>
      ) : (
        <FlatList
          data={gyms}
          keyExtractor={(g) => g.gym_id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => handlePress(item)}
            >
              <View style={[s.stripe, { backgroundColor: item.primary_color }]} />
              <View style={s.cardBody}>
                <Text style={[s.gymName, { color: item.primary_color }]}>{item.name}</Text>
                {item.address ? (
                  <View style={s.addressRow}>
                    <Ionicons name="location-outline" size={14} color={C.muted} />
                    <Text style={s.address} numberOfLines={1}>{item.address}</Text>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.dim} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { color: C.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: C.muted, fontSize: 14, fontWeight: '600', marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  stripe: { width: 5, alignSelf: 'stretch' },
  cardBody: { flex: 1, paddingVertical: 18, paddingHorizontal: 16 },
  gymName: { fontSize: 17, fontWeight: '800' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  address: { color: C.muted, fontSize: 13, fontWeight: '500', flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errText: { color: C.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retryBtn: {
    backgroundColor: C.accent + '22',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: C.accent, fontWeight: '700', fontSize: 14 },
});
