import { auth } from '../firebaseConfig'; // <-- IMPORT FOARTE IMPORTANT
import Constants from 'expo-constants';

// Get the actual local IP of the dev machine dynamically from Expo
const getLocalServerUrl = () => {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      // Remove port and add our backend port :8000
      const ip = hostUri.split(':')[0];
      return `http://${ip}:8000`;
    }
  }
  // Fallbacks if not running via Expo Go
  return 'http://[IP_ADDRESS]';
};

// const BASE_URL = getLocalServerUrl();
// const BASE_URL = 'http://10.40.141.116:8000'; //ASTA MERGE LA FACULTATE!!!!!!!!!!!!!!!!! NU STERGE!!!!!!!!!!!
const BASE_URL = 'http://192.168.1.134:8000'; // IP-ul tău local (MAXIM STABIL)
// const BASE_URL = 'https://climb-valy-v3-888.loca.lt'; // Tunel V3 (Ignoră-l dacă face figuri)

// Fetch with timeout (AbortController) — 180s for slow AI inference endpoints (queued requests)
// ---------------------------------------------------------------------------
const fetchWithTimeout = (
  url: string,
  options: RequestInit = {},
  timeoutMs = 180_000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const mergedHeaders: Record<string, string> = {
    'Bypass-Tunnel-Reminder': 'true' // Mandatory for localtunnel APIs
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

// Returns the current user's UID, or 'guest' if not logged in
const getCurrentUserId = () => {
  return auth.currentUser?.uid || 'guest';
};

export const analyzeRoute = async (payload: AnalyzePayload) => {
  try {
    const userId = getCurrentUserId();

    console.log('📡 Fetching:', `${BASE_URL}/api/analyze`, 'for user:', userId);

    const res = await fetchWithTimeout(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        wall_angle: payload.wall_angle || 'Vertical (0 degrees)',
        user_id: userId,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error('❌ Server error:', res.status, errorData);
      throw new Error(`Server error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('❌ Fetch error:', error);
    throw error;
  }
};

export const fetchHistory = async () => {
  const userId = getCurrentUserId();
  const res = await fetchWithTimeout(`${BASE_URL}/api/history?user_id=${userId}`);

  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
  return res.json();
};

export const fetchAnalysisById = async (analysisId: string) => {
  const res = await fetchWithTimeout(`${BASE_URL}/api/analyze/${analysisId}`);
  if (!res.ok) throw new Error(`Fetch analysis failed: ${res.status}`);
  return res.json();
};

export const fetchStats = async () => {
  const userId = getCurrentUserId();
  const res = await fetchWithTimeout(`${BASE_URL}/api/history/stats?user_id=${userId}`);

  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  return res.json();
};

export const deleteHistory = async (recordId: string) => {
  const userId = getCurrentUserId();
  const res = await fetchWithTimeout(`${BASE_URL}/api/history/${recordId}?user_id=${userId}`, {
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


// ---------------------------------------------------------------------------
// Spray Wall API
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Chat / Ask the Coach API
// ---------------------------------------------------------------------------

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