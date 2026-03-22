"""
ClAImb AI Coach — FastAPI Application
"""
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Încarcă variabilele de mediu
load_dotenv(Path(__file__).parent / ".env")

# Importuri rute și bază de date
from routes.analysis import router as analysis_router
from routes.history import router as history_router
from routes.pose import router as pose_router
from database import connect_to_mongo, close_mongo_connection

# ---------------------------------------------------------------------------
# 1. Definire Lifespan (Gestionare conexiune MongoDB)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ce se întâmplă la pornire (Startup)
    await connect_to_mongo()
    yield
    # Ce se întâmplă la oprire (Shutdown)
    await close_mongo_connection()

# ---------------------------------------------------------------------------
# 2. App setup (O SINGURĂ INSTANȚĂ)
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ClAImb AI Coach API",
    description="AI-powered climbing route analysis: hold detection + V-scale grading",
    version="1.0.0",
    lifespan=lifespan # Integrăm lifespan-ul aici
)

import os
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------------------------------------------------------------------------
# 3. Middleware (CORS) - Esențial pentru conexiunea cu telefonul
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 4. Routers (Înregistrarea rutelor)
# ---------------------------------------------------------------------------
app.include_router(analysis_router, prefix="/api", tags=["Analysis"])
app.include_router(history_router, prefix="/api", tags=["History"])
app.include_router(pose_router, prefix="/api/pose", tags=["Pose Analysis"])

# ---------------------------------------------------------------------------
# 5. Health check
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ClAImb AI Coach"}

# ---------------------------------------------------------------------------
# 6. Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
)

# ---------------------------------------------------------------------------
# 7. Execuție Server
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print("🚀 Serverul ClAImb pornește pe http://0.0.0.0:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)