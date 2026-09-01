from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base
from appointment_models import AuditMixin

class LabOrder(Base, AuditMixin):
    __tablename__ = 'lab_orders'

    id = Column(Integer, primary_key=True, index=True)
    order_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=True)
    doctor_id = Column(Integer, ForeignKey('doctors.user_id'), nullable=True)
    
    status = Column(String(50), nullable=False, default="Ordered") # Ordered, Collection, Processing, Verification, Completed, Cancelled
    priority = Column(String(50), nullable=False, default="Routine") # Routine, Urgent, STAT
    notes = Column(Text, nullable=True)
    
    items = relationship('LabOrderItem', back_populates='order', cascade='all, delete-orphan')
    collection = relationship('SampleCollection', back_populates='order', uselist=False, cascade='all, delete-orphan')
    verification = relationship('ResultVerification', back_populates='order', uselist=False, cascade='all, delete-orphan')

class LabOrderItem(Base, AuditMixin):
    __tablename__ = 'lab_order_items'
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('lab_orders.id'), nullable=False)
    
    category = Column(String(100), nullable=False) # e.g., Biochemistry, Hematology
    test_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="Ordered")
    
    order = relationship('LabOrder', back_populates='items')
    results = relationship('LabResult', back_populates='item', cascade='all, delete-orphan')

class SampleCollection(Base, AuditMixin):
    __tablename__ = 'sample_collections'
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('lab_orders.id'), unique=True, nullable=False)
    
    collection_time = Column(DateTime, nullable=True)
    technician_id = Column(Integer, nullable=True) # ForeignKey to Users
    sample_type = Column(String(100), nullable=False)
    barcode = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="Pending") # Pending, Collected, Received
    
    order = relationship('LabOrder', back_populates='collection')

class LabResult(Base, AuditMixin):
    __tablename__ = 'lab_results'
    
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey('lab_order_items.id'), nullable=False)
    
    parameter_name = Column(String(255), nullable=False)
    value = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=True)
    reference_range = Column(String(100), nullable=True)
    flag = Column(String(50), nullable=True) # Normal, High, Low, Critical
    remarks = Column(Text, nullable=True)
    
    item = relationship('LabOrderItem', back_populates='results')

class ResultVerification(Base, AuditMixin):
    __tablename__ = 'result_verifications'
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey('lab_orders.id'), unique=True, nullable=False)
    
    verified_by_id = Column(Integer, nullable=False) # ForeignKey to Users
    verified_time = Column(DateTime, nullable=False, default=func.now())
    comments = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="Verified") # Verified, Rejected
    
    order = relationship('LabOrder', back_populates='verification')
