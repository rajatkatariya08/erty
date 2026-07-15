"""
Backend tests for FixPoint iteration 3:
- Admin gating and CRUD (services/technicians/bookings)
- GPS on bookings + simulate-tech + tech-location update
- Streaming diagnosis SSE
- Notifications
"""
import os
import base64
import json
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://quick-diagnose-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_TOKEN = "test_session_1784025032702"
NONADMIN_TOKEN = "test_session_nonadmin_1784030460282"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin():
    return _h(ADMIN_TOKEN)


@pytest.fixture(scope="module")
def user():
    return _h(NONADMIN_TOKEN)


# ---------- auth/me is_admin flag ----------
class TestAuthMeAdminFlag:
    def test_admin_me_is_admin_true(self, admin):
        r = requests.get(f"{API}/auth/me", headers=admin)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == "admin@fixpoint.app"
        assert d.get("is_admin") is True

    def test_nonadmin_me_is_admin_false(self, user):
        r = requests.get(f"{API}/auth/me", headers=user)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_admin") is False


# ---------- Admin gating ----------
class TestAdminGating:
    def test_admin_stats_forbidden_for_normal(self, user):
        r = requests.get(f"{API}/admin/stats", headers=user)
        assert r.status_code == 403

    def test_admin_stats_ok_for_admin(self, admin):
        r = requests.get(f"{API}/admin/stats", headers=admin)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("services", "technicians", "bookings", "diagnoses", "users"):
            assert k in d
            assert isinstance(d[k], int)


