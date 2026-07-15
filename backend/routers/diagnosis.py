"""Gemini AI diagnosis: single-shot + streaming SSE."""
import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import uuid
import json
import asyncio
import logging

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
except ModuleNotFoundError:
    LlmChat = UserMessage = ImageContent = None

from deps import (
    db, EMERGENT_LLM_KEY, ALLOWED_LANGUAGES, COST_BANDS,
    strip_data_url, extract_json,
    Diagnosis, DiagnosisRequest, LiveDiagnosisRequest,
    User, get_current_user,
)

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])
logger = logging.getLogger("fixpoint.diagnosis")

# Test-mode kill switch: when false, endpoints return a canned mock diagnosis
# so credits are NOT debited from the Emergent Universal Key. Flip to "true"
# once a dedicated Google/Gemini key is wired up.
AI_ENABLED = os.environ.get("AI_DIAGNOSIS_ENABLED", "true").lower() == "true"

_MOCK_BY_CAT = {
    "home_appliances": {
        "issue_summary": "Sample diagnosis — appliance likely needs a service check",
        "detected_problems": [
            "Possible worn-out component",
            "Reduced performance vs. new condition",
            "Inspection recommended by a technician",
        ],
        "severity": "medium",
        "recommended_service": "General appliance inspection",
        "ai_notes": "This is a sample diagnosis returned in test mode — no AI call was made. Book a technician for an on-site inspection to get an accurate assessment.",
    },
    "bike": {
        "issue_summary": "Sample diagnosis — bike servicing recommended",
        "detected_problems": ["Chain tension check", "Brake pad wear", "General tune-up due"],
        "severity": "medium",
        "recommended_service": "Bike general service",
        "ai_notes": "Test-mode sample. Book a bike technician for a real doorstep check.",
    },
    "car": {
        "issue_summary": "Sample diagnosis — car needs on-site inspection",
        "detected_problems": ["Battery health check", "Fluid levels", "Tyre wear"],
        "severity": "medium",
        "recommended_service": "Car doorstep inspection",
        "ai_notes": "Test-mode sample. A technician can do a real diagnostic at your address.",
    },
    "installation": {
        "issue_summary": "Sample diagnosis — installation recommended",
        "detected_problems": ["Mounting compatibility check", "Wiring/plumbing setup", "Space alignment"],
        "severity": "low",
        "recommended_service": "Doorstep installation",
        "ai_notes": "Test-mode sample. Book an installer to complete the setup.",
    },
}


def _mock_parsed(category: str):
    return dict(_MOCK_BY_CAT.get(category, _MOCK_BY_CAT["home_appliances"]))


def _cat_label(cat: str) -> str:
    return {
        "home_appliances": "home appliance",
        "bike": "motorcycle/bike",
        "car": "car",
        "installation": "appliance installation",
    }.get(cat, "device")


def _validate_language(lang: str) -> str:
    if lang not in ALLOWED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Language '{lang}' not supported. Allowed: {sorted(ALLOWED_LANGUAGES)}",
        )
    return lang


