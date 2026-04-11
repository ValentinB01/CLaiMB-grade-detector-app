import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#475569',
  accent: '#22d3ee',
  green: '#22c55e',
  coverBg: '#0ea5e9',
};

export default function GymProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Cover header */}
        <View style={s.cover}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Ionicons name="image-outline" size={48} color={C.text + '55'} />
          <Text style={s.coverPlaceholder}>Cover Image Placeholder</Text>
          <Text style={s.gymId}>Gym ID: {id}</Text>
        </View>

        {/* Home Gym CTA */}
        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.8}>
          <Ionicons name="home-outline" size={20} color={C.bg} />
          <Text style={s.ctaText}>Seteaza ca Sala Mea (Home Gym)</Text>
        </TouchableOpacity>

        {/* Leaderboard Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="trophy-outline" size={20} color={C.accent} />
            <Text style={s.sectionTitle}>Leaderboard Sala</Text>
          </View>
          <View style={s.placeholder}>
            {[1, 2, 3].map((rank) => (
              <View key={rank} style={s.leaderRow}>
                <Text style={s.rank}>#{rank}</Text>
                <View style={s.leaderAvatar}>
                  <Text style={s.leaderInitial}>?</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.skeletonName} />
                  <View style={s.skeletonScore} />
                </View>
              </View>
            ))}
            <Text style={s.placeholderText}>Datele leaderboard-ului vor fi incarcate aici.</Text>
          </View>
        </View>

        {/* Routes Section */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="map-outline" size={20} color={C.accent} />
            <Text style={s.sectionTitle}>Trasee Recente</Text>
          </View>
          <View style={s.placeholder}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={s.routeRow}>
                <View style={[s.routeGrade, { backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'][i - 1] + '33' }]}>
                  <Text style={[s.routeGradeText, { color: ['#ef4444', '#f59e0b', '#22c55e'][i - 1] }]}>
                    {['6a+', '7b', '5c'][i - 1]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.skeletonName} />
                  <View style={s.skeletonScore} />
                </View>
              </View>
            ))}
            <Text style={s.placeholderText}>Traseele vor fi incarcate de pe server.</Text>
          </View>
        </View>

        {/* Back button at bottom */}
        <TouchableOpacity style={s.bottomBack} onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="arrow-back-outline" size={18} color={C.accent} />
          <Text style={s.bottomBackText}>Inapoi la Descopera Sali</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },

  /* Cover */
  cover: {
    height: 200,
    backgroundColor: C.coverBg + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.bg + 'cc',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  coverPlaceholder: {
    color: C.text + '55',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  gymId: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  /* CTA */
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    marginHorizontal: 20,
    marginTop: -24,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: C.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ctaText: {
    color: C.bg,
    fontSize: 16,
    fontWeight: '900',
  },

  /* Sections */
  section: {
    marginHorizontal: 20,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
  },
  placeholder: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  placeholderText: {
    color: C.dim,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },

  /* Leaderboard rows */
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rank: {
    color: C.accent,
    fontSize: 16,
    fontWeight: '900',
    width: 28,
  },
  leaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.dim + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderInitial: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '700',
  },

  /* Skeleton lines */
  skeletonName: {
    width: '60%',
    height: 10,
    borderRadius: 5,
    backgroundColor: C.dim + '33',
    marginBottom: 6,
  },
  skeletonScore: {
    width: '35%',
    height: 8,
    borderRadius: 4,
    backgroundColor: C.dim + '22',
  },

  /* Route rows */
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeGrade: {
    width: 44,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeGradeText: {
    fontSize: 14,
    fontWeight: '900',
  },

  /* Bottom back */
  bottomBack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    marginHorizontal: 20,
    backgroundColor: C.accent + '15',
    borderRadius: 14,
  },
  bottomBackText: {
    color: C.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
