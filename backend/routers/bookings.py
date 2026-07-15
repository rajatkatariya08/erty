"""Booking endpoints for customers."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
import math
import random

from deps import (
    db, CITY_CENTER, in_service_area,
    Booking, BookingCreate, StatusUpdate, ReviewPayload, TechLocationUpdate,
    User, get_current_user,
)

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


async def _assign_technician(category: str):
    """DEPRECATED: kept only for backward-compat import safety. Auto-assign was removed
    per product decision (admin manually assigns via /api/admin/bookings/{id}/assign)."""
    return None


@router.post("")
async def create_booking(payload: BookingCreate, user: User = Depends(get_current_user)):
    svc = await db.services.find_one({"service_id": payload.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    tier = next((t for t in svc["tiers"] if t["name"] == payload.tier_name), None)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid tier")

    # Determine destination coords
    if payload.dest_lat is not None and payload.dest_lng is not None:
        if not in_service_area(payload.dest_lat, payload.dest_lng):
            raise HTTPException(
                status_code=400,
                detail="Service currently available only in Gurugram, Haryana",
            )
        dest_lat, dest_lng = payload.dest_lat, payload.dest_lng
    else:
        dest_lat = CITY_CENTER[0] + random.uniform(-0.02, 0.02)
        dest_lng = CITY_CENTER[1] + random.uniform(-0.02, 0.02)

    tech = None  # bookings are now UNASSIGNED by default; admin assigns manually
    tech_lat = None
    tech_lng = None

    booking = Booking(
        booking_id=f"bk_{uuid.uuid4().hex[:12]}",
        user_id=user.user_id,
        service_id=payload.service_id,
        service_name=svc["name"],
        category=svc["category"],
        tier_name=payload.tier_name,
        price=tier["price"],
        address=payload.address,
        scheduled_date=payload.scheduled_date,
        scheduled_slot=payload.scheduled_slot,
        notes=payload.notes,
        status="unassigned",
        tech_id=None,
        tech_name=None,
        tech_picture=None,
        tech_lat=tech_lat, tech_lng=tech_lng,
        dest_lat=dest_lat, dest_lng=dest_lng,
        diagnosis_id=payload.diagnosis_id,
    )
    doc = booking.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)

    await db.notifications.insert_one({
        "notif_id": f"n_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "title": "Booking received",
        "body": f"{svc['name']} on {payload.scheduled_date} · {payload.scheduled_slot}. A technician will be assigned by our team shortly.",
        "booking_id": booking.booking_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return doc


@router.get("")
async def list_bookings(user: User = Depends(get_current_user)):
    return await db.bookings.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)


@router.get("/{booking_id}")
async def get_booking(booking_id: str, user: User = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id, "user_id": user.user_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


@router.post("/{booking_id}/simulate-tech")
async def simulate_tech(booking_id: str, user: User = Depends(get_current_user)):
    b = await db.bookings.find_one({"booking_id": booking_id, "user_id": user.user_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    cur_lat = b.get("tech_lat", CITY_CENTER[0])
    cur_lng = b.get("tech_lng", CITY_CENTER[1])
    dst_lat = b.get("dest_lat", CITY_CENTER[0])
    dst_lng = b.get("dest_lng", CITY_CENTER[1])
    step = 0.3
    new_lat = cur_lat + (dst_lat - cur_lat) * step
    new_lng = cur_lng + (dst_lng - cur_lng) * step
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"tech_lat": new_lat, "tech_lng": new_lng}},
    )
    R = 6371000
    dlat = math.radians(dst_lat - new_lat)
    dlng = math.radians(dst_lng - new_lng)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(new_lat))*math.cos(math.radians(dst_lat))*math.sin(dlng/2)**2
    distance_m = 2 * R * math.asin(math.sqrt(a))
    return {"tech_lat": new_lat, "tech_lng": new_lng, "distance_m": round(distance_m)}


@router.patch("/{booking_id}/tech-location")
async def update_tech_location(booking_id: str, payload: TechLocationUpdate, user: User = Depends(get_current_user)):
    res = await db.bookings.update_one(
        {"booking_id": booking_id, "user_id": user.user_id},
        {"$set": {"tech_lat": payload.lat, "tech_lng": payload.lng}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}


@router.patch("/{booking_id}/status")
async def update_status(booking_id: str, payload: StatusUpdate, user: User = Depends(get_current_user)):
    allowed = ["unassigned", "assigned", "on_the_way", "arrived", "in_progress", "completed", "cancelled"]
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.bookings.update_one(
        {"booking_id": booking_id, "user_id": user.user_id},
        {"$set": {"status": payload.status}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True, "status": payload.status}


@router.post("/{booking_id}/review")
async def review_booking(booking_id: str, payload: ReviewPayload, user: User = Depends(get_current_user)):
    if not 1 <= payload.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    res = await db.bookings.update_one(
        {"booking_id": booking_id, "user_id": user.user_id},
        {"$set": {"rating": payload.rating, "review": payload.review}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}
