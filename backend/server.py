"""FixPoint FastAPI entry point.

Modules under `routers/`. Shared config/models/deps in `deps.py`.
"""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os
import uuid
import logging

from deps import db, CITY_NAME, client
from routers import auth, catalog, bookings, diagnosis, notifications, tech, admin, custom_jobs
from routers.auth import seed_admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fixpoint")

app = FastAPI(title="FixPoint API")


@app.get("/")
async def root_page():
    return {"app": "FixPoint", "status": "ok", "api": "/api/"}


@app.get("/api/")
async def root():
    return {"app": "FixPoint", "status": "ok", "city": CITY_NAME}


for r in (auth.router, catalog.router, bookings.router, diagnosis.router,
          notifications.router, tech.router, admin.router, custom_jobs.router):
    app.include_router(r)


# Bump this when SEED_SERVICES changes to force a clean re-seed on startup.
SEED_VERSION = 4


# ---- Seed data ----
# Home Appliances: 12 services (Gurugram baselines from local surveys)
# Handyman: 10 services on ₹100 flat-visit ecosystem
def _tier(name, price, features):
    return {"name": name, "price": price, "features": features}


APPLIANCE_SERVICES = [
    {"name": "RO System Service", "icon": "droplets", "base_price": 449,
     "market_min": 500, "market_max": 1500,
     "description": "Filter change, membrane clean, motor/pump check for all RO brands.",
     "image_url": "https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?w=600",
     "tiers": [_tier("Basic Service", 449, ["Sediment + carbon filter clean", "Water quality check"]),
               _tier("Full Service", 999, ["All 4 filters replaced", "Membrane wash", "6-month warranty"]),
               _tier("Membrane Change", 1799, ["New RO membrane", "TDS calibration", "12-month warranty"])]},
    {"name": "Kitchen Chimney Service", "icon": "cooking-pot", "base_price": 499,
     "market_min": 600, "market_max": 1800,
     "description": "Deep clean, filter degrease, motor & suction diagnostics for chimneys.",
     "image_url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600",
     "tiers": [_tier("Basic Clean", 499, ["Baffle filter clean", "External wipe"]),
               _tier("Deep Service", 1299, ["Full dismantle", "Motor grease", "Baffle degrease"]),
               _tier("Motor Replacement", 2999, ["OEM motor", "6-month warranty"])]},
    {"name": "Air Purifier Repair", "icon": "wind", "base_price": 399,
     "market_min": 500, "market_max": 1500,
     "description": "HEPA/carbon replacement, sensor calibration, fan repair.",
     "image_url": "https://images.unsplash.com/photo-1585687504040-b6d5e1c5f88a?w=600",
     "tiers": [_tier("Diagnostic", 399, ["Full inspection", "Sensor check"]),
               _tier("Filter + Fix", 1499, ["New HEPA + carbon", "3-month warranty"])]},
    {"name": "Dishwasher Repair", "icon": "utensils", "base_price": 599,
     "market_min": 800, "market_max": 2500,
     "description": "Drain issues, spray arms, heating element & control PCB repair.",
     "image_url": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600",
     "tiers": [_tier("Diagnostic", 599, ["Full check", "Nozzle unclog"]),
               _tier("Standard Repair", 1799, ["Pump/valve fix", "6-month warranty"]),
               _tier("Heater Replacement", 3499, ["New heating element", "12-month warranty"])]},
    {"name": "Mixer Grinder Repair", "icon": "circle-dot", "base_price": 299,
     "market_min": 400, "market_max": 1000,
     "description": "Motor, coupler, blade, switch — quick doorstep fixes.",
     "image_url": "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=600",
     "tiers": [_tier("Basic Fix", 299, ["Coupler + switch check"]),
               _tier("Motor Service", 999, ["Motor rewind/replace", "3-month warranty"])]},
    {"name": "Air Cooler Service", "icon": "snowflake", "base_price": 349,
     "market_min": 500, "market_max": 1200,
     "description": "Pump, cooling pad, motor & bearing service pre-summer.",
     "image_url": "https://images.unsplash.com/photo-1621600411688-4be93c2c1208?w=600",
     "tiers": [_tier("Pre-Summer Clean", 349, ["Tank clean", "Pad replacement"]),
               _tier("Full Service", 999, ["Motor + pump", "Cooling pad", "6-month warranty"])]},
    {"name": "AC Repair", "icon": "air-vent", "base_price": 599,
     "market_min": 700, "market_max": 3500,
     "description": "Cooling issues, gas refill, compressor & PCB service.",
     "image_url": "https://images.unsplash.com/photo-1631545308456-19a9d5c8b4c8?w=600",
     "tiers": [_tier("Gas Check", 599, ["Pressure test", "Filter clean"]),
               _tier("Gas Refill (R32)", 1799, ["Refill + leak check", "3-month warranty"]),
               _tier("Compressor Overhaul", 3499, ["Compressor service", "12-month warranty"])]},
    {"name": "Washing Machine Repair", "icon": "washing-machine", "base_price": 499,
     "market_min": 600, "market_max": 2500,
     "description": "Drum, motor, drainage, and control fixes for all brands.",
     "image_url": "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600",
     "tiers": [_tier("Basic Checkup", 499, ["Diagnostic", "Cleaning"]),
               _tier("Standard Repair", 1299, ["Small parts + motor check", "6-month warranty"]),
               _tier("Deep Overhaul", 2499, ["Major parts replacement", "12-month warranty"])]},
    {"name": "Refrigerator Repair", "icon": "refrigerator", "base_price": 449,
     "market_min": 600, "market_max": 2500,
     "description": "Cooling, ice-making, thermostat, and door seal repairs.",
     "image_url": "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600",
     "tiers": [_tier("Diagnostic", 449, ["Full inspection"]),
               _tier("Standard Fix", 1499, ["Thermostat/coil work", "6-month warranty"])]},
    {"name": "TV Repair", "icon": "tv", "base_price": 549,
     "market_min": 800, "market_max": 4000,
     "description": "Display panel diagnosis, backlight, board & port fixes.",
     "image_url": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600",
     "tiers": [_tier("Diagnostic Visit", 549, ["Panel test", "Board inspection"]),
               _tier("Board/Port Fix", 1799, ["Motherboard rework", "3-month warranty"]),
               _tier("Backlight Replacement", 3999, ["LED strips", "6-month warranty"])]},
    {"name": "Microwave Repair", "icon": "microwave", "base_price": 399,
     "market_min": 500, "market_max": 1500,
     "description": "Magnetron, turntable, door switch & control repairs.",
     "image_url": "https://images.unsplash.com/photo-1585237072428-1e4d0bf74e0f?w=600",
     "tiers": [_tier("Diagnostic", 399, ["Full check", "Cleaning"]),
               _tier("Standard Repair", 1299, ["Switch/turntable", "6-month warranty"]),
               _tier("Magnetron Fix", 2499, ["Magnetron replace", "6-month warranty"])]},
    {"name": "Geyser Repair", "icon": "flame", "base_price": 449,
     "market_min": 600, "market_max": 2500,
     "description": "Heating element, thermostat, pressure valve & de-scaling.",
     "image_url": "https://images.unsplash.com/photo-1585537301037-6c8f6f9dfa76?w=600",
     "tiers": [_tier("De-scaling", 449, ["Tank flush", "Anode check"]),
               _tier("Element Replacement", 1499, ["New heating element", "6-month warranty"])]},
]

