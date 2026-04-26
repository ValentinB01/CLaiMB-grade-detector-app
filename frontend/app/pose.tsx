import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

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

// Base backend URL (update with your actual local IP if testing on physical device)
const DEV_API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://10.40.141.116:8000";

export default function PoseAnalysisScreen() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setAnalysisResult(null);
    }
  };

  const recordVideo = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You must allow camera access to record videos!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
      setAnalysisResult(null);
    }
  };

  const uploadAndAnalyze = async () => {
    if (!videoUri) return;

    setIsProcessing(true);
    setProgress(0);
    const progressId = Date.now().toString();
    
    // Start polling the backend for progress updates
    const progressInterval = setInterval(async () => {
      try {
        const res = await fetch(`${DEV_API_URL}/api/pose/progress/${progressId}`);
        if (res.ok) {
          const data = await res.json();
          setProgress(data.progress || 0);
        }
      } catch (e) {
        // Silent fail for polling errors
      }
    }, 500);

    try {
      console.log('Starting video upload for analysis...');
      console.log('Video URI:', videoUri);

      const formData = new FormData();
      formData.append('video', {
        uri: videoUri,
        name: 'climbing_video.mp4',
        type: 'video/mp4',
      } as any);

      console.log('Sending POST request to:', `${DEV_API_URL}/api/pose/analyze-video?progress_id=${progressId}`);

      const response = await fetch(`${DEV_API_URL}/api/pose/analyze-video?progress_id=${progressId}`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // DO NOT explicitly set Content-Type to multipart/form-data in React Native
          // or else the boundary parameter gets stripped out and the backend hangs!
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server returned an error: ${response.status} ${errorText}`);
      }

      console.log('Parsing JSON response...');
      const data = await response.json();
      console.log('Video analysis data received successfully.');
      setAnalysisResult(data.data);
      Alert.alert('Analysis Complete', 'Pose data extracted successfully!');
    } catch (error: any) {
      console.error('Error during video upload/analysis:', error);
      Alert.alert('Error', `Failed to analyze video: ${error.message}`);
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
      }, 500); // Small delay to let user see 100%
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, styles.neonText]}>POSE ANALYSIS</Text>
          <Text style={styles.subtitle}>Upload a video for AI pose estimation</Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.flexBtn]} onPress={pickVideo}>
            <Ionicons name="folder-open-outline" size={24} color={C.primary} style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.flexBtn]} onPress={recordVideo}>
            <Ionicons name="camera-outline" size={24} color={C.primary} style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Record</Text>
          </TouchableOpacity>
        </View>

        {videoUri && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={C.accent} />
              <Text style={styles.cardTitle}>Video Selected</Text>
            </View>
            <Text style={styles.vidUriText} numberOfLines={1} ellipsizeMode="middle">
              {videoUri.split('/').pop() || videoUri}
            </Text>
            
            <TouchableOpacity 
              style={[styles.actionBtn, styles.primaryBtn, isProcessing && { opacity: 0.7 }]} 
              onPress={uploadAndAnalyze}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator color={C.bg} style={{ marginRight: 8 }} />
                  <Text style={[styles.actionBtnText, { color: C.bg }]}>Analyzing Movement...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="analytics-outline" size={20} color={C.bg} style={{ marginRight: 8 }} />
                  <Text style={[styles.actionBtnText, { color: C.bg }]}>Start AI Analysis</Text>
                </>
              )}
            </TouchableOpacity>
            
            {isProcessing && (
              <View style={{ width: '100%', marginTop: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{color: C.secondary, fontSize: 13, fontWeight: '600'}}>AI Processing Engine</Text>
                  <Text style={{color: C.accent, fontSize: 13, fontWeight: '700'}}>{progress}%</Text>
                </View>
                <View style={{ height: 8, backgroundColor: C.bg, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
                  <View style={{ width: `${progress}%`, height: '100%', backgroundColor: C.accent, borderRadius: 4 }} />
                </View>
              </View>
            )}
          </View>
        )}

        {analysisResult && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="stats-chart" size={20} color={C.success} />
              <Text style={styles.cardTitle}>Analysis Results</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Total Frames Processed:</Text>
              <Text style={styles.resultValue}>{analysisResult.metadata?.total_frames || 'N/A'}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Output Framerate:</Text>
              <Text style={styles.resultValue}>{analysisResult.metadata?.fps ? `${Number(analysisResult.metadata.fps).toFixed(1)} FPS` : 'N/A'}</Text>
            </View>
            
            <View style={{ marginTop: 12 }}>
              <Text style={styles.resultLabel}>Metrics Tracked:</Text>
              {analysisResult.analysis?.metrics_available?.map((metric: string) => (
                <View key={metric} style={styles.metricItem}>
                  <Ionicons name="checkmark-circle" size={16} color={C.accent} />
                  <Text style={styles.metricText}>{metric.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
              ))}
            </View>
            
            {analysisResult.video_url && (
              <View style={styles.videoPlayerContainer}>
                <View style={styles.cardHeader}>
                  <Ionicons name="play-circle-outline" size={20} color={C.primary} />
                  <Text style={styles.cardTitle}>Pose Skeleton Overlay</Text>
                </View>
                <Video
                  source={{ uri: `${DEV_API_URL}${analysisResult.video_url}` }}
                  style={styles.videoPlayer}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping
                  shouldPlay
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
    marginTop: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: 1,
  },
  neonText: {
    textShadowColor: 'rgba(34, 211, 238, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 14,
    color: C.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  actionBtn: {
    backgroundColor: C.card,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  flexBtn: {
    flex: 1,
    marginBottom: 0,
  },
  primaryBtn: {
    backgroundColor: C.accent,
    borderColor: C.accent,
    marginTop: 16,
    marginBottom: 0,
  },
  actionBtnText: {
    color: C.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.primary,
  },
  vidUriText: {
    color: C.muted,
    fontSize: 13,
    backgroundColor: C.bg,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    fontFamily: 'monospace',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  resultLabel: {
    color: C.secondary,
    fontSize: 14,
  },
  resultValue: {
    color: C.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: C.bg,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  metricText: {
    color: C.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  videoPlayerContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  videoPlayer: {
    width: '100%',
    height: 400,
    backgroundColor: C.bg,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
});
