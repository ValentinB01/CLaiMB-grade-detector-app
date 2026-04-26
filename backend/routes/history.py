import logging
from typing import Optional

<<<<<<< HEAD
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from models.schemas import RouteRecord, RouteHistoryResponse, PoseRecord, PoseHistoryResponse
=======
from fastapi import APIRouter, Query
from models.schemas import RouteRecord, RouteHistoryResponse, RouteStatus
>>>>>>> main
from database import db

router = APIRouter(tags=["history"])
logger = logging.getLogger(__name__)


@router.get("/history", response_model=RouteHistoryResponse)
async def get_history(user_id: str):
    """Fetch history for a specific user."""
    # Am standardizat numele colecției: 'route_history'
    cursor = db.db.route_history.find({"user_id": user_id}).sort("analyzed_at", -1)
    routes = await cursor.to_list(length=50)
    
    # Formatăm _id-ul de la Mongo într-un string normal
    for route in routes:
        if "_id" in route:
            route["id"] = str(route["_id"])
            del route["_id"]
        if "user_id" not in route:
            route["user_id"] = "guest"
        if "status" not in route:
            route["status"] = "Project"
        
    return {
        "routes": routes,
        "total": len(routes)
        }


@router.delete("/history/{record_id}")
async def delete_history_entry(record_id: str, user_id: str):
    """Delete a single history entry by its record ID, ensuring ownership."""
    # Securitate: ștergem DOAR dacă traseul aparține acestui user_id
    result = await db.db.route_history.delete_one({"id": record_id, "user_id": user_id})    
    if result.deleted_count == 0:
        return {"deleted": False, "message": "Record not found or not authorized"}
    return {"deleted": True, "id": record_id}


@router.get("/history/stats")
async def get_stats(user_id: str): 
    """Aggregate stats: total routes, grade distribution, best grade."""
    # L-am făcut obligatoriu (fără default="guest"), ca să fim siguri că dă datele corecte
    docs = await db.db.route_history.find(
        {"user_id": user_id}, 
        {"grade": 1, "status": 1, "_id": 0}).to_list(1000)
    
    if not docs:
        return {
            "total_routes": 0,
            "best_grade": None,
            "grades": {},
            "statuses": {
                "Project": 0,
                "Sent": 0,
                "Topped": 0
            }
        }
    
    grade_map: dict[str, int] = {}
    status_map: dict[str, int] = {
        "Project": 0,
        "Sent": 0,
        "Topped": 0
    }

    for doc in docs:
        g = doc.get("grade", "V?")
        grade_map[g] = grade_map.get(g, 0) + 1

        status = doc.get("status", "Project")
        status_map[status] = status_map.get(status, 0) + 1

    def _grade_num(g: str) -> int:
        try:
            return int(g.replace("V", "").replace("+", "").split("-")[0])
        except Exception:
            return -1

    best = max(grade_map.keys(), key=_grade_num, default=None)
<<<<<<< HEAD
    return {"total_routes": len(docs), "best_grade": best, "grades": grade_map}


@router.get("/pose-history", response_model=PoseHistoryResponse)
async def get_pose_history(user_id: str):
    """Fetch pose analysis history for The Vault, newest first."""
    cursor = db.db.pose_history.find({"user_id": user_id}).sort("analyzed_at", -1)
    docs = await cursor.to_list(length=50)

    records = []
    for doc in docs:
        records.append(PoseRecord(
            id=str(doc["_id"]),
            user_id=doc.get("user_id", "guest"),
            final_overall_score=doc.get("final_overall_score", 0),
            consolidated_feedback=doc.get("consolidated_feedback", ""),
            efficiency_score=doc.get("efficiency_score", 0),
            feedback=doc.get("feedback", ""),
            balance_score=doc.get("balance_score", 0),
            balance_feedback=doc.get("balance_feedback", ""),
            fluidity_score=doc.get("fluidity_score", 0),
            fluidity_feedback=doc.get("fluidity_feedback", ""),
            total_active_frames=doc.get("total_active_frames", 0),
            frames_with_straight_arms=doc.get("frames_with_straight_arms", 0),
            video_url=doc.get("video_url"),
            analyzed_at=doc.get("analyzed_at", ""),
        ))

    return {"records": records, "total": len(records)}


@router.delete("/pose-history/{analysis_id}")
async def delete_pose_history_entry(analysis_id: str, user_id: str):
    """Delete a single pose analysis from the Vault by its MongoDB _id."""
    result = await db.db.pose_history.delete_one(
        {"_id": ObjectId(analysis_id), "user_id": user_id}
    )
    if result.deleted_count == 1:
        return {"message": "Analiza a fost ștearsă"}
    raise HTTPException(status_code=404, detail="Analiza nu a fost găsită")
=======

    return {
        "total_routes": len(docs),
        "best_grade": best,
        "grades": grade_map,
        "statuses": status_map
    }

@router.patch("/history/{record_id}/status")
async def update_history_status(record_id: str, user_id: str, status: RouteStatus):
    """Update the status of a saved route."""
    result = await db.db.route_history.update_one(
        {"id": record_id, "user_id": user_id},
        {"$set": {"status": status.value}}
    )

    if result.matched_count == 0:
        return {"updated": False, "message": "Record not found or not authorized"}

    return {"updated": True, "id": record_id, "status": status.value}

@router.patch("/history/{record_id}/gym")
async def update_history_gym(record_id: str, user_id: str, gym_name: str):
    """Update the gym name of a saved route."""
    result = await db.db.route_history.update_one(
        {"analysis_id": record_id, "user_id": user_id},
        {"$set": {"gym_name": gym_name}}
    )

    # De rezervă, încercăm și cu 'id' dacă 'analysis_id' nu e prezent (pentru înregistrări vechi)
    if result.matched_count == 0:
        result = await db.db.route_history.update_one(
            {"id": record_id, "user_id": user_id},
            {"$set": {"gym_name": gym_name}}
        )

    if result.matched_count == 0:
        return {"updated": False, "message": "Record not found or not authorized"}

    return {"updated": True, "id": record_id, "gym_name": gym_name}
>>>>>>> main
