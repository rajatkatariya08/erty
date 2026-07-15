"""Iter-9 Wave-9 backend tests:
- SEED_VERSION=4 migration: total 26 services (12 appliance + 10 handyman + 4 car_and_bike).
- /api/categories returns 5 pillars in order with coming_soon flag.
- Handyman services: exact base/market prices per spec, booking_fee=100, first tier 'Booking Visit'.
- Car & Bike services: exact 4 services with prices, booking_fee=0, is_flat_visit=False.
- Booking a car_and_bike service works with Gurugram GPS.
"""
import os
import time
import subprocess
import pytest
import requests

def _load_frontend_url():
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return os.environ.get('REACT_APP_BACKEND_URL', '')

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or _load_frontend_url()).rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

HANDYMAN_EXPECTED = {
    "TV Wall Mounting":              (249, 1500),
    "Curtain Rods / Blinds":         (199,  900),
    "Bathroom Fittings":             (149, 1200),
    "Ready-to-Assemble Furniture":   (399, 2000),
    "Wall Art / Mirrors":            (149,  800),
    "Fancy Lights / Chandeliers":    (299, 2000),
    "Ceiling Fan Installation":      (199, 1200),
    "Door Locks / Hinges":           (249,  900),
    "RO Wall Mounting":              (249, 1200),
    "Faucet / Jet Spray Replacement":(149,  900),
}

CAR_BIKE_EXPECTED = {
    "Doorstep Bike Service":  599,
    "Bike Roadside Fix":      399,
    "Car General Service":   2499,
    "Car Battery Jumpstart":  499,
}


def _mongo(js):
    r = subprocess.run(
        ["mongosh", "mongodb://localhost:27017/test_database", "--quiet", "--eval", js],
        capture_output=True, text=True, timeout=15,
    )
    return r.stdout.strip()


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def customer_token():
    ts = int(time.time() * 1000)
    js = f"""
    var uid='user_test_iter9_{ts}';
    var tok='test_session_iter9_{ts}';
    db.users.insertOne({{user_id:uid,email:'iter9_{ts}@example.com',name:'Iter9',picture:'',created_at:new Date().toISOString()}});
    db.user_sessions.insertOne({{user_id:uid,session_token:tok,role:'customer',expires_at:new Date(Date.now()+7*24*3600*1000).toISOString(),created_at:new Date().toISOString()}});
    print(tok);
    """
    out = _mongo(js)
    return out.splitlines()[-1].strip()


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Seed migration ----------

def test_seed_version_is_4():
    out = _mongo("printjson(db.getCollection('_meta').findOne({key:'seed_version'}));")
    assert "value: 4" in out or '"value": 4' in out, out


def test_service_totals():
    out = _mongo("print(db.services.countDocuments({}));")
    assert int(out.splitlines()[-1]) == 26
    for cat, n in [("home_appliances", 12), ("handyman", 10), ("car_and_bike", 4)]:
        o = _mongo(f"print(db.services.countDocuments({{category:'{cat}'}}));")
        assert int(o.splitlines()[-1]) == n, f"{cat} count mismatch"


# ---------- Categories ----------

def test_categories_five_pillars_order(api):
    r = api.get(f"{BASE_URL}/api/categories")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 5
    ids = [c["id"] for c in data]
    assert ids == ["home_appliances", "handyman", "car_and_bike",
                   "permanent_drivers", "domestic_maids"], ids


def test_categories_coming_soon_flags(api):
    data = api.get(f"{BASE_URL}/api/categories").json()
    by_id = {c["id"]: c for c in data}
    for active in ("home_appliances", "handyman", "car_and_bike"):
        assert by_id[active]["coming_soon"] is False, f"{active} should be active"
    for cs in ("permanent_drivers", "domestic_maids"):
        assert by_id[cs]["coming_soon"] is True, f"{cs} should be coming_soon"


def test_handyman_category_has_booking_fee(api):
    data = api.get(f"{BASE_URL}/api/categories").json()
    hm = next(c for c in data if c["id"] == "handyman")
    assert hm.get("booking_fee") == 100


# ---------- Handyman services ----------

def test_handyman_service_prices(api):
    r = api.get(f"{BASE_URL}/api/services", params={"category": "handyman"})
    assert r.status_code == 200
    svcs = r.json()
    assert len(svcs) == 10
    by_name = {s["name"]: s for s in svcs}
    assert set(by_name.keys()) == set(HANDYMAN_EXPECTED.keys()), \
        f"names diff: extra={set(by_name)-set(HANDYMAN_EXPECTED)} missing={set(HANDYMAN_EXPECTED)-set(by_name)}"

    for name, (start, market) in HANDYMAN_EXPECTED.items():
        s = by_name[name]
        assert s["base_price"] == start, f"{name} base_price {s['base_price']} != {start}"
        assert s["market_max"] == market, f"{name} market_max {s['market_max']} != {market}"
        assert s.get("is_flat_visit") is True, f"{name} not is_flat_visit"
        assert s.get("booking_fee") == 100, f"{name} booking_fee != 100"
        assert s["tiers"], f"{name} empty tiers"
        first = s["tiers"][0]
        assert first["name"] == "Booking Visit", f"{name} first tier not 'Booking Visit'"
        assert first["price"] == start, f"{name} first tier price != base"


# ---------- Car & Bike services ----------

def test_car_and_bike_services(api):
    r = api.get(f"{BASE_URL}/api/services", params={"category": "car_and_bike"})
    assert r.status_code == 200
    svcs = r.json()
    assert len(svcs) == 4
    by_name = {s["name"]: s for s in svcs}
    assert set(by_name.keys()) == set(CAR_BIKE_EXPECTED.keys()), \
        f"diff: {set(by_name) ^ set(CAR_BIKE_EXPECTED)}"

    for name, price in CAR_BIKE_EXPECTED.items():
        s = by_name[name]
        assert s["base_price"] == price, f"{name} base_price {s['base_price']} != {price}"
        assert s.get("booking_fee", 0) == 0, f"{name} booking_fee != 0"
        assert s.get("is_flat_visit") is False, f"{name} should not be is_flat_visit"
        assert s["tiers"] and len(s["tiers"]) >= 1


# ---------- Booking flow for car_and_bike ----------

def test_car_and_bike_booking(api, customer_token):
    svcs = api.get(f"{BASE_URL}/api/services", params={"category": "car_and_bike"}).json()
    svc = next(s for s in svcs if s["name"] == "Doorstep Bike Service")
    payload = {
        "service_id": svc["service_id"],
        "tier_name": svc["tiers"][0]["name"],
        "address": "Sector 29, Gurugram",
        "scheduled_date": "2026-02-15",
        "scheduled_slot": "10:00-12:00",
        "notes": "iter9 test booking",
        "dest_lat": 28.4595,
        "dest_lng": 77.0266,
    }
    r = api.post(f"{BASE_URL}/api/bookings", json=payload, headers=_auth(customer_token))
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    b = r.json()
    assert b["category"] == "car_and_bike"
    # unassigned per spec (no technician auto-assigned)
    assert b.get("tech_id") in (None, "", "null") or b.get("status") in ("unassigned", "pending")


# ---------- Regression: handyman preserved shape ----------

def test_home_appliances_still_12(api):
    r = api.get(f"{BASE_URL}/api/services", params={"category": "home_appliances"})
    assert r.status_code == 200
    assert len(r.json()) == 12