@router.post("")
async def create_diagnosis(payload: DiagnosisRequest, user: User = Depends(get_current_user)):
    language = _validate_language(payload.language)
    raw_b64 = strip_data_url(payload.image_base64)

    if not AI_ENABLED:
        # Test mode: skip Gemini entirely so no credits are debited.
        logger.info("AI_DIAGNOSIS_ENABLED=false — returning mock diagnosis (no credits used)")
        parsed = _mock_parsed(payload.category)
        parsed["test_mode"] = True
    else:
        if not EMERGENT_LLM_KEY or LlmChat is None:
            raise HTTPException(status_code=503, detail="LLM service not configured")

        cat_label = _cat_label(payload.category)
        system_msg = (
            "You are FixPoint AI, a doorstep repair diagnostic assistant. "
            "You analyze photos of broken or malfunctioning items and produce a structured diagnosis. "
            f"Reply in this language for issue_summary, ai_notes, and recommended_service: {language}. "
            "Keep field keys and severity value in English. "
            "Always respond with a single JSON object matching this schema exactly, no prose outside JSON:\n"
            "{\n"
            '  "issue_summary": "one sentence problem headline",\n'
            '  "detected_problems": ["problem 1", "problem 2"],\n'
            '  "severity": "low|medium|high",\n'
            '  "recommended_service": "specific service or replacement",\n'
            '  "ai_notes": "friendly 2-3 sentence explanation for the customer"\n'
            "}"
        )
        prompt = (
            f"Category: {cat_label}. User note: {payload.user_note or 'None'}. "
            "Inspect the image and diagnose the likely issue. If image is unclear, guess based on category and note. "
            "Return ONLY JSON."
        )

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"diag_{uuid.uuid4().hex[:8]}",
            system_message=system_msg,
        ).with_model("gemini", "gemini-3-flash-preview")

        um = UserMessage(text=prompt, file_contents=[ImageContent(image_base64=raw_b64)])
        try:
            response_text = await chat.send_message(um)
        except Exception as e:
            logger.exception("Gemini call failed")
            raise HTTPException(status_code=502, detail=f"AI service error: {str(e)[:120]}")

        parsed = extract_json(response_text) or {
            "issue_summary": "Unable to fully parse issue",
            "detected_problems": ["Needs on-site inspection"],
            "severity": "medium",
            "recommended_service": f"{_cat_label(payload.category)} inspection",
            "ai_notes": response_text[:280] if response_text else "AI could not extract details.",
        }

    severity = (parsed.get("severity") or "medium").lower()
    if severity not in COST_BANDS:
        severity = "medium"
    cmin, cmax = COST_BANDS[severity]

    thumb = f"data:image/jpeg;base64,{raw_b64[:12000]}"
    d = Diagnosis(
        diagnosis_id=f"dx_{uuid.uuid4().hex[:12]}",
        user_id=user.user_id,
        category=payload.category,
        issue_summary=parsed.get("issue_summary", "Issue detected"),
        detected_problems=parsed.get("detected_problems", []),
        severity=severity,
        estimated_cost_min=cmin,
        estimated_cost_max=cmax,
        recommended_service=parsed.get("recommended_service", ""),
        ai_notes=parsed.get("ai_notes", ""),
        image_thumb=thumb,
        language=language,
    )
    doc = d.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["test_mode"] = parsed.get("test_mode", False)
    await db.diagnoses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_diagnoses(user: User = Depends(get_current_user)):
    return await db.diagnoses.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)


@router.get("/{diagnosis_id}")
async def get_diagnosis(diagnosis_id: str, user: User = Depends(get_current_user)):
    d = await db.diagnoses.find_one(
        {"diagnosis_id": diagnosis_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not d:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return d


@router.post("/stream")
async def diagnosis_stream(payload: LiveDiagnosisRequest, user: User = Depends(get_current_user)):
    language = _validate_language(payload.language)

    # Test mode: emit a canned stream so UX still works, but no credits used.
    if not AI_ENABLED:
        logger.info("AI_DIAGNOSIS_ENABLED=false — returning mock live stream (no credits used)")
        mock_text = (
            "Test mode is on — no live AI call was made. "
            "Turn on AI_DIAGNOSIS_ENABLED once your Google/Gemini key is wired up to get real guidance."
        )

        async def mock_generator():
            for tok in mock_text.split(" "):
                yield f"data: {json.dumps({'token': tok + ' '})}\n\n"
                await asyncio.sleep(0.03)
            yield f"data: {json.dumps({'done': True})}\n\n"

        return StreamingResponse(
            mock_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    if not EMERGENT_LLM_KEY or LlmChat is None:
        raise HTTPException(status_code=503, detail="LLM service not configured")

    cat_label = _cat_label(payload.category)
    user_msg_text = payload.message or "What do you see? Guide me on next steps."
    system_msg = (
        f"You are FixPoint Live, a real-time repair guide for {cat_label}s. "
        "The user is showing you a live photo. Speak briefly, warmly, in 1-3 sentences. "
        "Ask for the next angle/action ('turn it on', 'show me the back panel', etc.) or state the likely issue. "
        f"Respond in this language: {language}. "
        "Do NOT return JSON. Speak naturally."
    )
    raw_b64 = strip_data_url(payload.image_base64)

    async def event_generator():
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"live_{uuid.uuid4().hex[:8]}",
            system_message=system_msg,
        ).with_model("gemini", "gemini-3-flash-preview")
        um = UserMessage(text=user_msg_text, file_contents=[ImageContent(image_base64=raw_b64)])
        try:
            from emergentintegrations.llm.chat import TextDelta, StreamDone  # type: ignore
            async for ev in chat.stream_message(um):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'token': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception:
            logger.exception("Live stream failed, falling back to send_message")
            try:
                text = await chat.send_message(um)
                yield f"data: {json.dumps({'token': text})}\n\n"
            except Exception as e2:
                yield f"data: {json.dumps({'error': str(e2)[:120]})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
