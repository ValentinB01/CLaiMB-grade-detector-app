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
KP_LEFT_HIP       = 11
KP_RIGHT_HIP      = 12
KP_LEFT_ANKLE     = 15
KP_RIGHT_ANKLE    = 16

STRAIGHT_ARM_THRESHOLD = 150  # degrees – above this the arm is considered "efficient"
BALANCE_MARGIN_PCT     = 0.15  # 15% tolerance on each side of the base of support
FLUIDITY_THRESHOLD     = 0.07  # ratio – net CoM displacement must exceed 7% of torso to be "moving"
FLUIDITY_WINDOW_FRAMES = 12    # frames – look-back window for displacement measurement
FLUIDITY_Y_WEIGHT      = 1.8   # vertical movement counts 1.8× more than horizontal (climbing = upward)
COM_SMOOTH_WINDOW      = 5     # frames – moving-average kernel to de-noise YOLO jitter
ACTIVE_Y_JUMP_THRESH   = 0.15  # ratio – min Y displacement (relative to torso) to mark climbing start


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

        # ── Balance / Center of Gravity counters ──
        balance_active_frames = 0
        frames_in_balance = 0

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

            # ── Center of Gravity / Base of Support ──
            if len(keypoints) > KP_RIGHT_ANKLE:
                left_hip    = keypoints[KP_LEFT_HIP]
                right_hip   = keypoints[KP_RIGHT_HIP]
                left_ankle  = keypoints[KP_LEFT_ANKLE]
                right_ankle = keypoints[KP_RIGHT_ANKLE]

                hips_valid  = _keypoint_valid(left_hip) and _keypoint_valid(right_hip)
                feet_valid  = _keypoint_valid(left_ankle) and _keypoint_valid(right_ankle)

                if hips_valid and feet_valid:
                    balance_active_frames += 1

                    x_center_mass = (left_hip[0] + right_hip[0]) / 2.0
                    min_x_feet = min(left_ankle[0], right_ankle[0])
                    max_x_feet = max(left_ankle[0], right_ankle[0])

                    base_width = max_x_feet - min_x_feet
                    margin = base_width * BALANCE_MARGIN_PCT

                    if (min_x_feet - margin) <= x_center_mass <= (max_x_feet + margin):
                        frames_in_balance += 1

        # ── Time Under Tension / Fluidity ──
        sorted_keys = sorted(frames_data.keys(), key=int)

        # 1. Collect raw centre-of-mass + per-frame torso length for normalisation
        raw_com: List[Tuple[str, float, float, float]] = []  # (key, cx, cy, torso_len)
        for frame_key in sorted_keys:
            keypoints = frames_data[frame_key]
            if len(keypoints) <= KP_RIGHT_HIP:
                continue
            l_hip = keypoints[KP_LEFT_HIP]
            r_hip = keypoints[KP_RIGHT_HIP]
            l_sh  = keypoints[KP_LEFT_SHOULDER]
            if not (_keypoint_valid(l_hip) and _keypoint_valid(r_hip)):
                continue
            cx = (l_hip[0] + r_hip[0]) / 2.0
            cy = (l_hip[1] + r_hip[1]) / 2.0
            # torso reference = left shoulder → left hip (robust single-side measurement)
            if _keypoint_valid(l_sh):
                torso = math.dist((l_sh[0], l_sh[1]), (l_hip[0], l_hip[1]))
            else:
                torso = 0.0
            raw_com.append((frame_key, cx, cy, torso))

        # 2. Smoothing – simple moving average on cx, cy to kill YOLO jitter
        half_k = COM_SMOOTH_WINDOW // 2
        smoothed_com: List[Tuple[str, float, float, float]] = []
        for i in range(len(raw_com)):
            lo = max(0, i - half_k)
            hi = min(len(raw_com), i + half_k + 1)
            avg_cx = sum(r[1] for r in raw_com[lo:hi]) / (hi - lo)
            avg_cy = sum(r[2] for r in raw_com[lo:hi]) / (hi - lo)
            smoothed_com.append((raw_com[i][0], avg_cx, avg_cy, raw_com[i][3]))

        # median torso length as stable reference (ignores outlier frames)
        torso_lengths = sorted(t for (_, _, _, t) in smoothed_com if t > 0)
        if torso_lengths:
            median_torso = torso_lengths[len(torso_lengths) // 2]
        else:
            median_torso = 1.0  # fallback – treat as raw pixels

        # 3. Determine active climbing window (relative to torso length)
        active_start_idx = 0
        active_end_idx = len(smoothed_com) - 1
        if len(smoothed_com) > 1:
            first_y = smoothed_com[0][2]
            for i, (_, _, cy, _) in enumerate(smoothed_com):
                if abs(first_y - cy) / median_torso >= ACTIVE_Y_JUMP_THRESH:
                    active_start_idx = i
                    break
            last_y = smoothed_com[-1][2]
            for i in range(len(smoothed_com) - 1, -1, -1):
                if abs(last_y - smoothed_com[i][2]) / median_torso >= ACTIVE_Y_JUMP_THRESH:
                    active_end_idx = i
                    break

        active_com = smoothed_com[active_start_idx:active_end_idx + 1]

        # 4. Classify each active frame as moving or static
        #    We use a weighted Euclidean distance where vertical movement
        #    (climbing direction) counts FLUIDITY_Y_WEIGHT× more than horizontal
        #    sway. This filters out lateral resting-sway while rewarding
        #    intentional upward/downward displacement toward the next hold.
        #
        #    Sway filter: when the net displacement over the full window is
        #    below the threshold, ALL frames in that window are marked static
        #    (the climber was oscillating in place, not progressing).
        n = len(active_com)
        window = max(1, FLUIDITY_WINDOW_FRAMES)
        # Pre-compute per-frame label: True = moving
        frame_moving = [False] * n

        for i in range(n):
            ref_idx = max(0, i - window)
            dx = active_com[i][1] - active_com[ref_idx][1]
            dy = active_com[i][2] - active_com[ref_idx][2]
            weighted_dist = math.sqrt(dx * dx + (dy * FLUIDITY_Y_WEIGHT) ** 2)
            relative_dist = weighted_dist / median_torso
            frame_moving[i] = relative_dist >= FLUIDITY_THRESHOLD

        # Sway filter: if the END of a window is static, force all frames
        # in that window to static (prevents counting sway-oscillation frames
        # that individually crossed the threshold but returned to origin).
        for i in range(n):
            if not frame_moving[i]:
                lo = max(0, i - window + 1)
                for j in range(lo, i + 1):
                    frame_moving[j] = False

        moving_frames = sum(frame_moving)
        static_frames = n - moving_frames
        total_active_fluidity = n

        # ── Compute final scores ──
        if total_active_frames > 0:
            efficiency_score = round(
                (frames_with_straight_arms / total_active_frames) * 100
            )
        else:
            efficiency_score = 0

        flexed_pct = 100 - efficiency_score

        if balance_active_frames > 0:
            balance_score = round(
                (frames_in_balance / balance_active_frames) * 100
            )
        else:
            balance_score = 0

        off_balance_pct = 100 - balance_score

        if total_active_fluidity > 0:
            fluidity_score = round(
                (moving_frames / total_active_fluidity) * 100
            )
        else:
            fluidity_score = 0
        fluidity_score = max(0, min(100, fluidity_score))
        static_pct = 100 - fluidity_score

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

        # ── Generate balance feedback ──
        if balance_score >= 80:
            balance_feedback = (
                f"Excelent! Centrul tau de greutate a ramas deasupra bazei de sustinere "
                f"in {balance_score}% din timp. Echilibrul tau este foarte bun!"
            )
        elif balance_score >= 50:
            balance_feedback = (
                f"Centrul tau de greutate a iesit din baza de sustinere in {off_balance_pct}% din timp. "
                "Incearca sa iti muti soldurile deasupra picioarelor inainte de a intinde mana."
            )
        else:
            balance_feedback = (
                f"Centrul tau de greutate a fost in afara bazei de sustinere in {off_balance_pct}% din timp. "
                "Acest lucru indica un dezechilibru frecvent (barn door). "
                "Concentreaza-te pe a aduce soldurile deasupra picioarelor pentru stabilitate!"
            )

        # ── Generate fluidity (Time Under Tension) feedback ──
        if fluidity_score >= 80:
            fluidity_feedback = (
                f"Excelent! Ai mentinut un ritm fluid in {fluidity_score}% din timp. "
                "Miscarea ta este cursiva si eficienta energetic!"
            )
        elif fluidity_score >= 50:
            fluidity_feedback = (
                f"Ai petrecut {static_pct}% din timp ezitand intr-o pozitie statica. "
                "Incearca sa citesti traseul de jos pentru a mentine un ritm fluid si a salva energie."
            )
        else:
            fluidity_feedback = (
                f"Ai petrecut {static_pct}% din timp blocat intr-o pozitie statica. "
                "Acest lucru consuma energie si indica ezitare frecventa. "
                "Planifica-ti miscarile inainte de a urca si concentreaza-te pe un ritm constant!"
            )

        # ── Consolidated overall score & feedback ──
        final_overall_score = round(
            (efficiency_score + balance_score + fluidity_score) / 3
        )
        final_overall_score = max(0, min(100, final_overall_score))

        consolidated_feedback = (
            f"Brate: {feedback} | "
            f"Echilibru: {balance_feedback} | "
            f"Fluiditate: {fluidity_feedback}"
        )

        return {
            "final_overall_score": final_overall_score,
            "consolidated_feedback": consolidated_feedback,
            "efficiency_score": efficiency_score,
            "feedback": feedback,
            "total_active_frames": total_active_frames,
            "frames_with_straight_arms": frames_with_straight_arms,
            "per_frame_angles": per_frame_angles,
            "balance_score": balance_score,
            "balance_feedback": balance_feedback,
            "balance_active_frames": balance_active_frames,
            "frames_in_balance": frames_in_balance,
            "fluidity_score": fluidity_score,
            "fluidity_feedback": fluidity_feedback,
            "static_frames": static_frames,
            "moving_frames": moving_frames,
            "total_active_fluidity_frames": total_active_fluidity,
        }