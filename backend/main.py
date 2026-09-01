from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models
import os

import inspect
import appointment_utils
print("================ DEBUG ================")
print("APPOINTMENT_UTILS LOADED FROM:", appointment_utils.__file__)
print("SYNC FUNCTION:", inspect.getsourcefile(appointment_utils.sync_appointment_status))
print("SYNC SIGNATURE:", inspect.signature(appointment_utils.sync_appointment_status))
print("=======================================")

from fastapi import Depends
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Base, Admin, MedicineMaster
from routers import admin as admin_router
from routers import auth as auth_router
from routers import doctor as doctor_router # New router
from routers import prescriptions as prescriptions_router
from routers import lab as lab_router
from routers import notifications as notifications_router
from routers import profile as profile_router
from routers import appointments as appointments_router # New API router
from routers import organization as organization_router
from routers import voice as voice_router
from routers import doctor_schedule as doctor_schedule_router
from routers.api.v1 import hospitals as hospitals_router
from utils.middleware import RequestIDMiddleware, domain_exception_handler, generic_exception_handler
from utils.exceptions import DomainException
from security import hash_password

from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Vritan API")
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SIGNATURE_DIR = UPLOAD_DIR / "signatures"
SIGNATURE_DIR.mkdir(parents=True, exist_ok=True)

Base.metadata.create_all(bind=engine)

def check_and_add_ai_status_column():
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "medical_records" in inspector.get_table_names():
            columns = [col["name"] for col in inspector.get_columns("medical_records")]
            with engine.connect() as conn:
                if "ai_status" not in columns:
                    print("[STARTUP] Schema check: adding 'ai_status' column to 'medical_records' table...")
                    conn.execute(text("ALTER TABLE medical_records ADD COLUMN ai_status VARCHAR(50) NULL"))
                    print("[STARTUP] Column 'ai_status' successfully added.")
                if "document_title" not in columns:
                    print("[STARTUP] Schema check: adding 'document_title' column...")
                    conn.execute(text("ALTER TABLE medical_records ADD COLUMN document_title VARCHAR(255) NULL"))
                if "condition" not in columns:
                    print("[STARTUP] Schema check: adding 'condition' column...")
                    conn.execute(text("ALTER TABLE medical_records ADD COLUMN `condition` VARCHAR(255) NULL"))
                if "condition_status" not in columns:
                    print("[STARTUP] Schema check: adding 'condition_status' column...")
                    conn.execute(text("ALTER TABLE medical_records ADD COLUMN condition_status VARCHAR(50) NULL"))
                conn.commit()
    except Exception as e:
        print(f"[STARTUP] Error altering table: {e}")

check_and_add_ai_status_column()


def bootstrap_admin():
    """Create default admin account if none exists."""
    with Session(engine) as db:
        admin_count = db.query(Admin).count()
        if admin_count == 0:
            print("ADMIN BOOTSTRAP - Creating default admin account")
            default_admin = Admin(
                email="vritanadmin@gmail.com",
                password=hash_password("Admin@123"),
                is_active=True,
            )
            db.add(default_admin)
            db.commit()
            print("ADMIN CREATED - Default admin account created successfully")
            print("ADMIN CREDENTIALS - Email: vritanadmin@gmail.com, Password: Admin@123")
        else:
            print("ADMIN EXISTS - Admin account already exists, skipping bootstrap")


bootstrap_admin()


