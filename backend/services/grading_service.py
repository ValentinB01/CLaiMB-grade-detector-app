import os
import json
import base64
import logging
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
from typing import List, Tuple, Dict, Any
import numpy as np
from sklearn.cluster import DBSCAN

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

    async def grade_route(self, holds: List, image_base64: str, wall_angle: str = "Vertical") -> Tuple[List[dict], str, float, str]:
        """Găsește traseele pe culori și le evaluează gradul."""
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

            angle_instruction = f"""
            CRITICAL CONTEXT: The user specified that the wall angle is: {wall_angle}. 
            Pay extreme attention to this! A hold that looks like a jug might be terrible on a 45-degree overhang. 
            Adjust your estimated V-grade and your coaching advice accordingly.
            """
            
            # 3. Construim noul prompt avansat pentru Gemini (Master Route Setter)
            # 3. Construim noul prompt avansat pentru Gemini (Master Route Setter)
            prompt = f"""
            You are an expert bouldering coach and master route setter. {angle_instruction}
            
            Your task is to analyze the attached image of a climbing wall and the provided list of detected holds.
            The detected holds in the image are outlined with white bounding boxes, and their ID numbers are displayed directly near the boxes.

            Here is the raw data of the detected holds (X and Y coordinates are normalized 0-1, where Y=0 is the top and Y=1 is the bottom):
            {holds_summary}

            To successfully complete this task, follow these steps strictly:

            STEP 1: COLOR IDENTIFICATION & GROUPING
            - Look at the physical plastic hold associated with each ID number. Ignore the white chalk marks.
            - Group the hold IDs into distinct routes based EXCLUSIVELY on their color (e.g., all Red holds form Route 1, all Blue holds form Route 2).
            - A single route MUST contain only holds of the exact same color. Never mix colors in the same list.

            STEP 2: GRADING ESTIMATION
            For each distinct color route you found, estimate its difficulty on the V-scale (V0 to V17) using these rules:
            - V0 - V2 (Beginner): Very large, positive holds (jugs). High density of holds (close to each other). Plentiful and obvious footholds. Straightforward, ladder-like movement.
            - V3 - V5 (Intermediate): Smaller holds (crimps, pinches, moderate slopers). Longer distances between holds requiring some dynamic movement or moderate lock-offs. Requires specific techniques (heel hooks, toe hooks, body tension).
            - V6 - V8 (Advanced): Very poor holds (micro-crimps, bad slopers, dual-texture). Large gaps between holds requiring powerful dynamic moves (dynos) or extreme core tension. Complex movement sequences.
            - V9+ (Expert): Extreme physical puzzles. Minimal, razor-thin holds. Severe overhangs or pure campus moves.

            STEP 3: ANALYSIS
            - Consider hold distance (visual gaps), hold types (jugs vs crimps/slopers), and wall angle.
            - Identify probable footholds (holds very low on the wall or extremely small).

            Return the analysis STRICTLY as a raw JSON object with the following structure (no markdown formatting, no ```json tags):
            {{
              "routes": [
                {{
                  "color": "Color name (e.g., Red, Blue)",
                  "holds_ids": [array of integer indexes corresponding to the input holds],
                  "estimated_grade": "V-scale grade (e.g., V3)",
                  "reasoning": "A short explanation of why this grade was chosen based on hold spacing, types, and wall angle."
                }}
              ],
              "overall_notes": "General advice or observation about the wall.",
              "overall_confidence": 0.85
            }}

            IMPORTANT: For 'overall_confidence', provide a float number between 0.0 and 1.0 reflecting how confident you are in your color grouping and visual grading.
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
                    temperature=0.2 
                )
            )

            # 5. Parsăm răspunsul JSON primit de la Gemini
            result_data = json.loads(response.text)
            
            raw_detected_routes = result_data.get("routes", [])
            overall_notes = result_data.get("overall_notes", "Routes detected successfully.")
            
            if not raw_detected_routes:
                return [], "V?", 0.0, "Gemini could not form routes."

            # ---> AICI E MAGIA MATEMATICĂ (DBSCAN) <---
            final_detected_routes = []
            for route in raw_detected_routes:
                # Trecem fiecare rută colorată prin filtrul de distanță
                split_routes = self._split_route_with_dbscan(route, holds)
                final_detected_routes.extend(split_routes)
            # ------------------------------------------

            # Găsim gradul rutei principale (prima din listă)
            best_route = final_detected_routes[0] if final_detected_routes else raw_detected_routes[0]
            main_grade = best_route.get("estimated_grade", "V?")

            logger.info(f"✅ Gemini a găsit {len(raw_detected_routes)} trasee. După procesarea DBSCAN, aplicația afișează {len(final_detected_routes)} trasee!")
            
            # Returnăm exact structura cerută de FastAPI: Listă rute finală, grad general, încredere AI, Notițe.
            return final_detected_routes, main_grade, 0.85, overall_notes

        except Exception as e:
            logger.error(f"❌ Eroare în GradingService: {e}")
            return [], "V?", 0.0, f"Grading unavailable. Model error: {str(e)}"

    def _draw_holds_on_image(self, image_base64: str, holds: List) -> Image.Image:
        """
        Desenează dreptunghiuri de încadrare (Bounding Boxes) non-intruzive pe imagine 
        pentru a delimita clar prizele fără a le acoperi culorile reale.
        """
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data)).convert("RGB")
        draw = ImageDraw.Draw(image)
        width, height = image.size

        # Încercăm să încărcăm un font lizibil (adaptat la dimensiunea imaginii)
        try:
            font = ImageFont.truetype("arial.ttf", size=max(16, int(width * 0.025)))
        except IOError:
            font = ImageFont.load_default()

        for idx, h in enumerate(holds):
            # Calculăm coordonatele centrului în pixeli
            cx = h.x * width
            cy = h.y * height
            
            # Ne folosim de lățimea și înălțimea reale ale prizei detectate de Roboflow
            # (Dacă dintr-o eroare acestea nu există, folosim radius-ul ca backup de siguranță)
            if hasattr(h, 'width') and hasattr(h, 'height') and h.width > 0 and h.height > 0:
                box_w = h.width * width
                box_h = h.height * height
            else:
                box_w = h.radius * 2 * width
                box_h = h.radius * 2 * height

            # Calculăm colțurile dreptunghiului
            x_min = int(cx - box_w / 2)
            y_min = int(cy - box_h / 2)
            x_max = int(cx + box_w / 2)
            y_max = int(cy + box_h / 2)
            
            # 1. Desenăm DREPTUNGHIUL în jurul prizei, lăsând interiorul gol!
            # Creăm un "truc" de vizibilitate: un contur alb flancat de un contur fin negru,
            # astfel markerul se va vedea perfect și pe pereți albi, și pe pereți negri.
            draw.rectangle([x_min-1, y_min-1, x_max+1, y_max+1], outline="black", width=1)
            draw.rectangle([x_min, y_min, x_max, y_max], outline="white", width=2)
            
            # 2. Plasăm numărul (ID-ul) fix deasupra colțului stânga-sus al dreptunghiului
            text = str(idx)
            text_x, text_y = x_min, y_min - 22 
            
            # Regula de siguranță: dacă priza e prea sus și textul ar ieși din poză, îl coborâm dedesubt
            if text_y < 0:
                text_y = y_max + 5

            # 3. Desenăm textul cu "umbră" neagră (shadow) ca să iasă în evidență
            for offset_x, offset_y in [(-2, -2), (2, -2), (-2, 2), (2, 2)]:
                draw.text((text_x + offset_x, text_y + offset_y), text, font=font, fill="black")
            draw.text((text_x, text_y), text, font=font, fill="white")

        # Salvăm imaginea pentru a putea verifica tu calitatea vizuală în fișierul debug
        image.save("debug_roboflow_output.jpg")
        return image
    
    def _split_route_with_dbscan(self, route: dict, holds: List[HoldLocation]) -> List[dict]:
        """
        Folosește DBSCAN pentru a împărți o rută de aceeași culoare în mai multe rute 
        dacă prizele sunt prea depărtate fizic.
        """
        hold_ids = route.get("holds_ids", [])
        if len(hold_ids) < 13:
            return [route]

        # 1. Extragem coordonatele (X, Y) doar pentru prizele din acest traseu
        points = []
        valid_ids = []
        for hid in hold_ids:
            if 0 <= hid < len(holds):
                # Normalizăm pe o scară comună (ținând cont de aspect ratio dacă e nevoie, 
                # dar simplificat merge X și Y pur)
                points.append([holds[hid].x, holds[hid].y])
                valid_ids.append(hid)

        if not points:
            return [route]

        X = np.array(points)

        # 2. Configurăm algoritmul DBSCAN
        # eps = 0.35 (distanța maximă permisă între prize, din procentajul pozei). 
        # min_samples = 1 (vrem ca și o priză singuratică să fie prinsă, dar o vom filtra noi mai jos)
        clustering = DBSCAN(eps=0.23, min_samples=1).fit(X)
        labels = clustering.labels_

        # 3. Grupăm ID-urile prizelor pe baza etichetelor date de DBSCAN
        clusters = {}
        for idx, label in enumerate(labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(valid_ids[idx])

        # Dacă DBSCAN a găsit un singur cluster mare, traseul e întreg!
        if len(clusters) == 1:
            return [route]

        # 4. Dacă a găsit mai multe clustere, creăm rute noi separate!
        split_routes = []
        cluster_count = 1
        for label, ids in clusters.items():
            if len(ids) >= 2: # Ignorăm "traseele" formate dintr-o singură priză rătăcită
                new_route = dict(route) # Copiem datele originale (culoare, grad, note)
                new_route["holds_ids"] = ids
                new_route["color"] = f"{route.get('color', 'Unknown')} Part {cluster_count}"
                split_routes.append(new_route)
                cluster_count += 1

        return split_routes if split_routes else [route]