from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
import uuid


class RouteStatus(str, Enum):
    PROJECT = "Project"
    SENT = "Sent"
    TOPPED = "Topped"


class DetectedRoute(BaseModel):
    color: str
    holds_ids: List[int]
    estimated_grade: str
    reasoning: str


class HoldLocation(BaseModel):
    """Represents a detected climbing hold on the wall."""
    x: float = Field(..., ge=0.0, le=1.0, description="Center X position, normalized 0-1")
    y: float = Field(..., ge=0.0, le=1.0, description="Center Y position, normalized 0-1")
    width: float = 0.0
    height: float = 0.0
    radius: float = Field(..., ge=0.001, le=0.2, description="Hold radius, normalized 0-1")
    confidence: float = Field(..., ge=0.0, le=1.0)
    hold_type: str = Field(default="hand", description="start | finish | hand | foot")
    color: Optional[str] = Field(default="unknown")
    polygon: Optional[List[dict]] = None


class AnalysisRequest(BaseModel):
    image_base64: str
    gym_name: Optional[str] = "Unknown Gym"
    wall_angle: Optional[str] = "vertical"
    user_id: Optional[str] = "guest"


class AnalysisResponse(BaseModel):
    """Contract returned to the mobile app."""
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    holds: List[HoldLocation]
    grade: str = Field(..., description="V-scale grade e.g. V4")
    confidence: float = Field(..., ge=0.0, le=1.0)
    notes: str
    gym_name: str
    processed_at: str
    detected_routes: List[DetectedRoute] = Field(default_factory=list)
    image_base64: Optional[str] = None


class RouteRecord(BaseModel):
    id: Optional[str] = None
    analysis_id: Optional[str] = None
    gym_name: str
    grade: str
    holds_count: int
    confidence: float
    notes: str
    thumbnail_base64: Optional[str] = None
    analyzed_at: str
    user_id: str = "guest"
    status: RouteStatus = RouteStatus.PROJECT
    detected_routes: List[DetectedRoute] = Field(default_factory=list)
    image_base64: Optional[str] = None
    holds: Optional[List[HoldLocation]] = None


class RouteHistoryResponse(BaseModel):
    routes: List[RouteRecord]
    total: Optional[int] = 0


# ---------------------------------------------------------------------------
# Spray Wall Feature Schemas
# ---------------------------------------------------------------------------
class DetectRequest(BaseModel):
    """Step 1: Detect holds only — no grading."""
    image_base64: str
    user_id: Optional[str] = "guest"


class DetectResponse(BaseModel):
    """Returns all detected holds for spray wall selection."""
    detect_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    holds: List[HoldLocation]
    holds_count: int


class GradeSelectionRequest(BaseModel):
    """Step 2: Grade a user-selected subset of holds."""
    image_base64: str
    selected_hold_indices: List[int]
    holds: List[HoldLocation]
    wall_angle: Optional[str] = "vertical"
    gym_name: Optional[str] = "Unknown Gym"
    user_id: Optional[str] = "guest"


class GradeSelectionResponse(BaseModel):
    """Grading result for a user-defined spray wall route."""
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    grade: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    coaching_notes: str
    selected_holds_count: int
    gym_name: str
    wall_angle: str
    processed_at: str


# ---------------------------------------------------------------------------
# Ask the Coach Feature Schemas
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'coach'")
    text: str

class ChatRequest(BaseModel):
    image_base64: str
    holds: List[HoldLocation]
    prompt: str
    history: List[ChatMessage] = Field(default_factory=list)
    wall_angle: Optional[str] = "vertical"
    gym_name: Optional[str] = "Unknown Gym"
    user_id: Optional[str] = "guest"

class ChatResponse(BaseModel):
    reply: str
    processed_at: str