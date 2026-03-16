import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { fetchHistory, deleteHistory, updateHistoryStatus } from '../../utils/api';

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
};

interface RouteRecord {
  id: string;
  gym_name: string;
  grade: string;
  holds_count: number;
  confidence: number;
  notes: string;
  analyzed_at: string;
  status: 'Project' | 'Sent' | 'Topped';
}

export default function HistoryScreen() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return '—'; }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={C.accent} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="history-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Route History</Text>
        <Text style={styles.subtitle}>{routes.length} climb{routes.length !== 1 ? 's' : ''}</Text>
      </View>

      {routes.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={64} color={C.muted} />
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySub}>Analyzed routes will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`history-card-${item.id}`}>
              <View style={styles.cardTop}>
                {/* Grade */}
                <View style={[styles.gradePill, { backgroundColor: gradeColor(item.grade) + '1A', borderColor: gradeColor(item.grade) }]}>
                  <Text style={[styles.gradeLabel, { color: gradeColor(item.grade) }]}>{item.grade}</Text>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={styles.gymName} numberOfLines={1}>{item.gym_name}</Text>
                  <Text style={styles.dateText}>{formatDate(item.analyzed_at)}</Text>
                </View>

                {/* Delete */}
                <TouchableOpacity
                  testID={`delete-route-${item.id}`}
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={C.muted} />
                </TouchableOpacity>
              </View>

              {/* Metrics */}
              <View style={styles.metrics}>
                <MetricChip icon="disc-outline" label={`${item.holds_count} holds`} />
                <MetricChip icon="shield-checkmark-outline" label={`${Math.round(item.confidence * 100)}% conf.`} />
              </View>

              <View style={styles.statusSection}>
  <Text style={styles.statusLabel}>Status</Text>
  <View style={styles.statusRow}>
    {(['Project', 'Sent', 'Topped'] as const).map(statusOption => {
      const isActive = item.status === statusOption;
      return (
        <TouchableOpacity
          key={statusOption}
          style={[
            styles.statusBtn,
            isActive && styles.statusBtnActive,
          ]}
          onPress={() => handleStatusChange(item.id, statusOption)}
        >
          <Text
            style={[
              styles.statusBtnText,
              isActive && styles.statusBtnTextActive,
            ]}
          >
            {statusOption}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
</View>

              {/* Notes */}
              {item.notes ? (
                <View style={styles.notesWrap}>
                  <Ionicons name="chatbubble-outline" size={12} color={C.muted} />
                  <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function MetricChip({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={12} color={C.muted} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusSection: {
  marginBottom: 10,
},
statusLabel: {
  fontSize: 12,
  color: C.secondary,
  marginBottom: 6,
  fontWeight: '600',
},
statusRow: {
  flexDirection: 'row',
  gap: 8,
},
statusBtn: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 999,
  backgroundColor: C.border,
  borderWidth: 1,
  borderColor: C.border,
},
statusBtnActive: {
  backgroundColor: 'rgba(34,211,238,0.14)',
  borderColor: C.accent,
},
statusBtnText: {
  fontSize: 12,
  color: C.secondary,
  fontWeight: '600',
},
statusBtnTextActive: {
  color: C.accent,
},
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: C.primary },
  subtitle: { fontSize: 13, color: C.secondary, marginTop: 2 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  gradePill: { width: 60, height: 60, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gradeLabel: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1 },
  gymName: { fontSize: 15, fontWeight: '600', color: C.primary },
  dateText: { fontSize: 12, color: C.secondary, marginTop: 2 },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#27272a', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, color: C.muted },
  notesWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  notes: { fontSize: 12, color: C.secondary, lineHeight: 18, flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: C.secondary },
  emptySub: { fontSize: 14, color: C.muted },
});
