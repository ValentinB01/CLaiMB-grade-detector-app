/** Simple in-memory store to pass analysis results between screens. */

// 1. Adăugăm interfața pentru un singur traseu (cum vine de la Gemini)
export interface DetectedRoute {
  color: string;
  holds_ids: number[];
  estimated_grade: string;
  reasoning: string;
}

export interface HoldLocation {
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius: number;
  confidence: number;
  hold_type: string;
  color?: string;
  polygon?: { x: number; y: number }[];
}

export interface AnalysisResult {
  analysis_id: string;
  holds: HoldLocation[];
  grade: string; // Îl păstrăm ca grad general/principal
  confidence: number;
  notes: string;
  gym_name: string;
  processed_at: string;
  image_base64: string; 
  detected_routes?: DetectedRoute[]; 
}

let _pending: AnalysisResult | null = null;

export const setPendingResult = (r: AnalysisResult) => { _pending = r; };
export const getPendingResult = (): AnalysisResult | null => _pending;
export const clearPendingResult = () => { _pending = null; };


// ---------------------------------------------------------------------------
// Spray Wall Types & State
// ---------------------------------------------------------------------------
export interface SprayWallDetection {
  detect_id: string;
  holds: HoldLocation[];
  holds_count: number;
  image_base64: string;
}

export interface SprayWallGradeResult {
  analysis_id: string;
  grade: string;
  confidence: number;
  coaching_notes: string;
  selected_holds_count: number;
  gym_name: string;
  wall_angle: string;
  processed_at: string;
}