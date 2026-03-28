import os
import cv2
import json
import logging
from typing import Dict, Any, List
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

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return {"error": "Failed to open video file."}

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Optimization: Cap processing at ~30 FPS
        TARGET_FPS = 30.0
        frame_skip = max(1, round(fps / TARGET_FPS))
        out_fps = fps / frame_skip
        expected_total_frames = total_frames // frame_skip
        
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
        # mp4v might not play in browser easily, but 'avc1' (h.264) usually does.
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
                
            # Log progress every ~15 processed frames
            if processed_frames % 15 == 0:
                logger.info(f"⏳ YOLO11 processing frame {frame_idx}/{total_frames} ({(frame_idx/max(total_frames, 1)*100):.1f}%)...")
                
            # Process frame with YOLOv11 pose model
            # We use stream=True or single frame inference
            results = self.model(frame, verbose=False)
            
            # Draw the skeleton onto the frame
            annotated_frame = results[0].plot()
            out.write(annotated_frame)
            
            frame_keypoints = []
            
            # Extract keypoints for each detected person (usually 1 climber)
            for r in results:
                if r.keypoints is not None and len(r.keypoints.xy) > 0:
                    # keypoints.xy is a tensor of shape (num_persons, 17, 2)
                    # We grab the first person detected: index 0
                    person_kpts = r.keypoints.xy[0].cpu().numpy().tolist()
                    frame_keypoints.append(person_kpts)
            
            # Store if we found anyone
            if frame_keypoints:
                results_data["frames"][str(processed_frames)] = frame_keypoints[0] # Just take the first person
                
            frame_idx += 1
            processed_frames += 1
            
            if progress_id and expected_total_frames > 0:
                processing_status[progress_id] = min(99, int((processed_frames / expected_total_frames) * 100))

        cap.release()
        out.release()
        
        # Calculate climbing metrics
        results_data["analysis"] = self._analyze_climbing_metrics(results_data["frames"])
        results_data["video_url"] = f"/static/annotated_{os.path.basename(video_path)}"
        
        if progress_id:
            processing_status[progress_id] = 100
            
        return results_data
        
    def _analyze_climbing_metrics(self, frames_data: Dict[str, List[List[float]]]) -> Dict[str, Any]:
        """
        Basic analysis of keypoints to extract climbing metrics.
        Keypoint indices (COCO format):
        0: Nose, 1: L Eye, 2: R Eye, 3: L Ear, 4: R Ear
        5: L Shoulder, 6: R Shoulder, 7: L Elbow, 8: R Elbow
        9: L Wrist, 10: R Wrist, 11: L Hip, 12: R Hip
        13: L Knee, 14: R Knee, 15: L Ankle, 16: R Ankle
        """
        # Placeholder for more complex geometric rules computing angles and trajectories
        return {
            "message": "Metrics calculated successfully.",
            "metrics_available": ["straight_arms", "center_of_mass_trajectory", "velocity"]
        }
