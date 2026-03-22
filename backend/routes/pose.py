import os
import shutil
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File
from services.pose_service import PoseService, processing_status

router = APIRouter()
logger = logging.getLogger(__name__)
pose_service = PoseService()

# Temporarily store incoming videos for processing
UPLOAD_DIR = "temp_videos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/analyze-video")
def analyze_video(video: UploadFile = File(...), progress_id: Optional[str] = None):
    """
    Endpoint to receive a climbing video, run YOLO11 pose estimation, 
    and return the keypoint coordinates and metrics.
    """
    logger.info(f"🎥 Received video upload for pose analysis: {video.filename}")
    
    # Save the uploaded video to a temporary file
    temp_video_path = os.path.join(UPLOAD_DIR, video.filename)
    
    with open(temp_video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
        
    try:
        # Process the video
        # Note: Depending on video length, this could be slow and might be better
        # offloaded to a background task (e.g. Celery) for production
        logger.info(f"🚀 Starting YOLO11 inference on {video.filename}...")
        results = pose_service.process_video(temp_video_path, progress_id=progress_id)
        logger.info(f"✅ Successfully analyzed {video.filename}!")
    finally:
        # Clean up the temp file
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
            
    return {"status": "success", "data": results}

@router.get("/progress/{progress_id}")
async def get_progress(progress_id: str):
    """
    Returns the current processing percentage for a given progress_id.
    """
    return {"progress": processing_status.get(progress_id, 0)}
