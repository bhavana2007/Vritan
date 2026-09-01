from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base
from appointment_models import AuditMixin

class Notification(Base, AuditMixin):
    __tablename__ = 'notifications'

    id = Column(Integer, primary_key=True, index=True)
    notification_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    recipient_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_role = Column(String(50), nullable=True) # e.g. 'patient', 'doctor', 'pharmacist'
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    priority = Column(String(50), nullable=False, default="Normal") # Critical, High, Normal, Low
    category = Column(String(50), nullable=False) # Appointment, Pharmacy, Laboratory, AI, Admin, System
    type = Column(String(50), nullable=False, default="info") # info, success, warning, danger
    is_read = Column(Boolean, default=False, nullable=False)
    
    source_module = Column(String(100), nullable=True)
    entity_uid = Column(String(100), nullable=True) # ID of the related object
    action_url = Column(String(255), nullable=True) # Deep link to action
    
    channels_supported = Column(JSON, nullable=False, default=list) # e.g. ["in-app", "email", "sms"]
    read_at = Column(DateTime, nullable=True)
    
    user = relationship("User", foreign_keys=[user_id])

class NotificationPreference(Base, AuditMixin):
    __tablename__ = 'notification_preferences'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=False)
    
    # Categories
    alerts_appointment = Column(Boolean, default=True)
    alerts_pharmacy = Column(Boolean, default=True)
    alerts_laboratory = Column(Boolean, default=True)
    alerts_ai = Column(Boolean, default=True)
    alerts_admin = Column(Boolean, default=True)
    
    # Channels
    channel_in_app = Column(Boolean, default=True)
    channel_email = Column(Boolean, default=False)
    channel_sms = Column(Boolean, default=False)
    
    quiet_hours_start = Column(String(5), nullable=True) # HH:MM
    quiet_hours_end = Column(String(5), nullable=True) # HH:MM
