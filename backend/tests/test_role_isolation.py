"""Tests for role isolation, technician signup/login, manual booking assign (iteration 6)."""
import os
import time
import uuid
import base64
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env parse
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_mc = MongoClient(MONGO_URL)
_dbsync = _mc[DB_NAME]

ADMIN_EMAIL = "admin@fixpoint.app"
ADMIN_PASSWORD = "Fixpoint@2026"


# -------- helpers --------
def _rand_email():
    return f"test_tech_{uuid.uuid4().hex[:8]}@example.com"


def _big_b64():
    # >100 chars
    return "data:image/png;base64," + base64.b64encode(b"x" * 500).decode()


def _seed_customer_session():
    """Create a customer session directly in mongo, returns token."""
    user_id = f"user_TESTc_{uuid.uuid4().hex[:8]}"
    email = f"TEST_cust_{uuid.uuid4().hex[:6]}@example.com"
    token = f"test_sess_c_{uuid.uuid4().hex}"
    _dbsync.users.insert_one({
        "user_id": user_id, "email": email, "name": "TestCust", "picture": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _dbsync.user_sessions.insert_one({
        "user_id": user_id, "session_token": token, "role": "customer",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return token, user_id, email


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


# -------- fixtures --------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    # extract cookie
    tok = r.cookies.get("session_token")
    assert tok
    return tok


@pytest.fixture
def new_tech():
    """Signup a fresh tech, return (token, tech_id, email, password)."""
    email = _rand_email()
    password = "Passw0rd!123"
    payload = {
        "name": "Test Tech",
        "email": email,
        "password": password,
        "phone": "9998887777",
        "specializations": ["home_appliances", "bike"],
        "gov_id_base64": _big_b64(),
        "home_lat": 28.4595, "home_lng": 77.0266,
        "experience_years": 3,
    }
    r = requests.post(f"{BASE_URL}/api/auth/tech/signup", json=payload)
    assert r.status_code == 200, f"tech signup failed: {r.status_code} {r.text}"
    data = r.json()
    tech_id = data["tech"]["tech_id"]
    token = r.cookies.get("session_token")
    assert token
    return {"token": token, "tech_id": tech_id, "email": email, "password": password}


# -------- Signup validations --------
class TestTechSignup:
    def test_signup_success_pending(self, new_tech):
        # verify pending + docs created
        tech = _dbsync.technicians.find_one({"tech_id": new_tech["tech_id"]}, {"_id": 0})
        assert tech and tech["status"] == "pending"
        cred = _dbsync.technician_credentials.find_one({"email": new_tech["email"]}, {"_id": 0})
        assert cred and cred["password_hash"].startswith("$2b$")
        u = _dbsync.users.find_one({"email": new_tech["email"]}, {"_id": 0})
        assert u
        sess = _dbsync.user_sessions.find_one({"session_token": new_tech["token"]}, {"_id": 0})
        assert sess and sess["role"] == "technician"

    def test_signup_duplicate_email(self, new_tech):
        payload = {
            "name": "Duper", "email": new_tech["email"], "password": "Passw0rd!123",
            "phone": "9998887777", "specializations": ["car"], "gov_id_base64": _big_b64(),
            "home_lat": 28.4595, "home_lng": 77.0266, "experience_years": 1,
        }
        r = requests.post(f"{BASE_URL}/api/auth/tech/signup", json=payload)
        assert r.status_code == 409

    def test_signup_empty_specs(self):
        payload = {
            "name": "Tester", "email": _rand_email(), "password": "Passw0rd!123",
            "phone": "9998887777", "specializations": [], "gov_id_base64": _big_b64(),
            "home_lat": 28.4595, "home_lng": 77.0266, "experience_years": 1,
        }
        r = requests.post(f"{BASE_URL}/api/auth/tech/signup", json=payload)
        assert r.status_code == 400

    def test_signup_invalid_specs_filtered(self):
        payload = {
            "name": "Tester", "email": _rand_email(), "password": "Passw0rd!123",
            "phone": "9998887777", "specializations": ["plumbing", "spaceship"],
            "gov_id_base64": _big_b64(),
            "home_lat": 28.4595, "home_lng": 77.0266, "experience_years": 1,
        }
        r = requests.post(f"{BASE_URL}/api/auth/tech/signup", json=payload)
        assert r.status_code == 400

    def test_signup_short_govid(self):
        payload = {
            "name": "Tester", "email": _rand_email(), "password": "Passw0rd!123",
            "phone": "9998887777", "specializations": ["car"],
            "gov_id_base64": "short",
            "home_lat": 28.4595, "home_lng": 77.0266, "experience_years": 1,
        }
        r = requests.post(f"{BASE_URL}/api/auth/tech/signup", json=payload)
        assert r.status_code == 400

    def test_signup_outside_gurugram(self):
        payload = {
            "name": "Tester", "email": _rand_email(), "password": "Passw0rd!123",
            "phone": "9998887777", "specializations": ["car"],
            "gov_id_base64": _big_b64(),
            "home_lat": 40.7, "home_lng": -74.0, "experience_years": 1,
        }
        r = requests.post(f"{BASE_URL}/api/auth/tech/signup", json=payload)
        assert r.status_code == 400
        assert "Gurugram" in r.json().get("detail", "")

    def test_signup_short_password(self):
        payload = {
            "name": "Tester", "email": _rand_email(), "password": "short",
            "phone": "9998887777", "specializations": ["car"],
            "gov_id_base64": _big_b64(),
            "home_lat": 28.4595, "home_lng": 77.0266, "experience_years": 1,
        }
        r = requests.post(f"{BASE_URL}/api/auth/tech/signup", json=payload)
        assert r.status_code == 422


# -------- Tech login --------
class TestTechLogin:
    def test_login_wrong_password(self, new_tech):
        r = requests.post(f"{BASE_URL}/api/auth/tech/login",
                          json={"email": new_tech["email"], "password": "WRONGpass1!"})
        assert r.status_code == 401

    def test_login_correct(self, new_tech):
        r = requests.post(f"{BASE_URL}/api/auth/tech/login",
                          json={"email": new_tech["email"], "password": new_tech["password"]})
        assert r.status_code == 200
        j = r.json()
        assert j["role"] == "technician"
        assert j["tech"]["email"] == new_tech["email"]
        tok = r.cookies.get("session_token")
        assert tok
        sess = _dbsync.user_sessions.find_one({"session_token": tok}, {"_id": 0})
        assert sess["role"] == "technician"


# -------- Pending tech gating --------
class TestPendingGating:
    def test_pending_jobs_403(self, new_tech):
        r = requests.get(f"{BASE_URL}/api/tech/jobs", headers=_bearer(new_tech["token"]))
        assert r.status_code == 403
        assert "awaiting admin approval" in r.json().get("detail", "").lower() or "approval" in r.json().get("detail", "").lower()

    def test_pending_me_ok(self, new_tech):
        r = requests.get(f"{BASE_URL}/api/tech/me", headers=_bearer(new_tech["token"]))
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_pending_location_403(self, new_tech):
        r = requests.patch(f"{BASE_URL}/api/tech/location",
                           headers=_bearer(new_tech["token"]),
                           json={"lat": 28.46, "lng": 77.03})
        assert r.status_code == 403

    def test_pending_auth_me(self, new_tech):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_bearer(new_tech["token"]))
        assert r.status_code == 200
        j = r.json()
        assert j["is_technician"] is True
        assert j["is_admin"] is False
        assert j["tech_status"] == "pending"


# -------- Role isolation --------
class TestRoleIsolation:
    def test_tech_cannot_hit_admin(self, new_tech):
        # Approve first so tech is fully-functional, still shouldn't access admin
        _dbsync.technicians.update_one({"tech_id": new_tech["tech_id"]},
                                       {"$set": {"status": "approved", "is_available": True}})
        for path in ["/api/admin/stats", "/api/admin/technicians", "/api/admin/bookings",
                     "/api/admin/technicians/pending"]:
            r = requests.get(f"{BASE_URL}{path}", headers=_bearer(new_tech["token"]))
            assert r.status_code == 403, f"{path} should 403 for tech, got {r.status_code}"

    def test_admin_me(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_bearer(admin_token))
        assert r.status_code == 200
        j = r.json()
        assert j["is_admin"] is True
        assert j["is_technician"] is False

    def test_admin_cannot_hit_tech_me(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/tech/me", headers=_bearer(admin_token))
        assert r.status_code == 403

    def test_admin_who_is_also_tech_isolated(self):
        # Create a tech with admin email? Actually signup forbids ADMIN_EMAILS.
        # Instead: create tech record with admin email directly in DB, then admin logs in and calls /tech/me
        email = ADMIN_EMAIL
        _dbsync.technicians.delete_many({"email": email})
        _dbsync.technicians.insert_one({
            "tech_id": f"tech_TESTadmintech_{uuid.uuid4().hex[:6]}",
            "name": "Admin as Tech", "email": email, "picture": "", "rating": 0,
            "experience_years": 1, "specializations": ["car"], "phone": "",
            "is_available": True, "home_lat": 28.46, "home_lng": 77.03,
            "status": "approved", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        tok = r.cookies.get("session_token")
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_bearer(tok)).json()
        assert me["is_admin"] is True
        assert me["is_technician"] is False
        # tech/me should 403 for admin-role even though email matches a tech
        r2 = requests.get(f"{BASE_URL}/api/tech/me", headers=_bearer(tok))
        assert r2.status_code == 403
        _dbsync.technicians.delete_many({"email": email})


# -------- Booking no auto-assign + admin assign --------
class TestBookingFlow:
    def test_booking_unassigned_and_admin_assign(self, new_tech, admin_token):
        # ensure a service exists
        svc = _dbsync.services.find_one({}, {"_id": 0})
        assert svc, "No services seeded"
        tier_name = svc["tiers"][0]["name"]

        # customer session
        c_tok, c_uid, c_email = _seed_customer_session()

        # create booking as customer
        payload = {
            "service_id": svc["service_id"], "tier_name": tier_name,
            "address": "Test addr, Gurugram",
            "scheduled_date": "2026-02-01", "scheduled_slot": "10-12",
            "notes": "test", "dest_lat": 28.46, "dest_lng": 77.03,
        }
        r = requests.post(f"{BASE_URL}/api/bookings", json=payload, headers=_bearer(c_tok))
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        b = r.json()
        assert b["status"] == "unassigned"
        assert b["tech_id"] is None
        assert b["tech_name"] is None
        booking_id = b["booking_id"]

        # notification created — title 'Booking received'
        notif = _dbsync.notifications.find_one({"booking_id": booking_id}, {"_id": 0})
        assert notif and notif["title"] == "Booking received"

        # tech is still pending → try approving via admin
        # First verify pending list contains our tech
        # Reset tech to pending first
        _dbsync.technicians.update_one({"tech_id": new_tech["tech_id"]},
                                       {"$set": {"status": "pending", "is_available": False}})
        pend = requests.get(f"{BASE_URL}/api/admin/technicians/pending",
                            headers=_bearer(admin_token))
        assert pend.status_code == 200
        ids = [t["tech_id"] for t in pend.json()]
        assert new_tech["tech_id"] in ids

        # try assign to pending tech → 400
        r = requests.post(f"{BASE_URL}/api/admin/bookings/{booking_id}/assign",
                          headers=_bearer(admin_token),
                          json={"tech_id": new_tech["tech_id"]})
        assert r.status_code == 400
        assert "not approved" in r.json().get("detail", "").lower()

        # invalid tech_id → 404
        r = requests.post(f"{BASE_URL}/api/admin/bookings/{booking_id}/assign",
                          headers=_bearer(admin_token),
                          json={"tech_id": "tech_does_not_exist"})
        assert r.status_code == 404

        # approve tech
        r = requests.patch(f"{BASE_URL}/api/admin/technicians/{new_tech['tech_id']}/status",
                           headers=_bearer(admin_token),
                           json={"status": "approved"})
        assert r.status_code == 200
        t = _dbsync.technicians.find_one({"tech_id": new_tech["tech_id"]}, {"_id": 0})
        assert t["status"] == "approved" and t["is_available"] is True

        # now assign booking → 200
        r = requests.post(f"{BASE_URL}/api/admin/bookings/{booking_id}/assign",
                          headers=_bearer(admin_token),
                          json={"tech_id": new_tech["tech_id"]})
        assert r.status_code == 200

        # verify booking updated
        b2 = _dbsync.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
        assert b2["status"] == "assigned"
        assert b2["tech_id"] == new_tech["tech_id"]
        assert b2["tech_name"]

        # customer got 'Technician assigned' notif
        assign_notif = _dbsync.notifications.find_one(
            {"booking_id": booking_id, "title": "Technician assigned"}, {"_id": 0})
        assert assign_notif

        # tech can now see the job & accept
        r = requests.get(f"{BASE_URL}/api/tech/jobs", headers=_bearer(new_tech["token"]))
        assert r.status_code == 200
        jobs = r.json()
        assert any(j["booking_id"] == booking_id for j in jobs)

        r = requests.post(f"{BASE_URL}/api/tech/jobs/{booking_id}/accept",
                          headers=_bearer(new_tech["token"]))
        assert r.status_code == 200
        assert r.json()["status"] == "on_the_way"


# -------- Admin stats new counters --------
class TestAdminStats:
    def test_stats_new_fields(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_bearer(admin_token))
        assert r.status_code == 200
        j = r.json()
        assert "technicians_pending" in j
        assert "bookings_unassigned" in j
        assert isinstance(j["technicians_pending"], int)
        assert isinstance(j["bookings_unassigned"], int)


# -------- Seed technicians backfilled --------
class TestSeedBackfill:
    def test_seed_techs_approved(self):
        for email in ["ravi@fixpoint.app", "priya@fixpoint.app", "arjun@fixpoint.app",
                      "zara@fixpoint.app", "sam@fixpoint.app", "neha@fixpoint.app"]:
            t = _dbsync.technicians.find_one({"email": email}, {"_id": 0})
            if t:
                assert t.get("status") == "approved", f"{email} status={t.get('status')}"


# -------- Admin login basic --------
class TestAdminLogin:
    def test_admin_login_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_admin_login_bad_pw(self):
        r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                          json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401
