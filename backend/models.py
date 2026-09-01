from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


import enum

class VerificationState(str, enum.Enum):
    PENDING_EMAIL_VERIFICATION = "PENDING_EMAIL_VERIFICATION"
    PENDING_ADMIN_APPROVAL = "PENDING_ADMIN_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(50))
    password = Column(String(255), nullable=True)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)
    email = Column(String(255), nullable=True)
    vritan_id = Column(String(50), unique=True, index=True, nullable=True)
    verification_status = Column(String(50), default=VerificationState.PENDING_EMAIL_VERIFICATION.value, nullable=True)

    patients = relationship(
        "Patient",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    doctor = relationship(
        "Doctor",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def patient(self):
        """Backward compat: returns primary/first patient profile."""
        if not self.patients:
            return None
        primary = next((p for p in self.patients if p.is_primary), None)
        return primary or self.patients[0]


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_primary = Column(Boolean, default=True)
    relationship_to_account = Column(String(50), default="Self")
    patient_uid = Column(String(50), unique=True, index=True)
    firebase_uid = Column(String(128), unique=True, index=True, nullable=True)
    full_name = Column(String(100))
    mobile = Column(String(20), unique=True, index=True, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    email = Column(String(255), nullable=True)
    pin_code = Column(String(20), nullable=True)
    country = Column(String(100), default="India")
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    mandal = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    municipality = Column(String(100), nullable=True)
    urban_rural = Column(String(20), nullable=True)
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    emergency_contact_relationship = Column(String(50), nullable=True)
    abha_id = Column(String(100), nullable=True)
    aadhaar_linked = Column(Boolean, default=False)
    consent_status = Column(Boolean, default=True)
    consent_terms = Column(Boolean, default=True)
    consent_privacy = Column(Boolean, default=True)
    consent_medical_storage = Column(Boolean, default=True)
    consent_analytics = Column(Boolean, default=True)
    consent_research = Column(Boolean, default=False)
    consent_marketing = Column(Boolean, default=False)
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    allergies = Column(Text, nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    aadhaar_number = Column(String(50), nullable=True)
    insurance_provider = Column(String(100), nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="patients")
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
    vritan_id = Column(String(50), unique=True, index=True, nullable=True) # e.g. VR-DOC-000123
    full_name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    phone = Column(String(20), unique=True, index=True)
    hospital = Column(String(100), nullable=True)
    hospital_vritan_id = Column(String(50), index=True, nullable=True) # Scenario 1
    unregistered_hospital_name = Column(String(255), nullable=True) # Scenario 2
    unregistered_hospital_address = Column(Text, nullable=True) # Scenario 2
    hospital_registered = Column(Boolean, default=True, nullable=False)
    practice_type = Column(String(100), nullable=True, default="Hospital / Healthcare Organization")
    clinic_name = Column(String(255), nullable=True)
    qualification = Column(String(255), nullable=True)
    registration_council = Column(String(255), nullable=True)
    specialization = Column(String(100), nullable=True)
    secondary_specialization = Column(String(100), nullable=True)
    languages_spoken = Column(Text, nullable=True)
    clinic_address = Column(Text, nullable=True)
    clinic_pin_code = Column(String(20), nullable=True)
    clinic_state = Column(String(100), nullable=True)
    clinic_district = Column(String(100), nullable=True)
    clinic_mandal = Column(String(100), nullable=True)
    clinic_city = Column(String(100), nullable=True)
    consultation_modes = Column(String(100), nullable=True)
    medical_license_number = Column(String(100), unique=True, index=True)
    years_of_experience = Column(Integer, nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    verification_document_url = Column(String(255), nullable=True)
    identity_proof_url = Column(String(255), nullable=True)
    degree_certificates_url = Column(String(255), nullable=True)
    signature_image_url = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_status = Column(String(50), default="PENDING_EMAIL_VERIFICATION", nullable=False)
    email_notifications = Column(Boolean, default=True, nullable=False)
    prescription_alerts = Column(Boolean, default=True, nullable=False)
    access_requests = Column(Boolean, default=True, nullable=False)
    profile_visibility = Column(String(50), default="public", nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="doctor")
    access_requests = relationship(
        "AccessRequest",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(128), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    attempt_count = Column(Integer, default=0, nullable=False)
    token_type = Column(String(50), default="LINK", nullable=False)


class GovernmentAuthority(Base):
    __tablename__ = "government_authorities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    authority_uid = Column(String(50), unique=True, index=True, nullable=True)
    vritan_id = Column(String(50), unique=True, index=True, nullable=True) # VR-GOV-000001
    agency_name = Column(String(255), nullable=False)
    authority_level = Column(String(50), default="National") # National, State, District
    country = Column(String(100), default="India")
    jurisdiction_level = Column(String(50), default="National")
    jurisdiction_region = Column(String(100), default="India")
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    office_address = Column(Text, nullable=True)
    official_email = Column(String(255), unique=True, index=True, nullable=False)
    official_phone = Column(String(50), nullable=True)
    department_head = Column(String(255), nullable=True)
    authorized_officer_name = Column(String(255), nullable=False)
    officer_name = Column(String(255), nullable=True)
    designation = Column(String(255), nullable=False)
    gov_employee_id = Column(String(100), nullable=True)
    gov_id_card_url = Column(String(255), nullable=True)
    gov_authorization_letter_url = Column(String(255), nullable=True)
    digital_signature_cert_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_status = Column(String(50), default="PENDING_EMAIL_VERIFICATION", nullable=False) # PENDING_EMAIL_VERIFICATION, PENDING_ADMIN_VERIFICATION, VERIFIED, REJECTED, SUSPENDED
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    is_active = Column(Boolean, default=True, nullable=False)


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    record_type = Column(String(20), nullable=False)
    file_url = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
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
    component_confidence = Column(Text, nullable=True)
    ai_status = Column(String(50), nullable=True)
    document_title = Column(String(255), nullable=True)
    condition = Column(String(255), nullable=True)
    condition_status = Column(String(50), nullable=True)
    
    laboratory_id = Column(Integer, ForeignKey("laboratories.id"), nullable=True)
    technician_id = Column(Integer, ForeignKey("lab_technicians.id"), nullable=True)
    verification_status = Column(String(50), nullable=True)

    patient = relationship("Patient", back_populates="medical_records")
    laboratory = relationship("Laboratory", back_populates="medical_records")
    technician = relationship("LabTechnician", back_populates="medical_records")
    verifications = relationship("PrescriptionVerification", back_populates="medical_record", cascade="all, delete-orphan")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.user_id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="access_requests")
    doctor = relationship("Doctor", back_populates="access_requests")


class MedicineMaster(Base):
    __tablename__ = "medicines_master"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    generic_name = Column(String(255), nullable=True)
    brand_name = Column(String(255), nullable=True)
    aliases = Column(Text, nullable=True)
    dosage_form = Column(String(100), nullable=True)
    strength = Column(String(100), nullable=True)
    unit = Column(String(50), nullable=True)
    route = Column(String(100), nullable=True)
    manufacturer = Column(String(255), nullable=True)
    source = Column(String(50), nullable=True)
    source_id = Column(String(100), nullable=True)
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
    notes = Column(Text, nullable=True)
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
    
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    doctor = relationship("Doctor", foreign_keys=[doctor_id])
    patient = relationship("Patient", foreign_keys=[patient_id])
    medicines = relationship("PrescriptionMedicine", back_populates="prescription", cascade="all, delete-orphan")
    verifications = relationship("PrescriptionVerification", back_populates="prescription", cascade="all, delete-orphan")


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

    @property
    def dosage(self) -> str:
        parts = [self.strength or "", self.unit or ""]
        value = " ".join(part.strip() for part in parts if part and part.strip())
        return value or self.strength or ""


class PrescriptionActivity(Base):
    __tablename__ = "prescription_activities"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, server_default=func.now())
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
    timestamp = Column(DateTime, server_default=func.now())
    editor_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class Laboratory(Base):
    __tablename__ = "laboratories"

    id = Column(Integer, primary_key=True, index=True)
    vritan_id = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=False)
    license_number = Column(String(100), unique=True, index=True, nullable=False)
    address = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    verification_status = Column(String(50), default=VerificationState.PENDING_EMAIL_VERIFICATION.value, nullable=False)
    verification_document_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    technicians = relationship("LabTechnician", back_populates="laboratory")
    medical_records = relationship("MedicalRecord", back_populates="laboratory")


class LabTechnician(Base):
    __tablename__ = "lab_technicians"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    laboratory_id = Column(Integer, ForeignKey("laboratories.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    employee_id = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    profile_image_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")
    laboratory = relationship("Laboratory", back_populates="technicians")
    medical_records = relationship("MedicalRecord", back_populates="technician")


class PrescriptionVerification(Base):
    __tablename__ = "prescription_verifications"

    id = Column(Integer, primary_key=True, index=True)
    medical_record_id = Column(Integer, ForeignKey("medical_records.id"), nullable=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True, index=True)
    verification_id = Column(String(100), unique=True, index=True, nullable=False)
    token_hash = Column(String(255), nullable=True)
    status = Column(String(50), default="active", nullable=False) # active, revoked
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_verified_at = Column(DateTime, nullable=True)

    medical_record = relationship("MedicalRecord", back_populates="verifications")
    prescription = relationship("Prescription", back_populates="verifications")
    creator = relationship("User", foreign_keys=[created_by])






from appointment_models import *

from pharmacy_models import *

from lab_models import *

from org_models import *

from notification_models import *
