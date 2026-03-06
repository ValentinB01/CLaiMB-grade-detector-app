const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

export interface AnalyzePayload {
  image_base64: string;
  gym_name: string;
  user_id?: string;
}

export const analyzeRoute = async (payload: AnalyzePayload) => {
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, user_id: 'guest' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analysis failed (${res.status}): ${text}`);
  }
  return res.json();
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
