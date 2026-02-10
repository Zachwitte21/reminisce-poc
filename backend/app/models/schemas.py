import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Literal
from datetime import date, datetime
from enum import Enum

# Enums
class UserRole(str, Enum):
    caregiver = "caregiver"
    supporter = "supporter"

class MediaStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class TagType(str, Enum):
    person = "person"
    place = "place"
    event = "event"
    date = "date"
    custom = "custom"

# Auth Schemas
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=100)
    role: UserRole = UserRole.caregiver

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    avatar_url: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Patient Schemas
class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    birth_date: Optional[date] = None
    relationship: str

class PatientUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    birth_date: Optional[date] = None
    photo_url: Optional[str] = None
    relationship: Optional[str] = Field(None, max_length=50)

class PatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: Optional[str]
    birth_date: Optional[date]
    photo_url: Optional[str]
    relationship: str
    caregiver_id: str
    created_at: datetime

class PatientSettingsUpdate(BaseModel):
    require_photo_approval: Optional[bool] = None
    voice_therapy_enabled: Optional[bool] = None
    voice_speed: Optional[Literal["slow", "normal", "fast"]] = None
    settings_pin: Optional[str] = Field(None, pattern=r'^\d{4,6}$')  # 4-6 digits only

# Media Schemas
class MediaResponse(BaseModel):
    id: str
    type: str
    url: str
    thumbnail_url: Optional[str]
    caption: Optional[str]
    tags: List[str] = []
    date_taken: Optional[date]
    status: MediaStatus
    uploaded_by: str
    created_at: datetime

class MediaReview(BaseModel):
    action: str  # "approve" or "reject"
    rejection_reason: Optional[str] = None

class TagSuggestion(BaseModel):
    type: TagType
    value: str
    confidence: float

class UpdateTags(BaseModel):
    tags: List[dict]  # [{"type": "person", "value": "John"}]

# Therapy Schemas - forward reference for MediaFilterRequest
class TherapySessionCreate(BaseModel):
    patient_id: str
    voice_enabled: bool = False
    media_filter: Optional["MediaFilterRequest"] = None

class TherapySessionEnd(BaseModel):
    photos_viewed: int
    duration: int  # seconds
    completed_naturally: bool

class TherapySessionResponse(BaseModel):
    id: str
    patient_id: str
    started_at: datetime
    ended_at: Optional[datetime]
    photos_viewed: int = 0
    duration_seconds: Optional[int] = 0
    voice_enabled: bool = False
    media_queue: List[dict] = []

class TherapyScheduleCreate(BaseModel):
    patient_id: str
    session_duration: int = 15
    notification_minutes_before: int = 0
    sessions: List["ScheduleSessionItem"]

class TherapyScheduleUpdate(BaseModel):
    session_duration: Optional[int] = None
    notification_minutes_before: Optional[int] = None
    sessions: Optional[List["ScheduleSessionItem"]] = None

# Invitation Schemas
class InvitationCreate(BaseModel):
    email: EmailStr
    patient_id: str
    personal_message: Optional[str] = Field(None, max_length=500)

class InvitationResponse(BaseModel):
    id: str
    email: str
    patient_id: str
    invite_code: str
    expires_at: datetime
    status: str
    created_at: datetime

class InvitationAccept(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=100)

class SupporterResponse(BaseModel):
    id: str
    patient_id: str
    supporter_id: str
    created_at: datetime
    revoked_at: Optional[datetime] = None
    supporter_email: Optional[str] = None
    supporter_name: Optional[str] = None

# Voice Transcript Schemas
class VoiceTranscriptSave(BaseModel):
    transcript: List[dict]  # [{role, text, timestamp, photo_id?}]
    duration: int  # seconds
    word_count: int


# =====================================================
# Security-hardened schemas for input validation
# =====================================================

# Media update schema (replaces dict[str, Any])
class MediaUpdateRequest(BaseModel):
    caption: Optional[str] = Field(None, max_length=500)
    date_taken: Optional[date] = None
    status: Optional[MediaStatus] = None

    class Config:
        extra = "forbid"  # Reject unknown fields


# Media tag schema (replaces dict[str, str])
class MediaTagCreate(BaseModel):
    tag_type: TagType
    tag_value: str = Field(min_length=1, max_length=100)

    @field_validator('tag_value')
    @classmethod
    def sanitize_tag(cls, v: str) -> str:
        v = v.strip()
        v = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', v)  # Remove control chars
        return v


# Media filter schema (replaces Optional[dict])
class MediaFilterRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator('end_date')
    @classmethod
    def validate_range(cls, v, info):
        if v and info.data.get('start_date') and v < info.data['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


# Schedule session item (replaces List[dict])
class ScheduleSessionItem(BaseModel):
    day_of_week: int = Field(ge=0, le=6)  # 0=Sunday
    time_of_day: str = Field(pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')  # HH:MM
    enabled: bool = True


# Client log schema (replaces unvalidated dict)
class ClientLogLevel(str, Enum):
    debug = "debug"
    info = "info"
    warn = "warn"
    error = "error"


class ClientLogRequest(BaseModel):
    level: ClientLogLevel = ClientLogLevel.info
    message: str = Field(min_length=1, max_length=5000)
    timestamp: Optional[str] = None
    context: Optional[dict] = Field(None)

    @field_validator('message')
    @classmethod
    def sanitize_message(cls, v: str) -> str:
        v = re.sub(r'[\x00-\x09\x0b-\x1f\x7f-\x9f]', '', v)
        return v.strip()

    @field_validator('context')
    @classmethod
    def validate_context(cls, v):
        if v is None:
            return v
        if len(v) > 20:
            raise ValueError('context max 20 keys')
        return v