# ---------- Admin Services CRUD ----------
class TestAdminServicesCRUD:
    created_id = None

    def test_list_services(self, admin):
        r = requests.get(f"{API}/admin/services", headers=admin)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_service(self, admin):
        payload = {
            "category": "home_appliances",
            "name": "TEST_Service_A",
            "description": "Test service created by pytest",
            "tiers": [{"name": "Basic", "price": 199, "features": ["x"]}],
            "base_price": 199,
        }
        r = requests.post(f"{API}/admin/services", headers=admin, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Service_A"
        assert "service_id" in d
        assert "_id" not in d
        TestAdminServicesCRUD.created_id = d["service_id"]

    def test_update_service(self, admin):
        sid = TestAdminServicesCRUD.created_id
        assert sid
        payload = {
            "category": "home_appliances",
            "name": "TEST_Service_A_upd",
            "description": "updated",
            "tiers": [{"name": "Basic", "price": 249, "features": ["y"]}],
            "base_price": 249,
        }
        r = requests.patch(f"{API}/admin/services/{sid}", headers=admin, json=payload)
        assert r.status_code == 200, r.text
        # verify via list
        lst = requests.get(f"{API}/admin/services", headers=admin).json()
        found = [s for s in lst if s["service_id"] == sid]
        assert found and found[0]["name"] == "TEST_Service_A_upd"

    def test_delete_service(self, admin):
        sid = TestAdminServicesCRUD.created_id
        r = requests.delete(f"{API}/admin/services/{sid}", headers=admin)
        assert r.status_code == 200
        lst = requests.get(f"{API}/admin/services", headers=admin).json()
        assert not any(s["service_id"] == sid for s in lst)


# ---------- Admin Technicians CRUD ----------
class TestAdminTechniciansCRUD:
    created_id = None

    def test_list_technicians(self, admin):
        r = requests.get(f"{API}/admin/technicians", headers=admin)
        assert r.status_code == 200
        techs = r.json()
        assert isinstance(techs, list)
        if techs:
            t = techs[0]
            assert "home_lat" in t and "home_lng" in t

    def test_create_technician(self, admin):
        payload = {
            "name": "TEST_Tech_A",
            "specializations": ["home_appliances"],
            "home_lat": 12.98,
            "home_lng": 77.60,
        }
        r = requests.post(f"{API}/admin/technicians", headers=admin, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "tech_id" in d
        assert d["name"] == "TEST_Tech_A"
        TestAdminTechniciansCRUD.created_id = d["tech_id"]

    def test_update_technician(self, admin):
        tid = TestAdminTechniciansCRUD.created_id
        payload = {
            "name": "TEST_Tech_A_upd",
            "specializations": ["bike"],
            "home_lat": 12.97,
            "home_lng": 77.59,
        }
        r = requests.patch(f"{API}/admin/technicians/{tid}", headers=admin, json=payload)
        assert r.status_code == 200, r.text

    def test_delete_technician(self, admin):
        tid = TestAdminTechniciansCRUD.created_id
        r = requests.delete(f"{API}/admin/technicians/{tid}", headers=admin)
        assert r.status_code == 200


# ---------- Admin Bookings ----------
class TestAdminBookings:
    def test_admin_lists_all_bookings(self, admin, user):
        # Create a booking as normal user first
        svcs = requests.get(f"{API}/services").json()
        svc = svcs[0]
        payload = {
            "service_id": svc["service_id"],
            "tier_name": svc["tiers"][0]["name"],
            "address": "123 Test St",
            "scheduled_date": "2026-08-01",
            "scheduled_slot": "10:00-12:00",
            "notes": "",
        }
        r = requests.post(f"{API}/bookings", headers=user, json=payload)
        assert r.status_code == 200, r.text
        booking = r.json()
        # GPS check
        for k in ("tech_lat", "tech_lng", "dest_lat", "dest_lng"):
            assert k in booking and booking[k] is not None, f"missing {k}"
            assert 12.0 < booking[k] < 78.5  # near 12.97/77.59
        assert "_id" not in booking
        TestAdminBookings.booking_id = booking["booking_id"]

        # Admin sees ALL bookings incl this one
        r2 = requests.get(f"{API}/admin/bookings", headers=admin)
        assert r2.status_code == 200
        all_ids = {b["booking_id"] for b in r2.json()}
        assert booking["booking_id"] in all_ids

    def test_admin_updates_other_users_booking_status(self, admin):
        bid = TestAdminBookings.booking_id
        r = requests.patch(f"{API}/admin/bookings/{bid}/status", headers=admin, json={"status": "on_the_way"})
        assert r.status_code == 200

    def test_admin_invalid_status(self, admin):
        bid = TestAdminBookings.booking_id
        r = requests.patch(f"{API}/admin/bookings/{bid}/status", headers=admin, json={"status": "banana"})
        assert r.status_code == 400


# ---------- GPS: simulate-tech + tech-location ----------
class TestGPS:
    def test_simulate_tech_decreases_distance(self, user):
        bid = TestAdminBookings.booking_id
        assert bid
        distances = []
        for _ in range(3):
            r = requests.post(f"{API}/bookings/{bid}/simulate-tech", headers=user)
            assert r.status_code == 200, r.text
            d = r.json()
            assert "tech_lat" in d and "tech_lng" in d and "distance_m" in d
            distances.append(d["distance_m"])
        # each call must move closer (or equal if already ~0)
        assert distances[0] >= distances[1] >= distances[2]
        assert distances[2] < distances[0]

    def test_tech_location_update_owner(self, user):
        bid = TestAdminBookings.booking_id
        r = requests.patch(
            f"{API}/bookings/{bid}/tech-location", headers=user,
            json={"lat": 12.9700, "lng": 77.5900},
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_tech_location_update_non_owner_404(self, admin):
        # admin's user (user_hit6y6mvgub) does NOT own this booking (owned by nonadmin)
        bid = TestAdminBookings.booking_id
        r = requests.patch(
            f"{API}/bookings/{bid}/tech-location", headers=admin,
            json={"lat": 12.97, "lng": 77.59},
        )
        assert r.status_code == 404


# ---------- Streaming diagnosis ----------
class TestDiagnosisStream:
    def test_stream_requires_auth(self):
        r = requests.post(f"{API}/diagnosis/stream", json={"category": "home_appliances", "image_base64": "iVBORw0KGgo="})
        assert r.status_code == 401

    def test_stream_returns_sse(self, user):
        # tiny 1x1 red pixel JPEG (base64)
        # Using a minimal valid JPEG
        jpeg_b64 = (
            "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=="
        )
        r = requests.post(
            f"{API}/diagnosis/stream",
            headers=user,
            json={"category": "home_appliances", "image_base64": jpeg_b64, "message": "What do you see?"},
            stream=True,
            timeout=60,
        )
        assert r.status_code == 200, r.text[:400]
        ctype = r.headers.get("content-type", "")
        assert "text/event-stream" in ctype, ctype

        got_token = False
        got_done = False
        for raw in r.iter_lines(decode_unicode=True):
            if not raw:
                continue
            assert raw.startswith("data:"), raw
            payload = raw[5:].strip()
            try:
                obj = json.loads(payload)
            except Exception:
                continue
            if "token" in obj:
                got_token = True
            if obj.get("done"):
                got_done = True
                break
        assert got_done, "SSE stream did not end with done=True"
        # token OR error acceptable; but we expect at least one token from Gemini
        assert got_token, "No token deltas received"


# ---------- Notifications ----------
class TestNotifications:
    def test_notifications_include_booking_confirmed(self, user):
        r = requests.get(f"{API}/notifications", headers=user)
        assert r.status_code == 200
        items = r.json()
        assert any(n.get("title") == "Booking confirmed" for n in items), items

    def test_read_all(self, user):
        r = requests.post(f"{API}/notifications/read-all", headers=user)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        items = requests.get(f"{API}/notifications", headers=user).json()
        assert all(n.get("read") is True for n in items)
