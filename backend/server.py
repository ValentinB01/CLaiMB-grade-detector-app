import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Încarcă variabilele de mediu din .env
load_dotenv(Path(__file__).parent / ".env")

# Importuri Bază de date
from database import connect_to_mongo, close_mongo_connection

# Importuri Rute
from routes.users import router as users_router
from routes.community import router as community_router
from routes.analysis import router as analysis_router
from routes.history import router as history_router
from routes.pose import router as pose_router

# ---------------------------------------------------------------------------
# 1. Definire Lifespan (Gestionare conexiune MongoDB)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

# ---------------------------------------------------------------------------
# 2. App setup (O SINGURĂ INSTANȚĂ)
# ---------------------------------------------------------------------------
app = FastAPI(
    title="CLaiMB API",
    description="Backend-ul unificat pentru CLaiMB Coach (AI) & Community (Gamification)",
    version="2.0.0",
    lifespan=lifespan
)

# Creare folder pentru fișierele statice (videoclipurile procesate de YOLO)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------------------------------------------------------------------------
# 3. Middleware (CORS) - Esențial pentru conexiunea cu telefonul
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Atenție: În producție, pune domeniul real sau IP-ul
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 4. Înregistrarea Rutelor (Structură Modulară)
# ---------------------------------------------------------------------------

# --- A. Rute Identitate & Auth ---
app.include_router(users_router, prefix="/users", tags=["Users"])

# --- B. Rute Community (Gamification & Leaderboard) ---
app.include_router(community_router, prefix="/community", tags=["Community"])

# --- C. Rute AI Coach (Rutele vechi, păstrate sub /api pt compatibilitate) ---
app.include_router(analysis_router, prefix="/api", tags=["Analysis"])
app.include_router(history_router, prefix="/api", tags=["History"])
app.include_router(pose_router, prefix="/api", tags=["Pose"])


# ---------------------------------------------------------------------------
# 5. Health check
# ---------------------------------------------------------------------------
@app.get("/")
@app.get("/api/health")
async def health():
    return {
        "status": "ok", 
        "service": "CLaiMB Unified Server",
        "modules_active": ["AI_Coach", "Community_Gamification"]
    }

# ---------------------------------------------------------------------------
# 6. Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
)

# ---------------------------------------------------------------------------
# 7. Execuție Server Local
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print("🚀 Serverul CLaiMB pornește pe http://0.0.0.0:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)