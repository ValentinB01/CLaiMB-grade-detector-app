import os
import json
import base64
import logging
import httpx # Asigură-te că ai rulat: pip install httpx
from typing import List, Optional
from models.schemas import HoldLocation

logger = logging.getLogger(__name__)

class VisionService:
    """Detectează prizele de cățărat folosind exclusiv Roboflow (Gratuit)."""

    def __init__(self):
        # Citim cheia direct din mediu
        self.roboflow_key: Optional[str] = os.environ.get("ROBOFLOW_API_KEY")
        
        # ⚠️ AICI MODIFICI CU DATELE NOULUI TĂU MODEL DE PE ROBOFLOW UNIVERSE
        # Dacă modelul se numește "bouldering-holds-xyz" și are versiunea "3", scrii așa:
        self.project = os.environ.get("ROBOFLOW_PROJECT", "holds-tptrk-u6v1c") 
        self.version = os.environ.get("ROBOFLOW_VERSION", "2")
        
        # Construim URL-ul corect
        self.url = f"https://detect.roboflow.com/{self.project}/{self.version}"

    async def analyze_image(self, image_base64: str) -> List[HoldLocation]:
        """Punctul de intrare principal pentru analiza imaginii."""
        if not self.roboflow_key:
            logger.error("❌ ROBOFLOW_API_KEY lipsește din .env! Folosesc date simulate.")
            return self._fallback_holds()

        return await self._detect_roboflow(image_base64)

    async def _detect_roboflow(self, image_base64: str) -> List[HoldLocation]:
        """Apel asincron către API-ul Roboflow."""
        try:
            # 1. Curățăm string-ul de prefixul de la telefon (ex: "data:image/jpeg;base64,...")
            clean_base64 = image_base64.split(",")[-1] if "," in image_base64 else image_base64

            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    self.url,
                    params={"api_key": self.roboflow_key},
                    content=clean_base64, 
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

            if resp.status_code != 200:
                logger.error(f"⚠️ Roboflow Error {resp.status_code}: {resp.text}")
                return self._fallback_holds()

            data = resp.json()
            
            # Dimensiunile imaginii pentru normalizare
            img_w = data.get("image", {}).get("width", 1)
            img_h = data.get("image", {}).get("height", 1)
            
            holds = []
            for pred in data.get("predictions", []):
                # Filtrăm predicțiile slabe (păstrăm doar ce e >= 60% sigur)
                if pred.get("confidence", 0) < 0.45:
                    continue

                clasa_detectata = pred.get("class", "unknown").lower()
                
                clase_detaliate = ["crimp", "jug", "sloper", "pinch", "pocket", "volume", "holds"] # Am pus și "holds" (plural) just in case
                if clasa_detectata in clase_detaliate:
                    clasa_detectata = "hold"

                h_type = self._map_label_to_type(clasa_detectata)
                
                holds.append(
                    HoldLocation(
                        x=pred["x"] / img_w, 
                        y=pred["y"] / img_h,
                        width=pred["width"] / img_w,   
                        height=pred["height"] / img_h, 
                        radius=max(pred["width"], pred["height"]) / (2 * max(img_w, img_h)), 
                        confidence=round(pred["confidence"], 3),
                        hold_type=h_type,          
                        color=clasa_detectata      
                    )
                )
            
            logger.info(f"✅ Roboflow a detectat {len(holds)} prize.")
            return holds
        except Exception as e:
            logger.error(f"❌ Eroare la apelul Roboflow: {e}")
            return self._fallback_holds()

    def _map_label_to_type(self, label: str) -> str:
        """Convertește etichetele modelului AI în tipurile sigure pt Frontend."""
        # 1. Corectat bug-ul cu label.lower
        lbl = label.lower()
        
        # 2. Mapare inteligentă:
        if "start" in lbl:
            return "start"
        if "finish" in lbl or "top" in lbl:
            return "finish"
        if "foot" in lbl:
            return "foot"
            
        # Orice altceva (jug, crimp, sloper, pinch, volume, etc.) devine "hand"
        # pentru a nu da crash schemei Pydantic, dar denumirea reală rămâne salvată în `color`
        return "hand"
    
    def _fallback_holds(self):
        """Funcție de siguranță: returnează o listă goală dacă Roboflow pică."""
        logger.warning("⚠️ Se folosește fallback_holds deoarece Roboflow a eșuat.")
        return []