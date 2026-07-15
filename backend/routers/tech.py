"""Technician-side endpoints (used by the technician-app UI)."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid
import time

from deps import (
    db, StatusUpdate, TechLocationUpdate, get_technician, get_approved_technician,
)

router = APIRouter(prefix="/api/tech", tags=["technician"])

# In-memory debounce: {tech_id: last_write_epoch}
_LAST_LOC_WRITE: dict = {}
_LOC_DEBOUNCE_SECS = 3.0


@router.get("/me")
async def tech_me(tech: dict = Depends(get_technician)):
    return tech


@router.get("/jobs")
async def tech_jobs(status: Optional[str] = None, tech: dict = Depends(get_approved_technician)):
    q = {"tech_id": tech["tech_id"]}
    if status:
        q["status"] = status
    return await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.get("/jobs/{booking_id}")
async def tech_job_detail(booking_id: str, tech: dict = Depends(get_approved_technician)):
    b = await db.bookings.find_one({"booking_id": booking_id, "tech_id": tech["tech_id"]}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Job not found")
    return b


@router.post("/jobs/{booking_id}/accept")
async def tech_accept_job(booking_id: str, tech: dict = Depends(get_approved_technician)):
    res = await db.bookings.update_one(
        {"booking_id": booking_id, "tech_id": tech["tech_id"], "status": "assigned"},
        {"$set": {"status": "on_the_way"}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not accept-able (not assigned or not yours)")
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if b:
        await db.notifications.insert_one({
            "notif_id": f"n_{uuid.uuid4().hex[:10]}",
            "user_id": b["user_id"],
            "title": "Technician on the way",
            "body": f"{tech['name']} accepted your {b['service_name']} booking",
            "booking_id": booking_id,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True, "status": "on_the_way"}


@router.patch("/jobs/{booking_id}/status")
async def tech_update_status(booking_id: str, payload: StatusUpdate, tech: dict = Depends(get_approved_technician)):
    allowed = ["on_the_way", "arrived", "in_progress", "completed", "cancelled"]
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status for technician")
    res = await db.bookings.update_one(
        {"booking_id": booking_id, "tech_id": tech["tech_id"]},
        {"$set": {"status": payload.status}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if b:
        pretty = payload.status.replace("_", " ").capitalize()
        await db.notifications.insert_one({
            "notif_id": f"n_{uuid.uuid4().hex[:10]}",
            "user_id": b["user_id"],
            "title": f"Booking update · {pretty}",
            "body": f"{b['service_name']} — status changed to {pretty}",
            "booking_id": booking_id,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"ok": True, "status": payload.status}


@router.patch("/location")
async def tech_update_location(payload: TechLocationUpdate, tech: dict = Depends(get_approved_technician)):
    """Debounced (3s per tech) to avoid Mongo-write thrash from high-frequency GPS pings."""
    now = time.monotonic()
    last = _LAST_LOC_WRITE.get(tech["tech_id"], 0.0)
    if now - last < _LOC_DEBOUNCE_SECS:
        return {"ok": True, "skipped": True, "reason": "debounced", "retry_after_sec": round(_LOC_DEBOUNCE_SECS - (now - last), 2)}
    _LAST_LOC_WRITE[tech["tech_id"]] = now

    await db.technicians.update_one(
        {"tech_id": tech["tech_id"]},
        {"$set": {"home_lat": payload.lat, "home_lng": payload.lng}},
    )
    await db.bookings.update_many(
        {
            "tech_id": tech["tech_id"],
            "status": {"$in": ["assigned", "on_the_way", "arrived", "in_progress"]},
        },
        {"$set": {"tech_lat": payload.lat, "tech_lng": payload.lng}},
    )
    return {"ok": True, "lat": payload.lat, "lng": payload.lng}
