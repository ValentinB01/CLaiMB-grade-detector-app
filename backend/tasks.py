"""
Celery tasks for async route analysis.

These tasks mirror the synchronous /api/analyze flow but run inside a
Celery worker process. Start the worker with:
    celery -A worker.celery_app worker --loglevel=info

Without Redis, the FastAPI endpoint handles analysis synchronously.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)

try:
    from worker import celery_app

    @celery_app.task(name="tasks.analyze_route_async", bind=True)
    def analyze_route_async(self, image_base64: str, gym_name: str, analysis_id: str):
        """
        Celery task: runs the full vision + grading pipeline asynchronously.
        Updates the MongoDB route_history document upon completion.
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                _run_analysis(image_base64, gym_name, analysis_id)
            )
        finally:
            loop.close()

except Exception as exc:
    logger.warning(f"Celery tasks not registered (worker unavailable): {exc}")


async def _run_analysis(image_base64: str, gym_name: str, analysis_id: str):
    import os
    from motor.motor_asyncio import AsyncIOMotorClient
    from services.vision_service import VisionService
    from services.grading_service import GradingService
    from datetime import datetime, timezone

    vision = VisionService()
    grading = GradingService()

    holds = await vision.analyze_image(image_base64)
    grade, confidence, notes = await grading.grade_route(holds, image_base64)

    from database import MONGODB_URL, DB_NAME
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]

    await db.route_history.update_one(
        {"analysis_id": analysis_id},
        {
            "$set": {
                "grade": grade,
                "confidence": confidence,
                "notes": notes,
                "holds_count": len(holds),
                "status": "complete",
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    client.close()
    logger.info(f"Async analysis {analysis_id} complete: {grade}")