# All handyman jobs charge a ₹100 Booking/Visiting Fee to secure the appointment;
# starting service price is separate from the booking fee.
def _handy(name, icon, desc, start_price, market_anchor, image):
    return {
        "name": name, "icon": icon, "base_price": start_price,
        "market_min": start_price, "market_max": market_anchor,
        "description": desc,
        "image_url": image,
        "is_flat_visit": True,
        "booking_fee": 100,
        "tiers": [
            {"name": "Booking Visit", "price": start_price,
             "features": [f"₹100 booking fee to secure the slot", "Handyman arrives with tools",
                          "Parts extra at cost"]},
        ],
    }
HANDYMAN_SERVICES = [
    _handy("TV Wall Mounting", "tv",
           "Fixed or tilt-mount TVs up to 65\". Cable routing included.", 249, 1500,
           "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600"),
    _handy("Curtain Rods / Blinds", "blinds",
           "Rods, brackets, curtain track & window blinds install.", 199, 900,
           "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600"),
    _handy("Bathroom Fittings", "shower-head",
           "Bath fittings — shower, jet, holders, shelves.", 149, 1200,
           "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600"),
    _handy("Ready-to-Assemble Furniture", "package",
           "IKEA-style flat-pack: beds, wardrobes, desks.", 399, 2000,
           "https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?w=600"),
    _handy("Wall Art / Mirrors", "image",
           "Mount paintings, mirrors & photo frames with care.", 149, 800,
           "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600"),
    _handy("Fancy Lights / Chandeliers", "lightbulb",
           "Chandelier hang, pendant & accent lights.", 299, 2000,
           "https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=600"),
    _handy("Ceiling Fan Installation", "fan",
           "Fan install, replace or rewiring at your ceiling point.", 199, 1200,
           "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600"),
    _handy("Door Locks / Hinges", "lock",
           "Repair or replace locks, latches, and hinges.", 249, 900,
           "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600"),
    _handy("RO Wall Mounting", "droplets",
           "Wall mount your new RO unit + inlet/outlet piping.", 249, 1200,
           "https://images.unsplash.com/photo-1618221118493-9cfa1a1c00da?w=600"),
    _handy("Faucet / Jet Spray Replacement", "wrench",
           "Bathroom & kitchen faucet, jet spray fix or swap.", 149, 900,
           "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600"),
]

