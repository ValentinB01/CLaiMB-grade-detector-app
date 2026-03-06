import os
import json
import logging
import re
import google.generativeai as genai # pip install google-generativeai
from typing import List, Tuple
from models.schemas import HoldLocation

logger = logging.getLogger(__name__)

class GradingService:
    """Calculează gradul V folosind Google Gemini (Gratuit)."""

    def __init__(self):
        # Configurează API Key-ul Gemini din .env
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            # Folosim 1.5 Flash pentru viteză mare sau 1.5 Pro pentru precizie maximă
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.model = None
            logger.warning("⚠️ GEMINI_API_KEY lipsește!")

    async def grade_route(self, holds: List[HoldLocation], image_base64: str) -> Tuple[str, float, str]:
        """Trimite imaginea și datele prizelor către Gemini pentru evaluare."""
        if not holds:
            return "V0", 0.5, "Nu s-au detectat prize."

        if not self.model:
            return "V?", 0.5, "Serviciul AI de grading este indisponibil (cheie lipsă)."

        # Pregătim datele statistice de la Roboflow pentru a ajuta AI-ul
        hold_count = len(holds)
        hold_types = ", ".join(set([h.hold_type for h in holds]))
        
        # Prompt-ul trimis către Gemini
        prompt = f"""
        Ești un antrenor expert de bouldering. Analizează această imagine și statisticile prizelor detectate:
        - Număr total de prize: {hold_count}
        - Tipuri de prize: {hold_types}
        
        Reguli:
        1. Estimează gradul pe scara Hueco (V0-V11).
        2. Analizează distanța dintre prize și unghiul peretelui vizibil în poză.
        3. Oferă un sfat scurt de coaching (1-2 propoziții).
        
        Returnează DOAR un obiect JSON valid:
        {{
            "grade": "V3",
            "confidence": 0.85,
            "notes": "Textul sfatului tău aici."
        }}
        """

        try:
            # Gemini acceptă imagini base64 sub formă de dicționar
            image_part = {
                "mime_type": "image/jpeg",
                "data": image_base64
            }
            
            # Apelăm Gemini
            response = self.model.generate_content([prompt, image_part])
            
            # Curățăm răspunsul (uneori AI-ul pune ```json ... ```)
            clean_json = re.search(r'\{.*\}', response.text, re.DOTALL).group()
            data = json.loads(clean_json)
            
            return (
                data.get("grade", "V0"),
                data.get("confidence", 0.7),
                data.get("notes", "Traseu interesant!")
            )
        except Exception as e:
            logger.error(f"❌ Eroare Gemini Grading: {e}")
            return "V2", 0.5, "Eroare la procesarea AI, am returnat un grad estimativ."