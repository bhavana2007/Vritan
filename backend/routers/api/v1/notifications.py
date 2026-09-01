from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import User
from security import get_current_user
from utils.responses import success_response, error_response
from notification_models import Notification, NotificationPreference

router = APIRouter(prefix="/api/v1", tags=["Notifications"])

@router.get("/notifications")
def get_notifications(
    category: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all notifications for the current user.
    """
    query = db.query(Notification).filter(Notification.recipient_user_id == current_user.id)
    if category and category != "All":
        query = query.filter(Notification.category == category)
        
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return success_response({"items": notifications}, "Notifications retrieved.")

@router.get("/notifications/unread")
def get_unread_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get unread count and latest unread items for the bell dropdown.
    """
    unread = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.read_at.is_(None)
    ).order_by(Notification.created_at.desc()).all()
    
    return success_response({
        "count": len(unread),
        "latest": unread[:5]
    }, "Unread retrieved.")

@router.put("/notifications/{notification_uid}/read")
def mark_notification_read(
    notification_uid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a specific notification as read.
    """
    notif = db.query(Notification).filter(
        Notification.notification_uid == notification_uid,
        Notification.recipient_user_id == current_user.id
    ).first()
    
    if not notif:
        return error_response("Notification not found", "NOT_FOUND", 404)
        
    notif.read_at = datetime.utcnow()
    db.commit()
    return success_response(None, "Marked as read.")

@router.put("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications as read.
    """
    db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.read_at.is_(None)
    ).update({"read_at": datetime.utcnow()})
    db.commit()
    return success_response(None, "All marked as read.")

class PrefUpdate(BaseModel):
    alerts_appointment: bool
    alerts_pharmacy: bool
    alerts_laboratory: bool
    alerts_ai: bool
    alerts_admin: bool
    channel_in_app: bool
    channel_email: bool
    channel_sms: bool

@router.get("/notification-preferences")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return success_response(pref, "Preferences retrieved.")

@router.put("/notification-preferences")
def update_preferences(
    req: PrefUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pref = db.query(NotificationPreference).filter(NotificationPreference.user_id == current_user.id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)
    
    for key, val in req.model_dump().items():
        setattr(pref, key, val)
        
    db.commit()
    return success_response(pref, "Preferences updated.")
