"""
GradingService — Uses Claude Sonnet 4-6 to assign a V-scale bouldering grade.

Input:  list of HoldLocation + the original base64 image for visual context.
Output: (grade: str, confidence: float, notes: str)
"""
import os
import json
import uuid
import re
import math
import logging
from typing import List, Tuple
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from models.schemas import HoldLocation

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a world-class climbing route setter with 20+ years of experience in competitive
bouldering. You grade routes on the Hueco V-scale (V0–V11+) with consistent, calibrated accuracy."""

GRADE_PROMPT_TEMPLATE = """Analyze this climbing route and assign an accurate V-scale bouldering grade.

Detected Route Statistics:
- Total holds: {hold_count}
- Hold types: {hold_types}
- Vertical span: {v_span:.2f} (normalized, 0=none, 1=full wall)
- Horizontal span: {h_span:.2f}
- Average hold spacing: {avg_spacing:.3f}
- Average detection confidence: {avg_confidence:.2f}

Using the image AND the statistics above, return ONLY a valid JSON object (no markdown):
{{
  "grade": "V3",
  "confidence": 0.85,
  "notes": "A concise 1-2 sentence coach note about the route: key techniques, crux, style."
}}

Grade scale: V0 (easiest beginner) → V11+ (world-class). Be accurate — don't guess high."""


def _avg_spacing(holds: List[HoldLocation]) -> float:
    if len(holds) < 2:
        return 0.0
    total, count = 0.0, 0
    for i in range(len(holds)):
        for j in range(i + 1, len(holds)):
            dx = holds[i].x - holds[j].x
            dy = holds[i].y - holds[j].y
            total += math.sqrt(dx * dx + dy * dy)
            count += 1
    return total / count if count else 0.0


class GradingService:
    """Grades a climbing route using Claude Vision + route statistics."""

    def __init__(self):
        self.api_key: str = os.environ.get("EMERGENT_LLM_KEY", "")
        self._model_provider = "anthropic"
        self._model_name = "claude-sonnet-4-6"

    async def grade_route(
        self, holds: List[HoldLocation], image_base64: str
    ) -> Tuple[str, float, str]:
        """Returns (grade, confidence, notes)."""
        if not holds:
            return "V?", 0.0, "No holds detected — unable to grade route."

        stats = {
            "hold_count": len(holds),
            "hold_types": ", ".join(sorted({h.hold_type for h in holds})),
            "v_span": round(max(h.y for h in holds) - min(h.y for h in holds), 3),
            "h_span": round(max(h.x for h in holds) - min(h.x for h in holds), 3),
            "avg_spacing": _avg_spacing(holds),
            "avg_confidence": round(
                sum(h.confidence for h in holds) / len(holds), 3
            ),
        }

        prompt = GRADE_PROMPT_TEMPLATE.format(**stats)
        session_id = f"grading-{uuid.uuid4()}"
        chat = (
            LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=SYSTEM_PROMPT,
            )
            .with_model(self._model_provider, self._model_name)
        )

        image_content = ImageContent(image_base64=image_base64)
        msg = UserMessage(text=prompt, file_contents=[image_content])

        try:
            response: str = await chat.send_message(msg)
            logger.info(f"Grading response (first 300 chars): {response[:300]}")
        except Exception as exc:
            logger.error(f"GradingService API error: {exc}")
            return "V?", 0.5, "AI grading temporarily unavailable."

        return self._parse_grade_json(response)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_grade_json(text: str) -> Tuple[str, float, str]:
        match = re.search(r"\{.*?\}", text, re.DOTALL)
        if not match:
            return "V?", 0.5, "Could not parse grading response."
        try:
            data = json.loads(match.group())
            grade = data.get("grade", "V?")
            confidence = float(data.get("confidence", 0.5))
            notes = data.get("notes", "No notes provided.")
            return grade, confidence, notes
        except (json.JSONDecodeError, ValueError):
            return "V?", 0.5, "Grading response parse error."
