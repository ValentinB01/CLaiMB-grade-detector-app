import os
import uuid
import logging
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from services.pose_service import PoseService, processing_status
from database import db

router = APIRouter()
pose_service = PoseService()
logger = logging.getLogger(__name__)

@router.post("/pose/analyze")
async def analyze_pose(
    video: UploadFile = File(...),
    user_id: str = Form("guest"),
):
    """
    Primește un videoclip și rulează YOLO11 Pose pentru a extrage keypointurile.
    Salvează rezultatul în colecția pose_history pentru The Vault.
    """
    progress_id = str(uuid.uuid4())
    temp_path = f"static/temp_{progress_id}_{video.filename}"

    try:
        os.makedirs("static", exist_ok=True)
        with open(temp_path, "wb") as f:
            content = await video.read()
            f.write(content)

        result = pose_service.process_video(temp_path, progress_id=progress_id)

        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        # Salvăm analiza în MongoDB pentru The Vault
        analysis = result.get("analysis", {})
        pose_doc = {
            "user_id": user_id,
            "efficiency_score": analysis.get("efficiency_score", 0),
            "feedback": analysis.get("feedback", ""),
            "total_active_frames": analysis.get("total_active_frames", 0),
            "frames_with_straight_arms": analysis.get("frames_with_straight_arms", 0),
            "video_url": result.get("video_url", ""),
            "analyzed_at": datetime.utcnow().isoformat(),
        }
        await db.db.pose_history.insert_one(pose_doc)
        logger.info(f"✅ Pose analysis saved for user {user_id}")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Eroare la analiza pose: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.get("/pose/progress/{progress_id}")
async def get_progress(progress_id: str):
    """Returnează progresul procesării video."""
    return {"progress": processing_status.get(progress_id, -1)}
