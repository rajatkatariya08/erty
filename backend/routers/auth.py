"""Auth routes: customer (Google OAuth), admin (email+password), technician (email+password + self-signup)."""
from fastapi import APIRouter, HTTPException, Response, Cookie, Depends
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import os
import bcrypt
import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from deps import (
    db, ADMIN_EMAILS, CITY_CENTER, in_service_area,
    SessionRequest, User, get_current_user,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


# ---------- password helpers ----------
def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _new_session_token(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


async def _create_session(user_id: str, role: str, prefix: str, response: Response) -> str:
    token = _new_session_token(prefix)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "role": role,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(
        key="session_token", value=token,
        max_age=7 * 24 * 60 * 60,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, path="/",
    )
    return token


# ---------- Admin seeding ----------
async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "").lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not password:
        return
    existing = await db.admin_credentials.find_one({"email": email}, {"_id": 0})
    if not existing:
        await db.admin_credentials.insert_one({
            "email": email, "password_hash": _hash_password(password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not _verify_password(password, existing["password_hash"]):
        await db.admin_credentials.update_one(
            {"email": email}, {"$set": {"password_hash": _hash_password(password)}}
        )
    if not await db.users.find_one({"email": email}, {"_id": 0}):
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email, "name": "Admin",
            "picture": "https://api.dicebear.com/7.x/shapes/svg?seed=Admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


# ---------- Customer (Google OAuth) ----------
class GoogleLoginRequest(BaseModel):
    credential: str


@router.post("/google")
async def google_login(payload: GoogleLoginRequest, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google auth is not configured")

    try:
        info = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if not info.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email is not verified")

    google_sub = info["sub"]
    email = info["email"].strip().lower()
    name = info.get("name") or email.split("@")[0]
    picture = info.get("picture", "")

    existing = await db.users.find_one({"google_sub": google_sub}, {"_id": 0})
    if not existing:
        existing = await db.users.find_one({"email": email}, {"_id": 0})

    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "email": email,
                "name": name,
                "picture": picture,
                "google_sub": google_sub,
                "auth_provider": "google",
            }},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "google_sub": google_sub,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await _create_session(user_id, role="customer", prefix="cus", response=response)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "role": "customer"}


@router.post("/session")
async def create_session(payload: SessionRequest, response: Response):
    async with httpx.AsyncClient() as http_client:
        r = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
            timeout=15.0,
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")

    data = r.json()
    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token, "role": "customer",
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(
        key="session_token", value=session_token,
        max_age=7 * 24 * 60 * 60,
        httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, path="/",
    )
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": session_token}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    d = user.model_dump()
    d["is_admin"] = user.role == "admin" and user.email.lower() in ADMIN_EMAILS
    d["is_technician"] = user.role == "technician"
    tech_id = None
    tech_status = None
    if d["is_technician"]:
        tech = await db.technicians.find_one({"email": user.email.lower()}, {"_id": 0})
        if tech:
            tech_id = tech["tech_id"]
            tech_status = tech.get("status", "approved")
    d["tech_id"] = tech_id
    d["tech_status"] = tech_status
    return d


@router.post("/logout")
async def logout(response: Response, session_token: str = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", samesite=COOKIE_SAMESITE, secure=COOKIE_SECURE)
    return {"ok": True}


# ---------- Admin (email + password) ----------
class AdminLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/admin/login")
async def admin_login(payload: AdminLoginRequest, response: Response):
    email = payload.email.strip().lower()
    if email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Not an admin account")
    cred = await db.admin_credentials.find_one({"email": email}, {"_id": 0})
    if not cred or not _verify_password(payload.password, cred["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": "Admin",
            "picture": "https://api.dicebear.com/7.x/shapes/svg?seed=Admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    await _create_session(user_doc["user_id"], role="admin", prefix="adm", response=response)
    return {"user": user_doc, "role": "admin"}


# ---------- Technician (email + password + self-signup) ----------
ALLOWED_CATS = {
    "home_appliances",
    "handyman",
    "car_and_bike",
    # Legacy values are kept so older seeded/test technicians remain valid.
    "bike",
    "car",
    "installation",
}


class TechSignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    phone: str = Field(min_length=6, max_length=30)
    specializations: List[str]
    gov_id_base64: str  # data URL or raw base64
    home_lat: float = Field(ge=-90, le=90)
    home_lng: float = Field(ge=-180, le=180)
    experience_years: int = 0


class TechLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/tech/signup")
async def tech_signup(payload: TechSignupRequest, response: Response):
    email = payload.email.strip().lower()
    if email in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="This email is reserved for admin use")

    if await db.technician_credentials.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="A technician account with this email already exists")

    specs = [s for s in payload.specializations if s in ALLOWED_CATS]
    if not specs:
        raise HTTPException(status_code=400, detail="Pick at least one service specialization")

    if not in_service_area(payload.home_lat, payload.home_lng):
        raise HTTPException(status_code=400, detail="Base location must be within Gurugram, Haryana")

    if len(payload.gov_id_base64) < 100:
        raise HTTPException(status_code=400, detail="Government ID upload is required")

    # store a small preview thumb only (data URL up to ~9KB) to keep docs small
    raw = payload.gov_id_base64
    thumb = raw if len(raw) < 12000 else (raw[:12000] + "...")

    tech_id = f"tech_{uuid.uuid4().hex[:10]}"
    picture = f"https://api.dicebear.com/7.x/avataaars/svg?seed={uuid.uuid4().hex[:6]}"
    await db.technicians.insert_one({
        "tech_id": tech_id,
        "name": payload.name.strip(),
        "email": email,
        "picture": picture,
        "rating": 0.0,
        "experience_years": payload.experience_years,
        "specializations": specs,
        "phone": payload.phone.strip(),
        "is_available": False,
        "home_lat": payload.home_lat,
        "home_lng": payload.home_lng,
        "status": "pending",
        "gov_id_thumb": thumb,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.technician_credentials.insert_one({
        "email": email,
        "password_hash": _hash_password(payload.password),
        "tech_id": tech_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Also create a User doc so get_current_user can find them
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": payload.name.strip(), "picture": picture,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await _create_session(user_id, role="technician", prefix="tec", response=response)

    tech = await db.technicians.find_one({"tech_id": tech_id}, {"_id": 0, "gov_id_thumb": 0})
    return {"ok": True, "status": "pending", "tech": tech, "message": "Signup submitted — waiting for admin approval"}


@router.post("/tech/login")
async def tech_login(payload: TechLoginRequest, response: Response):
    email = payload.email.strip().lower()
    cred = await db.technician_credentials.find_one({"email": email}, {"_id": 0})
    if not cred or not _verify_password(payload.password, cred["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        # rare: cred exists but user doc missing — recreate
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": email.split("@")[0], "picture": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    await _create_session(user_doc["user_id"], role="technician", prefix="tec", response=response)
    tech = await db.technicians.find_one({"email": email}, {"_id": 0, "gov_id_thumb": 0})
    return {"user": user_doc, "tech": tech, "role": "technician"}
