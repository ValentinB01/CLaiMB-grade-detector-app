import os
import json
import base64
import logging
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from typing import List, Tuple, Dict, Any

# Folosim noul pachet cerut de Google
from google import genai
from google.genai import types

from models.schemas import HoldLocation

logger = logging.getLogger(__name__)

class GradingService:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None
            logger.error("❌ GEMINI_API_KEY lipsește din .env!")

    async def grade_route(self, holds: List[HoldLocation], image_base64: str) -> Tuple[List[dict], str, float, str]:
        """Găsește traseele pe culori și le evaluează gradul."""
        if not self.client or not holds:
            return "V?", 0.0, "AI Grading indisponibil sau nu s-au găsit prize."

        try:
            # 1. Desenează numere pe poză peste prizele găsite de Roboflow
            annotated_image = self._draw_holds_on_image(image_base64, holds)

            # 2. Construim prompt-ul pentru Gemini
            prompt = """
            Ești un antrenor expert de bouldering (climbing). 
            În imaginea atașată am marcat cu cercuri roșii și numere albe toate prizele detectate.
            Te rog să analizezi imaginea și să grupezi aceste prize în trasee distincte, bazându-te pe culoarea lor (ex: traseul roșu, traseul albastru).
            
            Returnează STRICT un obiect JSON cu următoarea structură (fără alte texte):
            {
              "routes": [
                {
                  "color": "Numele culorii (ex: Red, Blue)",
                  "holds_ids": [lista cu numerele prizelor din acest traseu],
                  "estimated_grade": "Gradul estimat V-scale (ex: V3)",
                  "reasoning": "Scurtă explicație a gradului (ex: prize mici, necesită forță pe degete)"
                }
              ],
              "overall_notes": "Sfat general pentru acest perete."
            }
            """

            # 3. Trimitem la Gemini 2.5 Flash (cel mai bun pentru vizual)
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    annotated_image,
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2 # Vrem răspunsuri clare, nu fantezii
                )
            )

            # 4. Parsăm răspunsul JSON
            result_data = json.loads(response.text)
            
            # Pentru compatibilitate cu baza ta de date actuală, extragem cel mai greu traseu
            # (Pe viitor poți modifica baza de date să le salveze pe toate)
            routes = result_data.get("routes", [])
            if not routes:
                return "V?", 0.0, "Gemini nu a putut forma trasee."

            best_route = routes[0] # Luăm primul traseu (sau poți face o logică să îl iei pe cel mai greu)
            main_grade = best_route.get("estimated_grade", "V?")
            overall_notes = result_data.get("overall_notes", "Trasee detectate cu succes.")

            logger.info(f"✅ Gemini a găsit {len(routes)} trasee!")
            
            # Returnăm: lista completă, gradul principal, încrederea, notițele
            return routes, main_grade, 0.85, overall_notes

        except Exception as e:
            logger.error(f"❌ Eroare în GradingService: {e}")
            return [], "V?", 0.0, f"Grading unavailable. Model busy: {str(e)}"

    def _draw_holds_on_image(self, image_base64: str, holds: List[HoldLocation]) -> Image.Image:
        """Desenează numere peste prize pentru ca Gemini să le poată identifica."""
        image_data = base64.b64decode(image_base64)
        img = Image.open(BytesIO(image_data)).convert("RGB")
        draw = ImageDraw.Draw(img)
        
        width, height = img.size

        # Desenăm fiecare priză cu ID-ul ei (indexul)
        for idx, hold in enumerate(holds):
            # Transformăm coordonatele normalizate în pixeli reali
            cx = hold.x * width
            cy = hold.y * height
            r = hold.radius * max(width, height)

            # Desenăm un cerc roșu
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline="red", width=4)
            
            # Scriem numărul (ID-ul) lângă priză (cu fundal negru ca să fie vizibil)
            text = str(idx)
            draw.rectangle([cx - 10, cy - 10, cx + 15, cy + 15], fill="black")
            draw.text((cx - 5, cy - 5), text, fill="white")

        return img