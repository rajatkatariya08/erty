"""In-app notifications."""
from fastapi import APIRouter, Depends

from deps import db, User, get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(user: User = Depends(get_current_user)):
    return await db.notifications.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)


@router.post("/read-all")
async def read_all(user: User = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user.user_id}, {"$set": {"read": True}})
    return {"ok": True}
