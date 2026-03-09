import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from models.schemas import AnalysisRequest, AnalysisResponse, RouteRecord
from services.vision_service import VisionService
from services.grading_service import GradingService
from database import db

router = APIRouter(tags=["analysis"])
logger = logging.getLogger(__name__)

_vision = VisionService()
_grading = GradingService()

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_route(request: AnalysisRequest):
    analysis_id = str(uuid.uuid4())
    logger.info(f"Starting analysis {analysis_id} for gym='{request.gym_name}'")

    # --- Pasul 1: Detectarea (Roboflow) ---
    try:
        holds = await _vision.analyze_image(request.image_base64)
    except Exception as exc:
        logger.error(f"VisionService error: {exc}")
        raise HTTPException(status_code=500, detail=f"Vision analysis failed: {str(exc)}")

    # --- Pasul 2: Evaluarea (Gemini) ---
    try:
        # Acum primim și lista completă de trasee (detected_routes)
        detected_routes, grade, confidence, notes = await _grading.grade_route(holds, request.image_base64)
    except Exception as exc:
        logger.error(f"GradingService error: {exc}")
        detected_routes, grade, confidence, notes = [], "V?", 0.0, "Grading unavailable."

    processed_at = datetime.now(timezone.utc).isoformat()

    # --- Pasul 3: Salvarea în Baza de Date ---
    try:
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
            detected_routes=detected_routes # <--- Salvăm lista completă în MongoDB!
        )
        await db.db.route_history.insert_one(record.dict())
        logger.info(f"Saved route record {record.analysis_id}")
    except Exception as exc:
        logger.warning(f"Failed to save history (non-fatal): {exc}")

    # --- Pasul 4: Trimitem răspunsul către Telefon (React Native) ---
    return AnalysisResponse(
        analysis_id=analysis_id,
        holds=holds,
        grade=grade,
        confidence=confidence,
        notes=notes,
        gym_name=request.gym_name or "Unknown Gym",
        processed_at=processed_at,
        detected_routes=detected_routes # <--- Aici e magia care ajunge pe telefon!
    )

@router.get("/analyze/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str):
    doc = await db.db.route_history.find_one({"analysis_id": analysis_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return AnalysisResponse(
        analysis_id=doc["analysis_id"],
        holds=[],  
        grade=doc.get("grade", "V?"),
        confidence=doc.get("confidence", 0.0),
        notes=doc.get("notes", ""),
        gym_name=doc.get("gym_name", "Unknown Gym"),
        processed_at=doc.get("analyzed_at", ""),
        detected_routes=doc.get("detected_routes", []) # Încărcăm traseele și din istoric
    )