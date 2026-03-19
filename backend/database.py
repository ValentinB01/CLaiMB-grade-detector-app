import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

MONGODB_URL = os.getenv("MONGODB_URL")
if not MONGODB_URL:
    raise ValueError("❌ MONGODB_URL is missing! Please check backend/.env file.")

DB_NAME = os.getenv("DB_NAME", "claimb_db")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db = Database()

async def connect_to_mongo():
    db.client = AsyncIOMotorClient(MONGODB_URL)
    db.db = db.client[DB_NAME]
    print("✅ Conectat la MongoDB Atlas!")

async def close_mongo_connection():
    db.client.close()
    print("❌ Conexiune MongoDB închisă.")

# Funcție utilă pentru a salva un traseu
async def save_route(route_data: dict):
    result = await db.db.routes.insert_one(route_data)
    return str(result.inserted_id)

# Funcție pentru a lua istoricul
async def get_all_routes():
    cursor = db.db.routes.find().sort("created_at", -1)
    routes = await cursor.to_list(length=100)
    for r in routes:
        r["_id"] = str(r["_id"]) # Convertim ID-ul MongoDB în string pentru JSON
    return routes