from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Notification, User as UserModel
from schemas import NotificationResponse
from security import decode_access_token, InvalidTokenError

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get_current_user_id(authorization: str | None = Header(default=None)) -> int:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        return int(payload.get("sub", ""))
    except (InvalidTokenError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


@router.get("/unread")
def get_unread_notifications(
    user_id: int = Depends(_get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get unread count and latest unread items for the bell dropdown.
    """
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .order_by(Notification.created_at.desc())
        .all()
    )
    
    return {
        "data": {
            "count": len(unread),
            "latest": [
                {
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "priority": n.priority,
                    "category": n.category,
                    "type": n.type,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                    "action_url": n.action_url
                }
                for n in unread[:5]
            ]
        }
    }


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    user_id: int = Depends(_get_current_user_id),
    db: Session = Depends(get_db)
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return notifications


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user_id: int = Depends(_get_current_user_id),
    db: Session = Depends(get_db)
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.post("/read-all")
def mark_all_read(
    user_id: int = Depends(_get_current_user_id),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All marked as read"}
