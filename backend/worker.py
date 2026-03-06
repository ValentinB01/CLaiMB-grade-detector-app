"""
Celery worker configuration.

Broker: Redis (REDIS_URL env var).
When Redis is unavailable (dev/demo), tasks are dispatched inline
via FastAPI background tasks — see tasks.py.
"""
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

try:
    from celery import Celery

    celery_app = Celery(
        "claimb",
        broker=REDIS_URL,
        backend=REDIS_URL,
        include=["tasks"],
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
    )
except Exception as exc:
    print(f"[worker] Celery init skipped (Redis unavailable): {exc}")
    celery_app = None
