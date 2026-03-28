import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  primary: '#f8fafc',
  secondary: '#94a3b8',
  muted: '#64748b',
  accent: '#22d3ee',
};

// Dark style map
const customMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "water", stylers: [{ color: "#17263c" }] }
];

interface Gym {
  id: number;
  lat: number;
  lon: number;
  name: string;
  website?: string;
  opening_hours?: string;
}

export default function GymsMapContent() {
  const router = useRouter();
  const { from, current_id } = useLocalSearchParams<{ from?: string, current_id?: string }>();
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [region, setRegion] = useState<any>({
    latitude: 45.9432, // Romania default
    longitude: 24.9668,
    latitudeDelta: 10,
    longitudeDelta: 10,
  });
  
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setGyms([]);
    setSelectedGym(null);
    
    try {
      // 1. Geocode cu Nominatim (Gratuit)
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
        headers: { 'User-Agent': 'CLaiMB-App/1.0' }
      });
      const nomData = await nomRes.json();
      
      if (!nomData || nomData.length === 0) {
        Alert.alert('Location not found', 'Could not find the specified city or country.');
        return;
      }
      
      const loc = nomData[0];
      const lat = parseFloat(loc.lat);
      const lon = parseFloat(loc.lon);
      const bb = loc.boundingbox; // [south, north, west, east] string array
      
      setRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: Math.abs(parseFloat(bb[1]) - parseFloat(bb[0])) * 1.5,
        longitudeDelta: Math.abs(parseFloat(bb[3]) - parseFloat(bb[2])) * 1.5,
      });

      // 2. Extragem sălile de cățărat din acea zonă prin Overpass API
      const overpassQuery = `
        [out:json][timeout:25];
        (
          nwr["sport"~"climbing|bouldering"](${bb[0]},${bb[2]},${bb[1]},${bb[3]});
          nwr["climbing"~"bouldering|sport"](${bb[0]},${bb[2]},${bb[1]},${bb[3]});
          nwr["name"~"climbing|bouldering|climb|boulder|natural high",i](${bb[0]},${bb[2]},${bb[1]},${bb[3]});
        );
        out center;
      `;
      
      const overRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQuery
      });
      
      const overData = await overRes.json();
      
      const foundGyms: Gym[] = [];
      for (const el of overData.elements) {
        const name = el.tags?.name;
        if (!name) continue; // Ignorăm zidurile anonime din parcuri
        
        // Evităm duplicatele vizuale
        if (!foundGyms.find(g => g.name === name)) {
           foundGyms.push({
             id: el.id,
             lat: el.type === 'node' ? el.lat : el.center?.lat,
             lon: el.type === 'node' ? el.lon : el.center?.lon,
             name: name,
             website: el.tags?.website,
             opening_hours: el.tags?.opening_hours
           });
        }
      }
      
      setGyms(foundGyms);
      
      if (foundGyms.length === 0) {
        Alert.alert('No gyms found', 'Try expanding your search to a larger city.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Network Error', 'Failed to fetch map data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onSelectGymForCamera = () => {
    if (selectedGym) {
      if (from === 'camera') {
        router.replace({ pathname: '/camera', params: { selected_gym: selectedGym.name } });
      } else if (from === 'result') {
        // Dacă venim din Result, vrem să ne întoarcem pe Result cu noul param
        router.replace({ pathname: '/result', params: { selected_gym: selectedGym.name, id: current_id || undefined } });
      } else {
        router.back();
      }
      setSelectedGym(null);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        region={region}
        customMapStyle={customMapStyle}
        userInterfaceStyle="dark"
        onPress={() => setSelectedGym(null)} // deselectează la click pe hartă
      >
        {gyms.map(gym => (
          <Marker
            key={gym.id}
            coordinate={{ latitude: gym.lat, longitude: gym.lon }}
            title={gym.name}
            pinColor={C.accent}
            onPress={(e: any) => {
              e.stopPropagation();
              setSelectedGym(gym);
            }}
          />
        ))}
      </MapView>

      {/* Top Search Bar */}
      <View style={styles.searchContainer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={C.primary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Search city e.g. Bucharest..."
          placeholderTextColor={C.secondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          {loading ? <ActivityIndicator color={C.accent} /> : <Ionicons name="search" size={20} color={C.accent} />}
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet for Selected Gym */}
      {selectedGym && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{selectedGym.name}</Text>
            <TouchableOpacity onPress={() => setSelectedGym(null)}>
              <Ionicons name="close-circle" size={24} color={C.secondary} />
            </TouchableOpacity>
          </View>
          
          {selectedGym.website ? (
            <TouchableOpacity onPress={() => Linking.openURL(selectedGym.website!)}>
              <Text style={[styles.sheetText, { color: C.accent, textDecorationLine: 'underline' }]}>🌐 {selectedGym.website}</Text>
            </TouchableOpacity>
          ) : null}
          {selectedGym.opening_hours ? (
            <Text style={styles.sheetText}>🕒 {selectedGym.opening_hours}</Text>
          ) : null}

          {/* Dacă ecranul a fost deschis din Camera (Scan) sau Result, arată butonul uriaș de selectare */}
          {from === 'camera' || from === 'result' ? (
            <TouchableOpacity style={styles.ctaBtn} onPress={onSelectGymForCamera}>
              <LinearGradient colors={['#22d3ee', '#6366f1']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.ctaGradient}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.ctaBtnText}>SELECT THIS GYM</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={{height: 12}} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  backBtn: { marginRight: 12 },
  input: { flex: 1, color: C.primary, fontSize: 16 },
  searchBtn: { padding: 4, marginLeft: 8 },
  
  bottomSheet: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: C.accent, flex: 1 },
  sheetText: { fontSize: 14, color: C.primary, marginBottom: 8 },
  
  ctaBtn: { borderRadius: 9999, overflow: 'hidden', marginTop: 12 },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  ctaBtnText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 1 },
});
