"""
History routes — GET /api/history, DELETE /api/history/{id}
"""
import logging
from typing import Optional

from fastapi import APIRouter, Query
from models.schemas import RouteRecord, RouteHistoryResponse
from database import db

router = APIRouter(prefix="/api", tags=["history"])
logger = logging.getLogger(__name__)


@router.get("/history", response_model=RouteHistoryResponse)
async def get_history(
    user_id: str = Query(default="guest"),
    limit: int = Query(default=50, le=200),
):
    """Return paginated route history for a user."""
    cursor = (
        db.route_history.find({"user_id": user_id}, {"_id": 0})
        .sort("analyzed_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    routes = []
    for doc in docs:
        try:
            routes.append(RouteRecord(**doc))
        except Exception as exc:
            logger.warning(f"Skipping malformed history doc: {exc}")
    return RouteHistoryResponse(routes=routes, total=len(routes))


@router.delete("/history/{record_id}")
async def delete_history_entry(record_id: str):
    """Delete a single history entry by its record ID."""
    result = await db.route_history.delete_one({"id": record_id})
    if result.deleted_count == 0:
        return {"deleted": False, "message": "Record not found"}
    return {"deleted": True, "id": record_id}


@router.get("/history/stats")
async def get_stats(user_id: str = Query(default="guest")):
    """Aggregate stats: total routes, grade distribution, best grade."""
    docs = await db.route_history.find({"user_id": user_id}, {"grade": 1, "_id": 0}).to_list(1000)
    if not docs:
        return {"total_routes": 0, "best_grade": None, "grades": {}}

    grade_map: dict[str, int] = {}
    for doc in docs:
        g = doc.get("grade", "V?")
        grade_map[g] = grade_map.get(g, 0) + 1

    # Determine best V-grade numerically
    def _grade_num(g: str) -> int:
        try:
            return int(g.replace("V", "").replace("+", "").split("-")[0])
        except Exception:
            return -1

    best = max(grade_map.keys(), key=_grade_num, default=None)
    return {"total_routes": len(docs), "best_grade": best, "grades": grade_map}
