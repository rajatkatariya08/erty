"""Custom job requests: users submit an ad-hoc job description; admin manually reviews.
Status flow: pending_manpower_approval → approved | rejected | fulfilled
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid

from deps import db, User, get_current_user, get_admin_user

router = APIRouter(prefix="/api", tags=["custom-jobs"])


class CustomJobCreate(BaseModel):
    description: str = Field(min_length=8, max_length=1000)
    phone: str = Field(min_length=6, max_length=30)
    preferred_date: str = ""  # ISO date string, optional
    address: str = ""


@router.post("/custom-jobs")
async def create_custom_job(payload: CustomJobCreate, user: User = Depends(get_current_user)):
    doc = {
        "job_id": f"cj_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "user_email": user.email,
        "user_name": user.name,
        "description": payload.description.strip(),
        "phone": payload.phone.strip(),
        "preferred_date": payload.preferred_date,
        "address": payload.address.strip(),
        "status": "pending_manpower_approval",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.custom_jobs.insert_one(doc)
    doc.pop("_id", None)

    await db.notifications.insert_one({
        "notif_id": f"n_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "title": "Custom job submitted",
        "body": "Our team will review your request and get back within a few hours.",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return doc


@router.get("/custom-jobs")
async def list_my_custom_jobs(user: User = Depends(get_current_user)):
    return await db.custom_jobs.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)


@router.get("/admin/custom-jobs")
async def admin_list_custom_jobs(_: User = Depends(get_admin_user)):
    return await db.custom_jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


class CustomJobStatus(BaseModel):
    status: str  # approved | rejected | fulfilled | pending_manpower_approval


@router.patch("/admin/custom-jobs/{job_id}/status")
async def admin_update_custom_job(job_id: str, payload: CustomJobStatus, _: User = Depends(get_admin_user)):
    allowed = {"pending_manpower_approval", "approved", "rejected", "fulfilled"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    j = await db.custom_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Custom job not found")
    await db.custom_jobs.update_one({"job_id": job_id}, {"$set": {"status": payload.status}})
    # notify customer
    label_map = {
        "approved": "Your custom request has been approved",
        "rejected": "Your custom request could not be scheduled",
        "fulfilled": "Your custom job is complete",
    }
    title = label_map.get(payload.status)
    if title:
        await db.notifications.insert_one({
            "notif_id": f"n_{uuid.uuid4().hex[:10]}",
            "user_id": j["user_id"],
            "title": title,
            "body": j["description"][:120],
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True, "status": payload.status}
