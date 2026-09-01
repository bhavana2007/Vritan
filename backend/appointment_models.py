from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from database import Base

class AuditMixin:
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)








class DoctorProfile(Base, AuditMixin):
    __tablename__ = 'doctor_profiles'

    id = Column(Integer, primary_key=True, index=True)
    doctor_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    doctor_id = Column(Integer, ForeignKey('doctors.user_id'), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    consultation_fee = Column(Float, nullable=True, default=0.0)
    languages = Column(String(255), nullable=True)
    qualification = Column(String(255), nullable=True)
    rating = Column(Float, nullable=True, default=0.0)
    buffer_minutes = Column(Integer, default=0, nullable=False)
    max_appointments_per_day = Column(Integer, default=20, nullable=False)
    advance_booking_window_days = Column(Integer, default=30, nullable=False)
    cancellation_notice_hours = Column(Integer, default=24, nullable=False)
    
    doctor = relationship('Doctor', foreign_keys=[doctor_id])
    department = relationship('Department')


class DoctorAvailability(Base, AuditMixin):
    __tablename__ = 'doctor_availabilities'

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey('doctors.user_id'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    day_of_week = Column(Integer, nullable=False) # 0=Monday, 6=Sunday
    start_time = Column(String(5), nullable=False) # HH:MM
    end_time = Column(String(5), nullable=False) # HH:MM
    slot_duration_minutes = Column(Integer, default=30)


class DoctorAvailabilityException(Base, AuditMixin):
    __tablename__ = 'doctor_availability_exceptions'
    
    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey('doctors.user_id'), nullable=False)
    exception_date = Column(Date, nullable=False)
    exception_type = Column(String(50), nullable=False) # Holiday, Emergency Leave, Temporary Block, Special Clinic
    start_time = Column(String(5), nullable=True)
    end_time = Column(String(5), nullable=True)
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurrence_pattern = Column(String(100), nullable=True)


class AppointmentSlot(Base, AuditMixin):
    __tablename__ = 'appointment_slots'

    id = Column(Integer, primary_key=True, index=True)
    slot_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    doctor_id = Column(Integer, ForeignKey('doctors.user_id'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    date = Column(Date, nullable=False)
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)
    status = Column(String(20), nullable=False, default="AVAILABLE") # AVAILABLE, LOCKED, BOOKED


class AppointmentSlotLock(Base):
    __tablename__ = 'appointment_slot_locks'
    
    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey('appointment_slots.id'), unique=True, nullable=False)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    locked_at = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False) # Usually locked_at + 5 mins


class Appointment(Base, AuditMixin):
    __tablename__ = 'appointments'

    id = Column(Integer, primary_key=True, index=True)
    appointment_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    token_number = Column(String(50), nullable=True)
    
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    doctor_id = Column(Integer, ForeignKey('doctors.user_id'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    slot_id = Column(Integer, ForeignKey('appointment_slots.id'), nullable=False)
    
    appointment_type = Column(String(50), nullable=False, default="Physical") # Physical, Telemedicine, Home Visit
    consultation_mode = Column(String(50), nullable=False, default="Offline") # Offline, Video, Audio
    meeting_link = Column(String(255), nullable=True)
    
    # ABDM Future Proofing
    abha_id = Column(String(50), nullable=True)
    consent_id = Column(String(50), nullable=True)
    ehr_reference = Column(String(255), nullable=True)
    
    payment_status = Column(String(50), nullable=True, default='Unpaid')
    insurance_status = Column(String(50), nullable=True, default='N/A')
    
    status = Column(String(50), nullable=False, default='Requested') # Requested, Confirmed, Checked-In, Waiting, Consultation Started, Prescription Generated, Lab Tests Ordered, Completed, Cancelled, Rescheduled, Missed
    completed_at = Column(DateTime, nullable=True)
    
    patient = relationship('Patient', foreign_keys=[patient_id])
    doctor = relationship('Doctor', foreign_keys=[doctor_id])
    branch = relationship('Branch', foreign_keys=[branch_id])
    department = relationship('Department', foreign_keys=[department_id])


class AppointmentHistory(Base):
    __tablename__ = 'appointment_histories'
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=False)
    status = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    changed_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    changed_at = Column(DateTime, server_default=func.now())


class MedicalTimelineEvent(Base, AuditMixin):
    __tablename__ = 'medical_timeline_events'
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=True)
    event_type = Column(String(100), nullable=False) # e.g., APPOINTMENT_COMPLETED, LAB_RESULT_ADDED
    event_data = Column(Text, nullable=True) # JSON string
    event_date = Column(DateTime, server_default=func.now())


class AIAnalysisCache(Base, AuditMixin):
    __tablename__ = 'ai_analysis_caches'
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey('patients.id'), nullable=False)
    analysis_type = Column(String(100), nullable=False) # e.g., PATIENT_SUMMARY
    structured_data = Column(Text, nullable=False) # JSON string
    expires_at = Column(DateTime, nullable=True)


class FollowUp(Base, AuditMixin):
    __tablename__ = 'follow_ups'

    id = Column(Integer, primary_key=True, index=True)
    parent_appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=False)
    recommended_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default='Pending') # Pending, Scheduled, Cancelled
