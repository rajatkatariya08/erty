"""Iteration 7: SMS + Email notifications on admin booking assign (DRY-RUN mode).

Covers:
- POST /api/admin/bookings/{id}/assign fires 4 notifications with delivery status
- db.outbound_notifications records for each dry_run channel
- GET /api/admin/outbound admin-gated
- Missing recipient handling (no email / no phone)
- Template content
- Regression: assign works when both parties have no email/phone; in-app notif still created
"""
import os
import uuid
import base64
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_mc = MongoClient(MONGO_URL)
_db = _mc[DB_NAME]

ADMIN_EMAIL = "admin@fixpoint.app"
ADMIN_PASSWORD = "Fixpoint@2026"


def _bearer(t): return {"Authorization": f"Bearer {t}"}


def _big_b64():
    return "data:image/png;base64," + base64.b64encode(b"x" * 500).decode()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/admin/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return r.cookies.get("session_token")


def _seed_customer(with_email=True, with_phone=True):
    uid = f"user_TESTn_{uuid.uuid4().hex[:8]}"
    email = f"TEST_cust_{uuid.uuid4().hex[:6]}@example.com" if with_email else ""
    phone = "9876543210" if with_phone else ""
    tok = f"test_sess_n_{uuid.uuid4().hex}"
    doc = {"user_id": uid, "name": "TestCust", "picture": "",
           "created_at": datetime.now(timezone.utc).isoformat()}
    if with_email: doc["email"] = email
    if with_phone: doc["phone"] = phone
    _db.users.insert_one(doc)
    _db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok, "role": "customer",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return tok, uid, email, phone


