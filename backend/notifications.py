"""Notification channels: Email (SendGrid) + SMS (Twilio).

Both channels gracefully DRY-RUN when their API keys are absent:
- The rendered payload is logged to the backend logger
- A dry-run record is inserted in db.outbound_notifications so admin can inspect what would have gone out

Flip on real sends by pasting keys into .env and restarting the backend.
No code changes required.
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional
import asyncio

from deps import db

logger = logging.getLogger("fixpoint.notifications")


def _env_email():
    return {
        "api_key": os.environ.get("SENDGRID_API_KEY", "").strip(),
        "sender": os.environ.get("SENDER_EMAIL", "notifications@fixpoint.app").strip(),
        "sender_name": os.environ.get("SENDER_NAME", "FixPoint").strip(),
    }


def _env_sms():
    return {
        "sid":   os.environ.get("TWILIO_ACCOUNT_SID", "").strip(),
        "token": os.environ.get("TWILIO_AUTH_TOKEN", "").strip(),
        "from":  os.environ.get("TWILIO_FROM_NUMBER", "").strip(),
    }


def _sync_send_email(api_key: str, sender: str, sender_name: str, to: str, subject: str, html: str) -> tuple[bool, str]:
    """Blocking SendGrid call. Wrapped in asyncio.to_thread in async caller."""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, From
        message = Mail(
            from_email=From(sender, sender_name),
            to_emails=to,
            subject=subject,
            html_content=html,
        )
        sg = SendGridAPIClient(api_key)
        resp = sg.send(message)
        return (200 <= resp.status_code < 300, f"http_{resp.status_code}")
    except Exception as e:
        return (False, str(e)[:180])


def _sync_send_sms(sid: str, token: str, from_num: str, to: str, body: str) -> tuple[bool, str]:
    """Blocking Twilio call. Wrapped in asyncio.to_thread in async caller."""
    try:
        from twilio.rest import Client
        client = Client(sid, token)
        m = client.messages.create(from_=from_num, to=to, body=body)
        return (True, m.sid)
    except Exception as e:
        return (False, str(e)[:180])


async def _record(channel: str, to: str, subject: str, body: str, status: str, provider_id: str = ""):
    await db.outbound_notifications.insert_one({
        "channel": channel,     # email | sms
        "to": to,
        "subject": subject,
        "body": body,
        "status": status,       # sent | dry_run | failed
        "provider_id": provider_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def send_email(to: str, subject: str, html: str, plain_fallback: str = "") -> dict:
    """Send an email, or DRY-RUN if SENDGRID_API_KEY is missing."""
    if not to or "@" not in to:
        return {"ok": False, "reason": "invalid_recipient"}

    cfg = _env_email()
    if not cfg["api_key"]:
        logger.info(f"[EMAIL DRY-RUN] to={to} subject={subject!r}\n{plain_fallback or html[:400]}")
        await _record("email", to, subject, plain_fallback or html, "dry_run")
        return {"ok": True, "dry_run": True}

    ok, info = await asyncio.to_thread(
        _sync_send_email, cfg["api_key"], cfg["sender"], cfg["sender_name"], to, subject, html,
    )
    status = "sent" if ok else "failed"
    logger.info(f"[EMAIL {status}] to={to} subject={subject!r} info={info}")
    await _record("email", to, subject, plain_fallback or html, status, info)
    return {"ok": ok, "provider": "sendgrid", "info": info}


async def send_sms(to: str, body: str) -> dict:
    """Send an SMS, or DRY-RUN if Twilio creds are missing."""
    if not to or len(to) < 6:
        return {"ok": False, "reason": "invalid_recipient"}

    cfg = _env_sms()
    if not (cfg["sid"] and cfg["token"] and cfg["from"]):
        logger.info(f"[SMS DRY-RUN] to={to}\n{body}")
        await _record("sms", to, "", body, "dry_run")
        return {"ok": True, "dry_run": True}

    ok, info = await asyncio.to_thread(
        _sync_send_sms, cfg["sid"], cfg["token"], cfg["from"], to, body,
    )
    status = "sent" if ok else "failed"
    logger.info(f"[SMS {status}] to={to} info={info}")
    await _record("sms", to, "", body, status, info)
    return {"ok": ok, "provider": "twilio", "info": info}


# ---------- Message templates ----------
def render_tech_assignment_email(tech_name: str, service_name: str, address: str, date: str, slot: str, price: int, customer_name: Optional[str] = None) -> tuple[str, str, str]:
    subject = f"New job assigned · {service_name}"
    html = f"""\
