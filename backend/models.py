from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(50))
    password = Column(String(255), nullable=True)

    patient = relationship(
        "Patient",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    doctor = relationship(
        "Doctor",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    patient_uid = Column(String(50), unique=True, index=True)
    full_name = Column(String(100))
    mobile = Column(String(20), unique=True, index=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    allergies = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="patient")
    medical_records = relationship(
        "MedicalRecord",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    access_requests = relationship(
        "AccessRequest",
        back_populates="patient",
        cascade="all, delete-orphan",
    )


class Doctor(Base):
    __tablename__ = "doctors"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    full_name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    phone = Column(String(20), unique=True, index=True)
    hospital = Column(String(100))
    specialization = Column(String(100), nullable=True)
    medical_license_number = Column(String(100), unique=True, index=True)
    years_of_experience = Column(Integer, nullable=True)
    verification_document_url = Column(String(255), nullable=True)
    signature_image_url = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="doctor")
    access_requests = relationship(
        "AccessRequest",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, nullable=False)


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    record_type = Column(String(20), nullable=False)
    file_url = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    cleaned_text = Column(Text, nullable=True)
    detected_medicines = Column(Text, nullable=True)
    probable_conditions = Column(Text, nullable=True)
    ai_structured_data = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    ai_summary = Column(Text, nullable=True)
    
    # New AI pipeline fields
    document_type = Column(String(50), nullable=True)
    classification_confidence = Column(Float, nullable=True)
    classification_reason = Column(Text, nullable=True)
    ocr_quality_score = Column(Float, nullable=True)
    processing_time = Column(Float, nullable=True)
    ai_version = Column(String(20), nullable=True, default="v2.0")
    schema_validation_passed = Column(Boolean, nullable=True)
    validation_errors = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="medical_records")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.user_id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="access_requests")
    doctor = relationship("Doctor", back_populates="access_requests")


class MedicineMaster(Base):
    __tablename__ = "medicines_master"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    generic_name = Column(String(255), nullable=True)
    brand_name = Column(String(255), nullable=True)
    default_strength = Column(String(100), nullable=True)
    default_unit = Column(String(50), nullable=True)
    default_route = Column(String(100), nullable=True)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(String(50), unique=True, index=True, nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.user_id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    chief_complaint = Column(Text, nullable=True)
    clinical_findings = Column(Text, nullable=True)
    diagnosis = Column(Text, nullable=False)
    symptoms = Column(Text, nullable=False)
    doctor_advice = Column(Text, nullable=True)
    lifestyle_recommendations = Column(Text, nullable=True)
    follow_up_notes = Column(Text, nullable=True)
    follow_up_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    
    # Vitals Snapshots
    vitals_blood_pressure = Column(String(50), nullable=True)
    vitals_heart_rate = Column(Integer, nullable=True)
    vitals_temperature = Column(Float, nullable=True)
    vitals_sp02 = Column(Integer, nullable=True)
    vitals_height = Column(Float, nullable=True)
    vitals_weight = Column(Float, nullable=True)
    vitals_bmi = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    doctor = relationship("Doctor", foreign_keys=[doctor_id])
    patient = relationship("Patient", foreign_keys=[patient_id])
    medicines = relationship("PrescriptionMedicine", back_populates="prescription", cascade="all, delete-orphan")


class PrescriptionMedicine(Base):
    __tablename__ = "prescription_medicines"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_name = Column(String(255), nullable=False)
    strength = Column(String(100), nullable=False)
    unit = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    route = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)
    duration = Column(String(100), nullable=False)
    food_instruction = Column(String(100), nullable=False)
    special_instruction = Column(Text, nullable=True)

    prescription = relationship("Prescription", back_populates="medicines")


class PrescriptionActivity(Base):
    __tablename__ = "prescription_activities"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    actor_role = Column(String(50), nullable=False)
    actor_name = Column(String(100), nullable=False)


class PrescriptionAuditLog(Base):
    __tablename__ = "prescription_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    editor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
