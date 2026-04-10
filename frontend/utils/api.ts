import { auth } from '../firebaseConfig';
import Constants from 'expo-constants';

const getLocalServerUrl = () => {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:8000`;
    }
  }
  return 'http://[IP_ADDRESS]';
};

// const BASE_URL = getLocalServerUrl();
// const BASE_URL = 'http://10.40.141.116:8000'; //ASTA MERGE LA FACULTATE!!!!!!!!!!!!!!!!! NU STERGE!!!!!!!!!!!
const BASE_URL = 'http://192.168.1.129:8000'; // IP-ul tău local (MAXIM STABIL)
// const BASE_URL = 'https://climb-valy-v3-888.loca.lt'; // Tunel V3 (Ignoră-l dacă face figuri)

const fetchWithTimeout = (
  url: string,
  options: RequestInit = {},
  timeoutMs = 180_000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const mergedHeaders: Record<string, string> = {
    'Bypass-Tunnel-Reminder': 'true'
  };
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((val, key) => { mergedHeaders[key] = val; });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, val]) => { mergedHeaders[key] = val; });
    } else {
      Object.assign(mergedHeaders, options.headers);
    }
  }

  return fetch(url, { ...options, headers: mergedHeaders, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
};

export interface AnalyzePayload {
  image_base64: string;
  wall_angle?: string;
  gym_name: string;
  user_id?: string;
}

const getCurrentUserId = () => {
  return auth.currentUser?.uid || 'guest';
};

export const analyzeRoute = async (payload: AnalyzePayload) => {
  try {
    const userId = getCurrentUserId(); // Luăm ID-ul real!
    
    console.log("📡 Încerc fetch la:", `${BASE_URL}/api/analyze`, "pentru user:", userId);
    
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        ...payload, 
        wall_angle: payload.wall_angle || "Vertical (0 degrees)",
        user_id: userId // <-- Trimitem UID-ul real către Backend
      }),
    });
    
    if (!res.ok) {
        const errorData = await res.text();
        console.error("❌ Serverul a răspuns cu eroare:", res.status, errorData);
        throw new Error(`Server error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("❌ EROARE FETCH DETALIATĂ:", error);
    throw error;
  }
};

export const fetchHistory = async () => {
  const userId = getCurrentUserId();
  const res = await fetch(`${BASE_URL}/api/history?user_id=${userId}`); // <-- Filtrăm după user
  
  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
  return res.json();
};

export const fetchStats = async () => {
  const userId = getCurrentUserId();
  const res = await fetch(`${BASE_URL}/api/history/stats?user_id=${userId}`); // <-- Filtrăm după user
  
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  return res.json();
};

export const deleteHistory = async (recordId: string) => {
  const userId = getCurrentUserId();
  // Am adăugat ?user_id=${userId} aici, ca Backend-ul să știe că TU ai voie să ștergi traseul
  const res = await fetch(`${BASE_URL}/api/history/${recordId}?user_id=${userId}`, { 
    method: 'DELETE' 
  });
  
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
};

export const updateHistoryStatus = async (
  recordId: string,
  status: 'Project' | 'Sent' | 'Topped'
) => {
  const userId = getCurrentUserId();

  const res = await fetchWithTimeout(
    `${BASE_URL}/api/history/${recordId}/status?user_id=${userId}&status=${status}`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!res.ok) throw new Error(`Status update failed: ${res.status}`);
  return res.json();
};

