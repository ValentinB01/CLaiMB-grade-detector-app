import { auth } from '../firebaseConfig'; // <-- IMPORT FOARTE IMPORTANT

const BASE_URL = 'http://192.168.56.1:8000';
// const BASE_URL = 'http://172.20.10.2:8000'

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