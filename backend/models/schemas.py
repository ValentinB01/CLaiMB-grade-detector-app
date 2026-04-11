from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime
import uuid

class RouteStatus(str, Enum):
    PROJECT = "Project"
    SENT = "Sent"
    TOPPED = "Topped"

class AscentStyle(str, Enum):
    FLASH = "Flash"         
    REDPOINT = "Redpoint"   
    ZONE = "Zone"           
    ATTEMPT = "Attempt"     

class Progression(str, Enum):
    ZONE = "zone"
    TOP = "top"
    FLASH = "flash"

class VerifiedStatus(str, Enum):
    UNVERIFIED = "unverified"
    PEER_VERIFIED = "peer_verified"
    AI_VERIFIED = "ai_verified"

class UserProfile(BaseModel):
    uid: str = Field(..., description="Firebase UID")
    email: str
    display_name: str
    is_pro: bool = Field(default=False, description="Dacă are acces la CLaiMB Coach")
    home_gym_id: Optional[str] = Field(default=None, description="Sala preferată în Community")
    city: Optional[str] = Field(default=None, description="Orașul utilizatorului")
    country: Optional[str] = Field(default=None, description="Țara utilizatorului")
    total_points: int = Field(default=0, description="Punctajul total acumulat în Arena")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class Gym(BaseModel):
    gym_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    logo_url: Optional[str] = None
    primary_color: str = Field(default="#22d3ee", description="Culoarea temei pentru aplicație")
    address: Optional[str] = None
    is_active: bool = True

class GymRoute(BaseModel):
    route_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    gym_id: str
    name: Optional[str] = Field(default=None, description="Nume opțional al traseului (ex: Boulder roșu colț)")
    color: str = Field(..., description="Culoarea prizelor (ex: Roșu, Albastru)")
    grade: str = Field(..., description="Gradul real al traseului (ex: V4)")
    points: int = Field(default=100, description="Punctajul de bază oferit la completare")
    set_date: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    is_active: bool = True 

class Ascent(BaseModel):
    ascent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    gym_id: str
    route_id: str
    style: AscentStyle
    grade: Optional[str] = Field(default=None, description="Gradul traseului (ex: Galben, Verde, Albastru, Negru)")
    progression: Progression = Field(default=Progression.TOP, description="Nivelul de completare")
    verified_status: VerifiedStatus = Field(default=VerifiedStatus.UNVERIFIED, description="Statusul de validare")
    witness_id: Optional[str] = Field(default=None, description="UID-ul martorului care validează")
    points_awarded: int = 0
    date: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

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

class AnalysisRequest(BaseModel):
    image_base64: str
    gym_id: Optional[str] = None
    gym_name: Optional[str] = "Unknown Gym"
    wall_angle: Optional[str] = "vertical"
    user_id: Optional[str] = "guest"

class AnalysisResponse(BaseModel):
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    holds: List[HoldLocation]
    grade: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    notes: str
    gym_name: str = ""
    gym_id: Optional[str] = None
    processed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    detected_routes: List[DetectedRoute] = Field(default_factory=list)
    image_base64: Optional[str] = None

class RouteRecord(BaseModel):
    id: Optional[str] = None
    analysis_id: Optional[str] = None
    gym_id: Optional[str] = None
    gym_name: Optional[str] = "Unknown Gym"
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

class DetectRequest(BaseModel):
    image_base64: str
    user_id: Optional[str] = "guest"

class DetectResponse(BaseModel):
    detect_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    holds: List[HoldLocation]
    holds_count: int

class GradeSelectionRequest(BaseModel):
    image_base64: str
    selected_hold_indices: List[int]
    holds: List[HoldLocation]
    wall_angle: Optional[str] = "vertical"
    gym_id: Optional[str] = None
    user_id: Optional[str] = "guest"

class GradeSelectionResponse(BaseModel):
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    grade: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    coaching_notes: str
    selected_holds_count: int
    gym_id: Optional[str] = None
    wall_angle: str
    processed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class PoseRecord(BaseModel):
    id: Optional[str] = None
    user_id: str = "guest"
    final_overall_score: float = 0.0
    consolidated_feedback: str = ""
    efficiency_score: float = 0.0
    feedback: str = ""
    balance_score: float = 0.0
    balance_feedback: str = ""
    fluidity_score: float = 0.0
    fluidity_feedback: str = ""
    total_active_frames: int = 0
    frames_with_straight_arms: int = 0
    video_url: Optional[str] = None
    analyzed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class PoseHistoryResponse(BaseModel):
    records: List[PoseRecord]
    total: int = 0

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'model'")
    text: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    reply: str
    processed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class VerifyRouteRequest(BaseModel):
    route_id: str = Field(..., description="ID-ul urcării (ascent) de verificat")
    witness_user_id: str = Field(..., description="UID-ul martorului care confirmă urcarea")
