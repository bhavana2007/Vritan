from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base
from appointment_models import AuditMixin

class PharmacyOrder(Base, AuditMixin):
    __tablename__ = 'pharmacy_orders'

    id = Column(Integer, primary_key=True, index=True)
    order_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Internal Digital Prescription Links (Nullable for External)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)
    doctor_id = Column(Integer, ForeignKey('doctors.user_id'), nullable=True)
    
    # Manual / External Overrides
    source = Column(String(50), nullable=False, default="Digital") # "Digital" or "External"
    external_patient_name = Column(String(255), nullable=True)
    external_doctor_name = Column(String(255), nullable=True)
    external_hospital_name = Column(String(255), nullable=True)
    
    status = Column(String(50), nullable=False, default="Pending") # Pending, Verified, Preparing, Ready, Dispensed, Cancelled, Rejected, Expired
    
    notes = Column(Text, nullable=True)
    dispensed_at = Column(DateTime, nullable=True)
    
    items = relationship('PharmacyOrderItem', back_populates='order', cascade='all, delete-orphan')

class PharmacyOrderItem(Base, AuditMixin):
    __tablename__ = 'pharmacy_order_items'
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('pharmacy_orders.id'), nullable=False)
    
    medicine_name = Column(String(255), nullable=False)
    strength = Column(String(50), nullable=True)
    dosage = Column(String(100), nullable=True)
    frequency = Column(String(100), nullable=True)
    duration_days = Column(Integer, nullable=True)
    quantity_prescribed = Column(Integer, nullable=False, default=1)
    quantity_dispensed = Column(Integer, nullable=False, default=0)
    
    instructions = Column(Text, nullable=True)
    availability_status = Column(String(50), nullable=False, default="Available") # Available, Low Stock, Out of Stock
    
    order = relationship('PharmacyOrder', back_populates='items')

class Pharmacy(Base, AuditMixin):
    __tablename__ = 'pharmacies'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    pharmacy_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    vritan_id = Column(String(50), unique=True, index=True, nullable=True) # e.g. VR-PHAR-000001
    name = Column(String(255), nullable=False)
    drug_license_number = Column(String(100), unique=True, index=True, nullable=False)
    license_number = Column(String(100), nullable=True) # Legacy compatibility column
    gst_number = Column(String(50), nullable=True)
    owner_name = Column(String(255), nullable=True)
    owner_aadhaar_encrypted = Column(String(255), nullable=True)
    owner_pan_encrypted = Column(String(255), nullable=True)
    registered_pharmacist_name = Column(String(255), nullable=True)
    registered_pharmacist_license = Column(String(100), nullable=True)
    official_email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(255), nullable=True)
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    store_type = Column(String(100), default="Retail") # Retail, Hospital Attached, Chain, Online
    is_24x7 = Column(Boolean, default=False)
    home_delivery = Column(Boolean, default=False)
    operating_hours = Column(String(100), default="09:00 AM - 09:00 PM")
    logo_url = Column(String(255), nullable=True)
    verification_status = Column(String(50), default="PENDING_EMAIL_VERIFICATION", nullable=False) # PENDING_EMAIL_VERIFICATION, PENDING_ADMIN_VERIFICATION, VERIFIED, REJECTED, SUSPENDED
    drug_license_doc_url = Column(String(255), nullable=True)
    gst_doc_url = Column(String(255), nullable=True)
    owner_id_doc_url = Column(String(255), nullable=True)
    pharmacist_license_doc_url = Column(String(255), nullable=True)
    store_image_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

