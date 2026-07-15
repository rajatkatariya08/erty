"""Wave 4 backend regression + new-feature tests.

Covers:
- Router-split refactor regression
- /api/service-area
- Gurugram bounds enforcement on bookings
- Language whitelist on /api/diagnosis + /api/diagnosis/stream
- /api/tech/location 3s debounce
- Seed integrity (6 techs in Gurugram bounds w/ emails)
"""
import os
import time
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # Fallback: read from frontend/.env
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        for line in open(env_path):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
ADMIN_TECH_TOKEN = "test_session_1784025032702"     # admin@fixpoint.app + Ravi tech
NONADMIN_TOKEN = "test_session_nonadmin_1784030460282"

H_ADMIN = {"Authorization": f"Bearer {ADMIN_TECH_TOKEN}", "Content-Type": "application/json"}
H_USER = {"Authorization": f"Bearer {NONADMIN_TOKEN}", "Content-Type": "application/json"}


# ---------- REGRESSION: refactor preserved routes ----------
def test_root_health_gurugram():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["city"] == "Gurugram"


def test_categories_are_four():
    r = requests.get(f"{BASE_URL}/api/categories")
    assert r.status_code == 200
    cats = r.json()
    assert len(cats) == 4
    ids = {c["id"] for c in cats}
    assert ids == {"home_appliances", "bike", "car", "installation"}


def test_services_are_nine_or_more():
    r = requests.get(f"{BASE_URL}/api/services")
    assert r.status_code == 200
    svcs = r.json()
    # Wave 4 seed has 10 services in SEED_SERVICES; problem statement claimed 9,
    # so accept >=9.
    assert len(svcs) >= 9


def test_technicians_six_and_in_gurugram():
    r = requests.get(f"{BASE_URL}/api/technicians")
    assert r.status_code == 200
    techs = r.json()
    assert len(techs) == 6
    for t in techs:
        assert 28.30 <= t["home_lat"] <= 28.60, f"{t['name']} lat {t['home_lat']} outside"
        assert 76.85 <= t["home_lng"] <= 77.20, f"{t['name']} lng {t['home_lng']} outside"
        assert t.get("email"), f"{t['name']} missing email"


def test_auth_me_admin_tech_flags():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H_ADMIN)
    assert r.status_code == 200
    me = r.json()
    assert me.get("is_admin") is True
    assert me.get("is_technician") is True
    assert me.get("tech_id")


def test_auth_me_nonadmin_flags():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=H_USER)
    assert r.status_code == 200
    me = r.json()
    assert me.get("is_admin") is False
    assert me.get("is_technician") is False


def test_admin_endpoint_gated():
    # Non-admin blocked
    r = requests.get(f"{BASE_URL}/api/admin/bookings", headers=H_USER)
    assert r.status_code == 403
    # Admin OK
    r = requests.get(f"{BASE_URL}/api/admin/bookings", headers=H_ADMIN)
    assert r.status_code == 200


def test_tech_endpoint_gated():
    r = requests.get(f"{BASE_URL}/api/tech/me", headers=H_USER)
    assert r.status_code == 403
    r = requests.get(f"{BASE_URL}/api/tech/me", headers=H_ADMIN)
    assert r.status_code == 200
    assert r.json().get("tech_id")


def test_notifications_list():
    r = requests.get(f"{BASE_URL}/api/notifications", headers=H_USER)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- /api/service-area ----------
def test_service_area_endpoint():
    r = requests.get(f"{BASE_URL}/api/service-area")
    assert r.status_code == 200
    body = r.json()
    assert body["city"] == "Gurugram"
    assert "Haryana" in body["region"]
    assert body["center"]["lat"] and body["center"]["lng"]
    b = body["bounds"]
    assert b["lat_min"] == 28.30 and b["lat_max"] == 28.60
    assert b["lng_min"] == 76.85 and b["lng_max"] == 77.20


# ---------- Gurugram enforcement on bookings ----------
@pytest.fixture(scope="module")
def a_service_id():
    svcs = requests.get(f"{BASE_URL}/api/services").json()
    svc = next(s for s in svcs if s["category"] == "home_appliances")
    return svc["service_id"], svc["tiers"][0]["name"]


def _booking_payload(service_id, tier_name, **overrides):
    body = {
        "service_id": service_id,
        "tier_name": tier_name,
        "address": "TEST_ADDR",
        "scheduled_date": "2026-02-01",
        "scheduled_slot": "10-12",
        "notes": "TEST_wave4",
    }
    body.update(overrides)
    return body


def test_booking_rejects_nyc_coords(a_service_id):
    sid, tier = a_service_id
    payload = _booking_payload(sid, tier, dest_lat=40.7128, dest_lng=-74.006)
    r = requests.post(f"{BASE_URL}/api/bookings", headers=H_USER, json=payload)
    assert r.status_code == 400
    assert "Gurugram" in r.json().get("detail", "")


