from fastapi import APIRouter, HTTPException
from models.schemas import Gym, GymRoute, Ascent
from database import db
from typing import List

router = APIRouter()

# 1. Obține lista tuturor sălilor de pe platformă
@router.get("/gyms", response_model=List[Gym])
async def get_gyms():
    gyms = await db.db["gyms"].find({"is_active": True}).to_list(100)
    return gyms

# 2. Obține detaliile unei săli specifice
@router.get("/gyms/{gym_id}", response_model=Gym)
async def get_gym(gym_id: str):
    gym = await db.db["gyms"].find_one({"gym_id": gym_id, "is_active": True})
    if not gym:
        raise HTTPException(status_code=404, detail="Sala nu a fost găsită.")
    return gym

# 3. Obține traseele active dintr-o sală specifică
@router.get("/gyms/{gym_id}/routes", response_model=List[GymRoute])
async def get_gym_routes(gym_id: str):
    routes = await db.db["routes"].find({"gym_id": gym_id, "is_active": True}).to_list(1000)
    return routes

# 3. Înregistrează o reușită (Bifează un traseu)
@router.post("/ascents", response_model=Ascent)
async def log_ascent(ascent: Ascent):
    # Căutăm traseul ca să vedem câte puncte de bază oferă
    route = await db.db["routes"].find_one({"route_id": ascent.route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Traseul nu a fost găsit în baza de date.")
    
    base_points = route.get("points", 100)
    
    # Sistemul de Gamificare (Calcularea punctelor în funcție de stilul ales)
    if ascent.style == "Flash":
        ascent.points_awarded = base_points + 50  # Bonus pentru flash
    elif ascent.style == "Zone":
        ascent.points_awarded = base_points // 2  # Jumătate de puncte dacă a ajuns doar la zonă
    elif ascent.style == "Attempt":
        ascent.points_awarded = 0                 # Fără puncte dacă doar a încercat
    else:
        ascent.points_awarded = base_points       # Redpoint (Punctaj standard)

    # Salvăm reușita în MongoDB
    ascent_dict = ascent.dict()
    await db.db["ascents"].insert_one(ascent_dict)
    return ascent_dict

# 4. Generează Clasamentul (Leaderboard) pentru o sală
@router.get("/gyms/{gym_id}/leaderboard")
async def get_leaderboard(gym_id: str):
    # Agregare MongoDB: Adună toate punctele (points_awarded) grupate după user_id
    pipeline = [
        {"$match": {"gym_id": gym_id}},
        {"$group": {"_id": "$user_id", "total_points": {"$sum": "$points_awarded"}}},
        {"$sort": {"total_points": -1}}, # Sortează descrescător (cine are cele mai multe puncte)
        {"$limit": 50}                   # Arată doar top 50
    ]
    
    leaderboard = await db.db["ascents"].aggregate(pipeline).to_list(50)
    
    # Acum luăm ID-urile și le asociem cu numele reale ale cățărătorilor din colecția 'users'
    result = []
    for index, entry in enumerate(leaderboard):
        user = await db.db["users"].find_one({"uid": entry["_id"]})
        result.append({
            "rank": index + 1,
            "user_id": entry["_id"],
            "name": user["display_name"] if user else "Cățărător Anonim",
            "points": entry["total_points"]
        })
        
    return result

# 5. Generează Clasamentul Global (toate sălile)
@router.get("/leaderboard/global")
async def get_global_leaderboard():
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "total_points": {"$sum": "$points_awarded"},
            "gym_id": {"$last": "$gym_id"},
        }},
        {"$sort": {"total_points": -1}},
        {"$limit": 50}
    ]

    leaderboard = await db.db["ascents"].aggregate(pipeline).to_list(50)

    result = []
    for index, entry in enumerate(leaderboard):
        user = await db.db["users"].find_one({"uid": entry["_id"]})
        gym = await db.db["gyms"].find_one({"gym_id": entry.get("gym_id")})
        result.append({
            "rank": index + 1,
            "user_id": entry["_id"],
            "name": user["display_name"] if user else "Cățărător Anonim",
            "points": entry["total_points"],
            "gym_name": gym["name"] if gym else None,
        })

    return result