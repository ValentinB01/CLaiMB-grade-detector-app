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
        # Corectat: Returnăm 4 elemente (lista goală la început)
        if not self.client or not holds:
            return [], "V?", 0.0, "AI Grading unavailable or no holds found."

        try:
            # 1. Desenează numere pe poză peste prizele găsite de Roboflow
            annotated_image = self._draw_holds_on_image(image_base64, holds)

            # 2. Pregătim un rezumat text al prizelor pentru a ajuta AI-ul
            holds_summary = ""
            for idx, h in enumerate(holds):
                color_str = h.color if h.color else "unknown"
                holds_summary += f"[{idx}] Color: {color_str}, Type: {h.hold_type}, X:{h.x:.2f}, Y:{h.y:.2f}\n"

            # 3. Construim noul prompt avansat pentru Gemini (Master Route Setter)
            prompt = f"""
            You are an expert bouldering coach and master route setter. 
            Your task is to analyze the attached image of a climbing wall (where detected holds are marked with red circles and white numbers) and the provided list of detected holds to group them into individual climbing routes (by color) and estimate their difficulty grade on the V-scale (V0 to V17).

            Here is the data of the detected holds (X and Y coordinates are normalized 0-1):
            {holds_summary}

            Follow these strict grading rules to estimate the difficulty:
            - V0 - V2 (Beginner): Very large, positive holds (jugs). High density of holds (close to each other). Plentiful and obvious footholds. Straightforward, ladder-like movement.
            - V3 - V5 (Intermediate): Smaller holds (crimps, pinches, moderate slopers). Longer distances between holds requiring some dynamic movement or moderate lock-offs. Requires specific techniques (heel hooks, toe hooks, body tension).
            - V6 - V8 (Advanced): Very poor holds (micro-crimps, bad slopers, dual-texture). Large gaps between holds requiring powerful dynamic moves (dynos) or extreme core tension. Complex movement sequences.
            - V9+ (Expert): Extreme physical puzzles. Minimal, razor-thin holds. Severe overhangs or pure campus moves.

            When analyzing the image and the data, consider:
            1. Distance: Calculate the visual gap between holds of the same color. Large gaps mean higher grades.
            2. Hold Size/Shape: Identify if the holds look like easy jugs or difficult slopers/crimps.
            3. Footholds: Check if the route has dedicated footholds (lower grade) or if the climber must smear (higher grade).

            Return the analysis STRICTLY as a raw JSON object with the following structure (no markdown formatting, no ```json tags):
            {{
              "routes": [
                {{
                  "color": "color name (e.g., red, blue)",
                  "holds_ids": [array of integer indexes corresponding to the input holds],
                  "estimated_grade": "V-scale grade (e.g., V3)",
                  "reasoning": "A short, professional explanation of why this grade was chosen, referencing hold spacing, hold types, and required technique."
                }}
              ],
              "overall_notes": "General advice or observation about the wall."
            }}
            """

            # 4. Trimitem la Gemini 2.5 Flash
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

            # 5. Parsăm răspunsul JSON
            result_data = json.loads(response.text)
            
            routes = result_data.get("routes", [])
            
            # Corectat: Returnăm 4 elemente
            if not routes:
                return [], "V?", 0.0, "Gemini could not form routes."

            best_route = routes[0] 
            main_grade = best_route.get("estimated_grade", "V?")
            overall_notes = result_data.get("overall_notes", "Routes detected successfully.")

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
            
            # Folosim width/height dacă există (pentru dreptunghiuri) sau raza ca fallback
            if hold.width and hold.height:
                boxW = hold.width * width
                boxH = hold.height * height
                r_x = boxW / 2
                r_y = boxH / 2
            else:
                r_x = hold.radius * max(width, height)
                r_y = hold.radius * max(width, height)

            # Desenăm un dreptunghi/cerc roșu (aici am lăsat elipsa pentru claritate pt modelul AI)
            draw.ellipse([cx - r_x, cy - r_y, cx + r_x, cy + r_y], outline="red", width=4)
            
            # Scriem numărul (ID-ul) lângă priză (cu fundal negru ca să fie vizibil)
            text = str(idx)
            draw.rectangle([cx - 10, cy - 10, cx + 15, cy + 15], fill="black")
            draw.text((cx - 5, cy - 5), text, fill="white")

        return img