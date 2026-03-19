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

const BASE_URL = getLocalServerUrl();

export interface AnalyzePayload {
  image_base64: string;
  wall_angle?: string;
  gym_name: string;
  user_id?: string;
}

// Funcție utilitară: ia ID-ul userului curent sau pune 'guest' dacă nu e logat
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

  const res = await fetch(
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

    const res = await fetch(`${BASE_URL}/api/detect`, {
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

    const res = await fetch(`${BASE_URL}/api/grade-selection`, {
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