# Car & Bike Repair pillar — doorstep vehicle services.
CAR_BIKE_SERVICES = [
    {"name": "Doorstep Bike Service", "icon": "bike", "base_price": 599,
     "market_min": 700, "market_max": 1800, "is_flat_visit": False, "booking_fee": 0,
     "description": "Complete bike servicing at your doorstep — oil, brakes, chain, tuning.",
     "image_url": "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600",
     "tiers": [_tier("Basic Service", 599, ["Oil change", "Chain lube", "Air pressure"]),
               _tier("Full Service", 1499, ["Complete tune-up", "Brake pads", "Filter change"])]},
    {"name": "Bike Roadside Fix", "icon": "wrench", "base_price": 399,
     "market_min": 500, "market_max": 1500, "is_flat_visit": False, "booking_fee": 0,
     "description": "Fix breakdowns, electrical issues, and engine problems on-site.",
     "image_url": "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=600",
     "tiers": [_tier("Quick Fix", 399, ["Roadside visit"]),
               _tier("Engine Diagnostics", 1899, ["Engine check", "Parts extra"])]},
    {"name": "Car General Service", "icon": "car", "base_price": 2499,
     "market_min": 2800, "market_max": 6500, "is_flat_visit": False, "booking_fee": 0,
     "description": "Doorstep car service — oil, filters, brakes & 25-point inspection.",
     "image_url": "https://images.unsplash.com/photo-1493238792000-8113da705763?w=600",
     "tiers": [_tier("Essential", 2499, ["Oil + Filter", "10-point check"]),
               _tier("Comprehensive", 4999, ["25-point check", "Brake fluid"]),
               _tier("Premium Detail", 8999, ["Interior detail", "Ceramic wash"])]},
    {"name": "Car Battery Jumpstart", "icon": "battery-charging", "base_price": 499,
     "market_min": 550, "market_max": 1500, "is_flat_visit": False, "booking_fee": 0,
     "description": "Battery jumpstart & replacement at your location.",
     "image_url": "https://images.unsplash.com/photo-1620994533072-33e6d29fefb1?w=600",
     "tiers": [_tier("Jumpstart", 499, ["On-spot jumpstart"]),
               _tier("Replacement", 5999, ["New battery", "Old pickup"])]},
]

