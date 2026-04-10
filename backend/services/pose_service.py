import os
import cv2
import json
import math
import logging
from typing import Dict, Any, List, Tuple

# Try to import ultralytics, gracefully handling if it's not installed yet
try:
    from ultralytics import YOLO
    MODEL_LOADED = True
except ImportError:
    YOLO = None
    MODEL_LOADED = False

logger = logging.getLogger(__name__)

# Global dictionary to track video processing progress
processing_status = {}

# ── COCO Keypoint Indices (YOLO Pose) ──────────────────────
KP_LEFT_SHOULDER  = 5
KP_RIGHT_SHOULDER = 6
KP_LEFT_ELBOW     = 7
KP_RIGHT_ELBOW    = 8
KP_LEFT_WRIST     = 9
KP_RIGHT_WRIST    = 10

STRAIGHT_ARM_THRESHOLD = 150  # degrees – above this the arm is considered "efficient"


def calculate_angle(p1: Tuple[float, float],
                    p2: Tuple[float, float],
                    p3: Tuple[float, float]) -> float:
    """
    Calculate the angle (in degrees) at point p2 formed by segments p1→p2 and p3→p2.
    Uses math.atan2 for a robust 0-180° result.
    """
    a = (p1[0] - p2[0], p1[1] - p2[1])
    b = (p3[0] - p2[0], p3[1] - p2[1])
    angle_rad = math.atan2(b[1], b[0]) - math.atan2(a[1], a[0])
    angle_deg = abs(math.degrees(angle_rad))
    if angle_deg > 180:
        angle_deg = 360 - angle_deg
    return angle_deg


def _keypoint_valid(kp: List[float]) -> bool:
    """A keypoint is valid when both x and y are non-zero (YOLO marks missing as 0,0)."""
    return len(kp) >= 2 and (kp[0] != 0 or kp[1] != 0)


