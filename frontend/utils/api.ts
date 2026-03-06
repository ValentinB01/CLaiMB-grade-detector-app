const BASE_URL = 'http://192.168.1.130:8000';
export interface AnalyzePayload {
  image_base64: string;
  gym_name: string;
  user_id?: string;
}

export const analyzeRoute = async (payload: AnalyzePayload) => {
  try {
    console.log("📡 Încerc fetch la:", `${BASE_URL}/api/analyze`);
    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json' // <--- ADAUGĂ ACEASTĂ LINIE
      },
      body: JSON.stringify({ ...payload, user_id: 'guest' }),
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
  const res = await fetch(`${BASE_URL}/api/history?user_id=guest`);
  if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
  return res.json();
};

export const fetchStats = async () => {
  const res = await fetch(`${BASE_URL}/api/history/stats?user_id=guest`);
  if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
  return res.json();
};

export const deleteHistory = async (recordId: string) => {
  const res = await fetch(`${BASE_URL}/api/history/${recordId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
};
