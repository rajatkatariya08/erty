"""Iter-8 backend tests:
- SEED_VERSION=3 migration: exactly 12 home_appliances + 10 handyman services.
- /api/categories returns 2 categories only.
- Home appliances have market_min/max and named-list matches.
- Handyman all base_price=100, is_flat_visit=True, first tier 'Flat Visit' at 100.
- Custom jobs CRUD (POST, list, admin list, PATCH status).
- Regression: role isolation, categories bike/car/installation are gone.
"""
import os
import time
import subprocess
import json
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://quick-diagnose-5.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@fixpoint.app"
ADMIN_PASSWORD = "Fixpoint@2026"

APPLIANCE_NAMES = {
    "RO System Service", "Kitchen Chimney Service", "Air Purifier Repair",
    "Dishwasher Repair", "Mixer Grinder Repair", "Air Cooler Service",
    "AC Repair", "Washing Machine Repair", "Refrigerator Repair",
    "TV Repair", "Microwave Repair", "Geyser Repair",
}
HANDYMAN_NAMES = {
    "TV Wall Mounting", "Curtain Rods / Blinds", "Bathroom Fittings",
    "Ready-to-Assemble Furniture", "Wall Art / Mirrors",
    "Fancy Lights / Chandeliers", "Ceiling Fan Installation",
    "Door Locks / Hinges", "RO Wall Mounting", "Faucet / Jet Spray Replacement",
}


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _mongo(js):
    """Run mongosh eval and return stdout."""
    r = subprocess.run(
        ["mongosh", "mongodb://localhost:27017/test_database", "--quiet", "--eval", js],
        capture_output=True, text=True, timeout=15,
    )
    return r.stdout.strip()


