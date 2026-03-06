"""
Analysis routes — POST /api/analyze
Accepts a base64 photo, runs VisionService + GradingService, persists the result.
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from models.schemas import AnalysisRequest, AnalysisResponse, RouteRecord
from services.vision_service import VisionService
from services.grading_service import GradingService
from database import db

router = APIRouter( tags=["analysis"])
logger = logging.getLogger(__name__)

_vision = VisionService()
_grading = GradingService()


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_route(request: AnalysisRequest):
    """
    Main analysis endpoint.
    1. VisionService detects climbing holds (Claude Vision or Roboflow).
    2. GradingService assigns a V-scale grade (Claude Sonnet 4-6).
    3. Result is persisted to MongoDB route_history collection.
    """
    analysis_id = str(uuid.uuid4())
    logger.info(f"Starting analysis {analysis_id} for gym='{request.gym_name}'")

    # --- Step 1: Detect holds ---
    try:
        holds = await _vision.analyze_image(request.image_base64)
    except Exception as exc:
        logger.error(f"VisionService error: {exc}")
        raise HTTPException(status_code=500, detail=f"Vision analysis failed: {str(exc)}")

    # --- Step 2: Grade the route ---
    try:
        grade, confidence, notes = await _grading.grade_route(holds, request.image_base64)
    except Exception as exc:
        logger.error(f"GradingService error: {exc}")
        grade, confidence, notes = "V?", 0.0, "Grading unavailable."

    processed_at = datetime.now(timezone.utc).isoformat()

    # --- Step 3: Persist to history ---
    try:
        # Thumbnail: first 50K chars of base64 to keep DB lean
        thumbnail = (request.image_base64[:50000] if request.image_base64 else None)
        record = RouteRecord(
            analysis_id=analysis_id,
            gym_name=request.gym_name or "Unknown Gym",
            grade=grade,
            holds_count=len(holds),
            confidence=confidence,
            notes=notes,
            thumbnail_base64=thumbnail,
            analyzed_at=processed_at,
            user_id=request.user_id or "guest",
        )
        await db.route_history.insert_one(record.dict())
        logger.info(f"Saved route record {record.id}")
    except Exception as exc:
        logger.warning(f"Failed to save history (non-fatal): {exc}")

    return AnalysisResponse(
        analysis_id=analysis_id,
        holds=holds,
        grade=grade,
        confidence=confidence,
        notes=notes,
        gym_name=request.gym_name or "Unknown Gym",
        processed_at=processed_at,
    )


@router.get("/analyze/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str):
    """Retrieve a previously stored analysis by its ID."""
    doc = await db.route_history.find_one({"analysis_id": analysis_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Re-hydrate minimal response from stored record
    return AnalysisResponse(
        analysis_id=doc["analysis_id"],
        holds=[],  # holds not stored separately; return empty for lookup
        grade=doc.get("grade", "V?"),
        confidence=doc.get("confidence", 0.0),
        notes=doc.get("notes", ""),
        gym_name=doc.get("gym_name", "Unknown Gym"),
        processed_at=doc.get("analyzed_at", ""),
    )