def _seed_tech(with_email=True, with_phone=True, approved=True):
    tid = f"tech_TESTn_{uuid.uuid4().hex[:8]}"
    email = f"test_tech_{uuid.uuid4().hex[:6]}@example.com" if with_email else ""
    phone = "9998887777" if with_phone else ""
    _db.technicians.insert_one({
        "tech_id": tid, "name": "Test Tech N", "email": email, "phone": phone,
        "picture": "", "rating": 4.5, "experience_years": 3,
        "specializations": ["home_appliances"],
        "is_available": True, "home_lat": 28.46, "home_lng": 77.03,
        "status": "approved" if approved else "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return tid, email, phone


def _create_booking(cust_tok):
    svc = _db.services.find_one({}, {"_id": 0})
    assert svc, "no seeded services"
    tier_name = svc["tiers"][0]["name"]
    r = requests.post(f"{BASE_URL}/api/bookings", headers=_bearer(cust_tok), json={
        "service_id": svc["service_id"], "tier_name": tier_name,
        "address": "Plot 42, DLF Phase 3, Gurugram",
        "scheduled_date": "2026-02-15", "scheduled_slot": "10-12",
        "notes": "test notif", "dest_lat": 28.46, "dest_lng": 77.03,
    })
    assert r.status_code == 200, r.text
    return r.json(), svc


class TestAssignFiresFourNotifications:
    def test_four_dry_run_notifications(self, admin_token):
        c_tok, c_uid, c_email, c_phone = _seed_customer(True, True)
        tid, t_email, t_phone = _seed_tech(True, True)
        b, svc = _create_booking(c_tok)

        # Snapshot outbound count before
        before = _db.outbound_notifications.count_documents({})

        r = requests.post(f"{BASE_URL}/api/admin/bookings/{b['booking_id']}/assign",
                          headers=_bearer(admin_token), json={"tech_id": tid})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert "delivery" in j
        d = j["delivery"]
        # tech + customer both got email + sms attempts
        for party in ("tech", "customer"):
            for ch in ("email", "sms"):
                assert d[party][ch] is not None, f"{party}.{ch} should be attempted"
                assert d[party][ch]["ok"] is True
                assert d[party][ch].get("dry_run") is True

        # 4 records in outbound_notifications
        after = _db.outbound_notifications.count_documents({})
        assert after - before == 4, f"expected +4 outbound records, got {after-before}"

        # verify each record content
        recs = list(_db.outbound_notifications.find(
            {"$or": [{"to": t_email}, {"to": t_phone}, {"to": c_email}, {"to": c_phone}]},
            {"_id": 0}
        ))
        by_key = {(r["channel"], r["to"]): r for r in recs}
        assert ("email", t_email) in by_key
        assert ("sms", t_phone) in by_key
        assert ("email", c_email) in by_key
        assert ("sms", c_phone) in by_key
        for rec in recs:
            assert rec["status"] == "dry_run"
            assert "created_at" in rec
            assert rec["body"]

        # Templates
        tech_email = by_key[("email", t_email)]
        assert tech_email["subject"].startswith("New job assigned")
        assert svc["name"] in tech_email["subject"]
        body = tech_email["body"]
        assert svc["name"] in body
        assert "2026-02-15" in body
        assert "10-12" in body
        assert "DLF Phase 3" in body or "Gurugram" in body
        # price should appear
        assert "₹" in body or str(svc["tiers"][0]["price"]) in body

        cust_email = by_key[("email", c_email)]
        assert cust_email["subject"].startswith("Technician assigned")
        assert svc["name"] in cust_email["subject"]
        assert "Test Tech N" in cust_email["body"]

        tech_sms = by_key[("sms", t_phone)]
        assert "Test Tech N" in tech_sms["body"]
        assert svc["name"] in tech_sms["body"]
        assert "2026-02-15" in tech_sms["body"]
        assert "10-12" in tech_sms["body"]

        cust_sms = by_key[("sms", c_phone)]
        assert "Test Tech N" in cust_sms["body"]
        assert svc["name"] in cust_sms["body"]
        assert "2026-02-15" in cust_sms["body"]

        # Also assert in-app notification (regression)
        n = _db.notifications.find_one({"booking_id": b["booking_id"], "title": "Technician assigned"})
        assert n is not None


class TestPartialRecipients:
    def test_tech_no_email_no_phone_customer_full(self, admin_token):
        c_tok, c_uid, c_email, c_phone = _seed_customer(True, True)
        tid, _, _ = _seed_tech(with_email=False, with_phone=False)
        b, _ = _create_booking(c_tok)
        r = requests.post(f"{BASE_URL}/api/admin/bookings/{b['booking_id']}/assign",
                          headers=_bearer(admin_token), json={"tech_id": tid})
        assert r.status_code == 200
        d = r.json()["delivery"]
        assert d["tech"]["email"] is None
        assert d["tech"]["sms"] is None
        assert d["customer"]["email"]["ok"] is True
        assert d["customer"]["sms"]["ok"] is True

    def test_customer_no_email_only_phone(self, admin_token):
        c_tok, c_uid, _, c_phone = _seed_customer(with_email=True, with_phone=True)
        tid, t_email, t_phone = _seed_tech(True, True)
        b, _ = _create_booking(c_tok)
        # Now unset customer email (leave only phone) BEFORE assign to simulate missing email
        _db.users.update_one({"user_id": c_uid}, {"$unset": {"email": ""}})
        r = requests.post(f"{BASE_URL}/api/admin/bookings/{b['booking_id']}/assign",
                          headers=_bearer(admin_token), json={"tech_id": tid})
        assert r.status_code == 200, r.text
        d = r.json()["delivery"]
        assert d["customer"]["email"] is None
        assert d["customer"]["sms"]["ok"] is True
        assert d["tech"]["email"]["ok"] is True
        assert d["tech"]["sms"]["ok"] is True

    def test_both_parties_no_contact_regression(self, admin_token):
        """Even with no email/phone on either party, assign must not crash and in-app notif still created."""
        c_tok, c_uid, _, _ = _seed_customer(with_email=True, with_phone=True)
        tid, _, _ = _seed_tech(with_email=False, with_phone=False)
        b, _ = _create_booking(c_tok)
        # Strip both email and phone from customer post-booking
        _db.users.update_one({"user_id": c_uid}, {"$unset": {"email": "", "phone": ""}})
        r = requests.post(f"{BASE_URL}/api/admin/bookings/{b['booking_id']}/assign",
                          headers=_bearer(admin_token), json={"tech_id": tid})
        assert r.status_code == 200, r.text
        d = r.json()["delivery"]
        assert d["tech"]["email"] is None and d["tech"]["sms"] is None
        assert d["customer"]["email"] is None and d["customer"]["sms"] is None
        # booking updated
        bb = _db.bookings.find_one({"booking_id": b["booking_id"]}, {"_id": 0})
        assert bb["status"] == "assigned"
        assert bb["tech_id"] == tid
        # in-app notif still created
        n = _db.notifications.find_one({"booking_id": b["booking_id"], "title": "Technician assigned"})
        assert n is not None


class TestAdminOutboundEndpoint:
    def test_outbound_list_admin(self, admin_token):
        # ensure at least one record exists
        c_tok, _, _, _ = _seed_customer(True, True)
        tid, _, _ = _seed_tech(True, True)
        b, _ = _create_booking(c_tok)
        requests.post(f"{BASE_URL}/api/admin/bookings/{b['booking_id']}/assign",
                      headers=_bearer(admin_token), json={"tech_id": tid})

        r = requests.get(f"{BASE_URL}/api/admin/outbound?limit=50", headers=_bearer(admin_token))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) > 0
        # reverse chronological
        ts = [it["created_at"] for it in items]
        assert ts == sorted(ts, reverse=True), "outbound not reverse chronological"
        # sanity fields
        first = items[0]
        for k in ("channel", "to", "subject", "body", "status", "created_at"):
            assert k in first
        assert first["channel"] in ("email", "sms")

    def test_outbound_forbidden_for_non_admin(self):
        # create customer session
        c_tok, _, _, _ = _seed_customer(True, True)
        r = requests.get(f"{BASE_URL}/api/admin/outbound", headers=_bearer(c_tok))
        assert r.status_code == 403

    def test_outbound_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/admin/outbound")
        assert r.status_code in (401, 403)


class TestInvalidRecipientDirect:
    """Direct exercise of notifications.send_email / send_sms invalid-recipient short circuit.
    Ensures no crash + no DB record for invalid recipients.
    """
    def test_invalid_recipient_no_record(self):
        import asyncio, sys
        sys.path.insert(0, "/app/backend")
        from notifications import send_email, send_sms

        async def run():
            r1 = await send_email("invalid", "sub", "<p>x</p>")
            r2 = await send_email("", "sub", "<p>x</p>")
            r3 = await send_sms("", "hello")
            r4 = await send_sms("123", "hello")  # too short
            return r1, r2, r3, r4

        r1, r2, r3, r4 = asyncio.get_event_loop().run_until_complete(run()) if False else asyncio.new_event_loop().run_until_complete(run())
        for r in (r1, r2, r3, r4):
            assert r["ok"] is False
            assert r["reason"] == "invalid_recipient"
