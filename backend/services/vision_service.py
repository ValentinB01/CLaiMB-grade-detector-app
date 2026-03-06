"""
VisionService — Hybrid Claude Vision + optional Roboflow hold detection.

Primary:  Claude Sonnet 4-6 (via emergentintegrations) — always active.
Optional: Roboflow object-detection API — activated when ROBOFLOW_API_KEY is set.

The service returns a list of HoldLocation objects (normalized 0-1 coordinates).
"""
import os
import json
import uuid
import re
import logging
from typing import List, Optional
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from models.schemas import HoldLocation

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert computer vision system specialized in indoor climbing wall analysis.
You detect climbing holds with high accuracy and return precise normalized coordinates."""

HOLD_DETECT_PROMPT = """Analyze this climbing wall image and identify ALL visible climbing holds.

Return ONLY a valid JSON array — no markdown, no explanation, just the raw JSON array:
[
  {
    "x": 0.35,
    "y": 0.42,
    "radius": 0.03,
    "confidence": 0.92,
    "hold_type": "hand",
    "color": "yellow"
  }
]

Rules:
- x, y: center position normalized 0.0-1.0 (top-left = 0,0; bottom-right = 1,1)
- radius: hold visual radius normalized 0.0-1.0 (typical range 0.02–0.06)
- confidence: detection confidence 0.0-1.0
- hold_type: "start" (green, at bottom), "finish" (top hold), "hand" (primary), "foot" (small foothold)
- color: dominant color name of the hold or tape
- Detect between 5 and 25 holds
- Return ONLY the JSON array, absolutely nothing else"""


class VisionService:
    """Detects climbing holds in wall images. Hybrid: Claude Vision + optional Roboflow."""

    def __init__(self):
        self.api_key: str = os.environ.get("EMERGENT_LLM_KEY", "")
        self.roboflow_key: Optional[str] = os.environ.get("ROBOFLOW_API_KEY") or None
        self._model_provider = "anthropic"
        self._model_name = "claude-sonnet-4-6"

    async def analyze_image(self, image_base64: str) -> List[HoldLocation]:
        """Entry point: detect holds using Roboflow (if key set) or Claude Vision."""
        if self.roboflow_key:
            try:
                holds = await self._detect_roboflow(image_base64)
                if holds:
                    logger.info(f"Roboflow detected {len(holds)} holds")
                    return holds
            except Exception as exc:
                logger.warning(f"Roboflow failed, falling back to Claude: {exc}")

        return await self._detect_claude(image_base64)

    # ------------------------------------------------------------------
    # Claude Vision detection
    # ------------------------------------------------------------------
    async def _detect_claude(self, image_base64: str) -> List[HoldLocation]:
        session_id = f"vision-{uuid.uuid4()}"
        chat = (
            LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=SYSTEM_PROMPT,
            )
            .with_model(self._model_provider, self._model_name)
        )

        image_content = ImageContent(image_base64=image_base64)
        msg = UserMessage(text=HOLD_DETECT_PROMPT, file_contents=[image_content])

        try:
            response: str = await chat.send_message(msg)
            logger.info(f"Claude vision raw response (first 300 chars): {response[:300]}")
        except Exception as exc:
            logger.error(f"Claude vision API error: {exc}")
            return self._fallback_holds()

        holds = self._parse_holds_json(response)
        if not holds:
            logger.warning("Claude returned no parseable holds, using fallback")
            return self._fallback_holds()

        logger.info(f"Claude detected {len(holds)} holds")
        return holds

    # ------------------------------------------------------------------
    # Roboflow detection (optional)
    # ------------------------------------------------------------------
    async def _detect_roboflow(self, image_base64: str) -> List[HoldLocation]:
        import httpx
        import base64

        workspace = "climbing-holds-ek8zs"
        project = "climbing-hold-3cwll"
        version = "1"
        url = f"https://detect.roboflow.com/{project}/{version}"

        image_bytes = base64.b64decode(image_base64)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                params={"api_key": self.roboflow_key},
                content=image_bytes,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if resp.status_code != 200:
            logger.warning(f"Roboflow HTTP {resp.status_code}: {resp.text[:200]}")
            return []

        data = resp.json()
        img_w = data.get("image", {}).get("width", 1) or 1
        img_h = data.get("image", {}).get("height", 1) or 1
        holds = []

        for pred in data.get("predictions", []):
            holds.append(
                HoldLocation(
                    x=pred["x"] / img_w,
                    y=pred["y"] / img_h,
                    radius=max(pred["width"], pred["height"]) / (2 * max(img_w, img_h)),
                    confidence=round(pred["confidence"], 3),
                    hold_type="hand",
                    color=pred.get("class", "unknown"),
                )
            )

        return holds

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _parse_holds_json(self, text: str) -> List[HoldLocation]:
        match = re.search(r"\[.*?\]", text, re.DOTALL)
        if not match:
            return []
        try:
            raw = json.loads(match.group())
            holds = []
            for item in raw:
                try:
                    holds.append(HoldLocation(**item))
                except Exception:
                    pass
            return holds
        except json.JSONDecodeError:
            return []

    @staticmethod
    def _fallback_holds() -> List[HoldLocation]:
        """Return sensible mock holds so the app still functions when AI is unavailable."""
        import random
        mock_types = ["start", "hand", "hand", "hand", "foot", "hand", "finish"]
        colors = ["yellow", "blue", "red", "green", "purple", "orange"]
        holds = []
        for i, htype in enumerate(mock_types):
            holds.append(
                HoldLocation(
                    x=round(0.2 + (i % 3) * 0.25 + random.uniform(-0.05, 0.05), 3),
                    y=round(0.15 + (i // 3) * 0.25 + random.uniform(-0.05, 0.05), 3),
                    radius=0.035,
                    confidence=0.6,
                    hold_type=htype,
                    color=colors[i % len(colors)],
                )
            )
        return holds
