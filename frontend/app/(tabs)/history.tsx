import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchHistory, deleteHistory } from '../../utils/api';
import DrawerMenu from '../../components/DrawerMenu';

interface RouteRecord {
  id: string;
  gym_name: string;
  grade: string;
  analyzed_at: string;
}

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  primary: '#f8fafc',
  secondary: '#94a3b8',
  accent: '#22d3ee',
  purple: '#a78bfa',
  error: '#ef4444',
};

export default function HistoryScreen() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const router = useRouter();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setRoutes(data.routes || []);
    } catch {
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border }} onPress={() => setDrawerVisible(true)}>
            <Ionicons name="menu" size={20} color={C.primary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, styles.neonText]}>CLIMB LOG</Text>
            <Text style={styles.subtitle}>{routes.length} sessions analyzed</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={routes}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/result', params: { id: item.id } })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.gradeCircle}>
                <Text style={styles.gradeText}>{item.grade}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gymName}>{item.gym_name}</Text>
                <Text style={styles.date}>{new Date(item.analyzed_at).toLocaleDateString()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.border} />
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { padding: 24 },
  title: { fontSize: 32, fontWeight: '900', color: C.primary },
  neonText: { textShadowColor: 'rgba(34, 211, 238, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  subtitle: { fontSize: 14, color: C.secondary, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  gradeCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.accent
  },
  gradeText: { color: C.accent, fontWeight: '900', fontSize: 18 },
  gymName: { color: C.primary, fontWeight: '700', fontSize: 16 },
  date: { color: C.secondary, fontSize: 12, marginTop: 2 }
});