@pytest.fixture(scope="session")
def customer_token():
    ts = int(time.time() * 1000)
    js = f"""
    var uid = 'user_test_iter8_{ts}';
    var tok = 'test_session_iter8_{ts}';
    db.users.insertOne({{user_id: uid, email: 'iter8cust_{ts}@example.com', name: 'Iter8 Customer', picture: '', created_at: new Date().toISOString()}});
    db.user_sessions.insertOne({{user_id: uid, session_token: tok, role: 'customer', expires_at: new Date(Date.now()+7*24*3600*1000).toISOString(), created_at: new Date().toISOString()}});
    print(tok);
    """
    out = _mongo(js)
    tok = out.splitlines()[-1].strip()
    assert tok.startswith("test_session_iter8_"), f"no token: {out}"
    return tok


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/admin/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    # server may set cookie or return token
    tok = r.cookies.get("session_token")
    if not tok:
        data = r.json()
        tok = data.get("session_token") or data.get("token")
    assert tok, f"no admin token in response: {r.text} cookies={r.cookies.get_dict()}"
    return tok


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _bare():
    """Fresh session with no cookies (avoid session_token cookie leaking between fixtures)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Seed Migration ----------

def test_seed_version_meta_is_4():
    out = _mongo("printjson(db.getCollection('_meta').findOne({key:'seed_version'}));")
    assert "value: 4" in out or '"value": 4' in out, f"seed_version not 4: {out}"


def test_service_counts_exactly_26():
    out = _mongo("print(db.services.countDocuments({}));")
    total = int(out.splitlines()[-1].strip())
    assert total == 26, f"expected 26 services, got {total}"

    out = _mongo("print(db.services.countDocuments({category:'home_appliances'}));")
    assert int(out.splitlines()[-1].strip()) == 12

    out = _mongo("print(db.services.countDocuments({category:'handyman'}));")
    assert int(out.splitlines()[-1].strip()) == 10

    out = _mongo("print(db.services.countDocuments({category:'car_and_bike'}));")
    assert int(out.splitlines()[-1].strip()) == 4


# ---------- Categories ----------

def test_categories_five_pillars(api):
    r = api.get(f"{BASE_URL}/api/categories")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) == 5
    ids = [c["id"] for c in data]
    assert ids == ["home_appliances", "handyman", "car_and_bike",
                   "permanent_drivers", "domestic_maids"]

    ha = next(c for c in data if c["id"] == "home_appliances")
    assert ha["color"] == "hot_pink"
    assert "Repair" in ha["tagline"]
    assert ha["coming_soon"] is False

    hm = next(c for c in data if c["id"] == "handyman")
    assert hm["color"] == "lime_green"
    assert "100" in hm["tagline"]
    assert hm.get("booking_fee") == 100
    assert hm["coming_soon"] is False

    cb = next(c for c in data if c["id"] == "car_and_bike")
    assert cb["coming_soon"] is False

    for coming in ("permanent_drivers", "domestic_maids"):
        c = next(x for x in data if x["id"] == coming)
        assert c["coming_soon"] is True


def test_categories_no_legacy(api):
    r = api.get(f"{BASE_URL}/api/categories")
    ids = {c["id"] for c in r.json()}
    for gone in ("bike", "car", "installation"):
        assert gone not in ids

# ---------- Home Appliances ----------

def test_home_appliances_services(api):
    r = api.get(f"{BASE_URL}/api/services", params={"category": "home_appliances"})
    assert r.status_code == 200
    svcs = r.json()
    assert len(svcs) == 12
    names = {s["name"] for s in svcs}
    assert names == APPLIANCE_NAMES, f"mismatch: extra={names-APPLIANCE_NAMES} missing={APPLIANCE_NAMES-names}"

    for s in svcs:
        assert s["market_min"] > 0, f"{s['name']} market_min not > 0"
        assert s["market_max"] > s["market_min"], f"{s['name']} market_max not > market_min"
        assert s["market_min"] >= s["base_price"], f"{s['name']} market_min < base_price"
        assert s["tiers"], f"{s['name']} has empty tiers"


# ---------- Handyman ----------

def test_handyman_services(api):
    r = api.get(f"{BASE_URL}/api/services", params={"category": "handyman"})
    assert r.status_code == 200
    svcs = r.json()
    assert len(svcs) == 10
    names = {s["name"] for s in svcs}
    assert names == HANDYMAN_NAMES

    for s in svcs:
        assert s.get("is_flat_visit") is True, f"{s['name']} not is_flat_visit"
        assert s.get("booking_fee") == 100, f"{s['name']} booking_fee != 100"
        assert s["tiers"], f"{s['name']} empty tiers"
        first = s["tiers"][0]
        assert first["name"] == "Booking Visit"
        assert first["price"] == s["base_price"]


# ---------- Custom Jobs ----------

def test_custom_job_create_requires_auth(api):
    r = api.post(f"{BASE_URL}/api/custom-jobs",
                 json={"description": "Fix leaking pipe in bathroom", "phone": "+919999900000"})
    assert r.status_code == 401


def test_custom_job_create_too_short(api, customer_token):
    r = api.post(f"{BASE_URL}/api/custom-jobs",
                 json={"description": "hi", "phone": "+919999900000"},
                 headers=_auth(customer_token))
    assert r.status_code == 422


def test_custom_job_create_success(api, customer_token):
    r = api.post(f"{BASE_URL}/api/custom-jobs",
                 json={"description": "Fix leaking pipe under sink urgently", "phone": "+919999900000"},
                 headers=_auth(customer_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert "job_id" in data and data["job_id"].startswith("cj_")
    assert data["status"] == "pending_manpower_approval"

    # verify notification created (look up via user session)
    js = f"""
    var s = db.user_sessions.findOne({{session_token:'{customer_token}'}});
    print(db.notifications.countDocuments({{user_id: s.user_id, title: 'Custom job submitted'}}));
    """
    cnt = int(_mongo(js).splitlines()[-1].strip())
    assert cnt >= 1


def test_customer_list_scoped(api, customer_token):
    r = api.get(f"{BASE_URL}/api/custom-jobs", headers=_auth(customer_token))
    assert r.status_code == 200
    jobs = r.json()
    assert isinstance(jobs, list)
    # All jobs must belong to same user; created at least one above
    assert len(jobs) >= 1
    # every job in list should be this user's — check via session
    js = f"""
    var s = db.user_sessions.findOne({{session_token:'{customer_token}'}});
    print(s.user_id);
    """
    my_uid = _mongo(js).splitlines()[-1].strip()
    for j in jobs:
        assert j["user_id"] == my_uid


def test_admin_list_all_custom_jobs(api, admin_token, customer_token):
    # admin cookie-based session? Try header first.
    r = api.get(f"{BASE_URL}/api/admin/custom-jobs", headers=_auth(admin_token))
    if r.status_code == 401:
        # try cookie
        r = api.get(f"{BASE_URL}/api/admin/custom-jobs",
                    cookies={"session_token": admin_token})
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    jobs = r.json()
    assert isinstance(jobs, list) and len(jobs) >= 1


def test_admin_list_forbidden_for_customer(customer_token):
    r = _bare().get(f"{BASE_URL}/api/admin/custom-jobs", headers=_auth(customer_token))
    assert r.status_code == 403


def test_patch_status_flow(api, admin_token, customer_token):
    # create a job first — use bare session so admin cookie doesn't leak in
    r = _bare().post(f"{BASE_URL}/api/custom-jobs",
                 json={"description": "Need help hanging heavy chandelier safely", "phone": "+919888800000"},
                 headers=_auth(customer_token))
    assert r.status_code == 200
    job_id = r.json()["job_id"]

    # Determine auth style for admin
    def admin_req(method, path, **kw):
        r1 = api.request(method, f"{BASE_URL}{path}", headers=_auth(admin_token), **kw)
        if r1.status_code == 401:
            r1 = api.request(method, f"{BASE_URL}{path}", cookies={"session_token": admin_token}, **kw)
        return r1

    # invalid status
    r = admin_req("PATCH", f"/api/admin/custom-jobs/{job_id}/status", json={"status": "bogus"})
    assert r.status_code == 400

    # invalid job id
    r = admin_req("PATCH", f"/api/admin/custom-jobs/does_not_exist/status", json={"status": "approved"})
    assert r.status_code == 404

    # forbidden for customer
    r = _bare().patch(f"{BASE_URL}/api/admin/custom-jobs/{job_id}/status",
                  json={"status": "approved"}, headers=_auth(customer_token))
    assert r.status_code == 403

    # approve → notification
    r = admin_req("PATCH", f"/api/admin/custom-jobs/{job_id}/status", json={"status": "approved"})
    assert r.status_code == 200
    assert r.json().get("status") == "approved"

    js = f"""
    var s = db.user_sessions.findOne({{session_token:'{customer_token}'}});
    print(db.notifications.countDocuments({{user_id: s.user_id, title: 'Your custom request has been approved'}}));
    """
    assert int(_mongo(js).splitlines()[-1].strip()) >= 1

    # pending_manpower_approval → NO new notif
    js_before = f"""
    var s = db.user_sessions.findOne({{session_token:'{customer_token}'}});
    print(db.notifications.countDocuments({{user_id: s.user_id}}));
    """
    before = int(_mongo(js_before).splitlines()[-1].strip())

    r = admin_req("PATCH", f"/api/admin/custom-jobs/{job_id}/status",
                  json={"status": "pending_manpower_approval"})
    assert r.status_code == 200

    after = int(_mongo(js_before).splitlines()[-1].strip())
    assert after == before, f"pending_manpower_approval should not create notif ({before}→{after})"

    # rejected creates notif
    r = admin_req("PATCH", f"/api/admin/custom-jobs/{job_id}/status", json={"status": "rejected"})
    assert r.status_code == 200
    js = f"""
    var s = db.user_sessions.findOne({{session_token:'{customer_token}'}});
    print(db.notifications.countDocuments({{user_id: s.user_id, title: 'Your custom request could not be scheduled'}}));
    """
    assert int(_mongo(js).splitlines()[-1].strip()) >= 1

    # fulfilled creates notif
    r = admin_req("PATCH", f"/api/admin/custom-jobs/{job_id}/status", json={"status": "fulfilled"})
    assert r.status_code == 200
    js = f"""
    var s = db.user_sessions.findOne({{session_token:'{customer_token}'}});
    print(db.notifications.countDocuments({{user_id: s.user_id, title: 'Your custom job is complete'}}));
    """
    assert int(_mongo(js).splitlines()[-1].strip()) >= 1


# ---------- Regression: role isolation ----------

def test_regression_customer_cannot_access_admin(customer_token):
    r = _bare().get(f"{BASE_URL}/api/admin/custom-jobs", headers=_auth(customer_token))
    assert r.status_code == 403


def test_regression_unauth_cannot_list_customer_jobs():
    r = _bare().get(f"{BASE_URL}/api/custom-jobs")
    assert r.status_code == 401
