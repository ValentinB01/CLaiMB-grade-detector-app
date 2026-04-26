from fastapi import APIRouter, HTTPException, Query
from models.schemas import VerifyRouteRequest, VerifiedStatus
from services.scoring_service import calculate_route_points
from database import db

router = APIRouter(tags=["Arena"])


# ---------------------------------------------------------------------------
# GET /leaderboard  —  Clasament filtrat după scope (gym / city / country)
# ---------------------------------------------------------------------------
@router.get("/leaderboard")
async def get_leaderboard(
    scope: str = Query("gym", description="Scopul clasamentului: 'gym', 'city' sau 'country'"),
    gym_id: str = Query(None, description="ID-ul sălii (obligatoriu dacă scope='gym')"),
    city: str = Query(None, description="Orașul (obligatoriu dacă scope='city')"),
    country: str = Query(None, description="Țara (obligatoriu dacă scope='country')"),
):
    """
    Returnează clasamentul Arena sortat descrescător după total_points.

    - **scope=gym** → toți userii cu `home_gym_id == gym_id`
    - **scope=city** → toți userii din `city`
    - **scope=country** → toți userii din `country`
    """
    users_col = db.db["users"]

    if scope == "gym":
        if not gym_id:
            raise HTTPException(status_code=400, detail="Parametrul 'gym_id' este obligatoriu pentru scope='gym'.")
        query = {"home_gym_id": gym_id}

    elif scope == "city":
        if not city:
            raise HTTPException(status_code=400, detail="Parametrul 'city' este obligatoriu pentru scope='city'.")
        query = {"city": city}

    elif scope == "country":
        if not country:
            raise HTTPException(status_code=400, detail="Parametrul 'country' este obligatoriu pentru scope='country'.")
        query = {"country": country}

    else:
        raise HTTPException(status_code=400, detail=f"Scope invalid: '{scope}'. Folosește 'gym', 'city' sau 'country'.")

    users = await users_col.find(query).sort("total_points", -1).to_list(50)

    # Batch-fetch verified ascent counts for all users in a single aggregation
    user_uids = [u.get("uid") for u in users if u.get("uid")]
    verified_map: dict = {}
    if user_uids:
        pipeline = [
            {"$match": {"user_id": {"$in": user_uids}, "verified_status": {"$in": ["peer_verified", "ai_verified"]}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        ]
        counts = await db.db["ascents"].aggregate(pipeline).to_list(len(user_uids))
        verified_map = {c["_id"]: c["count"] for c in counts}

    result = []
    for idx, user in enumerate(users):
        uid = user.get("uid")
        result.append({
            "rank": idx + 1,
            "user_id": uid,
            "name": user.get("display_name", "Cățărător Anonim"),
            "total_points": user.get("total_points", 0),
            "home_gym_id": user.get("home_gym_id"),
            "verified_count": verified_map.get(uid, 0),
        })

    return result


# ---------------------------------------------------------------------------
# POST /routes/verify  —  Verificare peer și recalculare puncte
# ---------------------------------------------------------------------------
@router.post("/routes/verify")
async def verify_route(payload: VerifyRouteRequest):
    """
    Un martor (witness) confirmă o urcarea. Pașii:
    1. Validăm că martorul există și este diferit de proprietarul urcării.
    2. Schimbăm verified_status → 'peer_verified' și setăm witness_id.
    3. Recalculăm punctele urcării cu noul multiplicator de validare.
    4. Actualizăm total_points pe profilul utilizatorului.
    """
    ascents_col = db.db["ascents"]
    users_col = db.db["users"]

    # 1. Găsim urcarea
    ascent = await ascents_col.find_one({"ascent_id": payload.route_id})
    if not ascent:
        raise HTTPException(status_code=404, detail="Urcarea nu a fost găsită.")

    # Prevenim auto-verificarea
    if ascent.get("user_id") == payload.witness_user_id:
        raise HTTPException(status_code=400, detail="Nu te poți verifica singur.")

    # Verificăm că martorul există
    witness = await users_col.find_one({"uid": payload.witness_user_id})
    if not witness:
        raise HTTPException(status_code=404, detail="Martorul (witness) nu a fost găsit.")

    # Dacă este deja verificat, nu facem nimic
    if ascent.get("verified_status") in (
        VerifiedStatus.PEER_VERIFIED.value,
        VerifiedStatus.AI_VERIFIED.value,
    ):
        raise HTTPException(status_code=400, detail="Urcarea este deja verificată.")

    # 2. Recalculăm punctele cu noul status
    grade = ascent.get("grade", "")
    progression = ascent.get("progression", "top")
    old_points = ascent.get("points_awarded", 0)
    new_points = calculate_route_points(grade, progression, VerifiedStatus.PEER_VERIFIED.value)

    # 3. Actualizăm documentul urcării
    await ascents_col.update_one(
        {"ascent_id": payload.route_id},
        {"$set": {
            "verified_status": VerifiedStatus.PEER_VERIFIED.value,
            "witness_id": payload.witness_user_id,
            "points_awarded": new_points,
        }},
    )

    # 4. Actualizăm total_points pe user
    diff = new_points - old_points
    if diff != 0:
        await users_col.update_one(
            {"uid": ascent["user_id"]},
            {"$inc": {"total_points": diff}},
        )

    return {
        "ascent_id": payload.route_id,
        "verified_status": VerifiedStatus.PEER_VERIFIED.value,
        "witness_id": payload.witness_user_id,
        "old_points": old_points,
        "new_points": new_points,
        "points_diff": diff,
    }