<div style="font-family:Arial,sans-serif;background:#05050A;color:#fff;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#121217;border:1px solid #222;border-radius:16px;padding:24px;">
    <div style="color:#39FF14;font-size:12px;letter-spacing:3px;text-transform:uppercase">FixPoint · New Job</div>
    <h2 style="margin:8px 0 16px;font-size:22px;">Hi {tech_name}, you've got a new job.</h2>
    <p style="color:#c0c0c8;line-height:1.55;">Our admin has assigned this job to you. Please open the FixPoint technician app to accept and start route.</p>
    <table style="width:100%;margin-top:16px;font-size:14px;">
      <tr><td style="color:#7d7d88;padding:4px 0;">Service</td><td style="text-align:right"><b>{service_name}</b></td></tr>
      <tr><td style="color:#7d7d88;padding:4px 0;">Date</td><td style="text-align:right">{date} · {slot}</td></tr>
      <tr><td style="color:#7d7d88;padding:4px 0;">Address</td><td style="text-align:right">{address[:80]}</td></tr>
      <tr><td style="color:#7d7d88;padding:4px 0;">Payout on service</td><td style="text-align:right;color:#39FF14;font-weight:bold;">₹{price}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#7d7d88;">Open the app → Technician → Accept · Start route.</p>
  </div>
</div>"""
    plain = (
        f"Hi {tech_name}, new FixPoint job assigned.\n"
        f"Service: {service_name}\nDate: {date} {slot}\nAddress: {address}\nPayout: ₹{price}\n"
        "Open the technician app to accept."
    )
    return subject, html, plain


def render_tech_assignment_sms(tech_name: str, service_name: str, date: str, slot: str, address: str, price: int) -> str:
    return (
        f"FixPoint: Hi {tech_name}, new job assigned — {service_name} on {date} {slot} "
        f"at {address[:40]}… (₹{price}). Open the app to accept."
    )


def render_customer_assignment_email(customer_name: str, tech_name: str, service_name: str, date: str, slot: str) -> tuple[str, str, str]:
    subject = f"Technician assigned · {service_name}"
    html = f"""\
<div style="font-family:Arial,sans-serif;background:#05050A;color:#fff;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#121217;border:1px solid #222;border-radius:16px;padding:24px;">
    <div style="color:#00E5FF;font-size:12px;letter-spacing:3px;text-transform:uppercase">FixPoint · Update</div>
    <h2 style="margin:8px 0 16px;font-size:22px;">Great news, {customer_name.split(' ')[0]}!</h2>
    <p style="color:#c0c0c8;line-height:1.55;"><b>{tech_name}</b> has been assigned to your {service_name} booking on {date} · {slot}. You'll get another update when they're on the way.</p>
    <p style="margin-top:20px;font-size:12px;color:#7d7d88;">Track live status in the FixPoint app under Bookings.</p>
  </div>
</div>"""
    plain = (
        f"FixPoint: {tech_name} has been assigned to your {service_name} booking on {date} {slot}. "
        "Track live in the app."
    )
    return subject, html, plain


def render_customer_assignment_sms(tech_name: str, service_name: str, date: str, slot: str) -> str:
    return f"FixPoint: {tech_name} is assigned to your {service_name} booking on {date} {slot}. Track live in the app."
