/** Simple in-memory store to pass analysis results between screens. */

export interface HoldLocation {
  x: number;
  y: number;
  radius: number;
  confidence: number;
  hold_type: string;
  color?: string;
}

export interface AnalysisResult {
  analysis_id: string;
  holds: HoldLocation[];
  grade: string;
  confidence: number;
  notes: string;
  gym_name: string;
  processed_at: string;
  image_base64: string; // attached on frontend before storing
}

let _pending: AnalysisResult | null = null;

export const setPendingResult = (r: AnalysisResult) => { _pending = r; };
export const getPendingResult = (): AnalysisResult | null => _pending;
export const clearPendingResult = () => { _pending = null; };
