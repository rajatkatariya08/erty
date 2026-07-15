"""Shared dependencies, models, config, and helpers for FixPoint backend."""
from fastapi import HTTPException, Depends, Cookie, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from pathlib import Path
import os
import re
import json
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger("fixpoint")

# ---- Config ----
mongo_url = os.environ['MONGO_URL']
if mongo_url.startswith(("mongomock://", "memory://")):
    from mongomock_motor import AsyncMongoMockClient

    client = AsyncMongoMockClient()
else:
    client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()}

# Service area: Gurugram, Haryana, India (approx bounding box)
CITY_NAME = "Gurugram"
CITY_CENTER = (28.4595, 77.0266)
GURUGRAM_BOUNDS = {
    "lat_min": 28.30, "lat_max": 28.60,
    "lng_min": 76.85, "lng_max": 77.20,
}

# Whitelisted languages for AI diagnosis (prevents prompt-injection via language field)
ALLOWED_LANGUAGES = {
    "English", "Hindi", "Spanish", "French", "German", "Portuguese",
    "Arabic", "Chinese", "Japanese", "Tamil",
}

COST_BANDS = {
    "low": (299, 799),
    "medium": (799, 1999),
    "high": (1999, 4999),
}


def in_service_area(lat: float, lng: float) -> bool:
    b = GURUGRAM_BOUNDS
    return b["lat_min"] <= lat <= b["lat_max"] and b["lng_min"] <= lng <= b["lng_max"]


def strip_data_url(b64: str) -> str:
    if b64.startswith("data:"):
        parts = b64.split(",", 1)
        return parts[1] if len(parts) == 2 else b64
    return b64


def extract_json(text: str) -> Optional[dict]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


# ---- Models ----
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    role: str = "customer"  # customer | technician | admin (comes from user_sessions.role)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Service(BaseModel):
    service_id: str
    category: str
    name: str
    description: str
    icon: str
    image_url: str
    tiers: List[dict]
    base_price: int
    market_min: int = 0
    market_max: int = 0
    is_flat_visit: bool = False
    booking_fee: int = 0  # ₹100 booking/visiting fee for handyman ecosystem


class Technician(BaseModel):
    tech_id: str
    name: str
    email: str = ""
    picture: str
    rating: float
    experience_years: int
    specializations: List[str]
    phone: str
    is_available: bool = True
    home_lat: float = CITY_CENTER[0]
    home_lng: float = CITY_CENTER[1]
    status: str = "approved"  # pending | approved | rejected
    gov_id_thumb: Optional[str] = ""


class Booking(BaseModel):
    booking_id: str
    user_id: str
    service_id: str
    service_name: str
    category: str
    tier_name: str
    price: int
    address: str
    scheduled_date: str
    scheduled_slot: str
    notes: str = ""
    status: str = "assigned"
    tech_id: Optional[str] = None
    tech_name: Optional[str] = None
    tech_picture: Optional[str] = None
    tech_lat: Optional[float] = None
    tech_lng: Optional[float] = None
    dest_lat: float = CITY_CENTER[0]
    dest_lng: float = CITY_CENTER[1]
    diagnosis_id: Optional[str] = None
    rating: Optional[int] = None
    review: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Diagnosis(BaseModel):
    diagnosis_id: str
    user_id: str
    category: str
    issue_summary: str
    detected_problems: List[str]
    severity: str
    estimated_cost_min: int
    estimated_cost_max: int
    recommended_service: str
    ai_notes: str
    image_thumb: Optional[str] = ""
    language: str = "English"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionRequest(BaseModel):
    session_id: str


class BookingCreate(BaseModel):
    service_id: str
    tier_name: str
    address: str
    scheduled_date: str
    scheduled_slot: str
    notes: str = ""
    diagnosis_id: Optional[str] = None
    dest_lat: Optional[float] = Field(default=None, ge=-90, le=90)
    dest_lng: Optional[float] = Field(default=None, ge=-180, le=180)


class StatusUpdate(BaseModel):
    status: str


class ReviewPayload(BaseModel):
    rating: int
    review: str = ""


class TechLocationUpdate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class DiagnosisRequest(BaseModel):
    category: str
    image_base64: str
    user_note: str = ""
    language: str = "English"


class LiveDiagnosisRequest(BaseModel):
    category: str
    image_base64: str
    message: str = ""
    language: str = "English"


class ServiceUpsert(BaseModel):
    category: str
    name: str
    description: str
    icon: str = "wrench"
    image_url: str = ""
    tiers: List[dict]
    base_price: int
    market_min: int = 0
    market_max: int = 0
    is_flat_visit: bool = False


class TechnicianUpsert(BaseModel):
    name: str
    email: str = ""
    picture: str = ""
    rating: float = 4.5
    experience_years: int = 1
    specializations: List[str]
    phone: str = ""
    is_available: bool = True
    home_lat: float = CITY_CENTER[0]
    home_lng: float = CITY_CENTER[1]


# ---- Auth deps ----
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> User:
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    # Session role is the source of truth for what portal the user signed in through.
    user_doc["role"] = session.get("role", "customer")
    return User(**user_doc)


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    # Must have signed in through the admin portal AND be in the ADMIN_EMAILS allowlist.
    if user.role != "admin" or user.email.lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def get_technician(user: User = Depends(get_current_user)) -> dict:
    # Must have signed in through the technician portal.
    if user.role != "technician":
        raise HTTPException(status_code=403, detail="Technician access only")
    tech = await db.technicians.find_one({"email": user.email.lower()}, {"_id": 0})
    if not tech:
        raise HTTPException(status_code=403, detail="Technician profile not found")
    return tech


async def get_approved_technician(tech: dict = Depends(get_technician)) -> dict:
    if tech.get("status") != "approved":
        raise HTTPException(status_code=403, detail=f"Technician status is '{tech.get('status', 'unknown')}' — awaiting admin approval")
    return tech
