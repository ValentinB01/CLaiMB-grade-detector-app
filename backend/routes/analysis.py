import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from models.schemas import (
<<<<<<< HEAD
    AnalysisRequest, AnalysisResponse, RouteRecord,
    DetectRequest, DetectResponse,
=======
    AnalysisRequest, AnalysisResponse, RouteRecord, RouteStatus,
    DetectRequest, DetectResponse,
    GradeSelectionRequest, GradeSelectionResponse,
    ChatRequest, ChatResponse
>>>>>>> main
)
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
        # Acum trimitem și wall_angle-ul citit din request către Gemini!
        detected_routes, grade, confidence, notes = await _grading.grade_route(
            holds=holds, 
            image_base64=request.image_base64,
            wall_angle=request.wall_angle
        )
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
            status=RouteStatus.PROJECT,
            thumbnail_base64=thumbnail,
            analyzed_at=processed_at,
            user_id=request.user_id if request.user_id else "guest",
            detected_routes=detected_routes,
            image_base64=request.image_base64,
            holds=holds
        )
        await db.db.route_history.insert_one(record.model_dump())
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
        detected_routes=detected_routes
    )

@router.get("/analyze/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str):
    doc = await db.db.route_history.find_one({"analysis_id": analysis_id})
    if not doc:
        # Fallback for old records that used mongo _id instead of analysis_id
        from bson import ObjectId
        try:
            doc = await db.db.route_history.find_one({"_id": ObjectId(analysis_id)})
        except Exception:
            pass
            
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return AnalysisResponse(
        analysis_id=doc["analysis_id"],
        holds=doc.get("holds", []),
        grade=doc.get("grade", "V?"),
        confidence=doc.get("confidence", 0.0),
        notes=doc.get("notes", ""),
        gym_name=doc.get("gym_name", "Unknown Gym"),
        processed_at=doc.get("analyzed_at", ""),
<<<<<<< HEAD
        detected_routes=doc.get("detected_routes", []) # Încărcăm traseele și din istoric
=======
        detected_routes=doc.get("detected_routes", []),
        image_base64=doc.get("image_base64", None)
>>>>>>> main
    )


# ---------------------------------------------------------------------------
<<<<<<< HEAD
# Spray Wall — detect-only endpoint (Roboflow, no Gemini)
# ---------------------------------------------------------------------------
@router.post("/detect", response_model=DetectResponse)
async def detect_holds(request: DetectRequest):
    """Detect holds using Roboflow only. No Gemini grading involved."""
    logger.info("🔍 /api/detect — Running Roboflow hold detection only")
=======
# Spray Wall Endpoints
# ---------------------------------------------------------------------------

@router.post("/detect", response_model=DetectResponse)
async def detect_holds(request: DetectRequest):
    """Step 1: Detect all holds on wall using Roboflow only (no grading)."""
    logger.info("🔍 Spray Wall: Starting hold detection (Roboflow only)")
>>>>>>> main

    try:
        holds = await _vision.analyze_image(request.image_base64)
    except Exception as exc:
<<<<<<< HEAD
        logger.error(f"VisionService error in /detect: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Hold detection failed: {str(exc)}",
        )

    return DetectResponse(
        holds=holds,
        holds_count=len(holds),
=======
        logger.error(f"VisionService error: {exc}")
        raise HTTPException(status_code=500, detail=f"Hold detection failed: {str(exc)}")

    logger.info(f"✅ Spray Wall: Detected {len(holds)} holds")
    return DetectResponse(
        holds=holds,
        holds_count=len(holds)
    )


@router.post("/grade-selection", response_model=GradeSelectionResponse)
async def grade_selection(request: GradeSelectionRequest):
    """Step 2: Grade user-selected holds from spray wall."""
    logger.info(f"🎯 Spray Wall: Grading {len(request.selected_hold_indices)} selected holds")

    # Validate indices
    for idx in request.selected_hold_indices:
        if idx < 0 or idx >= len(request.holds):
            raise HTTPException(
                status_code=400,
                detail=f"Hold index {idx} out of range (0-{len(request.holds)-1})"
            )

    # Extract only selected holds
    selected_holds = [request.holds[i] for i in request.selected_hold_indices]

    # Grade with Gemini
    try:
        grade, confidence, coaching = await _grading.grade_custom_route(
            selected_holds=selected_holds,
            image_base64=request.image_base64,
            wall_angle=request.wall_angle
        )
    except Exception as exc:
        logger.error(f"GradingService error: {exc}")
        grade, confidence, coaching = "V?", 0.0, "Grading unavailable."

    processed_at = datetime.now(timezone.utc).isoformat()
    analysis_id = str(uuid.uuid4())

    # Save to history
    try:
        thumbnail = (request.image_base64[:50000] if request.image_base64 else None)
        record = RouteRecord(
            analysis_id=analysis_id,
            gym_name=request.gym_name or "Unknown Gym",
            grade=grade,
            holds_count=len(selected_holds),
            confidence=confidence,
            notes=f"[Spray Wall] {coaching}",
            status=RouteStatus.PROJECT,
            thumbnail_base64=thumbnail,
            analyzed_at=processed_at,
            user_id=request.user_id if request.user_id else "guest",
            image_base64=request.image_base64,
            holds=selected_holds
        )
        await db.db.route_history.insert_one(record.model_dump())
        logger.info(f"Saved spray wall route {analysis_id}")
    except Exception as exc:
        logger.warning(f"Failed to save spray wall history (non-fatal): {exc}")

    return GradeSelectionResponse(
        analysis_id=analysis_id,
        grade=grade,
        confidence=confidence,
        coaching_notes=coaching,
        selected_holds_count=len(selected_holds),
        gym_name=request.gym_name or "Unknown Gym",
        wall_angle=request.wall_angle or "vertical",
        processed_at=processed_at
    )

# ---------------------------------------------------------------------------
# Ask the Coach Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
async def ask_coach(request: ChatRequest):
    """Interactive AI Coach for a specific route."""
    logger.info(f"💬 Chatting with Coach. Gym: {request.gym_name}, Angle: {request.wall_angle}")

    try:
        # Convert Pydantic history objects to dicts if any
        history_dicts = [{"role": msg.role, "text": msg.text} for msg in request.history]
        
        reply_text = await _grading.chat_with_coach(
            image_base64=request.image_base64,
            holds=request.holds,
            prompt=request.prompt,
            history=history_dicts,
            wall_angle=request.wall_angle
        )
    except Exception as exc:
        logger.error(f"Chat failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Coach is currently unavailable: {str(exc)}")

    return ChatResponse(
        reply=reply_text,
        processed_at=datetime.now(timezone.utc).isoformat()
>>>>>>> main
    )