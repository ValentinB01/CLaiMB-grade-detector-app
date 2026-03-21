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
            
            prompt = f"""
            You are an expert bouldering coach and master route setter. {angle_instruction}
            
            Your task is to analyze the attached image of a climbing wall.
            CRITICAL VISUAL INSTRUCTION: The detected holds have white ID numbers hovering right next to them. There are NO boxes or dots. Look EXACTLY next to the number to see the raw pixels of the hold to determine its color. Ignore white chalk powder.

            Here is the raw data of the detected holds (X and Y coordinates are normalized 0-1):
            {holds_summary}

            To ensure 100% accuracy, you MUST follow this exact reasoning process:
            
            STEP 1: COLOR IDENTIFICATION (MANDATORY)
            - Look at the physical hold for EACH ID number.
            - Determine its true plastic color (e.g., Red, Blue, Yellow, Green, Black, Pink, Purple).
            
            STEP 2: ROUTE GROUPING
            - Group the hold IDs into distinct routes based EXCLUSIVELY on the color you identified in Step 1.
            - NEVER mix holds of different colors in the same route. If hold 1 is Yellow and hold 2 is Green, they are DIFFERENT routes.

            STEP 3: GRADING ESTIMATION (V-SCALE RUBRIC)
            For each color route, you must critically estimate its difficulty (V0 to V17) by evaluating the visual evidence against this strict rubric:

            * **V0 - V1 (Introductory):** High density of holds. Very large, positive jugs. Abundant, large footholds. Ladder-like spacing. Very forgiving on any wall angle.
            * **V2 - V3 (Beginner-Intermediate):** Moderate spacing. A mix of jugs and medium holds (mini-jugs, good crimps). Requires basic body positioning. On overhangs, these require good core tension.
            * **V4 - V5 (Intermediate):** Noticeable visual gaps. Poor holds introduced (flat slopers, small crimps, wide pinches). Might require dynamic movement, heel hooks, or strong body tension. Footholds are smaller or require smearing.
            * **V6 - V8 (Advanced):** Sparse holds. Terrible hold quality (micro-crimps, bad dual-texture slopers). Extreme physical demand, complex sequences (dynos, toe-catches). 
            * **V9+ (Elite):** Almost invisible holds, huge dynamic leaps, extreme overhangs with nonexistent feet.

            STEP 4: APPLYING THE WALL ANGLE MULTIPLIER
            - Remember the wall angle: {wall_angle}. 
            - A route with "V2" holds on a Vertical wall becomes a "V4" or "V5" if placed on a 45-degree Overhang. Adjust your final grade heavily based on the angle!

            Return the analysis STRICTLY as a raw JSON object with the following structure (no markdown formatting, no ```json tags):
            {{
              "routes": [
                {{
                  "color": "Color name (e.g., Red, Blue)",
                  "holds_ids": [array of integer indexes corresponding to the input holds],
                  "estimated_grade": "V-scale grade (e.g., V3)",
                  "reasoning": "A short explanation of why this grade was chosen."
                }}
              ],
              "overall_notes": "General advice about the wall.",
              "overall_confidence": 0.85
            }}

            IMPORTANT: For 'overall_confidence', provide a float number between 0.0 and 1.0 reflecting how confident you are in your color grouping.
            """

            # 4. Trimitem la Gemini 2.5 Flash
            response = self.client.models.generate_content(
                model='gemini-flash-latest',
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

            # Găsim gradul rutei principale (prima din listă) - Task Fix
            best_route = final_detected_routes[0] if final_detected_routes else (raw_detected_routes[0] if raw_detected_routes else {})
            main_grade = best_route.get("estimated_grade", "V?")

            # Extragem încrederea calculată de Gemini (Task KAN-11)
            confidence = result_data.get("overall_confidence", 0.85)

            logger.info(f"✅ Gemini a găsit {len(raw_detected_routes)} trasee. Grade: {main_grade}, Confidence: {confidence}")
            
            # Returnăm datele finale
            return final_detected_routes, main_grade, confidence, overall_notes

        except Exception as e:
            logger.error(f"❌ Eroare în GradingService: {e}")
            return [], "V?", 0.0, f"Grading unavailable. Model error: {str(e)}"

    def _draw_holds_on_image(self, image_base64: str, holds: List, start_index: int = 0) -> Image.Image:
        """
        Plasează DOAR numărul prizei lângă ea, lăsând pixelii prizei 100% vizibili pentru AI.
        """
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data)).convert("RGB")
        draw = ImageDraw.Draw(image)
        width, height = image.size

        # Folosim un font lizibil, dar care să nu acopere mult spațiu
        try:
            font = ImageFont.truetype("arial.ttf", size=max(14, int(width * 0.022)))
        except IOError:
            font = ImageFont.load_default()

        for idx, h in enumerate(holds):
            # Coordonatele centrului prizei
            cx = h.x * width
            cy = h.y * height
            
            # Plasăm numărul (ID-ul) ușor decalat spre dreapta-sus față de centru, 
            # FĂRĂ să mai desenăm vreun punct sau dreptunghi!
            text = str(idx + start_index)
            text_x, text_y = cx + 6, cy - 18 
            
            # Desenăm numărul cu un contur FOARTE fin negru pentru a fi lizibil 
            # pe pereți de orice culoare
            for offset_x, offset_y in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
                draw.text((text_x + offset_x, text_y + offset_y), text, font=font, fill="black")
            draw.text((text_x, text_y), text, font=font, fill="white")

        # Salvăm iar poza de debug ca să vezi diferența imensă!
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

    async def grade_custom_route(
        self,
        selected_holds: List[HoldLocation],
        image_base64: str,
        wall_angle: str = "Vertical"
    ) -> tuple:
        """Grade a user-defined spray wall route (selected subset of holds)."""
        if not self.client or not selected_holds:
            return "V?", 0.0, "AI Grading unavailable or no holds selected."

        try:
            # 1. Annotate image with only the selected holds
            annotated_image = self._draw_holds_on_image(image_base64, selected_holds)

            # 2. Build holds summary
            holds_summary = ""
            for idx, h in enumerate(selected_holds):
                holds_summary += f"[{idx}] Type: {h.hold_type}, X:{h.x:.2f}, Y:{h.y:.2f}\n"

            angle_instruction = f"""
            CRITICAL CONTEXT: The wall angle is: {wall_angle}. 
            Adjust your estimated V-grade and coaching advice accordingly.
            A hold that is a jug on a vertical wall becomes much harder on a 45-degree overhang.
            """

            prompt = f"""
            You are an expert bouldering coach analyzing a SPRAY WALL route.

            {angle_instruction}

            The climber has manually selected {len(selected_holds)} holds to create their own route.
            The holds are marked with white ID numbers on the attached image.
            
            Here is the data for the selected holds:
            {holds_summary}

            Analyze this as a SINGLE route. Consider:
            1. The spacing and distance between consecutive holds
            2. The wall angle: {wall_angle}
            3. Whether the movement requires dynamic moves, heel hooks, or complex body positioning
            4. The overall flow and difficulty of the sequence

            V-SCALE RUBRIC:
            * V0-V1: Large jugs, ladder-like, forgiving
            * V2-V3: Mix of jugs/medium holds, basic body positioning
            * V4-V5: Poor holds, dynamic movement, body tension
            * V6-V8: Sparse holds, terrible quality, extreme demand
            * V9+: Almost invisible holds, huge dynamic leaps

            Return STRICTLY as a raw JSON object (no markdown, no ```json tags):
            {{
              "estimated_grade": "V-scale grade (e.g. V4)",
              "confidence": 0.85,
              "coaching_notes": "Detailed coaching advice for this specific route, including suggested beta (sequence of movements), tips on body positioning, and what makes this route challenging."
            }}
            """

            response = self.client.models.generate_content(
                model='gemini-flash-latest',
                contents=[annotated_image, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )

            result_data = json.loads(response.text)
            grade = result_data.get("estimated_grade", "V?")
            confidence = result_data.get("confidence", 0.7)
            coaching = result_data.get("coaching_notes", "Route analyzed successfully.")

            logger.info(f"✅ Spray Wall grading: {grade} (confidence: {confidence})")
            return grade, confidence, coaching

        except Exception as e:
            logger.error(f"❌ Error in grade_custom_route: {e}")
            return "V?", 0.0, f"Grading failed: {str(e)}"

    async def chat_with_coach(
        self,
        image_base64: str,
        holds: List[HoldLocation],
        prompt: str,
        history: List[dict] = None,
        wall_angle: str = "vertical"
    ) -> str:
        """
        Interactive Chat: Generates a response from the coach based on the user's prompt
        and the specific route they selected (highlighted by the holds array).
        """
        if not self.client:
            return "AI Coach unavailable due to missing API key."

        try:
            # 1. Annotate image ONLY with the holds of the selected route, starting from 1
            annotated_image = self._draw_holds_on_image(image_base64, holds, start_index=1)

            # 2. Build the context for the model
            holds_summary = ""
            for idx, h in enumerate(holds):
                holds_summary += f"[{idx + 1}] Type: {h.hold_type}, X:{h.x:.2f}, Y:{h.y:.2f}\n"

            system_instruction = f"""
            You are an expert, encouraging bouldering coach named CLaiMB Coach.
            The user is asking you for beta (advice) on a specific route they selected on the wall.
            The wall angle is: {wall_angle}.

            The user's selected route consists of {len(holds)} holds. 
            These holds are explicitly marked with white ID numbers on the attached image.
            Here is the raw data of these holds:
            {holds_summary}

            IMPORTANT INSTRUCTIONS for your behavior:
            1. Keep your answers concise, practical, and highly specific to the holds marked with numbers.
            2. If they ask "Where do I start?", tell them which numbered holds look like the best starting hand/foot placements.
            3. Consider the wall angle when giving advice (e.g., overhangs require heel hooks and core tension).
            4. Be encouraging but realistic.
            
            STYLE INSTRUCTIONS:
            - Use **Bold text** for emphasis on critical moves or hold IDs.
            - Use Bulleted lists for step-by-step beta (e.g., "1. Left hand to #3").
            - Use Emojis (🧗‍♂️, 🎯, 💪, ⚡) to make the coach feel alive and professional.
            - Structure your response as a "Pro Tip" or "Beta Breakdown".
            """

            # 3. Format history for Gemini structured format
            # Format: 'user' or 'model'
            formatted_history = []
            if history:
                for msg in history:
                    role = "user" if msg["role"] == "user" else "model"
                    formatted_history.append({"role": role, "parts": [{"text": msg["text"]}]})

            # 4. We use the Chat mechanism from the new genai client
            # The genai client allows starting a chat
            chat = self.client.chats.create(
                model='gemini-flash-latest',
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3
                )
            )

            # Replay history if any (the current new SDK uses history param in create)
            # Actually, `client.chats.create` supports passing `history` 
            # To be safe and compatible with the new SDK, we'll pass the image and prompt in the first turn
            # or just send the current message with the image as context.
            
            # Since chat history with images can be heavy or complex in the genai SDK, 
            # we will send the current prompt and the image together.
            
            message_contents = [annotated_image, prompt]
            
            # If there is history, we construct a full prompt manually to avoid SDK chat history quirks with media
            history_text = ""
            if history:
                for msg in history:
                    sender = "User" if msg["role"] == "user" else "Coach"
                    history_text += f"{sender}: {msg['text']}\n"
                
                full_prompt = f"Previous Chat History:\n{history_text}\n\nUser's Current Question: {prompt}"
                message_contents = [annotated_image, full_prompt]

            response = chat.send_message(message_contents)
            
            logger.info(f"✅ Coach replied: {response.text[:50]}...")
            return response.text

        except Exception as e:
            logger.error(f"❌ Error in chat_with_coach: {e}")
            return f"Sorry, I had trouble processing that request. Error: {str(e)}"