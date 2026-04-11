import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
  green: '#22c55e',
  searchBg: '#1e293b',
  searchBorder: '#334155',
};

const SOCIAL_PROOF = [
  { icon: 'flame-outline' as const, text: 'Trending: {n} trasee noi' },
  { icon: 'people-outline' as const, text: '{n} cataratori au dat check-in azi' },
  { icon: 'trophy-outline' as const, text: '{n} rute completate saptamana asta' },
  { icon: 'pulse-outline' as const, text: 'Activ acum: {n} cataratori' },
  { icon: 'star-outline' as const, text: 'Rating: 4.{n}/5 din {m} recenzii' },
];

function getSocialProof(gymId: string) {
  let hash = 0;
  for (let i = 0; i < gymId.length; i++) {
    hash = (hash * 31 + gymId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % SOCIAL_PROOF.length;
  const n = (Math.abs(hash) % 40) + 5;
  const m = (Math.abs(hash) % 200) + 20;
  const template = SOCIAL_PROOF[idx];
  return {
    icon: template.icon,
    text: template.text.replace('{n}', String(n)).replace('{m}', String(m)),
  };
}

export default function ExploreScreen() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const filteredGyms = useMemo(() => {
    if (!searchQuery.trim()) return gyms;
    const q = searchQuery.toLowerCase().trim();
    return gyms.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.address && g.address.toLowerCase().includes(q)),
    );
  }, [gyms, searchQuery]);

  const fetchGyms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/community/gyms`);
      if (!res.ok) throw new Error(`${res.status}`);
      setGyms(await res.json());
    } catch {
      setError('Nu am putut incarca lista de sali.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const handlePress = (gym: Gym) => {
    router.push({ pathname: '/gym/[id]', params: { id: gym.gym_id } });
  };

  const renderAvatar = (gym: Gym) => {
    if (gym.logo_url) {
      return (
        <Image
          source={{ uri: gym.logo_url }}
          style={[s.avatar, { borderColor: gym.primary_color }]}
        />
      );
    }
    return (
      <View style={[s.avatar, s.avatarFallback, { borderColor: gym.primary_color, backgroundColor: gym.primary_color + '22' }]}>
        <Text style={[s.avatarLetter, { color: gym.primary_color }]}>
          {gym.name.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  };

  const renderCard = ({ item }: { item: Gym }) => {
    const proof = getSocialProof(item.gym_id);
    const inactive = !item.is_active;

    return (
      <TouchableOpacity
        style={[s.card, inactive && s.cardInactive]}
        activeOpacity={0.75}
        onPress={() => handlePress(item)}
      >
        <View style={[s.stripe, { backgroundColor: item.primary_color }]} />

        {renderAvatar(item)}

        <View style={s.cardBody}>
          <View style={s.nameRow}>
            <Text
              style={[s.gymName, { color: item.primary_color }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.is_active && <View style={s.activeDot} />}
          </View>

          {item.address ? (
            <View style={s.addressRow}>
              <Ionicons name="location-outline" size={13} color={C.muted} />
              <Text style={s.address} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
          ) : null}

          <View style={s.proofRow}>
            <Ionicons name={proof.icon} size={12} color={C.accent} />
            <Text style={s.proofText}>{proof.text}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={C.dim} style={s.chevron} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Descopera Sali</Text>
        <Text style={s.subtitle}>Gaseste urmatoarea ta provocare in Romania.</Text>
      </View>

      {/* Search Bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Cauta dupa nume sau adresa..."
          placeholderTextColor={C.dim}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={C.dim} />
          </TouchableOpacity>
        )}
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
            <Text style={s.retryText}>Reincearca</Text>
          </TouchableOpacity>
        </View>
      ) : filteredGyms.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="business-outline" size={40} color={C.dim} />
          <Text style={s.errText}>
            {searchQuery.trim()
              ? 'Nicio sala gasita pentru cautarea ta.'
              : 'Nicio sala disponibila momentan.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredGyms}
          keyExtractor={(g) => g.gym_id}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          renderItem={renderCard}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { color: C.text, fontSize: 26, fontWeight: '900' },
  subtitle: { color: C.muted, fontSize: 14, fontWeight: '600', marginTop: 4 },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.searchBg,
    borderWidth: 1,
    borderColor: C.searchBorder,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 46,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },

  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 },

  /* Card */
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
  cardInactive: {
    opacity: 0.5,
  },
  stripe: { width: 5, alignSelf: 'stretch' },

  /* Avatar */
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    marginLeft: 12,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '900',
  },

  /* Card body */
  cardBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gymName: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  address: { color: C.muted, fontSize: 12, fontWeight: '500', flex: 1 },

  /* Social proof */
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: C.accent + '11',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  proofText: { color: C.accent, fontSize: 11, fontWeight: '700' },

  chevron: { marginRight: 14 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errText: { color: C.muted, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    backgroundColor: C.accent + '22',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: C.accent, fontWeight: '700', fontSize: 14 },
});