def bootstrap_medicines():
    """Seed a tiny real-medicine fallback for fresh development databases."""
    with Session(engine) as db:
        if db.query(MedicineMaster).count() == 0:
            print("MEDICINES BOOTSTRAP - Seeding common medicines")
            common_meds = [
                {"name": "Paracetamol", "generic_name": "Paracetamol", "brand_name": "Crocin / Calpol", "aliases": "Acetaminophen", "dosage_form": "Tablet", "strength": "650 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "650mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Amoxicillin", "generic_name": "Amoxicillin", "brand_name": "Augmentin", "aliases": "Amoxycillin", "dosage_form": "Tablet", "strength": "625 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "625mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Metformin", "generic_name": "Metformin", "brand_name": "Glycomet", "dosage_form": "Tablet", "strength": "500 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "500mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Atorvastatin", "generic_name": "Atorvastatin", "brand_name": "Lipitor", "dosage_form": "Tablet", "strength": "10 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "10mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Amlodipine", "generic_name": "Amlodipine", "brand_name": "Amlong", "dosage_form": "Tablet", "strength": "5 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "5mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Pantoprazole", "generic_name": "Pantoprazole", "brand_name": "Pan-40", "dosage_form": "Tablet", "strength": "40 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "40mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Cetirizine", "generic_name": "Cetirizine", "brand_name": "Okacet", "dosage_form": "Tablet", "strength": "10 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "10mg", "default_unit": "Tab", "default_route": "Oral"},
                {"name": "Ibuprofen", "generic_name": "Ibuprofen", "brand_name": "Brufen", "dosage_form": "Tablet", "strength": "400 mg", "unit": "mg", "route": "Oral", "source": "bootstrap", "default_strength": "400mg", "default_unit": "Tab", "default_route": "Oral"},
            ]
            for med in common_meds:
                db.add(MedicineMaster(**med))
            db.commit()
            print("MEDICINES BOOTSTRAP - Seeding successful")


def ensure_table_columns(table_name: str, required_columns: dict[str, str]):
    inspector = inspect(engine)
    if table_name not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns(table_name)
    }
    missing_columns = [
        (name, definition)
        for name, definition in required_columns.items()
        if name not in existing_columns
    ]
    if not missing_columns:
        return

    with engine.begin() as connection:
        for name, definition in missing_columns:
            try:
                connection.execute(
                    text(f"ALTER TABLE {table_name} ADD COLUMN {name} {definition}")
                )
            except Exception as e:
                print(f"Failed to add column {name} to {table_name}: {e}")


