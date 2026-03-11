from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class DetectedRoute(BaseModel):
    color: str
    holds_ids: List[int]
    estimated_grade: str
    reasoning: str

class HoldLocation(BaseModel):
    """Represents a detected climbing hold on the wall."""
    x: float = Field(..., ge=0.0, le=1.0, description="Center X position, normalized 0-1")
    y: float = Field(..., ge=0.0, le=1.0, description="Center Y position, normalized 0-1")
    width: float = 0.0   # <--- Adăugat
    height: float = 0.0  # <--- Adăugat
    radius: float = Field(..., ge=0.001, le=0.2, description="Hold radius, normalized 0-1")
    confidence: float = Field(..., ge=0.0, le=1.0)
    hold_type: str = Field(default="hand", description="start | finish | hand | foot")
    color: Optional[str] = Field(default="unknown")


class AnalysisRequest(BaseModel):
    """Request payload from mobile: photo + optional metadata."""
    image_base64: str = Field(..., description="Base64-encoded JPEG image")
    gym_name: Optional[str] = Field(default="Unknown Gym")
    user_id: Optional[str] = Field(default="guest")
    wall_angle: Optional[str] = "Vertical (0 degrees)"


class AnalysisResponse(BaseModel):
    """Contract returned to the mobile app."""
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    holds: List[HoldLocation]
    grade: str = Field(..., description="V-scale grade e.g. V4")
    confidence: float = Field(..., ge=0.0, le=1.0)
    notes: str
    gym_name: str
    processed_at: str
    detected_routes: List[DetectedRoute] = []

class RouteRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    analysis_id: str
    gym_name: str
    grade: str
    holds_count: int
    confidence: float
    notes: str
    thumbnail_base64: Optional[str] = None
    analyzed_at: str
    user_id: str = "guest"
    detected_routes: List[DetectedRoute] = []

class RouteHistoryResponse(BaseModel):
    routes: List[RouteRecord]
    total: int
