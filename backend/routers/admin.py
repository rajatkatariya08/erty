"""Admin-only endpoints."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

from deps import (
    db, ServiceUpsert, TechnicianUpsert, StatusUpdate,
    User, get_admin_user,
)
from notifications import (
    send_email, send_sms,
    render_tech_assignment_email, render_tech_assignment_sms,
    render_customer_assignment_email, render_customer_assignment_sms,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class BookingAssignRequest(BaseModel):
    tech_id: str


class TechStatusUpdate(BaseModel):
    status: str  # approved | rejected | pending


@router.get("/stats")
async def admin_stats(_: User = Depends(get_admin_user)):
    return {
        "services": await db.services.count_documents({}),
        "technicians": await db.technicians.count_documents({}),
        "technicians_pending": await db.technicians.count_documents({"status": "pending"}),
        "bookings": await db.bookings.count_documents({}),
        "bookings_unassigned": await db.bookings.count_documents({"status": "unassigned"}),
        "diagnoses": await db.diagnoses.count_documents({}),
        "users": await db.users.count_documents({}),
    }


@router.get("/services")
async def admin_list_services(_: User = Depends(get_admin_user)):
    return await db.services.find({}, {"_id": 0}).to_list(500)


@router.post("/services")
async def admin_create_service(payload: ServiceUpsert, _: User = Depends(get_admin_user)):
    doc = {"service_id": f"svc_{uuid.uuid4().hex[:10]}", **payload.model_dump()}
    await db.services.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/services/{service_id}")
async def admin_update_service(service_id: str, payload: ServiceUpsert, _: User = Depends(get_admin_user)):
    res = await db.services.update_one({"service_id": service_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"ok": True}


@router.delete("/services/{service_id}")
async def admin_delete_service(service_id: str, _: User = Depends(get_admin_user)):
    await db.services.delete_one({"service_id": service_id})
    return {"ok": True}


@router.get("/technicians")
async def admin_list_technicians(_: User = Depends(get_admin_user)):
    return await db.technicians.find({}, {"_id": 0}).to_list(500)


@router.post("/technicians")
async def admin_create_technician(payload: TechnicianUpsert, _: User = Depends(get_admin_user)):
    doc = {"tech_id": f"tech_{uuid.uuid4().hex[:10]}", **payload.model_dump()}
    await db.technicians.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/technicians/{tech_id}")
async def admin_update_technician(tech_id: str, payload: TechnicianUpsert, _: User = Depends(get_admin_user)):
    res = await db.technicians.update_one({"tech_id": tech_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"ok": True}


@router.delete("/technicians/{tech_id}")
async def admin_delete_technician(tech_id: str, _: User = Depends(get_admin_user)):
    await db.technicians.delete_one({"tech_id": tech_id})
    return {"ok": True}


@router.get("/bookings")
async def admin_list_bookings(_: User = Depends(get_admin_user)):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.patch("/bookings/{booking_id}/status")
async def admin_update_booking_status(booking_id: str, payload: StatusUpdate, _: User = Depends(get_admin_user)):
    allowed = ["unassigned", "assigned", "on_the_way", "arrived", "in_progress", "completed", "cancelled"]
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}


@router.post("/bookings/{booking_id}/assign")
async def admin_assign_booking(booking_id: str, payload: BookingAssignRequest, _: User = Depends(get_admin_user)):
    tech = await db.technicians.find_one({"tech_id": payload.tech_id}, {"_id": 0})
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    if tech.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Technician is not approved yet")

    b = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "tech_id": tech["tech_id"],
            "tech_name": tech["name"],
            "tech_picture": tech["picture"],
            "tech_lat": tech.get("home_lat"),
            "tech_lng": tech.get("home_lng"),
            "status": "assigned",
        }},
    )
    # notify customer
    await db.notifications.insert_one({
        "notif_id": f"n_{uuid.uuid4().hex[:10]}",
        "user_id": b["user_id"],
        "title": "Technician assigned",
        "body": f"{tech['name']} has been assigned to your {b['service_name']} booking",
        "booking_id": booking_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Out-of-band notifications (email + SMS) to both technician and customer.
    # Runs in DRY-RUN mode when SendGrid / Twilio keys are absent — logs the payload
    # and records to db.outbound_notifications so admin can inspect via /api/admin/outbound.
    customer = await db.users.find_one({"user_id": b["user_id"]}, {"_id": 0}) or {}
    delivery = {"tech": {"email": None, "sms": None}, "customer": {"email": None, "sms": None}}

    if tech.get("email"):
        subj, html, plain = render_tech_assignment_email(
            tech.get("name", ""), b["service_name"], b.get("address", ""),
            b["scheduled_date"], b["scheduled_slot"], b["price"],
        )
        delivery["tech"]["email"] = await send_email(tech["email"], subj, html, plain)
    if tech.get("phone"):
        sms_body = render_tech_assignment_sms(
            tech.get("name", ""), b["service_name"], b["scheduled_date"], b["scheduled_slot"],
            b.get("address", ""), b["price"],
        )
        delivery["tech"]["sms"] = await send_sms(tech["phone"], sms_body)

    if customer.get("email"):
        subj, html, plain = render_customer_assignment_email(
            customer.get("name", "there"), tech.get("name", ""), b["service_name"],
            b["scheduled_date"], b["scheduled_slot"],
        )
        delivery["customer"]["email"] = await send_email(customer["email"], subj, html, plain)
    if customer.get("phone"):
        sms_body = render_customer_assignment_sms(
            tech.get("name", ""), b["service_name"], b["scheduled_date"], b["scheduled_slot"],
        )
        delivery["customer"]["sms"] = await send_sms(customer["phone"], sms_body)

    return {"ok": True, "tech_id": tech["tech_id"], "tech_name": tech["name"], "delivery": delivery}


@router.get("/outbound")
async def admin_outbound_log(_: User = Depends(get_admin_user), limit: int = 100):
    """Recent outbound email/SMS activity (including DRY-RUN records)."""
    items = await db.outbound_notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items


@router.get("/technicians/pending")
async def admin_list_pending_techs(_: User = Depends(get_admin_user)):
    return await db.technicians.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.patch("/technicians/{tech_id}/status")
async def admin_set_tech_status(tech_id: str, payload: TechStatusUpdate, _: User = Depends(get_admin_user)):
    if payload.status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status")
    updates = {"status": payload.status}
    if payload.status == "approved":
        updates["is_available"] = True
    if payload.status == "rejected":
        updates["is_available"] = False
    res = await db.technicians.update_one({"tech_id": tech_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"ok": True, "status": payload.status}
