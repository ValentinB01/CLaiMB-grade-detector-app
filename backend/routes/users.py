from fastapi import APIRouter, HTTPException
from models.schemas import UserProfile
from database import db  # Presupunând că ai obiectul db expus în database.py
from datetime import datetime

router = APIRouter()

@router.post("/sync", response_model=UserProfile)
async def sync_user(user_data: UserProfile):
    """
    Sincronizează utilizatorul logat din Firebase cu MongoDB.
    """
    users_collection = db.db["users"]
    
    # Căutăm dacă utilizatorul există deja folosind Firebase UID
    existing_user = await users_collection.find_one({"uid": user_data.uid})
    
    if existing_user:
        # Dacă există, NU îi suprascriem is_pro sau home_gym_id. 
        # Doar îi actualizăm numele, email-ul (în caz că le-a schimbat) și ultima logare.
        update_data = {
            "$set": {
                "email": user_data.email,
                "display_name": user_data.display_name,
                "last_login": datetime.utcnow().isoformat()
            }
        }
        await users_collection.update_one({"uid": user_data.uid}, update_data)
        
        # Returnăm utilizatorul actualizat din baza de date
        updated_user = await users_collection.find_one({"uid": user_data.uid})
        return updated_user
    else:
        # Dacă este un utilizator absolut nou, îl inserăm în MongoDB
        new_user_dict = user_data.dict()
        new_user_dict["last_login"] = datetime.utcnow().isoformat()
        
        await users_collection.insert_one(new_user_dict)
        return new_user_dict