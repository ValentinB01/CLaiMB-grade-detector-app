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


def _compute_spatial_context(holds: List) -> str:
    """Pre-compute spatial statistics about hold positions for the AI."""
    if len(holds) < 2:
        return "Spatial context: Only 0-1 holds detected, insufficient for analysis."

    xs = [h.x for h in holds]
    ys = [h.y for h in holds]

    # Average pairwise distance between all holds
    total_dist = 0
    count = 0
    for i in range(len(holds)):
        for j in range(i + 1, len(holds)):
            dist = ((holds[i].x - holds[j].x) ** 2 + (holds[i].y - holds[j].y) ** 2) ** 0.5
            total_dist += dist
            count += 1
    avg_dist = total_dist / count if count else 0

    vertical_spread = max(ys) - min(ys)
    horizontal_spread = max(xs) - min(xs)

    return (
        f"Spatial Context (all values normalized 0-1):\n"
        f"  - Total holds: {len(holds)}\n"
        f"  - Average pairwise distance: {avg_dist:.3f}\n"
        f"  - Vertical spread (bottom to top): {vertical_spread:.3f}\n"
        f"  - Horizontal spread (left to right): {horizontal_spread:.3f}\n"
        f"  - Hold density: {'Dense (spray wall)' if avg_dist < 0.15 else 'Moderate' if avg_dist < 0.25 else 'Sparse'}\n"
    )

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

            # 2. Pregătim un rezumat text al prizelor cu dimensiuni
            holds_summary = ""
            for idx, h in enumerate(holds):
                color_str = h.color if h.color else "unknown"
                holds_summary += (
                    f"[{idx}] Color: {color_str}, Type: {h.hold_type}, "
                    f"Pos: ({h.x:.2f}, {h.y:.2f}), "
                    f"Size: {h.width:.3f}x{h.height:.3f}\n"
                )

            # 3. Compute spatial context
            spatial_ctx = _compute_spatial_context(holds)

            prompt = f"""
            ROLE: You are an expert bouldering coach and professional route setter with 10+ years of 
            experience grading routes in commercial climbing gyms. You have set thousands of routes 
            from V0 to V12 and can accurately estimate difficulty from visual analysis.

            TASK: Analyze the attached image of a climbing wall.

            CRITICAL VISUAL INSTRUCTION: The detected holds have white ID numbers hovering right 
            next to them. There are NO boxes or dots. Look EXACTLY next to the number to see the 
            raw pixels of the hold to determine its color. Ignore white chalk powder.

            ═══════════════════════════════════════════
            HOLD DATA (all coordinates normalized 0-1, where size < 0.02 = small/crimp, > 0.05 = large/jug):
            {holds_summary}
            {spatial_ctx}
            ═══════════════════════════════════════════

            WALL ANGLE: {wall_angle}
            Apply this grade adjustment based on wall angle:
              • Slab (negative angle):    −1 grade for positive holds, +1 for slopers/friction-dependent holds
              • Vertical (0°):            Baseline — no adjustment
              • Slight overhang (15−30°): +1 grade
              • Overhang (30−45°):        +2 grades
              • Steep overhang (45°+):    +3 grades
              • Roof (horizontal):        +3 to +4 grades

            ═══════════════════════════════════════════
            MANDATORY CHAIN-OF-THOUGHT — Follow these steps IN ORDER:
            ═══════════════════════════════════════════

            STEP 1 — COLOR IDENTIFICATION:
            For EACH hold ID, look at the actual physical hold pixels next to the number.
            Determine its true plastic color (e.g., Red, Blue, Yellow, Green, Black, Pink, Purple, White, Orange).

            STEP 2 — ROUTE GROUPING:
            Group hold IDs into distinct routes based EXCLUSIVELY on the color from Step 1.
            NEVER mix holds of different colors in the same route.

            STEP 3 — DIFFICULTY ESTIMATION (V-SCALE RUBRIC):
            For each color route, evaluate against this calibrated rubric:

              V0−V1 (Introductory): Equivalent to climbing a ladder. All holds are large, positive 
                jugs you could hang on for 30+ seconds. Spacing ≤ arm's length. Abundant, large 
                footholds. Hold size typically > 0.05. Very forgiving on any angle.

              V2−V3 (Beginner-Intermediate): A mix of jugs and medium holds (mini-jugs, good crimps). 
                Requires basic body positioning (flagging, drop knees). Some spacing gaps. On overhangs, 
                requires noticeable core tension. Hold sizes mostly 0.03−0.05.

              V4−V5 (Intermediate): Noticeable visual gaps between holds. Poor holds introduced 
                (flat slopers, small crimps size < 0.025, wide pinches). May require dynamic 
                movement, heel hooks, or strong body tension. Footholds are smaller or require smearing.

              V6−V8 (Advanced): Sparse holds with large gaps. Terrible hold quality (micro-crimps 
                size < 0.015, bad slopers). Extreme physical demand, complex sequences 
                (dynos, toe-catches, figure-fours). Often requires competition-level strength.

              V9+ (Elite): Near-invisible holds, huge dynamic leaps between holds, extreme 
                overhangs with nonexistent feet. Reserved for elite-level problems.

            STEP 4 — APPLY WALL ANGLE ADJUSTMENT:
            Take the base grade from Step 3 and adjust using the wall angle rules above.

            STEP 5 — FINAL VALIDATION:
            Before outputting, ask yourself:
            - "Would a V0 climber actually be able to pull on these holds at this angle?"
            - "Is this grade consistent with what I'd see in a real gym?"

            ═══════════════════════════════════════════
            IMPORTANT RULES (DO NOT VIOLATE):
            ═══════════════════════════════════════════
            • Do NOT grade a route higher just because it has fewer holds. A 3-hold route of massive jugs is still V0.
            • Do NOT assume all small holds are hard. Context matters — a small hold near a rest jug is different from one mid-crux.
            • Do NOT mix colors. If hold 1 is Yellow and hold 2 is Green, they are DIFFERENT routes, period.
            • DO consider the overall flow: is the route sustained, or does it have a single hard crux move?

            ═══════════════════════════════════════════
            EXAMPLE OUTPUT (for reference only):
            ═══════════════════════════════════════════
            {{
              "routes": [
                {{
                  "color": "Red",
                  "holds_ids": [2, 5, 8, 12, 15, 19],
                  "estimated_grade": "V3",
                  "reasoning": "6 red holds spanning ~0.7 vertical distance. Mix of medium jugs (size ~0.04) and one small crimp at hold 12 (size 0.018) creating a clear crux. Adequate footholds. Vertical wall = no angle adjustment. Sustained but not powerful."
                }}
              ],
              "overall_notes": "Wall has 3 distinct color routes. The red route is beginner-friendly with one tricky move. The blue route requires more power.",
              "overall_confidence": 0.85
            }}

            ═══════════════════════════════════════════
            CONFIDENCE CALIBRATION:
            ═══════════════════════════════════════════
            Use this scale for 'overall_confidence':
              0.9 − 1.0: Crystal clear holds, obvious single-color route, unambiguous grade
              0.7 − 0.9: Minor ambiguity in hold colors or borderline grade (±1)
              0.5 − 0.7: Multiple possible color interpretations or grade uncertainty (±2)
              Below 0.5: Very uncertain — poor image quality, ambiguous hold colors, or unclear routes

            Return STRICTLY as a raw JSON object (no markdown, no ```json tags):
            {{
              "routes": [
                {{
                  "color": "Color name (e.g., Red, Blue)",
                  "holds_ids": [array of integer indexes from the input holds],
                  "estimated_grade": "V-scale grade (e.g., V3)",
                  "reasoning": "Explain: which holds form the crux, what makes it this grade, how angle affected it."
                }}
              ],
              "overall_notes": "General coaching advice about the wall and the routes.",
              "overall_confidence": 0.85
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
            text = str(idx)
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

            # 2. Build holds summary with size data
            holds_summary = ""
            for idx, h in enumerate(selected_holds):
                holds_summary += (
                    f"[{idx}] Type: {h.hold_type}, "
                    f"Pos: ({h.x:.2f}, {h.y:.2f}), "
                    f"Size: {h.width:.3f}x{h.height:.3f}\n"
                )

            # 3. Spatial context for selected holds
            spatial_ctx = _compute_spatial_context(selected_holds)

            prompt = f"""
            ROLE: You are a professional bouldering coach with 10+ years of route-setting experience, 
            analyzing a SPRAY WALL route. You specialize in reading sequences and providing 
            actionable beta (movement advice) to climbers of all levels.

            CONTEXT: The climber has manually selected {len(selected_holds)} holds to create their own route.
            The holds are marked with white ID numbers on the attached image.

            ═══════════════════════════════════════════
            SELECTED HOLD DATA (normalized 0-1, size < 0.02 = small, > 0.05 = large):
            {holds_summary}
            {spatial_ctx}
            ═══════════════════════════════════════════

            WALL ANGLE: {wall_angle}
            Grade adjustment:
              • Slab (negative): −1 for positive holds, +1 for slopers
              • Vertical (0°): Baseline
              • Slight overhang (15−30°): +1 grade
              • Overhang (30−45°): +2 grades  
              • Steep overhang (45°+): +3 grades

            ═══════════════════════════════════════════
            CHAIN-OF-THOUGHT ANALYSIS:
            ═══════════════════════════════════════════

            STEP 1 — SEQUENCE READING:
            Look at the hold positions from bottom to top. Determine the logical climbing sequence.
            Identify the start holds (lowest) and finish hold (highest).

            STEP 2 — MOVEMENT ANALYSIS:
            For each move in the sequence, determine:
              - Is it static (controlled reach) or dynamic (deadpoint/dyno)?
              - What body position is needed (square, flagging, drop knee, bat hang)?
              - What foot technique (smearing, heel hook, toe hook, bicycle)?

            STEP 3 — DIFFICULTY ESTIMATION:
            Apply this calibrated rubric:
              V0−V1: Ladder-like. All holds are large jugs (size > 0.05) you could hang 30+ seconds. 
                Spacing ≤ arm's length. No technique required.
              V2−V3: Mix of jugs and medium holds. Some require basic body positioning. 
                Moderate spacing.
              V4−V5: Poor holds appear (crimps < 0.025, slopers). Requires dynamic movement, 
                heel hooks, or strong body tension. Noticeable gaps.
              V6−V8: Micro-crimps (< 0.015), bad slopers. Complex sequences, extreme demand.
              V9+: Near-invisible holds, huge dynamic leaps, elite-level.

            STEP 4 — APPLY WALL ANGLE ADJUSTMENT.

            IMPORTANT RULES:
            • Do NOT grade higher just because there are fewer holds. 3 big jugs = still V0.
            • DO consider sustained difficulty vs. single crux move.
            • DO factor in the wall angle heavily — it changes everything.

            ═══════════════════════════════════════════
            CONFIDENCE CALIBRATION:
              0.9−1.0: Obvious grade, clear holds, unambiguous sequence
              0.7−0.9: Borderline grade (±1), minor ambiguity
              0.5−0.7: Significant uncertainty (±2 grades)
              Below 0.5: Very uncertain
            ═══════════════════════════════════════════

            Return STRICTLY as a raw JSON object (no markdown, no ```json tags):
            {{
              "estimated_grade": "V-scale grade (e.g. V4)",
              "confidence": 0.85,
              "coaching_notes": "Structure your advice as follows:\n\n"
                "BETA (Sequence):\n"
                "1. Start on holds X/Y with [hand position]\n"
                "2. Move [left/right] hand to hold Z — [static reach / deadpoint / dyno]\n"
                "3. [Continue move-by-move]\n"
                "...\n"
                "N. Top out on hold X\n\n"
                "KEY TIPS:\n"
                "• [Body positioning advice]\n"
                "• [Foot technique tips]\n\n"
                "CRUX: [Which move is hardest and why]"
            }}
            """

            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
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