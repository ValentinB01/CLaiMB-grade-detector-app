import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def cleanup_database():
    print("🧹 Curățăm duplicatele...")
    
    mongo_uri = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    db = client["claimb_db"]
    
    # Ștergem DOAR O instanță cu acest nume
    # Dacă ai 2, va rămâne 1. Dacă ai 3, va trebui să rulezi de 2 ori.
    result = await db["gyms"].delete_one({"name": "Bouldering Hub București"})
    
    if result.deleted_count > 0:
        print("✅ O instanță duplicat a fost ștearsă cu succes.")
    else:
        print("❓ Nu am găsit nicio sală cu acest nume pentru ștergere.")

    # SFAT: Dacă vrei să golești TOT și să o iei de la zero curat:
    # await db["gyms"].delete_many({})
    # await db["routes"].delete_many({})
    # print("🗑️ Baza de date a fost golită complet.")

if __name__ == "__main__":
    asyncio.run(cleanup_database())