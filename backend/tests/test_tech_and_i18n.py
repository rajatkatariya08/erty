"""Iteration 4 tests: tech-side endpoints, dest_lat/lng, multi-lang diagnosis, TechLocationUpdate bounds."""
import os
import re
import json
import pytest
import requests

def _load_frontend_env():
    path = "/app/frontend/.env"
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k, v)

_load_frontend_env()
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_TOKEN = "test_session_1784025032702"           # admin@fixpoint.app, linked to Ravi Kumar tech
NON_TOKEN = "test_session_nonadmin_1784030460282"    # non-admin, non-tech

ADMIN_H = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
NON_H = {"Authorization": f"Bearer {NON_TOKEN}", "Content-Type": "application/json"}

DEVANAGARI = re.compile(r"[\u0900-\u097F]")


# ---------- /api/auth/me technician flag ----------
class TestAuthMeTechFlag:
    def test_admin_is_technician(self):
        r = requests.get(f"{BASE}/api/auth/me", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_technician"] is True
        assert d["tech_id"] == "tech_84fdb194ac"

    def test_nonadmin_not_technician(self):
        r = requests.get(f"{BASE}/api/auth/me", headers=NON_H, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_technician"] is False
        assert d["tech_id"] is None


# ---------- /api/tech/me ----------
class TestTechMe:
    def test_tech_me_ok(self):
        r = requests.get(f"{BASE}/api/tech/me", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == "admin@fixpoint.app"
        assert d["tech_id"] == "tech_84fdb194ac"
        assert d["name"] == "Ravi Kumar"
        assert "home_lat" in d and "home_lng" in d
        assert "_id" not in d

    def test_tech_me_forbidden_for_non_tech(self):
        r = requests.get(f"{BASE}/api/tech/me", headers=NON_H, timeout=15)
        assert r.status_code == 403


# ---------- Helper: create a booking assigned to Ravi ----------
@pytest.fixture(scope="module")
def a_booking():
    # Need a service. Grab first service in DB.
    services = requests.get(f"{BASE}/api/services", timeout=15).json()
    assert services, "no services in DB"
    # Pick one whose category matches Ravi's spec (home_appliances) so assignment picks him.
    svc = next((s for s in services if "home_appliances" in s.get("category", "")), services[0])
    payload = {
        "service_id": svc["service_id"],
        "tier_name": (svc.get("tiers") or [{"name": "basic"}])[0]["name"],
        "scheduled_date": "2026-02-01",
        "scheduled_slot": "10:00-12:00",
        "address": "Test address",
        "notes": "TEST tech flow",
        "dest_lat": 12.9800,
        "dest_lng": 77.6000,
    }
    # Non-admin user creates the booking so notifications go to a different user_id
    r = requests.post(f"{BASE}/api/bookings", headers=NON_H, json=payload, timeout=20)
    assert r.status_code == 200, r.text
    b = r.json()
    # Force-assign to Ravi via admin patch endpoint if not already; use direct mongo via admin API.
    # Simpler: use admin bookings PATCH tech assignment through direct DB? We don't have such endpoint.
    # If auto-assigned tech differs, reassign via /api/admin/bookings/{id} PATCH? Only status.
    # Fall back: patch via mongosh - not available here. Instead we rely on server picking Ravi
    # (home_appliances specialist). If not, skip tech-specific job tests.
    return b


class TestTechJobs:
    def test_list_jobs(self, a_booking):
        r = requests.get(f"{BASE}/api/tech/jobs", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200, r.text
        jobs = r.json()
        assert isinstance(jobs, list)
        # Every job returned must belong to Ravi
        for j in jobs:
            assert j.get("tech_id") == "tech_84fdb194ac"

    def test_list_jobs_status_filter(self):
        r = requests.get(f"{BASE}/api/tech/jobs?status=assigned", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200
        for j in r.json():
            assert j["status"] == "assigned"

    def test_job_detail_404_for_other_tech(self):
        # Non-existent id should give 404
        r = requests.get(f"{BASE}/api/tech/jobs/bkg_doesnotexist_xxxxx", headers=ADMIN_H, timeout=15)
        assert r.status_code == 404


# ---------- Accept + status transitions ----------
class TestTechAcceptStatus:
    def _get_ravi_assigned(self):
        r = requests.get(f"{BASE}/api/tech/jobs?status=assigned", headers=ADMIN_H, timeout=15).json()
        return r[0] if r else None

    def _get_ravi_any(self):
        r = requests.get(f"{BASE}/api/tech/jobs", headers=ADMIN_H, timeout=15).json()
        return r[0] if r else None

    def test_accept_transitions_to_on_the_way(self, a_booking):
        # Find an assigned booking for Ravi. If a_booking is his and still assigned, use it.
        target = self._get_ravi_assigned()
        if not target:
            pytest.skip("No 'assigned' job for Ravi - auto-assign may have picked another tech")
        bid = target["booking_id"]
        cust_uid = target["user_id"]

        r = requests.post(f"{BASE}/api/tech/jobs/{bid}/accept", headers=ADMIN_H, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "on_the_way"

        # 2nd accept must 404 (already not 'assigned')
        r2 = requests.post(f"{BASE}/api/tech/jobs/{bid}/accept", headers=ADMIN_H, timeout=15)
        assert r2.status_code == 404

        # Verify customer got a "Technician on the way" notification.
        # We can't easily impersonate customer, but we can query admin notifications for that user via db? no endpoint.
        # Check via non-admin session ONLY if bid belongs to that user.
        if cust_uid == "user_nonadmin_u7jmth":
            notes = requests.get(f"{BASE}/api/notifications", headers=NON_H, timeout=15).json()
            assert any("Technician on the way" in n.get("title", "") and n.get("booking_id") == bid for n in notes)

    def test_status_transition_and_notification(self):
        target = self._get_ravi_any()
        if not target:
            pytest.skip("Ravi has no jobs")
        bid = target["booking_id"]
        cust_uid = target["user_id"]

        r = requests.patch(
            f"{BASE}/api/tech/jobs/{bid}/status",
            headers=ADMIN_H, json={"status": "arrived"}, timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "arrived"

        # invalid target status
        r_bad = requests.patch(
            f"{BASE}/api/tech/jobs/{bid}/status",
            headers=ADMIN_H, json={"status": "assigned"}, timeout=15,
        )
        assert r_bad.status_code == 400

        if cust_uid == "user_nonadmin_u7jmth":
            notes = requests.get(f"{BASE}/api/notifications", headers=NON_H, timeout=15).json()
            assert any("Booking update" in n.get("title", "") and n.get("booking_id") == bid for n in notes)


# ---------- /api/tech/location ----------
class TestTechLocation:
    def test_update_location_valid(self):
        r = requests.patch(
            f"{BASE}/api/tech/location",
            headers=ADMIN_H, json={"lat": 12.9850, "lng": 77.6050}, timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["lat"] == 12.9850 and d["lng"] == 77.6050

        # verify tech_me reflects it
        me = requests.get(f"{BASE}/api/tech/me", headers=ADMIN_H, timeout=15).json()
        assert me["home_lat"] == 12.9850 and me["home_lng"] == 77.6050

        # verify all active jobs have tech_lat/lng updated
        jobs = requests.get(f"{BASE}/api/tech/jobs", headers=ADMIN_H, timeout=15).json()
        for j in jobs:
            if j.get("status") in ("assigned", "on_the_way", "arrived", "in_progress"):
                assert j.get("tech_lat") == 12.9850
                assert j.get("tech_lng") == 77.6050

    def test_update_location_invalid_lat(self):
        r = requests.patch(
            f"{BASE}/api/tech/location",
            headers=ADMIN_H, json={"lat": 200.0, "lng": 77.0}, timeout=15,
        )
        assert r.status_code == 422, r.text

    def test_update_location_invalid_lng(self):
        r = requests.patch(
            f"{BASE}/api/tech/location",
            headers=ADMIN_H, json={"lat": 12.0, "lng": 500.0}, timeout=15,
        )
        assert r.status_code == 422

    def test_update_location_forbidden_for_non_tech(self):
        r = requests.patch(
            f"{BASE}/api/tech/location",
            headers=NON_H, json={"lat": 12.0, "lng": 77.0}, timeout=15,
        )
        assert r.status_code == 403


# ---------- POST /api/bookings dest_lat/lng ----------
class TestBookingDest:
    def _svc(self):
        return requests.get(f"{BASE}/api/services", timeout=15).json()[0]

    def _payload(self, **extra):
        s = self._svc()
        return {
            "service_id": s["service_id"],
            "tier_name": (s.get("tiers") or [{"name": "basic"}])[0]["name"],
            "scheduled_date": "2026-02-02",
            "scheduled_slot": "10:00-12:00",
            "address": "TEST addr",
            **extra,
        }

    def test_custom_dest(self):
        r = requests.post(f"{BASE}/api/bookings", headers=NON_H, json=self._payload(dest_lat=40.7128, dest_lng=-74.006), timeout=20)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["dest_lat"] == 40.7128
        assert b["dest_lng"] == -74.006

    def test_invalid_dest_lat(self):
        r = requests.post(f"{BASE}/api/bookings", headers=NON_H, json=self._payload(dest_lat=999.0, dest_lng=0.0), timeout=20)
        assert r.status_code == 422

    def test_default_dest(self):
        r = requests.post(f"{BASE}/api/bookings", headers=NON_H, json=self._payload(), timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert 12.5 < b["dest_lat"] < 13.5
        assert 77.0 < b["dest_lng"] < 78.0


# ---------- PATCH /api/bookings/{id}/tech-location bounds ----------
class TestTechLocationPatchBounds:
    def test_invalid_lat_422(self):
        r = requests.patch(
            f"{BASE}/api/bookings/anything/tech-location",
            headers=NON_H, json={"lat": 200.0, "lng": 77.0}, timeout=15,
        )
        assert r.status_code == 422

    def test_invalid_lng_422(self):
        r = requests.patch(
            f"{BASE}/api/bookings/anything/tech-location",
            headers=NON_H, json={"lat": 12.0, "lng": 999.0}, timeout=15,
        )
        assert r.status_code == 422


# 1x1 transparent PNG
TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


# ---------- Multi-language diagnosis ----------
class TestDiagnosisLanguage:
    def test_hindi(self):
        payload = {
            "category": "home_appliances",
            "image_base64": TINY_PNG,
            "user_note": "My refrigerator is not cooling and making a loud noise from the back",
            "language": "Hindi",
        }
        r = requests.post(f"{BASE}/api/diagnosis", headers=NON_H, json=payload, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        blob = (d.get("issue_summary", "") or "") + " " + (d.get("ai_notes", "") or "")
        assert DEVANAGARI.search(blob), f"No Devanagari chars found in: {blob[:200]}"

    def test_spanish_no_error(self):
        payload = {
            "category": "home_appliances",
            "image_base64": TINY_PNG,
            "user_note": "AC not cooling",
            "language": "Spanish",
        }
        r = requests.post(f"{BASE}/api/diagnosis", headers=NON_H, json=payload, timeout=90)
        assert r.status_code == 200, r.text

    def test_stream_hindi(self):
        payload = {"category": "home_appliances", "image_base64": TINY_PNG,
                   "message": "Washing machine not spinning", "language": "Hindi"}
        with requests.post(
            f"{BASE}/api/diagnosis/stream", headers=NON_H, json=payload, timeout=90, stream=True
        ) as r:
            assert r.status_code == 200
            found_devanagari = False
            for line in r.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                try:
                    obj = json.loads(data)
                except Exception:
                    continue
                tok = obj.get("token", "") or ""
                if DEVANAGARI.search(tok):
                    found_devanagari = True
                if obj.get("done"):
                    break
            assert found_devanagari, "No Devanagari tokens seen in stream"