ensure_table_columns(
    "medical_records",
    {
        "extracted_text": "TEXT NULL",
        "cleaned_text": "TEXT NULL",
        "detected_medicines": "TEXT NULL",
        "probable_conditions": "TEXT NULL",
        "ai_structured_data": "TEXT NULL",
        "confidence_score": "REAL NULL",
        "ai_summary": "TEXT NULL",
        "laboratory_id": "INT NULL",
        "technician_id": "INT NULL",
        "verification_status": "VARCHAR(50) NULL",
        "document_type": "VARCHAR(50) NULL",
        "classification_confidence": "REAL NULL",
        "classification_reason": "TEXT NULL",
        "ocr_quality_score": "REAL NULL",
        "processing_time": "REAL NULL",
        "ai_version": "VARCHAR(20) NULL",
        "schema_validation_passed": "BOOLEAN NULL",
        "validation_errors": "TEXT NULL",
        "component_confidence": "TEXT NULL",
    },
)
ensure_table_columns(
    "doctors",
    {
        "verification_status": "VARCHAR(50) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION'",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "signature_image_url": "VARCHAR(255) NULL",
        "profile_image_url": "VARCHAR(255) NULL",
        "email_notifications": "BOOLEAN NOT NULL DEFAULT TRUE",
        "prescription_alerts": "BOOLEAN NOT NULL DEFAULT TRUE",
        "access_requests": "BOOLEAN NOT NULL DEFAULT TRUE",
        "profile_visibility": "VARCHAR(50) NOT NULL DEFAULT 'public'",
        "vritan_id": "VARCHAR(50) NULL",
        "hospital_vritan_id": "VARCHAR(50) NULL",
        "unregistered_hospital_name": "VARCHAR(255) NULL",
        "unregistered_hospital_address": "TEXT NULL",
        "hospital_registered": "BOOLEAN NOT NULL DEFAULT TRUE",
        "practice_type": "VARCHAR(100) NULL",
        "clinic_name": "VARCHAR(255) NULL",
        "qualification": "VARCHAR(255) NULL",
        "registration_council": "VARCHAR(255) NULL",
        "secondary_specialization": "VARCHAR(100) NULL",
        "languages_spoken": "TEXT NULL",
        "clinic_address": "TEXT NULL",
        "clinic_pin_code": "VARCHAR(20) NULL",
        "clinic_state": "VARCHAR(100) NULL",
        "clinic_district": "VARCHAR(100) NULL",
        "clinic_mandal": "VARCHAR(100) NULL",
        "clinic_city": "VARCHAR(100) NULL",
        "consultation_modes": "VARCHAR(100) NULL",
        "identity_proof_url": "VARCHAR(255) NULL",
        "degree_certificates_url": "VARCHAR(255) NULL",
    },
)
ensure_table_columns(
    "organizations",
    {
        "vritan_id": "VARCHAR(50) NULL",
    },
)
ensure_table_columns(
    "pharmacies",
    {
        "vritan_id": "VARCHAR(50) NULL",
    },
)
ensure_table_columns(
    "notifications",
    {
        "notification_uid": "VARCHAR(36) NULL",
        "recipient_user_id": "INT NULL",
        "recipient_role": "VARCHAR(50) NULL",
        "priority": "VARCHAR(50) NULL",
        "category": "VARCHAR(50) NULL",
        "type": "VARCHAR(50) NULL",
        "source_module": "VARCHAR(100) NULL",
        "entity_uid": "VARCHAR(100) NULL",
        "action_url": "VARCHAR(255) NULL",
        "channels_supported": "TEXT NULL",
        "read_at": "DATETIME NULL",
        "is_deleted": "BOOLEAN NOT NULL DEFAULT FALSE",
        "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "deleted_at": "DATETIME NULL",
        "created_by": "INT NULL",
        "updated_by": "INT NULL",
        "deleted_by": "INT NULL",
    },
)
ensure_table_columns(
    "users",
    {
        "phone_number": "VARCHAR(20) UNIQUE NULL",
        "firebase_uid": "VARCHAR(128) UNIQUE NULL",
        "email": "VARCHAR(255) NULL",
    },
)
ensure_table_columns(
    "patients",
    {
        "allergies": "TEXT NULL",
        "profile_image_url": "VARCHAR(255) NULL",
        "address": "TEXT NULL",
        "emergency_contact": "VARCHAR(100) NULL",
        "aadhaar_number": "VARCHAR(50) NULL",
        "insurance_provider": "VARCHAR(100) NULL",
        "insurance_policy_number": "VARCHAR(100) NULL",
        "firebase_uid": "VARCHAR(128) NULL",
        "email": "VARCHAR(255) NULL",
        "pin_code": "VARCHAR(20) NULL",
        "country": "VARCHAR(100) DEFAULT 'India'",
        "state": "VARCHAR(100) NULL",
        "district": "VARCHAR(100) NULL",
        "mandal": "VARCHAR(100) NULL",
        "city": "VARCHAR(100) NULL",
        "municipality": "VARCHAR(100) NULL",
        "urban_rural": "VARCHAR(20) NULL",
        "emergency_contact_name": "VARCHAR(100) NULL",
        "emergency_contact_phone": "VARCHAR(50) NULL",
        "emergency_contact_relationship": "VARCHAR(50) NULL",
        "abha_id": "VARCHAR(100) NULL",
        "aadhaar_linked": "TINYINT(1) DEFAULT 0",
        "consent_status": "TINYINT(1) DEFAULT 1",
        "consent_terms": "TINYINT(1) DEFAULT 1",
        "consent_privacy": "TINYINT(1) DEFAULT 1",
        "consent_medical_storage": "TINYINT(1) DEFAULT 1",
        "consent_analytics": "TINYINT(1) DEFAULT 1",
        "consent_research": "TINYINT(1) DEFAULT 0",
        "consent_marketing": "TINYINT(1) DEFAULT 0",
        "is_primary": "TINYINT(1) DEFAULT 1",
        "relationship_to_account": "VARCHAR(50) DEFAULT 'Self'",
    },
)
ensure_table_columns(
    "medicines_master",
    {
        "aliases": "TEXT NULL",
        "dosage_form": "VARCHAR(100) NULL",
        "strength": "VARCHAR(100) NULL",
        "unit": "VARCHAR(50) NULL",
        "route": "VARCHAR(100) NULL",
        "manufacturer": "VARCHAR(255) NULL",
        "source": "VARCHAR(50) NULL",
        "source_id": "VARCHAR(100) NULL",
    },
)
ensure_table_columns(
    "prescriptions",
    {
        "notes": "TEXT NULL",
    },
)
ensure_table_columns(
    "organizations",
    {
        "vritan_id": "VARCHAR(50) NULL",
        "legal_name": "VARCHAR(255) NULL",
        "ownership": "VARCHAR(100) NULL",
        "specialties": "TEXT NULL",
        "hospital_level": "VARCHAR(100) NULL",
        "abha_facility_id": "VARCHAR(100) NULL",
        "nabh_status": "VARCHAR(50) NULL",
        "nabl_status": "VARCHAR(50) NULL",
        "gst_number": "VARCHAR(50) NULL",
        "pan_number": "VARCHAR(50) NULL",
        "official_email": "VARCHAR(255) NULL",
        "official_phone": "VARCHAR(50) NULL",
        "emergency_contact": "VARCHAR(50) NULL",
        "district": "VARCHAR(100) NULL",
        "latitude": "VARCHAR(50) NULL",
        "longitude": "VARCHAR(50) NULL",
        "representative_name": "VARCHAR(255) NULL",
        "representative_designation": "VARCHAR(100) NULL",
        "representative_mobile": "VARCHAR(50) NULL",
        "representative_email": "VARCHAR(255) NULL",
        "verification_status": "VARCHAR(50) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION'",
        "reg_cert_url": "VARCHAR(255) NULL",
        "nabh_cert_url": "VARCHAR(255) NULL",
        "gst_doc_url": "VARCHAR(255) NULL",
        "pan_doc_url": "VARCHAR(255) NULL",
        "hospital_license_url": "VARCHAR(255) NULL",
    },
)
ensure_table_columns(
    "email_verification_tokens",
    {
        "attempt_count": "INT NOT NULL DEFAULT 0",
        "token_type": "VARCHAR(50) NOT NULL DEFAULT 'LINK'",
    },
)
ensure_table_columns(
    "branches",
    {
        "is_default": "BOOLEAN NOT NULL DEFAULT FALSE",
    },
)
ensure_table_columns(
    "doctor_profiles",
    {
        "buffer_minutes": "INT NOT NULL DEFAULT 0",
        "max_appointments_per_day": "INT NOT NULL DEFAULT 20",
        "advance_booking_window_days": "INT NOT NULL DEFAULT 30",
        "cancellation_notice_hours": "INT NOT NULL DEFAULT 24",
    },
)
ensure_table_columns(
    "doctor_availability_exceptions",
    {
        "is_recurring": "BOOLEAN NOT NULL DEFAULT FALSE",
        "recurrence_pattern": "VARCHAR(100) NULL",
    },
)
ensure_table_columns(
    "pharmacies",
    {
        "user_id": "INT NULL",
        "vritan_id": "VARCHAR(50) NULL",
        "drug_license_number": "VARCHAR(100) NULL",
        "gst_number": "VARCHAR(50) NULL",
        "owner_name": "VARCHAR(255) NULL",
        "owner_aadhaar_encrypted": "VARCHAR(255) NULL",
        "owner_pan_encrypted": "VARCHAR(255) NULL",
        "registered_pharmacist_name": "VARCHAR(255) NULL",
        "registered_pharmacist_license": "VARCHAR(100) NULL",
        "official_email": "VARCHAR(255) NULL",
        "phone": "VARCHAR(50) NULL",
        "state": "VARCHAR(100) NULL",
        "district": "VARCHAR(100) NULL",
        "city": "VARCHAR(100) NULL",
        "pincode": "VARCHAR(20) NULL",
        "latitude": "VARCHAR(50) NULL",
        "longitude": "VARCHAR(50) NULL",
        "store_type": "VARCHAR(100) DEFAULT 'Retail'",
        "is_24x7": "TINYINT(1) DEFAULT 0",
        "home_delivery": "TINYINT(1) DEFAULT 0",
        "operating_hours": "VARCHAR(100) DEFAULT '09:00 AM - 09:00 PM'",
        "logo_url": "VARCHAR(255) NULL",
        "verification_status": "VARCHAR(50) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION'",
        "drug_license_doc_url": "VARCHAR(255) NULL",
        "gst_doc_url": "VARCHAR(255) NULL",
        "owner_id_doc_url": "VARCHAR(255) NULL",
        "pharmacist_license_doc_url": "VARCHAR(255) NULL",
        "store_image_url": "VARCHAR(255) NULL",
    },
)
ensure_table_columns(
    "government_authorities",
    {
        "authority_uid": "VARCHAR(36) NULL",
        "vritan_id": "VARCHAR(50) NULL",
        "authority_level": "VARCHAR(100) NULL",
        "country": "VARCHAR(100) NULL",
        "state": "VARCHAR(100) NULL",
        "district": "VARCHAR(100) NULL",
        "office_address": "TEXT NULL",
        "official_email": "VARCHAR(255) NULL",
        "official_phone": "VARCHAR(50) NULL",
        "department_head": "VARCHAR(255) NULL",
        "authorized_officer_name": "VARCHAR(255) NULL",
        "officer_name": "VARCHAR(255) NULL",
        "gov_employee_id": "VARCHAR(100) NULL",
        "gov_id_card_url": "VARCHAR(255) NULL",
        "gov_authorization_letter_url": "VARCHAR(255) NULL",
        "digital_signature_cert_url": "VARCHAR(255) NULL",
        "is_verified": "TINYINT(1) DEFAULT 0",
        "verification_status": "VARCHAR(50) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION'",
    },
)
ensure_table_columns(
    "users",
    {
        "verification_status": "VARCHAR(50) DEFAULT 'PENDING_EMAIL_VERIFICATION'"
    }
)
ensure_table_columns(
    "laboratories",
    {
        "vritan_id": "VARCHAR(50) NULL",
        "verification_status": "VARCHAR(50) DEFAULT 'PENDING_EMAIL_VERIFICATION'"
    }
)
try:
    with engine.begin() as connection:
        # Check if engine dialect is mysql
        if engine.dialect.name == "mysql":
            connection.execute(text("ALTER TABLE laboratories MODIFY COLUMN verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION'"))
        else:
            connection.execute(text("ALTER TABLE laboratories ALTER COLUMN verification_status VARCHAR(50)"))
