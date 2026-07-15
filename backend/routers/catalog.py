"""Public catalog: services, categories, technicians."""
from fastapi import APIRouter, HTTPException
from typing import Optional

from deps import db, CITY_NAME

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/services")
async def list_services(category: Optional[str] = None):
    q = {"category": category} if category else {}
    return await db.services.find(q, {"_id": 0}).to_list(500)


@router.get("/services/{service_id}")
async def get_service(service_id: str):
    svc = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    return svc


@router.get("/categories")
async def list_categories():
    return [
        {"id": "home_appliances", "label": "Home Appliances", "icon": "washing-machine",
         "color": "hot_pink", "tagline": "Repair · Install · Service", "coming_soon": False},
        {"id": "handyman", "label": "Handyman & Odd Jobs", "icon": "hammer",
         "color": "lime_green", "tagline": "₹100 booking fee", "booking_fee": 100, "coming_soon": False},
        {"id": "car_and_bike", "label": "Car & Bike Repair", "icon": "car",
         "color": "electric_blue", "tagline": "Doorstep vehicle care", "coming_soon": False},
        {"id": "permanent_drivers", "label": "Permanent Drivers", "icon": "steering-wheel",
         "color": "sunny_yellow", "tagline": "Monthly · Full-time", "coming_soon": True},
        {"id": "domestic_maids", "label": "Domestic Maids", "icon": "sparkles",
         "color": "fuchsia", "tagline": "Verified housekeeping", "coming_soon": True},
    ]


@router.get("/technicians")
async def list_technicians(category: Optional[str] = None):
    q = {"specializations": category} if category else {}
    return await db.technicians.find(q, {"_id": 0}).to_list(500)


@router.get("/service-area")
async def service_area():
    """Returns current service area info so the frontend can center its map picker."""
    from deps import CITY_CENTER, GURUGRAM_BOUNDS
    return {
        "city": CITY_NAME,
        "region": "Haryana, India",
        "center": {"lat": CITY_CENTER[0], "lng": CITY_CENTER[1]},
        "bounds": GURUGRAM_BOUNDS,
    }
