import logging
from typing import Optional

from fastapi import APIRouter, Query
from models.schemas import RouteRecord, RouteHistoryResponse, RouteStatus
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