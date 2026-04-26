import os
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types

from models.schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["Chat"])
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are an Expert Climbing Coach with deep knowledge of bouldering, "
    "sport climbing, and training methodology. You help climbers of all levels "
    "improve their technique, strength, and mental game. Always provide "
    "actionable, safe advice. Be encouraging but honest."
)

_api_key = os.environ.get("GEMINI_API_KEY")
_client = genai.Client(api_key=_api_key) if _api_key else None


@router.post("/chat", response_model=ChatResponse)
async def chat_with_coach(request: ChatRequest):
    if not _client:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured.")

    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty.")

    # --- Formatarea istoricului pentru SDK-ul Gemini ---
    # Toate mesajele *în afara* ultimului devin istoric
    history = [
        {"role": msg.role, "parts": [{"text": msg.text}]}
        for msg in request.messages[:-1]
    ]

    # Ultimul mesaj este cel pe care îl trimitem acum
    user_message = request.messages[-1].text

    try:
        chat = _client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7,
            ),
            history=history,
        )
        response = chat.send_message(user_message)
        reply_text = response.text or ""
    except Exception as exc:
        logger.error(f"Gemini chat error: {exc}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(exc)}")

    return ChatResponse(
        reply=reply_text,
        processed_at=datetime.now(timezone.utc).isoformat(),
    )
