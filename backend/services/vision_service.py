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
        # Configurația proiectului tău de bouldering de pe Roboflow
        self.workspace = "climbing-holds-ek8zs"
        self.project = "climbing-hold-3cwll"
        self.version = "1"
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
            # Decodăm imaginea pentru a o trimite ca bytes (formatul cerut de Roboflow)
            image_bytes = base64.b64decode(image_base64)

            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    self.url,
                    params={"api_key": self.roboflow_key},
                    content=image_bytes,
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
                # Mapăm clasa detectată de model la tipurile noastre (start, finish, etc.)
                h_type = self._map_label_to_type(pred.get("class", "hand"))
                
                holds.append(
                    HoldLocation(
                        x=pred["x"] / img_w, # Normalizare 0-1
                        y=pred["y"] / img_h,
                        radius=max(pred["width"], pred["height"]) / (2 * max(img_w, img_h)),
                        confidence=round(pred["confidence"], 3),
                        hold_type=h_type,
                        color=pred.get("class", "unknown") # Folosim clasa ca denumire de culoare/tip
                    )
                )
            
            logger.info(f"✅ Roboflow a detectat {len(holds)} prize.")
            return holds

        except Exception as e:
            logger.error(f"❌ Eroare la apelul Roboflow: {e}")
            return self._fallback_holds()

    def _map_label_to_type(self, label: str) -> str:
        """Convertește etichetele modelului AI în tipurile recunoscute de frontend."""
        label = label.lower