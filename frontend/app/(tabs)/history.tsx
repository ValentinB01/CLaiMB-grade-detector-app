import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchHistory, deleteHistory, updateHistoryStatus } from '../../utils/api';
import DrawerMenu from '../../components/DrawerMenu';

const C = {
  bg: '#09090b',
  card: '#18181b',
  border: '#27272a',
  primary: '#fafafa',
  secondary: '#a1a1aa',
  muted: '#52525b',
  accent: '#22d3ee',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#ef4444',
  purple: '#a78bfa',
};

interface RouteRecord {
  id: string;
  gym_name: string;
  grade: string;
  analyzed_at: string;
  status: 'Project' | 'Sent' | 'Topped';
  notes?: string;
  analysis_id?: string;
}


export default function HistoryScreen() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedGym, setSelectedGym] = useState<string | null>(null);
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

  const handleDelete = (id: string) => {
    Alert.alert('Delete Route', 'Remove this climb from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHistory(id);
            setRoutes(prev => prev.filter(r => r.id !== id));
          } catch {
            Alert.alert('Error', 'Could not delete record.');
          }
        },
      },
    ]);
  };

  const handleStatusChange = async (id: string, status: 'Project' | 'Sent' | 'Topped') => {
    try {
      await updateHistoryStatus(id, status);
      setRoutes(prev =>
        prev.map(route =>
          route.id === id ? { ...route, status } : route
        )
      );
    } catch {
      Alert.alert('Error', 'Could not update route status.');
    }
  };

  const gradeColor = (grade: string) => {
    const n = parseInt(grade.replace('V', ''));
    if (n <= 2) return C.success;
    if (n <= 5) return C.accent;
    if (n <= 7) return C.warning;
    return C.error;
  };

  const uniqueGyms = Array.from(new Set(routes.map(r => r.gym_name))).filter(Boolean);
  const filteredRoutes = selectedGym ? routes.filter(r => r.gym_name === selectedGym) : routes;

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

      {uniqueGyms.length > 0 && (
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[null, ...uniqueGyms]}
            keyExtractor={(item) => item || 'all'}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterBtn, selectedGym === item && styles.filterBtnActive]}
                onPress={() => setSelectedGym(item)}
              >
                <Text style={[styles.filterBtnText, selectedGym === item && styles.filterBtnTextActive]}>
                  {item || 'All Gyms'}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.filterList}
          />
        </View>
      )}

      <FlatList
        data={filteredRoutes}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/result', params: { id: item.analysis_id || item.id } })}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.gradeCircle, { borderColor: gradeColor(item.grade) }]}>
                <Text style={[styles.gradeText, { color: gradeColor(item.grade) }]}>{item.grade}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gymName}>{item.gym_name}</Text>
                <Text style={styles.date}>{new Date(item.analyzed_at).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={18} color={C.error} />
              </TouchableOpacity>
            </View>

            <View style={styles.statusSection}>
              <Text style={styles.statusLabel}>Status</Text>
              <View style={styles.statusRow}>
                {(['Project', 'Sent', 'Topped'] as const).map(statusOption => {
                  const isActive = item.status === statusOption;
                  return (
                    <TouchableOpacity
                      key={statusOption}
                      style={[styles.statusBtn, isActive && styles.statusBtnActive]}
                      onPress={() => handleStatusChange(item.id, statusOption)}
                    >
                      <Text style={[styles.statusBtnText, isActive && styles.statusBtnTextActive]}>
                        {statusOption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {item.notes ? (
              <View style={styles.notesWrap}>
                <Ionicons name="chatbubble-outline" size={12} color={C.muted} />
                <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { padding: 24, paddingBottom: 12 },
  filterContainer: { marginBottom: 12 },
  filterList: { paddingHorizontal: 24, gap: 10 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  filterBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterBtnText: { color: C.secondary, fontSize: 13, fontWeight: '700' },
  filterBtnTextActive: { color: '#000' },
  title: { fontSize: 32, fontWeight: '900', color: C.primary },
  neonText: { textShadowColor: 'rgba(34, 211, 238, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  subtitle: { fontSize: 14, color: C.secondary, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  gradeCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.accent,
  },
  gradeText: { color: C.accent, fontWeight: '900', fontSize: 18 },
  gymName: { color: C.primary, fontWeight: '700', fontSize: 16 },
  date: { color: C.secondary, fontSize: 12, marginTop: 2 },
  statusSection: { marginBottom: 10 },
  statusLabel: { fontSize: 12, color: C.secondary, marginBottom: 6, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: C.border, borderWidth: 1, borderColor: C.border,
  },
  statusBtnActive: { backgroundColor: 'rgba(34,211,238,0.14)', borderColor: C.accent },
  statusBtnText: { fontSize: 12, color: C.secondary, fontWeight: '600' },
  statusBtnTextActive: { color: C.accent },
  notesWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  notes: { fontSize: 12, color: C.muted, flex: 1 },
});