def test_booking_accepts_dlf_cyber_city(a_service_id):
    sid, tier = a_service_id
    payload = _booking_payload(sid, tier, dest_lat=28.4949, dest_lng=77.0891)
    r = requests.post(f"{BASE_URL}/api/bookings", headers=H_USER, json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["dest_lat"] == 28.4949
    assert body["dest_lng"] == 77.0891


def test_booking_defaults_within_bounds(a_service_id):
    sid, tier = a_service_id
    payload = _booking_payload(sid, tier)  # no dest_lat / dest_lng
    r = requests.post(f"{BASE_URL}/api/bookings", headers=H_USER, json=payload)
    assert r.status_code == 200
    b = r.json()
    assert 28.30 <= b["dest_lat"] <= 28.60
    assert 76.85 <= b["dest_lng"] <= 77.20


# ---------- Language whitelist on diagnosis ----------
# Use a tiny fake image (a red 1x1 JPEG-ish base64). Backend will hit Gemini so
# we ONLY assert on 400 rejection for invalid languages — those must short-circuit
# BEFORE the LLM call.
TINY_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD/AD/6KKKACiiigAooooA//9k="


def _diag_body(lang="English"):
    return {"category": "home_appliances", "image_base64": TINY_B64, "user_note": "TEST", "language": lang}


def test_diagnosis_rejects_klingon():
    r = requests.post(f"{BASE_URL}/api/diagnosis", headers=H_USER, json=_diag_body("Klingon"))
    assert r.status_code == 400
    assert "Klingon" in r.json().get("detail", "") or "not supported" in r.json().get("detail", "").lower()


def test_diagnosis_rejects_injection():
    r = requests.post(f"{BASE_URL}/api/diagnosis", headers=H_USER,
                      json=_diag_body("DROP TABLE users"))
    assert r.status_code == 400


def test_diagnosis_stream_rejects_klingon():
    r = requests.post(f"{BASE_URL}/api/diagnosis/stream", headers=H_USER,
                      json=_diag_body("Klingon"))
    assert r.status_code == 400


@pytest.mark.parametrize("lang", ["English", "Hindi", "Tamil", "Arabic"])
def test_diagnosis_accepts_whitelisted_language(lang):
    # We accept 200 OR 502 (LLM upstream flake), but NOT 400 which would signal
    # incorrect whitelist rejection.
    r = requests.post(f"{BASE_URL}/api/diagnosis", headers=H_USER,
                      json=_diag_body(lang), timeout=90)
    assert r.status_code != 400, f"Whitelisted {lang} incorrectly rejected: {r.text[:200]}"
    assert r.status_code in (200, 502, 503)


# ---------- /api/tech/location 3s debounce ----------
def test_tech_location_debounce():
    # First hit — expect a real write
    p1 = {"lat": 28.4600, "lng": 77.0300}
    r1 = requests.patch(f"{BASE_URL}/api/tech/location", headers=H_ADMIN, json=p1)
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    # Might be debounced from an earlier test-run; accept either but if not
    # debounced, verify write occurred.
    if not body1.get("skipped"):
        assert body1.get("lat") == p1["lat"] and body1.get("lng") == p1["lng"]

        # Verify DB persisted first write
        me1 = requests.get(f"{BASE_URL}/api/tech/me", headers=H_ADMIN).json()
        assert abs(me1["home_lat"] - p1["lat"]) < 1e-6
        assert abs(me1["home_lng"] - p1["lng"]) < 1e-6

        # Second call within 3s -> debounced
        p2 = {"lat": 28.4700, "lng": 77.0400}
        r2 = requests.patch(f"{BASE_URL}/api/tech/location", headers=H_ADMIN, json=p2)
        assert r2.status_code == 200
        b2 = r2.json()
        assert b2.get("skipped") is True
        assert b2.get("reason") == "debounced"
        assert "retry_after_sec" in b2

        # DB should still show first-write coords
        me2 = requests.get(f"{BASE_URL}/api/tech/me", headers=H_ADMIN).json()
        assert abs(me2["home_lat"] - p1["lat"]) < 1e-6
        assert abs(me2["home_lng"] - p1["lng"]) < 1e-6

        # After debounce window elapses, another write goes through
        time.sleep(3.5)
        p3 = {"lat": 28.4800, "lng": 77.0500}
        r3 = requests.patch(f"{BASE_URL}/api/tech/location", headers=H_ADMIN, json=p3)
        assert r3.status_code == 200
        assert r3.json().get("skipped") is not True
        me3 = requests.get(f"{BASE_URL}/api/tech/me", headers=H_ADMIN).json()
        assert abs(me3["home_lat"] - p3["lat"]) < 1e-6
    else:
        # Wait for window and re-try
        time.sleep(3.5)
        r_again = requests.patch(f"{BASE_URL}/api/tech/location", headers=H_ADMIN, json=p1)
        assert r_again.status_code == 200
        assert r_again.json().get("skipped") is not True