SEED_SERVICES = (
    [{"category": "home_appliances", **s} for s in APPLIANCE_SERVICES] +
    [{"category": "handyman", **s} for s in HANDYMAN_SERVICES] +
    [{"category": "car_and_bike", **s} for s in CAR_BIKE_SERVICES]
)

# Gurugram-anchored technicians (retained from earlier waves).
SEED_TECHNICIANS = [
    {"name": "Ravi Kumar", "email": "ravi@fixpoint.app",
     "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Ravi",
     "rating": 4.9, "experience_years": 8, "specializations": ["home_appliances", "handyman"],
     "phone": "+91 98765 43210", "home_lat": 28.4595, "home_lng": 77.0266},
    {"name": "Priya Sharma", "email": "priya@fixpoint.app",
     "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
     "rating": 4.8, "experience_years": 6, "specializations": ["home_appliances"],
     "phone": "+91 98765 43211", "home_lat": 28.4753, "home_lng": 77.0985},
    {"name": "Arjun Mehta", "email": "arjun@fixpoint.app",
     "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun",
     "rating": 4.7, "experience_years": 10, "specializations": ["handyman"],
     "phone": "+91 98765 43212", "home_lat": 28.4321, "home_lng": 77.0250},
    {"name": "Zara Ali", "email": "zara@fixpoint.app",
     "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Zara",
     "rating": 4.9, "experience_years": 5, "specializations": ["handyman"],
     "phone": "+91 98765 43213", "home_lat": 28.4900, "home_lng": 77.0800},
    {"name": "Sam Fernandes", "email": "sam@fixpoint.app",
     "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam",
     "rating": 4.6, "experience_years": 12, "specializations": ["home_appliances", "handyman"],
     "phone": "+91 98765 43214", "home_lat": 28.5055, "home_lng": 76.9500},
    {"name": "Neha Iyer", "email": "neha@fixpoint.app",
     "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=Neha",
     "rating": 4.8, "experience_years": 7, "specializations": ["home_appliances", "handyman"],
     "phone": "+91 98765 43215", "home_lat": 28.5000, "home_lng": 77.0900},
]


@app.on_event("startup")
async def seed_data():
    await seed_admin()

    meta = await db["_meta"].find_one({"key": "seed_version"}, {"_id": 0})
    current = meta.get("value", 0) if meta else 0
    if current < SEED_VERSION:
        logger.info(f"Reseeding services (version {current} -> {SEED_VERSION})")
        await db.services.delete_many({})
        docs = [{"service_id": f"svc_{uuid.uuid4().hex[:10]}", **s} for s in SEED_SERVICES]
        await db.services.insert_many(docs)
        await db["_meta"].update_one(
            {"key": "seed_version"},
            {"$set": {"value": SEED_VERSION}},
            upsert=True,
        )
        logger.info(f"Seeded {len(docs)} services")

    tech_count = await db.technicians.count_documents({})
    if tech_count == 0:
        docs = [{"tech_id": f"tech_{uuid.uuid4().hex[:10]}", "is_available": True, "status": "approved", **t}
                for t in SEED_TECHNICIANS]
        await db.technicians.insert_many(docs)
        logger.info(f"Seeded {len(docs)} technicians")
    else:
        for src in SEED_TECHNICIANS:
            await db.technicians.update_one(
                {"name": src["name"]},
                {"$set": {"home_lat": src["home_lat"], "home_lng": src["home_lng"]}},
            )
            # widen specializations so existing seeded techs cover new "handyman" category
            await db.technicians.update_one(
                {"name": src["name"]},
                {"$set": {"specializations": src["specializations"], "status": "approved"}},
            )
            await db.technicians.update_one(
                {"name": src["name"], "$or": [{"email": {"$exists": False}}, {"email": ""}]},
                {"$set": {"email": src["email"]}},
            )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
