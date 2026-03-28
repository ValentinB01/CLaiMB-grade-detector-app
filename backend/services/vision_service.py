import os
import json
import base64
import logging
import io
import httpx # Asigură-te că ai rulat: pip install httpx
from typing import List, Optional
from PIL import Image as PILImage, ImageOps
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    print("✅ HEIC Support registered and active!")
except ImportError:
    print("⚠️ pillow-heif NOT found. iPhone (HEIC) images will fail.")
    pass
from models.schemas import HoldLocation

logger = logging.getLogger(__name__)

class VisionService:
    """Detectează prizele de cățărat folosind exclusiv Roboflow (Gratuit)."""

    MAX_DIM = 1024  # Max width/height before sending to Roboflow

    def __init__(self):
        # Citim cheia direct din mediu
        self.roboflow_key: Optional[str] = os.environ.get("ROBOFLOW_API_KEY")
        
        # ⚠️ AICI MODIFICI CU DATELE NOULUI TĂU MODEL DE PE ROBOFLOW UNIVERSE
        # Dacă modelul se numește "bouldering-holds-xyz" și are versiunea "3", scrii așa:
        self.project = os.environ.get("ROBOFLOW_PROJECT", "holds-tptrk-u6v1c") 
        self.version = os.environ.get("ROBOFLOW_VERSION", "2")
        
        # Construim URL-ul corect
        self.url = f"https://detect.roboflow.com/{self.project}/{self.version}"

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
        except Exception as e:
            logger.warning(f"⚠️ Resize failed, using original: {e}")
            return image_base64

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

            # 2. Resize image to reduce upload size
            clean_base64 = self._resize_base64(clean_base64)

            logger.info(f"📤 Sending to Roboflow (b64 len: {len(clean_base64)})")
            print(f"📦 B64 Preview: {clean_base64[:50]}...")
            
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    self.url,
                    params={"api_key": self.roboflow_key},
                    content=clean_base64, 
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

            if resp.status_code != 200:
                error_txt = resp.text
                logger.error(f"⚠️ Roboflow Error {resp.status_code}: {error_txt}")
                # Log critical info for the user to see in terminal
                print(f"❌ ROBOFLOW ERROR: {resp.status_code} - {error_txt}")
                return self._fallback_holds()

            data = resp.json()
            
            # Dimensiunile imaginii pentru normalizare
            img_w = data.get("image", {}).get("width", 1)
            img_h = data.get("image", {}).get("height", 1)
            
            holds = []
            for pred in data.get("predictions", []):
                # Spray walls are dense, lower threshold to capture more holds
                if pred.get("confidence", 0) < 0.05:
                    continue

                clasa_detectata = pred.get("class", "unknown").lower()
                
                clase_detaliate = ["crimp", "jug", "sloper", "pinch", "pocket", "volume", "holds"] # Am pus și "holds" (plural) just in case
                if clasa_detectata in clase_detaliate:
                    clasa_detectata = "hold"

                h_type = self._map_label_to_type(clasa_detectata)
                
                # Extragem poligonul (dacă modelul este de tip Instance Segmentation)
                points = pred.get("points", [])
                polygon_data = None
                if points:
                    polygon_data = [{"x": p["x"] / img_w, "y": p["y"] / img_h} for p in points]
                
                holds.append(
                    HoldLocation(
                        x=pred["x"] / img_w, 
                        y=pred["y"] / img_h,
                        width=pred["width"] / img_w,   
                        height=pred["height"] / img_h, 
                        radius=max(pred["width"], pred["height"]) / (2 * max(img_w, img_h)), 
                        confidence=round(pred["confidence"], 3),
                        hold_type=h_type,          
                        color=clasa_detectata,
                        polygon=polygon_data
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