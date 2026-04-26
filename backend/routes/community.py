from fastapi import APIRouter, HTTPException
from models.schemas import Gym, GymRoute, Ascent
from database import db
from typing import List
from datetime import datetime
from bson import ObjectId

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

# 2.5 Actualizează detaliile unei săli (Admin Panel)
@router.put("/gyms/{gym_id}")
async def update_gym(gym_id: str, payload: dict):
    try:
        allowed = {"name", "address", "primary_color"}
        update_fields = {k: v for k, v in payload.items() if k in allowed}
        if not update_fields:
            raise HTTPException(status_code=400, detail="Niciun câmp valid de actualizat.")

        result = await db.db["gyms"].update_one(
            {"gym_id": gym_id},
            {"$set": update_fields}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Sala nu a fost găsită.")

        updated = await db.db["gyms"].find_one({"gym_id": gym_id})
        updated.pop("_id", None)
        return updated

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Eroare la actualizarea sălii: {str(e)}"
        )

# 3. Obține traseele active dintr-o sală specifică
@router.get("/gyms/{gym_id}/routes", response_model=List[GymRoute])
async def get_gym_routes(gym_id: str):
    routes = await db.db["routes"].find({"gym_id": gym_id, "is_active": True}).to_list(1000)
    return routes

# 3.1 Adaugă un traseu nou într-o sală (Admin Panel)
@router.post("/gyms/{gym_id}/routes", response_model=GymRoute)
async def create_gym_route(gym_id: str, route: GymRoute):
    route.gym_id = gym_id
    route_dict = route.dict()
    await db.db["routes"].insert_one(route_dict)
    route_dict.pop("_id", None)
    return route_dict

# 3.2 Șterge (dezactivează) un traseu dintr-o sală (Admin Panel)
@router.delete("/gyms/{gym_id}/routes/{route_id}")
async def delete_gym_route(gym_id: str, route_id: str):
    result = await db.db["routes"].update_one(
        {"route_id": route_id, "gym_id": gym_id},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Traseul nu a fost găsit.")
    return {"detail": "Traseul a fost șters cu succes."}

# 3.5 Știri pentru o sală (Feed de noutăți)
@router.get("/gyms/{gym_id}/news")
async def get_gym_news(gym_id: str):
    try:
        news = await db.db["gym_news"].find(
            {"gym_id": gym_id}
        ).sort("date", -1).to_list(20)

        if not news:
            return [{
                "id": "default",
                "title": "Bun venit în comunitate!",
                "content": "Aici vor apărea noutățile sălii tale.",
                "date": "Azi",
            }]

        result = []
        for doc in news:
            result.append({
                "id": str(doc.get("_id", "")),
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "date": doc.get("date", ""),
                "emoji": doc.get("emoji", "📢"),
            })
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Eroare la încărcarea știrilor: {str(e)}"
        )

# 3.6 Publică o știre nouă (Admin Panel)
@router.post("/gyms/{gym_id}/news")
async def create_gym_news(gym_id: str, payload: dict):
    try:
        doc = {
            "gym_id": gym_id,
            "title": payload.get("title", "").strip(),
            "content": payload.get("content", "").strip(),
            "emoji": payload.get("emoji", "📢"),
            "date": datetime.utcnow().isoformat(),
        }
        if not doc["title"]:
            raise HTTPException(status_code=400, detail="Titlul este obligatoriu.")
        result = await db.db["gym_news"].insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eroare la publicarea știrii: {str(e)}")

# 3.7 Șterge o știre (Admin Panel)
@router.delete("/gyms/{gym_id}/news/{news_id}")
async def delete_gym_news(gym_id: str, news_id: str):
    try:
        result = await db.db["gym_news"].delete_one({"_id": ObjectId(news_id), "gym_id": gym_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Știrea nu a fost găsită.")
        return {"detail": "Știrea a fost ștearsă cu succes."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eroare la ștergerea știrii: {str(e)}")

# 4. Înregistrează o reușită (Bifează un traseu)
@router.post("/ascents", response_model=Ascent)
async def log_ascent(ascent: Ascent):
    # Urcări manuale (din Arena) — nu au traseu real în DB
    if ascent.route_id.startswith("manual_"):
        # Punctele sunt calculate pe client și trimise direct
        pass
    else:
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

# 5. Statistici utilizator (pentru ecranul de profil)
@router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str):
    try:
        # Agregare: total urcări + total puncte
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": None,
                "total_ascents": {"$sum": 1},
                "total_points": {"$sum": "$points_awarded"},
            }},
        ]
        agg = await db.db["ascents"].aggregate(pipeline).to_list(1)

        if agg:
            total_ascents = agg[0]["total_ascents"]
            total_points = agg[0]["total_points"]
        else:
            total_ascents = 0
            total_points = 0

        # Ultimele 5 urcări (cele mai recente)
        recent_docs = await db.db["ascents"].find(
            {"user_id": user_id}
        ).sort("date", -1).to_list(5)

        recent_climbs = []
        for doc in recent_docs:
            route = await db.db["routes"].find_one({"route_id": doc.get("route_id")})
            recent_climbs.append({
                "route_id": doc.get("route_id"),
                "gym_id": doc.get("gym_id"),
                "color": route.get("color", "—") if route else "—",
                "grade": route.get("grade", "?") if route else "?",
                "style": doc.get("style", "Redpoint"),
                "points_awarded": doc.get("points_awarded", 0),
                "date": doc.get("date"),
            })

        return {
            "user_id": user_id,
            "total_ascents": total_ascents,
            "total_points": total_points,
            "recent_climbs": recent_climbs,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Eroare la calcularea statisticilor: {str(e)}"
        )

# 6. Generează Clasamentul Global (toate sălile)
@router.get("/leaderboard/global")
async def get_global_leaderboard():
    try:
        # Etapa 1: Agregăm punctele totale per utilizator (din toate sălile)
        pipeline = [
            {"$group": {
                "_id": "$user_id",
                "total_points": {"$sum": "$points_awarded"},
            }},
            {"$sort": {"total_points": -1}},
            {"$limit": 50}
        ]

        leaderboard = await db.db["ascents"].aggregate(pipeline).to_list(50)

        # Etapa 2: Construim răspunsul, identic ca structură cu leaderboard-ul local
        result = []
        for index, entry in enumerate(leaderboard):
            user_id = entry["_id"]
            user = await db.db["users"].find_one({"uid": user_id})

            # Bonus: Determinăm sala utilizatorului
            # Prioritate: home_gym_id din profil → sala cu cele mai multe puncte
            gym_name = None
            home_gym_id = user.get("home_gym_id") if user else None

            if home_gym_id:
                gym = await db.db["gyms"].find_one({"gym_id": home_gym_id})
                gym_name = gym["name"] if gym else None

            if not gym_name:
                # Fallback: sala unde utilizatorul a strâns cele mai multe puncte
                top_gym_pipeline = [
                    {"$match": {"user_id": user_id}},
                    {"$group": {"_id": "$gym_id", "pts": {"$sum": "$points_awarded"}}},
                    {"$sort": {"pts": -1}},
                    {"$limit": 1}
                ]
                top_gym = await db.db["ascents"].aggregate(top_gym_pipeline).to_list(1)
                if top_gym:
                    gym = await db.db["gyms"].find_one({"gym_id": top_gym[0]["_id"]})
                    gym_name = gym["name"] if gym else None

            result.append({
                "rank": index + 1,
                "user_id": user_id,
                "name": user["display_name"] if user else "Cățărător Anonim",
                "points": entry["total_points"],
                "gym_name": gym_name,
            })

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Eroare la generarea clasamentului global: {str(e)}"
        )