class PoseService:
    def __init__(self):
        self.model = None
        if MODEL_LOADED:
            # Load the YOLO11 pose model (it will download automatically if not present)
            try:
                # YOLOv8/9/11 models follow the same naming convention for pose
                self.model = YOLO("yolo11n-pose.pt")
                logger.info("✅ YOLO11 Pose model loaded successfully.")
            except Exception as e:
                logger.error(f"❌ Error loading YOLO11 pose model: {e}")
        else:
            logger.warning("⚠️ Ultralytics is not installed. Pose service will not work. Please run: pip install ultralytics")

    def process_video(self, video_path: str, progress_id: str = None) -> Dict[str, Any]:
        """
        Process a climbing video frame by frame to extract human pose keypoints.
        Returns a dictionary mapping frame indices to keypoint data.
        """
        if progress_id:
            processing_status[progress_id] = 0
            
        if not self.model:
            return {"error": "Pose model not loaded. Ensure ultralytics is installed."}
            
        if not os.path.exists(video_path):
            return {"error": "Video file not found."}

        cap = None
        out = None
        
        # Plasa de siguranță globală
        try:
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return {"error": "Failed to open video file (Unsupported format)."}

            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            # Optimization: Cap processing at ~30 FPS with division-by-zero guards
            TARGET_FPS = 30.0
            frame_skip = max(1, round(fps / TARGET_FPS)) if fps > 0 else 1
            out_fps = fps / frame_skip if fps > 0 else 30
            expected_total_frames = total_frames // frame_skip if frame_skip > 0 else 0
            
            results_data = {
                "metadata": {
                    "fps": out_fps,
                    "width": frame_width,
                    "height": frame_height,
                    "total_frames": expected_total_frames
                },
                "frames": {}
            }

            logger.info(f"📹 Loaded video: {total_frames} frames ({fps} FPS), skipping {frame_skip-1} frames between processing (Target: ~{out_fps:.1f} FPS for {expected_total_frames} frames)")

            os.makedirs("static", exist_ok=True)
            out_filename = f"static/annotated_{os.path.basename(video_path)}"
            
            # Use web-compatible mp4 encoding if possible, or standard mp4v. 
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(out_filename, fourcc, out_fps, (frame_width, frame_height))

            frame_idx = 0
            processed_frames = 0
            
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                    
                if frame_idx % frame_skip != 0:
                    frame_idx += 1
                    continue
                    
                if processed_frames % 15 == 0:
                    logger.info(f"⏳ YOLO11 processing frame {frame_idx}/{total_frames} ({(frame_idx/max(total_frames, 1)*100):.1f}%)...")
                
                # Plasa de siguranță la nivel de cadru individual
                try:
                    results = self.model(frame, verbose=False)
                    annotated_frame = results[0].plot()
                    out.write(annotated_frame)
                    
                    frame_keypoints = []
                    for r in results:
                        if r.keypoints is not None and len(r.keypoints.xy) > 0:
                            person_kpts = r.keypoints.xy[0].cpu().numpy().tolist()
                            frame_keypoints.append(person_kpts)
                    
                    if frame_keypoints:
                        results_data["frames"][str(processed_frames)] = frame_keypoints[0]
                        
                except Exception as frame_e:
                    logger.warning(f"⚠️ Error processing frame {frame_idx}, skipping to next: {frame_e}")
                
                frame_idx += 1
                processed_frames += 1
                
                if progress_id and expected_total_frames > 0:
                    processing_status[progress_id] = min(99, int((processed_frames / expected_total_frames) * 100))

            # Calculate climbing metrics
            results_data["analysis"] = self._analyze_climbing_metrics(results_data["frames"])
            results_data["video_url"] = f"/static/annotated_{os.path.basename(video_path)}"
            
            if progress_id:
                processing_status[progress_id] = 100
                
            return results_data

        except Exception as e:
            logger.error(f"❌ Eroare critică la procesarea video: {e}")
            if progress_id:
                processing_status[progress_id] = -1 # Marcăm cu eroare
            return {"error": f"Internal video processing error: {str(e)}"}
            
        finally:
            # Acest bloc 'finally' se execută GARANTAT la final, eliberând memorie RAM
            if cap is not None:
                cap.release()
            if out is not None:
                out.release()
        
    def _analyze_climbing_metrics(self, frames_data: Dict[str, List[List[float]]]) -> Dict[str, Any]:
        """
        Analyse keypoints across all frames and compute climbing heuristics.
        Currently implements: Arm Efficiency (Straight Arm Rule).
        """
        total_active_frames = 0
        frames_with_straight_arms = 0
        per_frame_angles: Dict[str, Dict[str, float]] = {}

        for frame_key, keypoints in frames_data.items():
            # keypoints is a list of [x, y] pairs indexed by COCO id
            if len(keypoints) < 11:
                continue  # not enough keypoints detected

            left_shoulder  = keypoints[KP_LEFT_SHOULDER]
            left_elbow     = keypoints[KP_LEFT_ELBOW]
            left_wrist     = keypoints[KP_LEFT_WRIST]
            right_shoulder = keypoints[KP_RIGHT_SHOULDER]
            right_elbow    = keypoints[KP_RIGHT_ELBOW]
            right_wrist    = keypoints[KP_RIGHT_WRIST]

            left_valid  = all(_keypoint_valid(kp) for kp in [left_shoulder, left_elbow, left_wrist])
            right_valid = all(_keypoint_valid(kp) for kp in [right_shoulder, right_elbow, right_wrist])

            if not left_valid and not right_valid:
                continue  # cannot evaluate any arm

            total_active_frames += 1
            frame_angles: Dict[str, float] = {}

            left_straight = False
            right_straight = False

            if left_valid:
                left_angle = calculate_angle(
                    tuple(left_shoulder), tuple(left_elbow), tuple(left_wrist)
                )
                frame_angles["left_elbow"] = round(left_angle, 1)
                left_straight = left_angle > STRAIGHT_ARM_THRESHOLD

            if right_valid:
                right_angle = calculate_angle(
                    tuple(right_shoulder), tuple(right_elbow), tuple(right_wrist)
                )
                frame_angles["right_elbow"] = round(right_angle, 1)
                right_straight = right_angle > STRAIGHT_ARM_THRESHOLD

            # Frame counts as "efficient" if at least one arm is straight
            if left_straight or right_straight:
                frames_with_straight_arms += 1

            per_frame_angles[frame_key] = frame_angles

        # ── Compute final score ──
        if total_active_frames > 0:
            efficiency_score = round(
                (frames_with_straight_arms / total_active_frames) * 100
            )
        else:
            efficiency_score = 0

        flexed_pct = 100 - efficiency_score

        # ── Generate human-readable feedback ──
        if efficiency_score >= 80:
            feedback = (
                f"Excelent! Ai mentinut bratele intinse in {efficiency_score}% din timp. "
                "Continua sa lasi greutatea pe schelet pentru a economisi energie!"
            )
        elif efficiency_score >= 50:
            feedback = (
                f"Ai tinut bratele flexate in {flexed_pct}% din timp. "
                "Incearca sa lasi greutatea pe schelet (brate intinse) "
                "pentru a salva energie pe prizele bune!"
            )
        else:
            feedback = (
                f"Bratele tale au fost flexate in {flexed_pct}% din timp. "
                "Acest lucru consuma foarte multa energie. "
                "Concentreaza-te pe a intinde bratele complet atunci cand "
                "citesti urmatoarea miscare!"
            )

        return {
            "efficiency_score": efficiency_score,
            "feedback": feedback,
            "total_active_frames": total_active_frames,
            "frames_with_straight_arms": frames_with_straight_arms,
            "per_frame_angles": per_frame_angles,
        }