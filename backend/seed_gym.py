import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

async def seed_database():
    print("🌱 Începem popularea bazei de date cu o Sală demonstrativă...")
    
    # Conectare la baza de date
    mongo_uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    db = client["claimb_db"]
    
    # 1. Creăm Sala
    gym_id = str(uuid.uuid4())
    demo_gym = {
        "gym_id": gym_id,
        "name": "Bouldering Hub București",
        "primary_color": "#ff5722", # Portocaliu
        "address": "Splaiul Independenței, București",
        "is_active": True
    }
    
    await db["gyms"].insert_one(demo_gym)
    print(f"✅ Sala '{demo_gym['name']}' a fost creată! (ID: {gym_id})")
    
    # 2. Creăm câteva trasee pentru această sală
    routes = [
        {"route_id": str(uuid.uuid4()), "gym_id": gym_id, "color": "Galben", "grade": "V2", "points": 100, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_id, "color": "Albastru", "grade": "V3", "points": 200, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_id, "color": "Verde", "grade": "V4", "points": 300, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_id, "color": "Roșu", "grade": "V6", "points": 500, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_id, "color": "Negru", "grade": "V8", "points": 1000, "is_active": True},
    ]
    
    await db["routes"].insert_many(routes)
    print(f"✅ {len(routes)} trasee au fost adăugate pe perete pentru competiție!")
    print("🚀 Gata! Acum putem lucra la Frontend-ul Community.")

if __name__ == "__main__":
    asyncio.run(seed_database())