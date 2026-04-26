import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

async def seed_database():
    print("🌱 Începem popularea bazei de date cu săli demonstrative...")
    
    # Conectare la baza de date
    mongo_uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    db = client["claimb_db"]
    
    # ==========================================
    # 🏢 SALA 1: Bouldering Hub București
    # ==========================================
    gym_1_id = str(uuid.uuid4())
    gym_1 = {
        "gym_id": gym_1_id,
        "name": "Bouldering Hub București",
        "primary_color": "#ff5722", # Portocaliu
        "address": "Splaiul Independenței, București",
        "is_active": True
    }
    
    await db["gyms"].insert_one(gym_1)
    print(f"✅ Sala '{gym_1['name']}' a fost creată! (ID: {gym_1_id})")
    
    routes_1 = [
        {"route_id": str(uuid.uuid4()), "gym_id": gym_1_id, "color": "Galben", "grade": "V2", "points": 100, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_1_id, "color": "Albastru", "grade": "V3", "points": 200, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_1_id, "color": "Verde", "grade": "V4", "points": 300, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_1_id, "color": "Roșu", "grade": "V6", "points": 500, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_1_id, "color": "Negru", "grade": "V8", "points": 1000, "is_active": True},
    ]
    
    await db["routes"].insert_many(routes_1)
    print(f"✅ {len(routes_1)} trasee adăugate pentru {gym_1['name']}.")

    # ==========================================
    # 🏢 SALA 2: Carpatic Bouldering
    # ==========================================
    gym_2_id = str(uuid.uuid4())
    gym_2 = {
        "gym_id": gym_2_id,
        "name": "Carpatic Bouldering",
        "primary_color": "#00bcd4", # Cyan / Albastru deschis
        "address": "Bulevardul Vasile Milea, București",
        "is_active": True
    }
    
    await db["gyms"].insert_one(gym_2)
    print(f"✅ Sala '{gym_2['name']}' a fost creată! (ID: {gym_2_id})")
    
    # Am pus alte culori și grade pentru a testa mai bine interfața de Explore
    routes_2 = [
        {"route_id": str(uuid.uuid4()), "gym_id": gym_2_id, "color": "Roz", "grade": "V1", "points": 50, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_2_id, "color": "Galben", "grade": "V2", "points": 100, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_2_id, "color": "Mov", "grade": "V5", "points": 400, "is_active": True},
        {"route_id": str(uuid.uuid4()), "gym_id": gym_2_id, "color": "Alb", "grade": "V7", "points": 750, "is_active": True},
    ]
    
    await db["routes"].insert_many(routes_2)
    print(f"✅ {len(routes_2)} trasee adăugate pentru {gym_2['name']}.")

    # ==========================================
    print("\n🚀 Gata! Baza de date este populată cu date de test. Acum poți lucra la Frontend-ul Community.")

if __name__ == "__main__":
    asyncio.run(seed_database())