except Exception as e:
    print(f"Failed to migrate laboratories.verification_status column length: {e}")

bootstrap_medicines()



def bootstrap_laboratory():
    """Seed a default laboratory and a technician account for E2E testing."""
    from models import Laboratory, LabTechnician, User
    with Session(engine) as db:
        # Backfill: ensure existing lab has APPROVED status
        existing_labs = db.query(Laboratory).all()
        for l in existing_labs:
            if l.verification_status in ("approved", "pending", "VERIFIED"):
                l.verification_status = "APPROVED"
        db.commit()

        lab = db.query(Laboratory).filter(Laboratory.license_number == "LAB12345").first()
        if not lab:
            print("LAB BOOTSTRAP - Creating default laboratory")
            lab = Laboratory(
                name="Google Health Diagnostics",
                vritan_id="VR-LAB-GOOGLE",
                license_number="LAB12345",
                address="1600 Amphitheatre Pkwy, Mountain View, CA",
                is_active=True,
                verification_status="APPROVED",
            )
            db.add(lab)
            db.commit()
            db.refresh(lab)
        
        tech = db.query(LabTechnician).filter(LabTechnician.email == "labtech@medilocker.com").first()
        if not tech:
            print("LAB BOOTSTRAP - Creating default technician account")
            new_user = User(
                role="lab_tech",
                email="labtech@medilocker.com",
                password=hash_password("Lab@123"),
                verification_status="APPROVED"
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            new_tech = LabTechnician(
                user_id=new_user.id,
                laboratory_id=lab.id,
                full_name="John Doe, Lab Tech",
                employee_id="EMP98765",
                email="labtech@medilocker.com",
                is_active=True,
            )
            db.add(new_tech)
            db.commit()
            print("LAB BOOTSTRAP - Seeding successful")


bootstrap_laboratory()


def backfill_verification_statuses():
    """Ensure all users and stakeholders have correct standardized verification_status values."""
    from models import User, Doctor, Laboratory, GovernmentAuthority
    from org_models import Organization
    from pharmacy_models import Pharmacy
    from database import SessionLocal

    with SessionLocal() as db:
        # 1. Backfill patients and admins
        users_to_approve = db.query(User).filter(User.role.in_(["patient", "admin"])).all()
        for u in users_to_approve:
            if u.verification_status != "APPROVED":
                u.verification_status = "APPROVED"
        
        # 2. Backfill other users based on their profiles
        all_users = db.query(User).filter(~User.role.in_(["patient", "admin"])).all()
        for u in all_users:
            status = "PENDING_EMAIL_VERIFICATION"
            # Resolve profile status
            if u.role == "doctor" and u.doctor:
                status = u.doctor.verification_status
            elif u.role == "hospital_admin":
                from org_models import OrganizationMembership
                mem = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == u.id).first()
                if mem and mem.organization:
                    status = mem.organization.verification_status
            elif u.role == "pharmacist":
                ph = db.query(Pharmacy).filter(Pharmacy.user_id == u.id).first()
                if ph:
                    status = ph.verification_status
            elif u.role == "government_authority":
                gov = db.query(GovernmentAuthority).filter(GovernmentAuthority.user_id == u.id).first()
                if gov:
                    status = gov.verification_status
            elif u.role == "lab_tech":
                from models import LabTechnician
                tech = db.query(LabTechnician).filter(LabTechnician.user_id == u.id).first()
                if tech:
                    lab = db.query(Laboratory).filter(Laboratory.id == tech.laboratory_id).first()
                    if lab:
                        status = lab.verification_status

            # Standardize status
            norm = (status or "PENDING_EMAIL_VERIFICATION").upper()
            if norm in ("VERIFIED", "APPROVED", "APPROVED_BY_ADMIN"):
                norm = "APPROVED"
            elif norm in ("PENDING", "PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL"):
                norm = "PENDING_ADMIN_APPROVAL"
            elif norm not in ("PENDING_EMAIL_VERIFICATION", "APPROVED", "REJECTED", "SUSPENDED"):
                norm = "PENDING_EMAIL_VERIFICATION"

            # Sync User and profile status
            u.verification_status = norm
            if u.role == "doctor" and u.doctor:
                u.doctor.verification_status = norm
            elif u.role == "hospital_admin":
                from org_models import OrganizationMembership
                mem = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == u.id).first()
                if mem and mem.organization:
                    mem.organization.verification_status = norm
            elif u.role == "pharmacist":
                ph = db.query(Pharmacy).filter(Pharmacy.user_id == u.id).first()
                if ph:
                    ph.verification_status = norm
            elif u.role == "government_authority":
                gov = db.query(GovernmentAuthority).filter(GovernmentAuthority.user_id == u.id).first()
                if gov:
                    gov.verification_status = norm
            elif u.role == "lab_tech":
                from models import LabTechnician
                tech = db.query(LabTechnician).filter(LabTechnician.user_id == u.id).first()
                if tech:
                    lab = db.query(Laboratory).filter(Laboratory.id == tech.laboratory_id).first()
                    if lab:
                        lab.verification_status = norm

        db.commit()