export const updateHistoryGym = async (recordId: string, gymName: string) => {
  const userId = getCurrentUserId();
  const response = await fetchWithTimeout(`${BASE_URL}/api/history/${recordId}/gym?user_id=${userId}&gym_name=${encodeURIComponent(gymName)}`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to update gym');
  return response.json();
};


export interface DetectPayload {
  image_base64: string;
  user_id?: string;
}

export interface GradeSelectionPayload {
  image_base64: string;
  selected_hold_indices: number[];
  holds: any[];
  wall_angle?: string;
  gym_name?: string;
  user_id?: string;
}

export const detectHolds = async (payload: DetectPayload) => {
  try {
    const userId = getCurrentUserId();
    console.log("🔍 Spray Wall: Detecting holds...");

    const res = await fetchWithTimeout(`${BASE_URL}/api/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        user_id: userId,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("❌ Detect error:", res.status, errorData);
      throw new Error(`Detect error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("❌ DETECT FETCH ERROR:", error);
    throw error;
  }
};

export const gradeSelection = async (payload: GradeSelectionPayload) => {
  try {
    const userId = getCurrentUserId();
    console.log("🎯 Spray Wall: Grading selection...");

    const res = await fetchWithTimeout(`${BASE_URL}/api/grade-selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        user_id: userId,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("❌ Grade selection error:", res.status, errorData);
      throw new Error(`Grade selection error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("❌ GRADE SELECTION FETCH ERROR:", error);
    throw error;
  }
};


export interface ChatMessagePayload {
  role: 'user' | 'coach';
  text: string;
}

export interface AskCoachPayload {
  image_base64: string;
  holds: any[];
  prompt: string;
  history?: ChatMessagePayload[];
  wall_angle?: string;
  gym_name?: string;
}

// ── Pose History (The Vault) ─────────────────────────────────
export interface PoseRecord {
  id: string;
  user_id: string;
  efficiency_score: number;
  feedback: string;
  total_active_frames: number;
  frames_with_straight_arms: number;
  video_url?: string;
  analyzed_at: string;
}

export const fetchPoseHistory = async (): Promise<{ records: PoseRecord[]; total: number }> => {
  const userId = getCurrentUserId();
  const res = await fetch(`${BASE_URL}/api/pose-history?user_id=${userId}`);
  if (!res.ok) throw new Error(`Pose history fetch failed: ${res.status}`);
  return res.json();
};

// ── Pose / Video Analysis ────────────────────────────────────
export interface PoseAnalysisResult {
  metadata: {
    fps: number;
    width: number;
    height: number;
    total_frames: number;
  };
  frames: Record<string, number[][]>;
  analysis: {
    efficiency_score: number;
    feedback: string;
    total_active_frames: number;
    frames_with_straight_arms: number;
    per_frame_angles: Record<string, Record<string, number>>;
  };
  video_url: string;
}

export const analyzePose = async (
  videoUri: string,
  fileName: string,
  onProgress?: (pct: number) => void
): Promise<PoseAnalysisResult> => {
  const userId = getCurrentUserId();
  const formData = new FormData();
  formData.append('video', {
    uri: videoUri,
    name: fileName || 'climbing_video.mp4',
    type: 'video/mp4',
  } as any);
  formData.append('user_id', userId);

  console.log('🎬 Pose: uploading video to', `${BASE_URL}/api/pose/analyze`, 'for user:', userId);

  const res = await fetchWithTimeout(
    `${BASE_URL}/api/pose/analyze`,
    {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type — fetch will auto-set multipart boundary
    },
    300_000 // 5 min timeout for video processing
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('❌ Pose analysis error:', res.status, errText);
    throw new Error(`Pose analysis error: ${res.status}`);
  }

  return await res.json();
};

export const fetchPoseProgress = async (progressId: string): Promise<number> => {
  const res = await fetch(`${BASE_URL}/api/pose/progress/${progressId}`);
  if (!res.ok) return -1;
  const data = await res.json();
  return data.progress ?? -1;
};

export const askCoach = async (payload: AskCoachPayload) => {
  try {
    const userId = getCurrentUserId();
    console.log("💬 Coaching Chat:", `${BASE_URL}/api/chat`);

    const res = await fetchWithTimeout(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        user_id: userId,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("❌ Ask Coach error:", res.status, errorData);
      throw new Error(`Chat error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("❌ ASK COACH FETCH ERROR:", error);
    throw error;
  }
};