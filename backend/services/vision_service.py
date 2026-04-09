import os
import json
import base64
import logging
<<<<<<< Updated upstream
import httpx # Asigură-te că ai rulat: pip install httpx
from typing import List, Optional
=======
import io
import binascii
import httpx # Asigură-te că ai rulat: pip install httpx
from typing import List, Optional
from PIL import Image as PILImage, ImageOps, UnidentifiedImageError

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    print("✅ HEIC Support registered and active!")
except ImportError:
    print("⚠️ pillow-heif NOT found. iPhone (HEIC) images will fail.")
    pass

>>>>>>> Stashed changes
from models.schemas import HoldLocation

logger = logging.getLogger(__name__)

class VisionService:
    """Detectează prizele de cățărat folosind exclusiv Roboflow (Gratuit)."""

    def __init__(self):
        # Citim cheia direct din mediu
        self.roboflow_key: Optional[str] = os.environ.get("ROBOFLOW_API_KEY")
        
        # ⚠️ AICI MODIFICI CU DATELE NOULUI TĂU MODEL DE PE ROBOFLOW UNIVERSE
        self.project = os.environ.get("ROBOFLOW_PROJECT", "holds-tptrk-u6v1c") 
        self.version = os.environ.get("ROBOFLOW_VERSION", "2")
        
        # Construim URL-ul corect
        self.url = f"https://detect.roboflow.com/{self.project}/{self.version}"

<<<<<<< Updated upstream
=======
    def _resize_base64(self, image_base64: str) -> str:
        """Resize image to max MAX_DIM px if larger, returns base64 string."""
        try:
            raw = base64.b64decode(image_base64)
            img = PILImage.open(io.BytesIO(raw))
            img = ImageOps.exif_transpose(img) # Fix EXIF rotation from phones

            w, h = img.size

            if w > self.MAX_DIM or h > self.MAX_DIM:
                # Calculate new size preserving aspect ratio
                ratio = min(self.MAX_DIM / w, self.MAX_DIM / h)
                new_w, new_h = int(w * ratio), int(h * ratio)
                img = img.resize((new_w, new_h), PILImage.LANCZOS)
                w, h = new_w, new_h

            # Convert to RGB to avoid "cannot write mode RGBA as JPEG" error
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=80)
            resized_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            logger.info(f"📐 Resized/Oriented image to {w}x{h} (b64 len: {len(image_base64)} → {len(resized_b64)})")
            return resized_b64
        except (binascii.Error, ValueError):
            logger.error("❌ Eroare: String-ul Base64 furnizat este invalid sau corupt.")
            raise ValueError("Imaginea transmisă este invalidă.")
        except UnidentifiedImageError:
            logger.error("❌ Eroare: Fișierul nu este o imagine recunoscută (posibil format nesuportat).")
            raise ValueError("Formatul imaginii nu este suportat.")
        except Exception as e:
            logger.warning(f"⚠️ Resize failed, using original: {e}")
            return image_base64

>>>>>>> Stashed changes
    async def analyze_image(self, image_base64: str) -> List[HoldLocation]:
        """Punctul de intrare principal pentru analiza imaginii."""
        # Plasa de siguranță pentru input gol sau prea mic
        if not image_base64 or len(image_base64) < 100:
            logger.error("❌ Imaginea trimisă este goală sau prea mică.")
            return self._fallback_holds()

        if not self.roboflow_key:
            logger.error("❌ ROBOFLOW_API_KEY lipsește din .env! Folosesc fallback-ul curent.")
            return self._fallback_holds()

        return await self._detect_roboflow(image_base64)

    async def _detect_roboflow(self, image_base64: str) -> List[HoldLocation]:
        """Apel asincron către API-ul Roboflow."""
        try:
            # 1. Curățăm string-ul de prefixul de la telefon (ex: "data:image/jpeg;base64,...")
            clean_base64 = image_base64.split(",")[-1] if "," in image_base64 else image_base64

<<<<<<< Updated upstream
            async with httpx.AsyncClient(timeout=20) as client:
=======
            # 2. Resize image to reduce upload size
            clean_base64 = self._resize_base64(clean_base64)

            logger.info(f"📤 Sending to Roboflow (b64 len: {len(clean_base64)})")
            
            async with httpx.AsyncClient(timeout=60) as client:
>>>>>>> Stashed changes
                resp = await client.post(
                    self.url,
                    params={"api_key": self.roboflow_key},
                    content=clean_base64, 
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

            if resp.status_code != 200:
<<<<<<< Updated upstream
                logger.error(f"⚠️ Roboflow Error {resp.status_code}: {resp.text}")
=======
                error_txt = resp.text
                logger.error(f"⚠️ Roboflow Error {resp.status_code}: {error_txt}")
                print(f"❌ ROBOFLOW ERROR: {resp.status_code} - {error_txt}")
>>>>>>> Stashed changes
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
                
                clase_detaliate = ["crimp", "jug", "sloper", "pinch", "pocket", "volume", "holds"]
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
            
        except ValueError as ve:
            logger.error(f"❌ Eroare de validare a imaginii: {ve}")
            return self._fallback_holds()
        except Exception as e:
            logger.error(f"❌ Eroare la apelul Roboflow: {e}")
            return self._fallback_holds()

    def _map_label_to_type(self, label: str) -> str:
        """Convertește etichetele modelului AI în tipurile sigure pt Frontend."""
        lbl = label.lower()
        
        if "start" in lbl:
            return "start"
        if "finish" in lbl or "top" in lbl:
            return "finish"
        if "foot" in lbl:
            return "foot"
            
        return "hand"
    
    def _fallback_holds(self):
        """Funcție de siguranță: returnează o listă goală dacă Roboflow pică."""
        logger.warning("⚠️ Se folosește fallback_holds deoarece procesarea a eșuat.")
        return []