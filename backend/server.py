"""
ClAImb AI Coach — FastAPI Application

Architecture (Service-Oriented):
  /routes   — HTTP handlers (thin layer)
  /services — AI logic: VisionService, GradingService
  /models   — Pydantic contracts shared between Mobile & Backend
  /worker   — Celery async worker (Redis broker)
  /tasks    — Celery task definitions
"""
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parent / ".env")

from routes.analysis import router as analysis_router
from routes.history import router as history_router

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ClAImb AI Coach API",
    description="AI-powered climbing route analysis: hold detection + V-scale grading",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(analysis_router)
app.include_router(history_router)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ClAImb AI Coach"}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
)