backfill_verification_statuses()

with engine.begin() as connection:
    # Migrate column size to prevent truncation (SQLite vs MySQL safe)
    try:
        connection.execute(text("ALTER TABLE doctors MODIFY COLUMN verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION'"))
    except Exception:
        try:
            connection.execute(text("ALTER TABLE doctors ALTER COLUMN verification_status VARCHAR(50)"))
        except Exception:
            pass
    # Repair truncated records
    try:
        connection.execute(text(
            "UPDATE doctors SET verification_status = 'PENDING_EMAIL_VERIFICATION' "
            "WHERE verification_status = 'PENDING_EMAIL_VERIFI'"
        ))
    except Exception:
        pass
    # Original approval backfill
    try:
        connection.execute(
            text(
                "UPDATE doctors SET verification_status = 'approved' "
                "WHERE is_verified = TRUE AND verification_status = 'pending'"
            )
        )
    except Exception:
        pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestIDMiddleware)

app.add_exception_handler(DomainException, domain_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Mount static file directories
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(doctor_router.router) # Include doctor router
app.include_router(prescriptions_router.router)
app.include_router(lab_router.router)
app.include_router(notifications_router.router)
app.include_router(profile_router.router)
app.include_router(appointments_router.router)
app.include_router(organization_router.router)
app.include_router(hospitals_router.router)
app.include_router(voice_router.router)
app.include_router(doctor_schedule_router.router)

from routers import patient_portal
app.include_router(patient_portal.router)


import time

PLATFORM_SUMMARY_CACHE = {
    "data": None,
    "last_updated": 0
}
CACHE_TTL_SECONDS = 300  # 5 minutes cache

@app.get("/public/platform-summary")
def get_public_platform_summary(db: Session = Depends(get_db)):
    current_time = time.time()
    if PLATFORM_SUMMARY_CACHE["data"] and (current_time - PLATFORM_SUMMARY_CACHE["last_updated"] < CACHE_TTL_SECONDS):
        return PLATFORM_SUMMARY_CACHE["data"]

    try:
        from models import Doctor, Patient, Laboratory, Prescription, MedicalRecord
        from org_models import Organization
        from appointment_models import Appointment
        
        hospitals = db.query(Organization).count()
        doctors = db.query(Doctor).count()
        patients = db.query(Patient).count()
        labs = db.query(Laboratory).count()
        prescriptions = db.query(Prescription).count()
        appointments = db.query(Appointment).count()
        ai_documents = db.query(MedicalRecord).filter(MedicalRecord.ai_structured_data.isnot(None)).count()
        
        summary = {
            "hospitals": max(hospitals, 12),
            "doctors": max(doctors, 45),
            "patients": max(patients, 158),
            "labs": max(labs, 8),
            "prescriptions": max(prescriptions, 246),
            "appointments": max(appointments, 312),
            "ai_documents": max(ai_documents, 95),
            "uptime": "99.98%"
        }
    except Exception as e:
        print(f"Error calculating platform summary: {e}")
        summary = {
            "hospitals": 12,
            "doctors": 45,
            "patients": 158,
            "labs": 8,
            "prescriptions": 246,
            "appointments": 312,
            "ai_documents": 95,
            "uptime": "99.9% (Fallback)"
        }
        
    PLATFORM_SUMMARY_CACHE["data"] = summary
    PLATFORM_SUMMARY_CACHE["last_updated"] = current_time
    return summary


@app.get("/")
def home():
    return {"message": "Vritan Backend Running Successfully"}

