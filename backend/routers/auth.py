"""Registration and login endpoints."""
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
import time
import traceback
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from typing import Optional
from database import get_db
from models import AccessRequest, Admin, Doctor, GovernmentAuthority, Laboratory, LabTechnician, MedicalRecord, Patient, Prescription, User as UserModel
from schemas import AccessRequestPublic
from schemas import DoctorAccessRequestResponse, DoctorProfile
from schemas import DoctorResetOtpRequest, DoctorResetPasswordRequest
from schemas import DoctorVerifyResetOtpRequest, LoginResponse, MedicalRecordPublic
from schemas import PatientFirebaseLoginRequest, PatientProfile, PatientSearchResult
from schemas import SendOtpRequest, UserLogin, UserPublic, AdminDoctorPublic
from schemas import UserRegister, VerifyOtpRequest
from schemas import DoctorDashboardStats
from security import InvalidTokenError, create_access_token, decode_access_token, hash_password, verify_password
from services.gemini_service import structure_medical_text
from services.ocr_service import extract_text_from_file, OCRError, compress_image
from services.email_service import (
    send_doctor_verification_request_to_admin,
    send_doctor_approval_email,
    send_doctor_rejection_email,
)
from firebase_config import verify_firebase_token

router = APIRouter(tags=["auth"])

# Development-only OTP store. It resets when the backend restarts.
patient_otp_store: dict[str, dict[str, str | bool]] = {}
doctor_reset_otp_store: dict[str, dict[str, str | bool | datetime]] = {}
RESET_OTP_TTL_MINUTES = 5
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
ALLOWED_RECORD_TYPES = {"prescription", "report", "scan", "other"}
ALLOWED_FILE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ACCESS_DURATION_MINUTES = 10
NON_MEDICAL_UPLOAD_MESSAGE = (
    "This file does not appear to be a medical prescription, report, or scan."
)


def _is_bcrypt_hash(value: str | None) -> bool:
    if not value:
        return False
    return (
        value.startswith("$2a$")
        or value.startswith("$2b$")
        or value.startswith("$2y$")
    )


def _password_matches(plain: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False
    if _is_bcrypt_hash(stored_hash):
        return verify_password(plain, stored_hash)
    return plain == stored_hash


def _make_patient_uid(user_id: int) -> str:
    return f"PAT-{user_id:06d}"


def _make_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _now_utc() -> datetime:
    """Return current UTC time as a naive datetime (no tzinfo), consistent with
    Column(DateTime) values read back from MySQL after SET time_zone='+00:00'.
    Uses datetime.now(timezone.utc) internally to avoid the Python 3.12+
    deprecation of datetime.utcnow().
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _check_duplicate_account(db: Session, phone: str | None, firebase_uid: str | None = None) -> tuple[bool, str]:
    """
    Checks for duplicate account against users.phone_number, users.firebase_uid,
    and legacy patients.mobile.
    Returns (is_duplicate, reason).
    """
    normalized_phone = None
    if phone:
        try:
            normalized_phone = normalize_phone_number(phone)
        except ValueError:
            pass
            
    is_dup = False
    reason = ""
    
    # 1. Check users.phone_number (source of truth)
    if normalized_phone:
        existing_user_phone = db.query(UserModel).filter(UserModel.phone_number == normalized_phone).first()
        if existing_user_phone:
            is_dup = True
            reason = "Phone number already registered in users table"
            
    # 2. Check users.firebase_uid
    if not is_dup and firebase_uid:
        existing_user_uid = db.query(UserModel).filter(UserModel.firebase_uid == firebase_uid).first()
        if existing_user_uid:
            is_dup = True
            reason = "Firebase UID already registered in users table"
            
    # 3. Check legacy patients.mobile
    if not is_dup and normalized_phone:
        existing_patient_mobile = db.query(Patient).filter(Patient.mobile == normalized_phone).first()
        if existing_patient_mobile:
            is_dup = True
            reason = "Phone number already registered in patients table (legacy)"
            
    if os.getenv("APP_ENV", "development").lower() != "production":
        print(f"[PATIENT_AUTH_AUDIT] raw_phone={phone}, normalized_phone={normalized_phone}, "
              f"firebase_uid={firebase_uid}, is_duplicate={is_dup}, reason={reason}")
              
    return is_dup, reason


def _patient_mobile_exists(db: Session, mobile: str) -> bool:
    is_dup, _ = _check_duplicate_account(db, mobile)
    return is_dup



def normalize_phone_number(phone: str | None) -> str:
    """
    Extracts exactly 10 digits from an Indian phone number.
    Removes +91 or 91 prefix if present.
    If the result is not exactly 10 digits, raises ValueError.
    """
    if not phone:
        raise ValueError("Phone number is required")
        
    import re
    # Remove all non-digits
    digits = re.sub(r"\D", "", str(phone))
    
    # Handle optional country codes if it's longer than 10 digits
    if len(digits) > 10:
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]
            
    if len(digits) != 10:
        raise ValueError(f"Invalid phone number length: {len(digits)} digits")
        
    return digits


def _current_user_from_token(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserModel | Admin:
    print(f"AUTH DEBUG - Authorization header: {authorization[:20] if authorization else 'None'}...")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        print(f"AUTH DEBUG - Decoded payload: {payload}")
        user_id = int(payload.get("sub", ""))
    except (InvalidTokenError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    token_role = payload.get("role")
    print(f"AUTH DEBUG - Token role: {token_role}, User ID: {user_id}")
    
    # Handle admin tokens separately since admins use the Admin table
    if token_role == "admin":
        admin = db.query(Admin).filter(Admin.id == user_id).first()
        if not admin:
            print(f"AUTH DEBUG - Admin not found for ID: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Admin account not found",
            )
        print(f"AUTH DEBUG - Admin found: {admin.email}")
        return admin
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        print(f"AUTH DEBUG - User not found for ID: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )
    if user.role != token_role:
        print(f"AUTH DEBUG - Role mismatch: user.role={user.role}, token_role={token_role}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    
    # Enforce verification status check from database for stakeholders
    if user.role not in ("patient", "admin"):
        status_str = (user.verification_status or "PENDING_EMAIL_VERIFICATION").upper()
        from models import VerificationState
        if status_str == VerificationState.PENDING_EMAIL_VERIFICATION.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Complete email verification first.",
            )
        elif status_str == VerificationState.PENDING_ADMIN_APPROVAL.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your registration is under review. Please wait for approval.",
            )
        elif status_str == VerificationState.REJECTED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your application has been rejected. Contact support.",
            )
        elif status_str == VerificationState.SUSPENDED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your organization account has been suspended by system administration.",
            )
        elif status_str != VerificationState.APPROVED.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not approved.",
            )

    # For doctor role, validate that the doctor record exists
    if token_role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
        if not doctor:
            print(f"AUTH DEBUG - Doctor record not found for user_id: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Doctor profile not found",
            )
        print(f"AUTH DEBUG - Doctor record found: {doctor.email}")
    
    print(f"AUTH DEBUG - User found: {user.id}, role: {user.role}")
    return user


def _resolve_password_login_user(db: Session, identifier_raw: str) -> UserModel | None:
    import re
    # Strip markdown if accidentally pasted (e.g., [email](mailto:email))
    match = re.search(r'\[(.*?)\]\(.*?\)', str(identifier_raw or ""))
    if match:
        identifier_raw = match.group(1).replace("mailto:", "")
        
    term = str(identifier_raw or "").strip().lower()
    term_upper = str(identifier_raw or "").strip().upper()
    if not term:
        return None

    from org_models import Organization, OrganizationMembership
    from pharmacy_models import Pharmacy
    from models import GovernmentAuthority, Doctor

    # 0. Fast path: check UserModel directly for VRITAN ID
    base_user = db.query(UserModel).filter(UserModel.vritan_id == term_upper).first()
    if base_user:
        return base_user

    # 1. Doctor by Email
    doc_user = db.query(UserModel).join(Doctor).filter(
        func.lower(Doctor.email) == term
    ).first()
    if doc_user:
        return doc_user

    # 2. Hospital / Organization Admin by Email or Vritan ID.
    #    IMPORTANT: filter by role='admin' so that subsequently-added doctors or staff
    #    who also have OrganizationMembership rows are never returned in their place.
    org = db.query(Organization).filter(
        (func.lower(Organization.email) == term)
        | (func.lower(Organization.official_email) == term)
        | (Organization.vritan_id == term_upper)
    ).first()
    if org:
        admin_mem = (
            db.query(OrganizationMembership)
            .filter(
                OrganizationMembership.organization_id == org.id,
                OrganizationMembership.role == "admin",
            )
            .first()
        )
        if admin_mem:
            return db.query(UserModel).filter(UserModel.id == admin_mem.user_id).first()
        # org exists but has no admin membership — fall through, not a valid login target

    # 3. Pharmacy by Official Email or Vritan ID
    pharmacy = db.query(Pharmacy).filter(
        (func.lower(Pharmacy.official_email) == term) | (Pharmacy.vritan_id == term_upper)
    ).first()
    if pharmacy and pharmacy.user_id:
        return db.query(UserModel).filter(UserModel.id == pharmacy.user_id).first()

    # 4. Government Authority by Official Email or Vritan ID
    gov_auth = db.query(GovernmentAuthority).filter(
        (func.lower(GovernmentAuthority.official_email) == term) | (GovernmentAuthority.vritan_id == term_upper)
    ).first()
    if gov_auth:
        return db.query(UserModel).filter(UserModel.id == gov_auth.user_id).first()

    return None


def _resolve_doctor_by_email(db: Session, email_raw: str) -> Doctor | None:
    email = str(email_raw or "").strip().lower()
    if not email:
        return None
    return db.query(Doctor).filter(Doctor.email == email).first()


def _reset_otp_is_expired(saved: dict[str, str | bool | datetime] | None) -> bool:
    if not saved:
        return True
    expires_at = saved.get("expires_at")
    if not isinstance(expires_at, datetime):
        return True
    return datetime.now(timezone.utc) >= expires_at


def _require_current_doctor(current_user: UserModel) -> Doctor:
    if current_user.role != "doctor" or not current_user.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor access required",
        )
    return current_user.doctor


def _require_verified_doctor(current_user: UserModel) -> Doctor:
    doctor = _require_current_doctor(current_user)
    if doctor.verification_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your verification request was rejected. Please contact support.",
        )
    if not doctor.is_verified or doctor.verification_status not in ("approved", "VERIFIED"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor account must be verified before searching patients",
        )
    return doctor


def _safe_original_filename(filename: str | None) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(filename or "record").name)
    return cleaned.strip(" .") or "record"


def _safe_upload_extension(filename: str | None) -> str:
    extension = Path(filename or "").suffix.lower()
    if extension not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image and PDF files are allowed",
        )
    return extension


def _slugify_filename_part(value: str) -> str:
    lowered = str(value or "").lower()
    lowered = re.sub(r"possible related condition\s*:\s*", "", lowered, flags=re.I)
    lowered = re.sub(r"[^a-z0-9]+", "_", lowered)
    lowered = re.sub(r"_+", "_", lowered).strip("_")
    return lowered[:70]


def _smart_record_filename(
    *,
    patient_id: int,
    record_type: str,
    extension: str,
    ai_data: dict,
    upload_time: datetime,
) -> str:
    conditions = ai_data.get("possible_conditions") or []
    condition = ""
    if isinstance(conditions, list) and conditions:
        condition = _slugify_filename_part(str(conditions[0]))

    date_part = upload_time.strftime("%Y_%m_%d")
    record_part = _slugify_filename_part(record_type) or "medical_record"
    if condition:
        base_name = f"{condition}_{record_part}_{date_part}"
    else:
        base_name = f"medical_record_{date_part}"

    unique = secrets.token_urlsafe(5).lower().replace("-", "_")
    return f"{patient_id}_{base_name}_{unique}{extension}"


def _record_display_title(record: MedicalRecord) -> str:
    ai_data = _json_loads(record.ai_structured_data, {})
    
    # Use AI-generated document_title if available
    if ai_data and isinstance(ai_data, dict):
        document_title = ai_data.get("document_title")
        if document_title:
            return document_title
    
    # Fallback to document_type from AI pipeline
    document_type = record.document_type
    if document_type and document_type != "unknown":
        conditions = ai_data.get("possible_conditions") if isinstance(ai_data, dict) else []
        if isinstance(conditions, list) and conditions:
            condition = re.sub(
                r"possible related condition\s*:\s*",
                "",
                str(conditions[0]),
                flags=re.I,
            ).strip()
            if condition:
                return f"{condition} {document_type}".title()
        return f"{document_type}".title()
    
    # Legacy fallback using record_type
    conditions = ai_data.get("possible_conditions") if isinstance(ai_data, dict) else []
    if isinstance(conditions, list) and conditions:
        condition = re.sub(
            r"possible related condition\s*:\s*",
            "",
            str(conditions[0]),
            flags=re.I,
        ).strip()
        if condition:
            return f"{condition} {record.record_type}".title()
    return f"{record.record_type} record".title()


def _json_dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(value, fallback):
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback
    return parsed


def _resolve_record_title_and_condition(record: MedicalRecord) -> tuple[str, str, str]:
    is_prescription = (record.record_type == "prescription" or record.document_type == "prescription")
    doc_title = record.document_title
    cond = record.condition
    cond_status = record.condition_status

    if is_prescription:
        if not doc_title:
            def safe_json_loads(val, default):
                if not val:
                    return default
                try:
                    import json
                    return json.loads(val)
                except Exception:
                    return default
            probable_conditions = safe_json_loads(record.probable_conditions, [])
            clean_cond = ""
            if probable_conditions and isinstance(probable_conditions, list):
                raw_cond = probable_conditions[0] if probable_conditions else ""
                clean_cond = raw_cond.replace("Possible related condition:", "").replace("Possible condition:", "").strip()
            
            if not clean_cond:
                ai_structured_data = safe_json_loads(record.ai_structured_data, {})
                if ai_structured_data:
                    raw_cond = ai_structured_data.get("diagnosis", "") or ai_structured_data.get("condition", "")
                    if raw_cond:
                        clean_cond = raw_cond.replace("Possible related condition:", "").replace("Possible condition:", "").strip()
            
            if clean_cond and clean_cond.lower() != "unknown" and clean_cond.lower() != "not detected":
                doc_title = f"Prescription — {clean_cond}"
                cond = clean_cond
                cond_status = "probable"
            else:
                ai_structured_data = safe_json_loads(record.ai_structured_data, {})
                doc_name = None
                if ai_structured_data:
                    doc_name = ai_structured_data.get("doctor_name") or ai_structured_data.get("doctor_or_hospital")
                
                doc_title = "Prescription"
    else:
        if not doc_title:
            if record.laboratory_id:
                doc_title = f"Lab Report ({record.document_type or 'General'})"
            else:
                doc_title = record.original_filename

    return doc_title or record.original_filename or "Medical Record", cond or "", cond_status or ""


def _medical_record_public(record: MedicalRecord) -> MedicalRecordPublic:
    ai_structured_data = _json_loads(record.ai_structured_data, None)
    detected_medicines = _json_loads(record.detected_medicines, [])
    probable_conditions = _json_loads(record.probable_conditions, [])

    # Resolve active verification status
    active_verification = next((v for v in record.verifications if v.status == "active"), None)
    qr_status = "active" if active_verification else "none"
    if qr_status == "none":
        revoked_verification = next((v for v in record.verifications if v.status == "revoked"), None)
        if revoked_verification:
            qr_status = "revoked"
    qr_verification_id = active_verification.verification_id if active_verification else None

    doc_title, cond, cond_status = _resolve_record_title_and_condition(record)

    return MedicalRecordPublic(
        id=record.id,
        record_type=record.record_type,
        file_url=f"/records/{record.id}/file",
        original_filename=record.original_filename,
        display_title=doc_title,
        uploaded_at=record.uploaded_at,
        notes=record.notes,
        extracted_text=record.extracted_text,
        cleaned_text=record.cleaned_text,
        detected_medicines=detected_medicines if isinstance(detected_medicines, list) else [],
        probable_conditions=probable_conditions if isinstance(probable_conditions, list) else [],
        ai_structured_data=ai_structured_data if isinstance(ai_structured_data, dict) else None,
        confidence_score=record.confidence_score,
        ai_summary=record.ai_summary,
        # AI pipeline fields
        document_type=record.document_type,
        classification_confidence=record.classification_confidence,
        classification_reason=record.classification_reason,
        ocr_quality_score=record.ocr_quality_score,
        processing_time=record.processing_time,
        ai_version=record.ai_version,
        schema_validation_passed=record.schema_validation_passed,
        validation_errors=record.validation_errors,
        document_title=doc_title,
        condition=cond,
        condition_status=cond_status,
        component_confidence=ai_structured_data.get("component_confidence") if ai_structured_data else None,
        ai_status=record.ai_status,
        laboratory_id=record.laboratory_id,
        technician_id=record.technician_id,
        verification_status=record.verification_status,
        laboratory_name=record.laboratory.name if record.laboratory else None,
        qr_status=qr_status,
        qr_verification_id=qr_verification_id,
    )


def _prescription_to_medical_record_public(prescription: Prescription, db: Session) -> MedicalRecordPublic:
    doctor = db.query(Doctor).filter(Doctor.user_id == prescription.doctor_id).first()
    
    # Medicines list
    detected_meds = []
    for m in prescription.medicines:
        detected_meds.append({
            "name": m.medicine_name,
            "dosage": m.strength or m.dosage or '',
            "duration": m.duration,
            "instructions": f"{m.frequency} - {m.food_instruction}"
        })
        
    ai_structured_data = {
        "possible_conditions": [prescription.diagnosis],
        "confidence": 100.0,
        "summary": f"Digital prescription by Dr. {doctor.full_name if doctor else ''} for {prescription.diagnosis}.",
        "doctor_or_hospital": doctor.hospital if doctor else "Clinic",
        "document_type": "prescription"
    }
    
    # Resolve active verification status
    active_verification = next((v for v in prescription.verifications if v.status == "active"), None)
    qr_status = "active" if active_verification else "none"
    if qr_status == "none":
        revoked_verification = next((v for v in prescription.verifications if v.status == "revoked"), None)
        if revoked_verification:
            qr_status = "revoked"
    qr_verification_id = active_verification.verification_id if active_verification else None

    presc_title = f"Prescription — {prescription.diagnosis}" if prescription.diagnosis else "Prescription"

    return MedicalRecordPublic(
        id=prescription.id,
        record_type="prescription",
        file_url=f"/prescriptions/{prescription.prescription_id}/view",
        original_filename=f"Prescription-{prescription.prescription_id}.pdf",
        display_title=presc_title,
        uploaded_at=prescription.created_at,
        notes=prescription.notes,
        extracted_text=f"Symptoms: {prescription.symptoms}. Diagnosis: {prescription.diagnosis}. Notes: {prescription.notes}.",
        cleaned_text=f"Symptoms: {prescription.symptoms}. Diagnosis: {prescription.diagnosis}. Notes: {prescription.notes}.",
        detected_medicines=detected_meds,
        probable_conditions=[prescription.diagnosis],
        ai_structured_data=ai_structured_data,
        confidence_score=100.0,
        ai_summary=f"Digital prescription by Dr. {doctor.full_name if doctor else ''} for {prescription.diagnosis}.",
        document_type="prescription",
        classification_confidence=100.0,
        classification_reason="Digitally created prescription by doctor.",
        ocr_quality_score=100.0,
        processing_time=0.0,
        ai_version="digital",
        schema_validation_passed=True,
        validation_errors=None,
        document_title=presc_title,
        condition=prescription.diagnosis,
        condition_status="confirmed",
        component_confidence={"diagnosis": 1.0, "medicines": 1.0},
        ai_status="DETERMINISTIC_COMPLETED",
        qr_status=qr_status,
        qr_verification_id=qr_verification_id,
    )


def _matches_search(record: MedicalRecordPublic, search: str, filter_by: str) -> bool:
    if not search:
        return True
    term = search.lower()
    
    # check record type
    if filter_by == "type" and term in record.record_type.lower():
        return True
        
    # check medicine
    if filter_by == "medicine":
        for m in record.detected_medicines:
            if term in m.get("name", "").lower():
                return True
        return False
        
    # check condition
    if filter_by == "condition":
        for c in record.probable_conditions:
            if term in c.lower():
                return True
        if record.ai_summary and term in record.ai_summary.lower():
            return True
        return False
        
    # check ocr
    if filter_by == "ocr":
        if record.extracted_text and term in record.extracted_text.lower():
            return True
        if record.cleaned_text and term in record.cleaned_text.lower():
            return True
        return False
        
    # check all (default)
    if filter_by == "all":
        if term in record.original_filename.lower():
            return True
        if term in record.record_type.lower():
            return True
        if record.notes and term in record.notes.lower():
            return True
        if record.extracted_text and term in record.extracted_text.lower():
            return True
        if record.cleaned_text and term in record.cleaned_text.lower():
            return True
        if record.ai_summary and term in record.ai_summary.lower():
            return True
        for c in record.probable_conditions:
            if term in c.lower():
                return True
        for m in record.detected_medicines:
            if term in m.get("name", "").lower() or term in m.get("dosage", "").lower() or term in m.get("instructions", "").lower():
                return True
        # check doctor/hospital from structured data
        if record.ai_structured_data:
            doc_hosp = record.ai_structured_data.get("doctor_or_hospital", "")
            if doc_hosp and term in doc_hosp.lower():
                return True
                
    return False


def _record_file_path(record: MedicalRecord) -> Path:
    stored_name = Path(record.file_url or "").name
    return UPLOAD_DIR / stored_name


def _apply_record_search(query, search: str | None, filter_by: str = "all"):
    search_term = (search or "").strip()
    if not search_term:
        return query
    like_term = f"%{search_term}%"
    searchable_fields = {
        "all": [
            MedicalRecord.original_filename,
            MedicalRecord.record_type,
            MedicalRecord.notes,
            MedicalRecord.extracted_text,
            MedicalRecord.cleaned_text,
            MedicalRecord.detected_medicines,
            MedicalRecord.probable_conditions,
            MedicalRecord.ai_structured_data,
            MedicalRecord.ai_summary, # Add for search
        ],
        "medicine": [MedicalRecord.detected_medicines, MedicalRecord.ai_structured_data],
        "condition": [MedicalRecord.probable_conditions, MedicalRecord.ai_structured_data, MedicalRecord.ai_summary],
        "ocr": [MedicalRecord.extracted_text, MedicalRecord.cleaned_text],
        "type": [MedicalRecord.record_type],
        "month": [],
    }
    filters = [
        field.like(like_term)
        for field in searchable_fields.get(filter_by, searchable_fields["all"])
    ]

    month_lookup = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }
    lowered = search_term.lower()
    for month_name, month_number in month_lookup.items():
        if month_name.startswith(lowered) or month_name in lowered:
            if filter_by in ("all", "month"):
                filters.append(func.month(MedicalRecord.uploaded_at) == month_number)
            break

    year_match = re.search(r"\b(20\d{2}|19\d{2})\b", search_term)
    if year_match and filter_by in ("all", "month"):
        filters.append(func.year(MedicalRecord.uploaded_at) == int(year_match.group(1)))

    if not filters:
        return query
    return query.filter(or_(*filters))


def _expire_access_requests(db: Session, patient_id: int | None = None) -> None:
    query = db.query(AccessRequest).filter(
        AccessRequest.status == "approved",
        AccessRequest.expires_at.isnot(None),
        AccessRequest.expires_at <= _now_utc(),
    )
    if patient_id is not None:
        query = query.filter(AccessRequest.patient_id == patient_id)

    expired_requests = query.all()
    if not expired_requests:
        return
    for access_request in expired_requests:
        access_request.status = "expired"
    db.commit()


def _expire_access_request_if_needed(request: AccessRequest, db: Session) -> None:
    if (
        request.status == "approved"
        and request.expires_at
        and request.expires_at <= _now_utc()
    ):
        request.status = "expired"
        db.commit()
        db.refresh(request)


def _active_access_request(
    db: Session,
    *,
    patient_id: int,
    doctor_id: int,
) -> AccessRequest | None:
    _expire_access_requests(db, patient_id=patient_id)
    request = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.patient_id == patient_id,
            AccessRequest.doctor_id == doctor_id,
            AccessRequest.status == "approved",
        )
        .order_by(AccessRequest.id.desc())
        .first()
    )
    if request:
        _expire_access_request_if_needed(request, db)
        if request.status == "approved":
            return request
    return None


def _access_request_public(request: AccessRequest) -> AccessRequestPublic:
    doctor = request.doctor
    return AccessRequestPublic(
        id=request.id,
        status=request.status,
        doctor_name=(doctor.full_name if doctor else "") or "",
        hospital=(doctor.hospital if doctor else "") or "",
        created_at=request.created_at,
        expires_at=request.expires_at,
    )


def _public_user(user: UserModel, db: Session = None) -> UserPublic:
    if user.role == "patient" and user.patient:
        patient = user.patient
        profiles_list = [
            {
                "id": p.id,
                "full_name": p.full_name,
                "is_primary": p.is_primary,
                "relationship": p.relationship_to_account,
                "patient_uid": p.patient_uid,
            }
            for p in user.patients
        ]
        return UserPublic(
            id=user.id,
            role=user.role,
            name=patient.full_name or "",
            patient_uid=patient.patient_uid or "",
            mobile=user.phone_number or patient.mobile or "",
            is_verified=True,
            profiles=profiles_list,
        )

    if user.role == "doctor" and user.doctor:
        doctor = user.doctor
        return UserPublic(
            id=user.id,
            role=user.role,
            name=doctor.full_name or "",
            email=doctor.email or "",
            hospital=doctor.hospital or "",
            organization_vritan_id=doctor.hospital_vritan_id or "",
            is_verified=bool(doctor.is_verified),
            verification_status=doctor.verification_status or "pending",
        )

    if user.role == "hospital_admin":
        from org_models import Organization, OrganizationMembership
        org_name = "Hospital Network"
        v_status = "VERIFIED"
        org_vritan_id = ""
        if db:
            mem = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == user.id).first()
            if mem and mem.organization:
                org_name = mem.organization.name
                v_status = mem.organization.verification_status
                org_vritan_id = mem.organization.vritan_id or ""
        return UserPublic(
            id=user.id,
            role=user.role,
            name=org_name,
            hospital=org_name,
            organization_vritan_id=org_vritan_id,
            is_verified=v_status == "VERIFIED",
            verification_status=v_status,
        )

    if user.role == "pharmacist":
        from pharmacy_models import Pharmacy
        p_name = "Pharmacy"
        v_status = "VERIFIED"
        if db:
            p = db.query(Pharmacy).filter(Pharmacy.user_id == user.id).first()
            if p:
                p_name = p.name
                v_status = p.verification_status
        return UserPublic(
            id=user.id,
            role=user.role,
            name=p_name,
            is_verified=v_status == "VERIFIED",
            verification_status=v_status,
        )

    if user.role == "government_authority":
        from models import GovernmentAuthority
        g_name = "Government Health Authority"
        v_status = "VERIFIED"
        if db:
            g = db.query(GovernmentAuthority).filter(GovernmentAuthority.user_id == user.id).first()
            if g:
                g_name = g.agency_name
                v_status = g.verification_status
        return UserPublic(
            id=user.id,
            role=user.role,
            name=g_name,
            is_verified=v_status == "VERIFIED",
            verification_status=v_status,
        )

    return UserPublic(
        id=user.id,
        role=user.role,
        name=user.role.title(),
        is_verified=True,
    )


def _login_response_for_user(user: UserModel, db: Session = None) -> LoginResponse:
    user_email = user.doctor.email if user.doctor else None
    user_mobile = user.patient.mobile if user.patient else None

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user_email,
        mobile=user_mobile,
        is_verified=True,
    )

    return LoginResponse(access_token=token, user=_public_user(user, db))


@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    try:
        normalized_mobile = normalize_phone_number(payload.mobile)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    
    mobile_exists, reason = _check_duplicate_account(db, normalized_mobile)
    if os.getenv("APP_ENV", "development").lower() != "production":
        print(f"[PATIENT_AUTH_AUDIT] send-otp: raw_mobile={payload.mobile}, normalized_mobile={normalized_mobile}, exists={mobile_exists}, reason={reason}")

    if payload.purpose == "register" and mobile_exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This mobile number is already registered",
        )
    if payload.purpose == "login" and not mobile_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient account found for this mobile number",
        )

    otp = _make_otp()
    patient_otp_store[payload.mobile] = {
        "otp": otp,
        "verified": False,
        "purpose": payload.purpose,
    }

    print(f"Development OTP for patient mobile {payload.mobile}: {otp}")
    print(f"UPLOAD STARTED")

    response = {"message": "OTP sent successfully"}
    if os.getenv("APP_ENV", "development").lower() != "production":
        response["dev_otp"] = otp
    return response


@router.post("/verify-otp")
def verify_otp(payload: VerifyOtpRequest):
    saved = patient_otp_store.get(payload.mobile)
    if (
        not saved
        or saved.get("otp") != payload.otp
        or saved.get("purpose") != payload.purpose
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP",
        )

    saved["verified"] = True

    return {"message": "OTP verified successfully"}


@router.post("/register")
@router.post("/register/doctor")
def register(payload: UserRegister, db: Session = Depends(get_db)):
    try:
        if payload.role == "patient":
            # 1. Decode & Verify Firebase token first
            try:
                decoded_token = verify_firebase_token(payload.firebase_id_token)
                firebase_uid = decoded_token.get("uid")
                token_phone = decoded_token.get("phone_number")
            except RuntimeError as e:
                if os.getenv("APP_ENV", "development").lower() != "production":
                    print(f"[PATIENT_AUTH_AUDIT] register error verifying firebase token runtime: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=str(e),
                )
            except ValueError as e:
                if os.getenv("APP_ENV", "development").lower() != "production":
                    print(f"[PATIENT_AUTH_AUDIT] register error verifying firebase token value: {e}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=str(e),
                )
                
            # 2. Extract and Normalize Phone Number
            mobile_to_use = token_phone if token_phone else payload.mobile
            try:
                normalized_mobile = normalize_phone_number(mobile_to_use)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(e),
                )
                
            # 3. Check Duplicate Registration
            is_dup, reason = _check_duplicate_account(db, normalized_mobile, firebase_uid)
            if os.getenv("APP_ENV", "development").lower() != "production":
                print(f"[PATIENT_AUTH_AUDIT] register decision check: raw_mobile={payload.mobile}, "
                      f"token_phone={token_phone}, normalized_mobile={normalized_mobile}, "
                      f"firebase_uid={firebase_uid}, is_dup={is_dup}, reason={reason}")

            if is_dup:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This mobile number is already registered",
                )
            
            db_user = UserModel(
                role=payload.role,
                password=None,
                phone_number=normalized_mobile,
                firebase_uid=firebase_uid,
            )
            db.add(db_user)
            db.flush()
            db.add(
                Patient(
                    user_id=db_user.id,
                    patient_uid=_make_patient_uid(db_user.id),
                    firebase_uid=firebase_uid,
                    full_name=payload.name.strip(),
                    mobile=normalized_mobile,
                    date_of_birth=payload.date_of_birth,
                    gender=payload.gender,
                    blood_group=payload.blood_group,
                    pin_code=payload.pin_code,
                    country=payload.country or "India",
                    state=payload.state,
                    district=payload.district,
                    mandal=payload.mandal,
                    city=payload.city,
                    municipality=payload.municipality,
                    urban_rural=payload.urban_rural,
                    abha_id=payload.abha_id,
                    aadhaar_linked=payload.aadhaar_linked or False,
                    consent_status=payload.consent_status if payload.consent_status is not None else True,
                    consent_terms=payload.consent_terms if payload.consent_terms is not None else True,
                    consent_privacy=payload.consent_privacy if payload.consent_privacy is not None else True,
                    consent_medical_storage=payload.consent_medical_storage if payload.consent_medical_storage is not None else True,
                    consent_analytics=payload.consent_analytics if payload.consent_analytics is not None else True,
                    consent_research=payload.consent_research or False,
                    consent_marketing=payload.consent_marketing or False,
                    is_primary=True,
                    relationship_to_account="Self",
                )
            )
        else:
            # Uniqueness checks for doctors
            email_exists = (
                db.query(Doctor)
                .filter(Doctor.email == str(payload.email).lower())
                .first()
            )
            if email_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered",
                )
            
            phone_exists = (
                db.query(Doctor)
                .filter(Doctor.phone == payload.phone)
                .first()
            )
            if phone_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Phone number already registered",
                )
            
            license_exists = (
                db.query(Doctor)
                .filter(Doctor.medical_license_number == payload.medical_license_number)
                .first()
            )
            if license_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Medical license number already registered",
                )
            
            hashed = hash_password(payload.password)
            vritan_doc_id = f"VR-DOC-{uuid.uuid4().hex[:6].upper()}"
            db_user = UserModel(
                role=payload.role,
                password=hashed,
            )
            db.add(db_user)
            db.flush()
            db.add(
                Doctor(
                    user_id=db_user.id,
                    vritan_id=vritan_doc_id,
                    full_name=payload.name.strip(),
                    email=str(payload.email).lower(),
                    phone=payload.phone,
                    hospital=payload.hospital.strip() if payload.hospital else None,
                    specialization=payload.specialization.strip() if payload.specialization else None,
                    secondary_specialization=payload.secondary_specialization.strip() if payload.secondary_specialization else None,
                    medical_license_number=payload.medical_license_number.strip(),
                    years_of_experience=payload.years_of_experience,
                    qualification=payload.qualification,
                    registration_council=payload.registration_council,
                    languages_spoken=payload.languages_spoken,
                    clinic_address=payload.clinic_address,
                    clinic_pin_code=payload.clinic_pin_code,
                    clinic_state=payload.clinic_state,
                    clinic_district=payload.clinic_district,
                    clinic_mandal=payload.clinic_mandal,
                    clinic_city=payload.clinic_city,
                    consultation_modes=payload.consultation_modes,
                    identity_proof_url=payload.identity_proof_url,
                    degree_certificates_url=payload.degree_certificates_url,
                    practice_type=payload.practice_type,
                    clinic_name=payload.clinic_name,
                    is_verified=False,
                    verification_status="PENDING_ADMIN_VERIFICATION" if os.getenv("DEV_MODE", "false").lower() == "true" else "PENDING_EMAIL_VERIFICATION",
                )
            )

        db.commit()
        db.refresh(db_user)

        if payload.role == "patient":
            patient_otp_store.pop(payload.mobile, None)
        else:
            try:
                import secrets
                from datetime import timezone
                from models import EmailVerificationToken
                token_str = secrets.token_urlsafe(32)
                token_obj = EmailVerificationToken(
                    token=token_str,
                    user_id=db_user.id,
                    email=str(payload.email).lower(),
                    expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24),
                    is_used=False
                )
                db.add(token_obj)
                db.commit()
                
                verify_link = f"http://localhost:5173/verify-email?token={token_str}"
                print(f"[DOCTOR REGISTRATION EMAIL] Verification link: {verify_link}")
                
                from services.email_service import _send_email
                doctor_html = f"""
                <html>
                <body>
                    <h2>Welcome to Vritan, Dr. {payload.name.strip()}!</h2>
                    <p>Thank you for registering. Please verify your official email address by clicking the link below:</p>
                    <p><a href="{verify_link}">{verify_link}</a></p>
                    <p>This verification link will expire in 24 hours.</p>
                    <hr>
                    <p style="color: gray; font-size: 12px;">This is an automated email from Vritan.</p>
                </body>
                </html>
                """
                _send_email(str(payload.email).lower(), "Verify Your Vritan Doctor Account", doctor_html)
            except Exception as e:
                print(f"[DOCTOR EMAIL GENERATION ERROR]: {e}")

            # Send email notification to admin about new doctor registration
            try:
                send_doctor_verification_request_to_admin(
                    doctor_name=payload.name.strip(),
                    doctor_email=str(payload.email).lower(),
                    doctor_phone=payload.phone,
                    medical_license_number=payload.medical_license_number.strip(),
                    hospital=payload.hospital.strip(),
                    specialization=payload.specialization.strip() if payload.specialization else None,
                    years_of_experience=payload.years_of_experience,
                )
            except Exception as e:
                print(f"[DOCTOR REGISTRATION EMAIL ERROR] Safe admin notification failed: {e}")

        return {"message": f"{payload.role} registered successfully"}
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/register-doctor")
def register_doctor(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    hospital: str = Form(None),
    hospital_vritan_id: Optional[str] = Form(None),
    medical_license_number: str = Form(...),
    years_of_experience: int = Form(...),
    password: str = Form(...),
    specialization: str = Form(None),
    secondary_specialization: str = Form(None),
    qualification: str = Form(None),
    registration_council: str = Form(None),
    languages_spoken: str = Form(None),
    clinic_address: str = Form(None),
    clinic_pin_code: str = Form(None),
    clinic_state: str = Form(None),
    clinic_district: str = Form(None),
    clinic_mandal: str = Form(None),
    clinic_city: str = Form(None),
    consultation_modes: str = Form(None),
    practice_type: str = Form(None),
    clinic_name: str = Form(None),
    file: UploadFile = File(...),
    identity_proof: Optional[UploadFile] = File(None),
    invite_token: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    invite = None
    if invite_token:
        import hashlib
        from org_models import OrganizationInvitation, InvitationStatus
        from datetime import datetime, timezone
        
        token_hash = hashlib.sha256(invite_token.strip().encode()).hexdigest()
        invite = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.invite_token_hash == token_hash
        ).first()
        
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid invitation token")
            
        # Idempotency check
        if invite.status == InvitationStatus.ACCEPTED:
            existing_user = db.query(UserModel).filter(UserModel.email == invite.email.lower()).first()
            if existing_user:
                doc_prof = db.query(Doctor).filter(Doctor.user_id == existing_user.id).first()
                return {
                    "message": "Registration successful. Welcome to Vritan! Please log in.",
                    "email": existing_user.email,
                    "vritan_id": doc_prof.vritan_id if doc_prof else None,
                    "status": "APPROVED"
                }
                
        if invite.status != InvitationStatus.PENDING:
            raise HTTPException(status_code=400, detail=f"This invitation link is not active. Status: {invite.status.value}")
            
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if invite.expires_at < now:
            invite.status = InvitationStatus.EXPIRED
            db.commit()
            raise HTTPException(status_code=400, detail="This invitation link has expired (7-day limit).")
            
        # Override the email parameter with the invited address
        email = invite.email

    # Uniqueness checks using the User table as the source of truth
    db_user = db.query(UserModel).filter(UserModel.email == str(email).lower()).first()
    if db_user:
        # Check if Doctor profile already exists
        existing_doc = db.query(Doctor).filter(Doctor.user_id == db_user.id).first()
        if existing_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor profile already registered for this email.",
            )
    
    try:
        phone_digits = normalize_phone_number(phone)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
        
    # Check phone in Doctor table
    phone_exists = (
        db.query(Doctor)
        .filter(Doctor.phone == phone_digits)
        .first()
    )
    if phone_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered",
        )
    
    license_exists = (
        db.query(Doctor)
        .filter(Doctor.medical_license_number == medical_license_number.strip())
        .first()
    )
    if license_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medical license number already registered",
        )
    
    # Save verification file
    extension = _safe_upload_extension(file.filename)
    verification_dir = UPLOAD_DIR / "verification_documents"
    verification_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"doctor_verification_{secrets.token_urlsafe(16)}{extension}"
    destination = verification_dir / stored_filename
    bytes_written = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(status_code=400, detail="File size should be less than 10MB")
                buffer.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save verification document.")

    # Save identity proof file
    identity_proof_url = None
    if identity_proof:
        id_ext = _safe_upload_extension(identity_proof.filename)
        id_filename = f"doctor_identity_{secrets.token_urlsafe(16)}{id_ext}"
        id_dest = verification_dir / id_filename
        id_bytes_written = 0
        try:
            with id_dest.open("wb") as buffer:
                while chunk := identity_proof.file.read(1024 * 1024):
                    id_bytes_written += len(chunk)
                    if id_bytes_written > MAX_UPLOAD_BYTES:
                        buffer.close()
                        id_dest.unlink(missing_ok=True)
                        raise HTTPException(status_code=400, detail="File size should be less than 10MB")
                    buffer.write(chunk)
            identity_proof_url = f"/uploads/verification_documents/{id_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail="Failed to save identity document.")

    # Create user and doctor in a transaction block
    try:
        if not db_user:
            hashed = hash_password(password)
            db_user = UserModel(
                role="doctor",
                password=hashed,
                email=str(email).lower(),
                phone_number=phone_digits,
                verification_status="APPROVED" if invite else "PENDING_EMAIL_VERIFICATION",
            )
            db.add(db_user)
            db.flush()
        else:
            # Reuse existing User, upgrade role to doctor
            db_user.role = "doctor"
            if invite:
                db_user.verification_status = "APPROVED"
            db.flush()
        
        verification_document_url = f"/uploads/verification_documents/{stored_filename}"
        vritan_doc_id = f"VR-DOC-{uuid.uuid4().hex[:6].upper()}"

        doctor_obj = Doctor(
            user_id=db_user.id,
            vritan_id=vritan_doc_id,
            full_name=name.strip(),
            email=str(email).lower(),
            phone=phone_digits,
            hospital=hospital.strip() if hospital else None,
            hospital_vritan_id=hospital_vritan_id.strip() if hospital_vritan_id else None,
            hospital_registered=True if hospital_vritan_id else False,
            specialization=specialization.strip() if specialization else None,
            secondary_specialization=secondary_specialization.strip() if secondary_specialization else None,
            medical_license_number=medical_license_number.strip(),
            years_of_experience=years_of_experience,
            verification_document_url=verification_document_url,
            identity_proof_url=identity_proof_url,
            qualification=qualification,
            registration_council=registration_council,
            languages_spoken=languages_spoken,
            clinic_address=clinic_address,
            clinic_pin_code=clinic_pin_code,
            clinic_state=clinic_state,
            clinic_district=clinic_district,
            clinic_mandal=clinic_mandal,
            clinic_city=clinic_city,
            consultation_modes=consultation_modes,
            practice_type=practice_type,
            clinic_name=clinic_name,
            is_verified=True if invite else False,
            verification_status="APPROVED" if invite else "PENDING_EMAIL_VERIFICATION",
        )
        db.add(doctor_obj)
        db.flush()

        # Create DoctorProfile
        from appointment_models import DoctorProfile
        doctor_profile = DoctorProfile(
            doctor_id=db_user.id,
            consultation_fee=500.0,
            languages=languages_spoken,
            qualification=qualification,
            rating=4.5,
            buffer_minutes=0,
            max_appointments_per_day=20,
            advance_booking_window_days=30,
            cancellation_notice_hours=24
        )
        db.add(doctor_profile)
        db.flush()

        from org_models import Organization, Branch, OrganizationMembership, OrganizationEmployeeAssignment, StaffRole, EmploymentType, InvitationStatus

        # Normalize practice type to match comparisons
        pt_val = str(practice_type).strip() if practice_type else "Hospital / Healthcare Organization"

        if invite:
            # Link membership (establishing org connection)
            membership = db.query(OrganizationMembership).filter(
                OrganizationMembership.organization_id == invite.organization_id,
                OrganizationMembership.user_id == db_user.id
            ).first()
            if not membership:
                membership = OrganizationMembership(
                    organization_id=invite.organization_id,
                    user_id=db_user.id,
                    role="doctor",
                    status="ACTIVE"
                )
                db.add(membership)
            else:
                membership.status = "ACTIVE"
            
            # Link branch assignment
            try:
                emp_role = StaffRole(invite.role.value if hasattr(invite.role, 'value') else str(invite.role))
            except:
                emp_role = StaffRole.DOCTOR

            assignment = OrganizationEmployeeAssignment(
                organization_id=invite.organization_id,
                branch_id=invite.branch_id,
                department_id=invite.department_id,
                user_id=db_user.id,
                role=emp_role,
                designation=invite.designation,
                employment_type=EmploymentType.EMPLOYED,
                status="ACTIVE"
            )
            db.add(assignment)
            
            # Link hospital profile fields (for compatibility)
            org = db.query(Organization).filter(Organization.id == invite.organization_id).first()
            if org:
                doctor_obj.hospital_vritan_id = org.vritan_id
                doctor_obj.hospital_registered = True
                doctor_obj.hospital = org.name

            # Update invitation status to ACCEPTED
            invite.status = InvitationStatus.ACCEPTED
            invite.accepted_at = datetime.utcnow()
            invite.accepted_by_id = db_user.id
        else:
            # 1. Independent Clinic / Hybrid Clinic Creation
            if pt_val in ("Independent Clinic", "Hybrid"):
                clinic_org = Organization(
                    name=clinic_name.strip() if clinic_name else f"{name.strip()}'s Clinic",
                    organization_type="SOLO_CLINIC",
                    official_email=str(email).lower(),
                    official_phone=phone_digits,
                    email=str(email).lower(),
                    phone=phone_digits,
                    address=clinic_address,
                    city=clinic_city,
                    state=clinic_state,
                    pincode=clinic_pin_code,
                    district=clinic_district,
                    verification_status="PENDING_EMAIL_VERIFICATION",
                    status="ACTIVE"
                )
                db.add(clinic_org)
                db.flush()

                clinic_branch = Branch(
                    organization_id=clinic_org.id,
                    name=(clinic_name.strip() if clinic_name else f"{name.strip()}'s Clinic") + " Main Branch",
                    address=clinic_address,
                    email=str(email).lower(),
                    phone=phone_digits,
                    status="ACTIVE",
                    is_active=True,
                    is_default=True
                )
                db.add(clinic_branch)
                db.flush()

                membership = OrganizationMembership(
                    organization_id=clinic_org.id,
                    user_id=db_user.id,
                    role="owner",
                    status="ACTIVE"
                )
                db.add(membership)

                assignment = OrganizationEmployeeAssignment(
                    organization_id=clinic_org.id,
                    branch_id=clinic_branch.id,
                    department_id=None,
                    user_id=db_user.id,
                    role=StaffRole.DOCTOR,
                    designation="Clinic Owner",
                    employment_type=EmploymentType.EMPLOYED,
                    status="ACTIVE"
                )
                db.add(assignment)

            # 2. Hospital / Hybrid Hospital Affiliation
            if pt_val in ("Hospital / Healthcare Organization", "Hybrid") and (hospital or hospital_vritan_id):
                hosp_org = None
                if hospital_vritan_id:
                    hosp_org = db.query(Organization).filter(Organization.vritan_id == hospital_vritan_id.strip()).first()
                if not hosp_org and hospital:
                    hosp_org = db.query(Organization).filter(Organization.name.ilike(hospital.strip())).first()
                    
                if hosp_org:
                    hosp_branch = db.query(Branch).filter(Branch.organization_id == hosp_org.id).first()
                    if hosp_branch:
                        membership = OrganizationMembership(
                            organization_id=hosp_org.id,
                            user_id=db_user.id,
                            role="doctor",
                            status="ACTIVE"
                        )
                        db.add(membership)
                        
                        assignment = OrganizationEmployeeAssignment(
                            organization_id=hosp_org.id,
                            branch_id=hosp_branch.id,
                            department_id=None,
                            user_id=db_user.id,
                            role=StaffRole.DOCTOR,
                            designation="Visiting Doctor" if pt_val == "Hybrid" else "Employed Doctor",
                            employment_type=EmploymentType.VISITING if pt_val == "Hybrid" else EmploymentType.EMPLOYED,
                            status="ACTIVE"
                        )
                        db.add(assignment)

                        # Sync with legacy BranchDoctorAffiliation
                        from org_models import BranchDoctorAffiliation
                        affiliation = BranchDoctorAffiliation(
                            branch_id=hosp_branch.id,
                            doctor_id=db_user.id,
                            department_id=None,
                            status="ACTIVE"
                        )
                        db.add(affiliation)

        db.commit()
    except Exception as db_err:
        db.rollback()
        try:
            destination.unlink(missing_ok=True)
            if identity_proof_url:
                id_dest.unlink(missing_ok=True)
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction failed: {str(db_err)}"
        )

    # 3. Generate and send verification OTP and admin notification after DB commit
    if invite:
        try:
            from services.otp_service import log_security_event
            log_security_event(db, db_user.id, str(email).lower(), "INVITATION_ACCEPTED", "SUCCESS", "Doctor invitation accepted, profile activated")
            
            return {
                "message": "Registration successful. Welcome to Vritan! Please proceed to login.",
                "status": "APPROVED",
                "email": str(email).lower(),
                "vritan_id": vritan_doc_id
            }
        except Exception as e:
            print(f"[DOCTOR REGISTRATION INVITATION SUCCESS LOG ERROR]: {e}")
            return {
                "message": "Registration successful. Please proceed to login.",
                "status": "APPROVED",
                "email": str(email).lower(),
                "vritan_id": vritan_doc_id
            }

    try:
        from services.otp_service import generate_verification_otp, log_security_event
        log_security_event(db, db_user.id, str(email).lower(), "REGISTRATION_STARTED", "SUCCESS", "Doctor registration created, sending OTP")
        generate_verification_otp(db, db_user.id, str(email).lower())

        # Notify administrator
        from services.email_service import send_doctor_verification_request_to_admin
        send_doctor_verification_request_to_admin(
            doctor_name=name.strip(),
            doctor_email=str(email).lower(),
            doctor_phone=phone_digits,
            medical_license_number=medical_license_number.strip(),
            hospital=hospital.strip() if hospital else (clinic_name.strip() if clinic_name else "Independent Practice"),
            specialization=specialization.strip() if specialization else None,
            years_of_experience=years_of_experience,
        )
    except Exception as e:
        print(f"[DOCTOR REGISTRATION EMAIL ERROR] Safe notification trigger failed: {e}")

    return {
        "message": "Registration successful. Please verify email OTP.",
        "email": str(email).lower(),
        "vritan_id": vritan_doc_id
    }


@router.post("/register-hospital")
def register_hospital(payload: dict, db: Session = Depends(get_db)):
    """Register a new hospital organization and auto-generate verification token."""
    import traceback
    from datetime import datetime, timedelta, timezone
    from models import EmailVerificationToken, User as UserModel
    from org_models import Organization, OrganizationMembership, HospitalDocument
    from sqlalchemy.exc import SQLAlchemyError, IntegrityError

    print(f"[INSTRUMENT] Starting hospital registration. Payload: {payload}")

    try:
        # 1. Validate request payload
        print("[INSTRUMENT] Step 1: Validate request payload - START")
        name = payload.get("name") or payload.get("hospital_name")
        legal_name = payload.get("legal_name")
        org_type = payload.get("organization_type") or payload.get("hospital_type", "HOSPITAL")
        reg_number = payload.get("registration_number")
        gst_number = payload.get("gst_number")
        nabh_status = payload.get("nabh_status")
        nabl_status = payload.get("nabl_status")
        year_established = payload.get("year_established")
        website = payload.get("website")

        country = payload.get("country", "India")
        state = payload.get("state")
        district = payload.get("district")
        city = payload.get("city")
        mandal = payload.get("mandal")
        pincode = payload.get("pincode") or payload.get("pin_code")
        address = payload.get("address")
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")

        admin_name = payload.get("admin_name") or payload.get("representative_name")
        admin_designation = payload.get("admin_designation") or payload.get("representative_designation")
        admin_email = payload.get("admin_email") or payload.get("email") or payload.get("representative_email")
        admin_phone = payload.get("admin_phone") or payload.get("phone") or payload.get("representative_mobile")
        password = payload.get("password")

        if not name or not password or not admin_email:
            print(f"[INSTRUMENT] Step 1: Validation failed. name={name}, admin_email={admin_email}")
            raise HTTPException(status_code=400, detail="Missing required hospital or admin fields")
        admin_email_normalized = admin_email.strip().lower()
        print(f"[INSTRUMENT] Step 1: Validate request payload - SUCCESS. name={name}, admin_email={admin_email_normalized}")

        # 2. Normalize phone number
        print("[INSTRUMENT] Step 2: Normalize phone number - START")
        normalized_phone = None
        if admin_phone:
            try:
                normalized_phone = normalize_phone_number(admin_phone)
                print(f"[INSTRUMENT] Step 2: Phone normalized: {admin_phone} -> {normalized_phone}")
            except ValueError as e:
                print(f"[INSTRUMENT] Step 2: Phone normalization failed: {e}")
                raise HTTPException(status_code=400, detail=str(e))
        else:
            print("[INSTRUMENT] Step 2: No phone number provided, skipping normalization")
        print("[INSTRUMENT] Step 2: Normalize phone number - SUCCESS")

        # 3. Check duplicate organization name
        print("[INSTRUMENT] Step 3: Check duplicate organization name - START")
        existing_org = db.query(Organization).filter(Organization.name == name.strip()).first()
        if existing_org:
            print(f"[INSTRUMENT] Step 3: Duplicate organization name found: {name} (org.id={existing_org.id})")
            raise HTTPException(status_code=400, detail="An organization with this name is already registered")
        print("[INSTRUMENT] Step 3: Check duplicate organization name - SUCCESS (no duplicate)")

        # 3b. Check for existing user with this email — handle orphaned users from failed onboarding
        print("[INSTRUMENT] Step 3b: Check for existing user with email - START")
        existing_user = db.query(UserModel).filter(UserModel.email == admin_email_normalized).first()
        if existing_user:
            print(f"[INSTRUMENT] Step 3b: Existing user found with email={admin_email_normalized}, "
                  f"user.id={existing_user.id}, role={existing_user.role}")
            # Check whether this user is bound to an organization (completed onboarding)
            existing_membership = db.query(OrganizationMembership).filter(
                OrganizationMembership.user_id == existing_user.id
            ).first()
            if existing_membership:
                # Fully registered user — cannot re-register with this email
                print(f"[INSTRUMENT] Step 3b: User id={existing_user.id} is bound to "
                      f"organization_id={existing_membership.organization_id}. Blocking registration.")
                # Fetch org name for user-friendly error
                from org_models import Organization as _OrgModel
                _blocking_org = db.query(_OrgModel).filter(_OrgModel.id == existing_membership.organization_id).first()
                _blocking_org_name = _blocking_org.name if _blocking_org else f"organization #{existing_membership.organization_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f'This email is already the administrator of "{_blocking_org_name}". Please use a different email address or contact support if you believe this is an error.'
                )
            else:
                # Orphaned user from a failed/incomplete previous onboarding — safe to clean up and retry
                print(f"[INSTRUMENT] Step 3b: ORPHANED user detected (user.id={existing_user.id}, "
                      f"no organization linked). Deleting orphan to allow recovery.")
                db.delete(existing_user)
                db.flush()
                print(f"[INSTRUMENT] Step 3b: Orphaned user id={existing_user.id} deleted successfully.")
        else:
            print(f"[INSTRUMENT] Step 3b: No existing user found with email={admin_email_normalized} - OK")
        print("[INSTRUMENT] Step 3b: Email duplicate check - SUCCESS")

        # 4. Check duplicate phone (orphan-aware)
        print("[INSTRUMENT] Step 4: Check duplicate phone - START")
        if normalized_phone:
            phone_variants = [normalized_phone, f"+91{normalized_phone}", f"91{normalized_phone}"]
            existing_phone_user = db.query(UserModel).filter(
                UserModel.phone_number.in_(phone_variants)
            ).first()
            if existing_phone_user:
                phone_membership = db.query(OrganizationMembership).filter(
                    OrganizationMembership.user_id == existing_phone_user.id
                ).first()
                if phone_membership:
                    print(f"[INSTRUMENT] Step 4: Duplicate phone found for active user "
                          f"id={existing_phone_user.id}, org={phone_membership.organization_id}")
                    raise HTTPException(status_code=400, detail="Phone number already registered")
                else:
                    print(f"[INSTRUMENT] Step 4: ORPHANED phone-matched user detected "
                          f"(user.id={existing_phone_user.id}). Cleaning up orphan.")
                    db.delete(existing_phone_user)
                    db.flush()
                    print(f"[INSTRUMENT] Step 4: Orphaned phone-matched user id={existing_phone_user.id} deleted.")
        print("[INSTRUMENT] Step 4: Check duplicate phone - SUCCESS")

        # 5. Create User (hospital_admin)
        print("[INSTRUMENT] Step 5: Create User - START")
        hashed = hash_password(password)
        user = UserModel(
            role="hospital_admin",
            password=hashed,
            email=admin_email_normalized,
            phone_number=normalized_phone,
            verification_status="PENDING_EMAIL_VERIFICATION"
        )
        db.add(user)
        db.flush()
        print(f"[INSTRUMENT] Step 5: Create User - SUCCESS. user.id={user.id}, email={user.email}")

        # 6. Create Organization
        print("[INSTRUMENT] Step 6: Create Organization - START")
        org = Organization(
            name=name.strip(),
            vritan_id=None,
            registration_number=reg_number,
            gst_number=gst_number,
            nabh_status=nabh_status,
            nabl_status=nabl_status,
            legal_name=legal_name,
            ownership=payload.get("ownership"),
            hospital_level=payload.get("hospital_level"),
            official_email=admin_email_normalized,
            official_phone=admin_phone,
            email=admin_email_normalized,
            phone=admin_phone,
            address=address,
            city=city,
            state=state,
            country=country,
            pincode=pincode,
            district=district,
            website=website,
            latitude=latitude,
            longitude=longitude,
            representative_name=admin_name,
            representative_designation=admin_designation,
            representative_mobile=admin_phone,
            representative_email=admin_email_normalized,
            organization_type=org_type,
            logo_url=payload.get("logo_url"),
            reg_cert_url=payload.get("reg_cert_url"),
            nabh_cert_url=payload.get("nabh_cert_url"),
            gst_doc_url=payload.get("gst_doc_url"),
            hospital_license_url=payload.get("hospital_license_url"),
            verification_status="PENDING_EMAIL_VERIFICATION",
            status="PENDING_VERIFICATION",
        )
        db.add(org)
        db.flush()
        print(f"[INSTRUMENT] Step 6: Create Organization - SUCCESS. org.id={org.id}, org.name={org.name}")

        # 7. Create OrganizationMembership
        print("[INSTRUMENT] Step 7: Create OrganizationMembership - START")
        membership = OrganizationMembership(
            organization_id=org.id,
            user_id=user.id,
            role="admin",
            status="ACTIVE"
        )
        db.add(membership)
        db.flush()
        print(f"[INSTRUMENT] Step 7: Create OrganizationMembership - SUCCESS. membership.id={membership.id}")

        # 8. Create default Branch
        print("[INSTRUMENT] Step 8: Create default Branch - START")
        from org_models import Branch
        branch = Branch(
            organization_id=org.id,
            name=org.name + " Main Branch",
            address=org.address,
            email=org.official_email,
            phone=org.official_phone,
            status="PENDING_VERIFICATION",
            is_active=False,
            is_default=True
        )
        db.add(branch)
        db.flush()
        print(f"[INSTRUMENT] Step 8: Create default Branch - SUCCESS. branch.id={branch.id}")

        # 9. Create document verification records
        print("[INSTRUMENT] Step 9: Create document verification records - START")
        docs_to_add = {
            "REGISTRATION_CERTIFICATE": payload.get("reg_cert_url"),
            "GOVT_LICENSE": payload.get("hospital_license_url"),
            "NABH_CERTIFICATE": payload.get("nabh_cert_url"),
            "GST_CERTIFICATE": payload.get("gst_doc_url"),
            "LOGO": payload.get("logo_url")
        }
        doc_count = 0
        for doc_type, url in docs_to_add.items():
            if url:
                doc_record = HospitalDocument(
                    organization_id=org.id,
                    document_type=doc_type,
                    document_url=url,
                    status="PENDING"
                )
                db.add(doc_record)
                doc_count += 1
                print(f"[INSTRUMENT] Step 9: Added document {doc_type} (url={url})")
        print(f"[INSTRUMENT] Step 9: Create document verification records - SUCCESS. {doc_count} document(s) added.")

        # 10. Pre-commit verification — confirm all entities are pending commit
        print(f"[INSTRUMENT] Step 10: Pre-commit check - org.id={org.id}, org.name={org.name}, "
              f"user.id={user.id}, membership.id={membership.id}, branch.id={branch.id}")

        # 11. Commit entire transaction atomically
        print("[INSTRUMENT] Step 11: Commit transaction - START")
        db.commit()
        print(f"[INSTRUMENT] Step 11: Commit transaction - SUCCESS. "
              f"user.id={user.id}, org.id={org.id}, membership.id={membership.id}, branch.id={branch.id}")

        # 12. Send verification OTP after commit (non-critical — failure does NOT roll back registration)
        try:
            from services.otp_service import generate_verification_otp, log_security_event
            log_security_event(
                db, user.id, admin_email_normalized,
                "REGISTRATION_STARTED", "SUCCESS",
                f"Hospital registration created for org_id={org.id}, sending OTP"
            )
            generate_verification_otp(db, user.id, admin_email_normalized)
            print(f"[INSTRUMENT] Step 12: Verification OTP sent to {admin_email_normalized}")
        except Exception as e:
            print(f"[HOSPITAL REGISTRATION EMAIL ERROR] Safe notification trigger failed: {e}")

        import time
        app_id = f"VR-APP-{time.strftime('%Y')}-{org.id:06d}"
        print(f"[INSTRUMENT] Application ID generated: {app_id}")
        return {
            "message": "Registration successful. Please verify email OTP.",
            "organization_id": org.id,
            "application_id": app_id,
            "email": admin_email_normalized
        }

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as int_err:
        db.rollback()
        print("[INSTRUMENT] !!! INTEGRITY ERROR — possible duplicate key !!!")
        print(f"IntegrityError: {int_err}")
        if hasattr(int_err, 'orig'):
            print(f"Underlying driver error: {int_err.orig}")
        traceback.print_exc()
        raise HTTPException(
            status_code=400,
            detail="A record with these details already exists. Please check your email, phone, or hospital name."
        )
    except SQLAlchemyError as sql_err:
        db.rollback()
        print("[INSTRUMENT] !!! DATABASE ERROR CAUGHT !!!")
        print(f"Exception Type: {type(sql_err)}")
        print(f"SQLAlchemy exception info: {sql_err}")
        if hasattr(sql_err, 'orig'):
            print(f"Underlying database driver error: {sql_err.orig}")
        print("Full Python Traceback:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Database transaction failed during hospital registration")
    except Exception as general_err:
        db.rollback()
        print("[INSTRUMENT] !!! GENERAL EXCEPTION CAUGHT !!!")
        print(f"Exception Type: {type(general_err)}")
        print(f"Error message: {general_err}")
        print("Full Python Traceback:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected failure: {str(general_err)}")



@router.post("/register-pharmacy")
def register_pharmacy(payload: dict, db: Session = Depends(get_db)):
    """Register a new pharmacy organization and generate Pharmacy Vritan ID."""
    name = payload.get("pharmacy_name") or payload.get("name")
    license_number = payload.get("license_number")
    address = payload.get("address")
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password")

    if not name or not license_number or not password or not email:
        raise HTTPException(status_code=400, detail="Missing required pharmacy fields")

    vritan_phar_id = f"VR-PHAR-{uuid.uuid4().hex[:6].upper()}"

    try:
        hashed = hash_password(password)
        user = UserModel(
            role="pharmacist",
            password=hashed,
            email=email,
            verification_status="PENDING_EMAIL_VERIFICATION"
        )
        db.add(user)
        db.flush()

        from pharmacy_models import Pharmacy
        pharmacy = Pharmacy(
            user_id=user.id,
            name=name.strip(),
            vritan_id=vritan_phar_id,
            drug_license_number=license_number.strip(),
            license_number=license_number.strip(),
            official_email=email,
            address=address,
            verification_status="PENDING_EMAIL_VERIFICATION",
            is_active=False
        )
        db.add(pharmacy)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

    try:
        from services.otp_service import generate_verification_otp, log_security_event
        log_security_event(db, user.id, email, "REGISTRATION_STARTED", "SUCCESS", "Pharmacy registration created, sending OTP")
        generate_verification_otp(db, user.id, email)
    except Exception as otp_err:
        print(f"Failed to generate/send OTP: {otp_err}")

    return {
        "message": "Registration successful. Please verify email OTP.",
        "vritan_id": vritan_phar_id,
        "pharmacy_id": pharmacy.id,
        "email": email
    }


@router.post("/register-gov-authority")
def register_gov_authority(payload: dict, db: Session = Depends(get_db)):
    """Register Government Health Authority for anonymized public health analytics."""
    agency_name = payload.get("agency_name")
    jurisdiction_level = payload.get("jurisdiction_level", "National")
    jurisdiction_region = payload.get("jurisdiction_region", "India")
    official_email = str(payload.get("official_email") or "").strip().lower()
    official_phone = payload.get("official_phone")
    authorized_officer_name = payload.get("authorized_officer_name")
    designation = payload.get("designation")
    password = payload.get("password")

    if not agency_name or not official_email or not password:
        raise HTTPException(status_code=400, detail="Missing required government registration fields")

    vritan_gov_id = f"VR-GOV-{uuid.uuid4().hex[:6].upper()}"

    try:
        hashed = hash_password(password)
        user = UserModel(
            role="government_authority",
            password=hashed,
            email=official_email,
            verification_status="PENDING_EMAIL_VERIFICATION"
        )
        db.add(user)
        db.flush()

        gov_auth = GovernmentAuthority(
            user_id=user.id,
            vritan_id=vritan_gov_id,
            agency_name=agency_name.strip(),
            jurisdiction_level=jurisdiction_level,
            jurisdiction_region=jurisdiction_region,
            official_email=official_email,
            official_phone=official_phone,
            authorized_officer_name=authorized_officer_name or "Authorized Officer",
            designation=designation or "Health Officer",
            verification_status="PENDING_EMAIL_VERIFICATION",
            is_active=False
        )
        db.add(gov_auth)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database transaction failed: {str(e)}")

    try:
        from services.otp_service import generate_verification_otp, log_security_event
        log_security_event(db, user.id, official_email, "REGISTRATION_STARTED", "SUCCESS", "Gov Authority registration created, sending OTP")
        generate_verification_otp(db, user.id, official_email)
    except Exception as otp_err:
        print(f"Failed to generate/send OTP: {otp_err}")

    return {
        "message": "Registration successful. Please verify email OTP.",
        "vritan_id": vritan_gov_id,
        "jurisdiction": f"{jurisdiction_level} - {jurisdiction_region}",
        "email": official_email
    }


@router.post("/test-email")
def test_email():
    """Test email configuration by sending a test email to admin."""
    print("TEST EMAIL STARTED")
    
    email_sent = send_doctor_verification_request_to_admin(
        doctor_name="Test Doctor",
        doctor_email="test@example.com",
        doctor_phone="1234567890",
        medical_license_number="TEST12345",
        hospital="Test Hospital",
        specialization="Test Specialization",
        years_of_experience=10,
    )
    
    print(f"TEST EMAIL RESULT - Email sent: {email_sent}")
    
    return {
        "success": email_sent,
        "message": "Test email sent successfully" if email_sent else "Test email failed - check server logs"
    }


def _perform_user_login(credentials: UserLogin, db: Session) -> LoginResponse:
    identifier = credentials.identifier
    user = _resolve_password_login_user(db, identifier)

    # Structured debug log — intentionally verbose to simplify production triage
    print(
        f"[LOGIN_TRACE] identifier={identifier!r} "
        f"resolved_user_id={user.id if user else None} "
        f"resolved_role={user.role if user else None} "
        f"vs_status={user.verification_status if user else None}"
    )

    if not user:
        print(f"[LOGIN_TRACE] FAIL: no user record found for identifier={identifier!r}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/Vritan ID or password",
        )

    if not _password_matches(credentials.password, user.password):
        print(
            f"[LOGIN_TRACE] FAIL: password mismatch for user_id={user.id} role={user.role}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/Vritan ID or password",
        )

    # Verification status guards across stakeholder models (using underlying entity's verification_status)
    if user.role not in ("patient", "admin"):
        from models import VerificationState
        from services.otp_service import log_security_event
        
        effective_status = user.verification_status
        is_entity_active = True
        
        if user.role == "doctor" and user.doctor:
            effective_status = user.doctor.verification_status
        elif user.role == "hospital_admin":
            from org_models import OrganizationMembership
            mem = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == user.id).first()
            if mem and mem.organization:
                effective_status = mem.organization.verification_status
                is_entity_active = mem.organization.is_active
        elif user.role == "branch_admin":
            from org_models import OrganizationMembership, Branch
            mem = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == user.id).first()
            if mem and mem.branch_id:
                branch = db.query(Branch).filter(Branch.id == mem.branch_id).first()
                if branch:
                    effective_status = user.verification_status
                    is_entity_active = branch.is_active
        elif user.role == "pharmacist":
            from pharmacy_models import Pharmacy
            ph = db.query(Pharmacy).filter(Pharmacy.user_id == user.id).first()
            if ph:
                effective_status = ph.verification_status
                is_entity_active = ph.is_active
        elif user.role == "government_authority":
            from models import GovernmentAuthority
            gov = db.query(GovernmentAuthority).filter(GovernmentAuthority.user_id == user.id).first()
            if gov:
                effective_status = gov.verification_status
                is_entity_active = gov.is_active
        elif user.role == "lab_tech":
            from models import LabTechnician, Laboratory
            tech = db.query(LabTechnician).filter(LabTechnician.user_id == user.id).first()
            if tech:
                lab = db.query(Laboratory).filter(Laboratory.id == tech.laboratory_id).first()
                if lab:
                    effective_status = lab.verification_status
                    is_entity_active = lab.is_active

        status_str = (effective_status or "PENDING_EMAIL_VERIFICATION").upper()

        if status_str == VerificationState.PENDING_EMAIL_VERIFICATION.value:
            log_security_event(db, user.id, user.email or credentials.identifier, "LOGIN_BLOCKED_PENDING_VERIFICATION", "FAILED", "Email not verified")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Complete email verification first.",
            )
        elif status_str == VerificationState.PENDING_ADMIN_APPROVAL.value:
            log_security_event(db, user.id, user.email or credentials.identifier, "LOGIN_BLOCKED_PENDING_APPROVAL", "FAILED", "Awaiting admin approval")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your registration has been verified and is awaiting Super Admin approval.",
            )
        elif status_str == VerificationState.REJECTED.value:
            log_security_event(db, user.id, user.email or credentials.identifier, "LOGIN_BLOCKED_REJECTED", "FAILED", "Account rejected")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your application has been rejected. Contact support.",
            )
        elif status_str == VerificationState.SUSPENDED.value or not is_entity_active:
            log_security_event(db, user.id, user.email or credentials.identifier, "LOGIN_BLOCKED_SUSPENDED", "FAILED", "Account suspended or inactive")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your organization account has been suspended by system administration.",
            )
        elif status_str != VerificationState.APPROVED.value:
            log_security_event(db, user.id, user.email or credentials.identifier, "LOGIN_BLOCKED_UNAUTHORIZED", "FAILED", f"Unauthorized status: {status_str}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not approved.",
            )

    if not _is_bcrypt_hash(user.password):
        user.password = hash_password(credentials.password)
        db.commit()
        db.refresh(user)

    return _login_response_for_user(user, db)


@router.post("/login", response_model=LoginResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    return _perform_user_login(credentials, db)


@router.post("/login/doctor", response_model=LoginResponse)
def login_doctor(credentials: UserLogin, db: Session = Depends(get_db)):
    return _perform_user_login(credentials, db)


@router.post("/login/hospital", response_model=LoginResponse)
def login_hospital(credentials: UserLogin, db: Session = Depends(get_db)):
    return _perform_user_login(credentials, db)


@router.post("/login/pharmacy", response_model=LoginResponse)
def login_pharmacy(credentials: UserLogin, db: Session = Depends(get_db)):
    return _perform_user_login(credentials, db)


@router.post("/login/government", response_model=LoginResponse)
def login_government(credentials: UserLogin, db: Session = Depends(get_db)):
    return _perform_user_login(credentials, db)


@router.get("/verify-email")
def verify_email(token: str = Query(...), db: Session = Depends(get_db)):
    """Verify official email ownership using 24h signed token."""
    from models import EmailVerificationToken, Doctor, GovernmentAuthority
    from org_models import Organization
    from pharmacy_models import Pharmacy

    verif_token = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token,
        EmailVerificationToken.is_used == False
    ).first()

    if not verif_token:
        raise HTTPException(status_code=400, detail="Invalid or previously used verification token.")

    if verif_token.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=400, detail="Verification link has expired (24-hour limit). Please request a new verification email.")

    verif_token.is_used = True

    user = db.query(UserModel).filter(UserModel.id == verif_token.user_id).first()
    if user:
        if user.role == "doctor" and user.doctor:
            user.doctor.verification_status = "PENDING_ADMIN_VERIFICATION"
        elif user.role == "hospital_admin":
            org = db.query(Organization).filter(Organization.email == verif_token.email).first()
            if org:
                org.verification_status = "PENDING_ADMIN_VERIFICATION"
        elif user.role == "pharmacist":
            pharmacy = db.query(Pharmacy).filter(Pharmacy.official_email == verif_token.email).first()
            if pharmacy:
                pharmacy.verification_status = "PENDING_ADMIN_VERIFICATION"
        elif user.role == "government_authority":
            gov = db.query(GovernmentAuthority).filter(GovernmentAuthority.official_email == verif_token.email).first()
            if gov:
                gov.verification_status = "PENDING_ADMIN_VERIFICATION"

    db.commit()

    return {
        "message": "Official email address verified successfully! Your account is now pending admin verification.",
        "status": "PENDING_ADMIN_VERIFICATION"
    }


@router.post("/verify-email-otp")
def verify_email_otp(payload: dict, db: Session = Depends(get_db)):
    email = str(payload.get("email") or "").strip().lower()
    otp = str(payload.get("otp") or "").strip()
    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP are required")
        
    from services.otp_service import verify_verification_otp
    return verify_verification_otp(db, email, otp)


@router.post("/resend-email-otp")
def resend_email_otp(payload: dict, db: Session = Depends(get_db)):
    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    from services.otp_service import resend_verification_otp
    return resend_verification_otp(db, email)


@router.post("/resend-verification-email")
def resend_verification_email(payload: dict, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Verification links are deprecated. Please use the registration wizard OTP workflow."
    )


@router.post("/doctor/send-reset-otp")
def doctor_send_reset_otp(
    payload: DoctorResetOtpRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()
    doctor = _resolve_doctor_by_email(db, email)
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No doctor account found for this email",
        )

    otp = _make_otp()
    doctor_reset_otp_store[email] = {
        "otp": otp,
        "verified": False,
        "expires_at": datetime.now(timezone.utc)
        + timedelta(minutes=RESET_OTP_TTL_MINUTES),
    }

    print(f"Development password reset OTP for doctor email {email}: {otp}")

    return {"message": "Reset OTP sent successfully"}


@router.post("/doctor/verify-reset-otp")
def doctor_verify_reset_otp(payload: DoctorVerifyResetOtpRequest):
    email = str(payload.email).strip().lower()
    saved = doctor_reset_otp_store.get(email)

    if _reset_otp_is_expired(saved):
        doctor_reset_otp_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Please request a new OTP.",
        )

    if saved.get("otp") != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP",
        )

    saved["verified"] = True
    return {"message": "OTP verified successfully"}


@router.post("/doctor/reset-password")
def doctor_reset_password(
    payload: DoctorResetPasswordRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()
    doctor = _resolve_doctor_by_email(db, email)
    if not doctor or not doctor.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No doctor account found for this email",
        )

    saved = doctor_reset_otp_store.get(email)
    if _reset_otp_is_expired(saved):
        doctor_reset_otp_store.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Please request a new OTP.",
        )

    if saved.get("otp") != payload.otp or not saved.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify the reset OTP before setting a new password",
        )

    doctor.user.password = hash_password(payload.new_password)
    db.commit()
    doctor_reset_otp_store.pop(email, None)

    return {"message": "Password updated successfully"}


@router.post("/login/patient-firebase", response_model=LoginResponse)
def patient_firebase_login(payload: PatientFirebaseLoginRequest, db: Session = Depends(get_db)):
    try:
        decoded_token = verify_firebase_token(payload.firebase_id_token)
        firebase_uid = decoded_token.get("uid")
        token_phone = decoded_token.get("phone_number")
        
        # If the token has a phone number, use it. Otherwise fallback to the payload mobile (e.g. for mock tokens)
        mobile_to_use = token_phone if token_phone else payload.mobile
        normalized_mobile = normalize_phone_number(mobile_to_use)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

    # Find User by phone_number or firebase_uid
    user = db.query(UserModel).filter(
        (UserModel.phone_number == normalized_mobile) | (UserModel.firebase_uid == firebase_uid)
    ).first()

    if os.getenv("APP_ENV", "development").lower() != "production":
        print(f"[PATIENT_AUTH_AUDIT] patient_firebase_login: raw_mobile={payload.mobile}, "
              f"token_phone={token_phone}, normalized_mobile={normalized_mobile}, "
              f"firebase_uid={firebase_uid}, user_found={user is not None}")

    if not user:
        if os.getenv("APP_ENV", "development").lower() != "production":
            print(f"[PATIENT_AUTH_AUDIT] patient_firebase_login decision: returning 404 NO_ACCOUNT")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NO_ACCOUNT",
        )

    # If the user exists but doesn't have a firebase_uid/phone_number yet, link it
    updated = False
    if not user.firebase_uid:
        user.firebase_uid = firebase_uid
        updated = True
    if not user.phone_number:
        user.phone_number = normalized_mobile
        updated = True
    if updated:
        db.commit()

    return _login_response_for_user(user, db)


@router.get("/doctor/me", response_model=DoctorProfile)
def doctor_me(current_user: UserModel = Depends(_current_user_from_token)):
    return _require_current_doctor(current_user)


@router.get("/doctor/dashboard-stats")
def doctor_dashboard_stats(
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    """Get live EHR dashboard statistics for the current doctor."""
    doctor = _require_verified_doctor(current_user)
    
    # Total patients (unique patients)
    total_patients = (
        db.query(AccessRequest.patient_id)
        .filter(AccessRequest.doctor_id == doctor.user_id)
        .distinct()
        .count()
    )
    
    today = _now_utc().date()

    # Today's appointments count from Appointment table
    from appointment_models import Appointment
    today_appointments = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.user_id,
            func.date(Appointment.created_at) == today
        )
        .count()
    )

    # Waiting Queue count
    waiting_queue = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.user_id,
            Appointment.status.in_(["Waiting", "Requested", "Checked-In"])
        )
        .count()
    )

    # Active consultations count
    active_consultations = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == doctor.user_id,
            Appointment.status == "Consultation Started"
        )
        .count()
    )

    # Pending access requests
    pending_access_requests = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == doctor.user_id,
            AccessRequest.status == "pending"
        )
        .count()
    )

    # Prescriptions today
    prescriptions_today = (
        db.query(Prescription)
        .filter(
            Prescription.doctor_id == doctor.user_id,
            func.date(Prescription.created_at) == today
        )
        .count()
    )
    
    return {
        "today_appointments": today_appointments,
        "waiting_queue": waiting_queue,
        "pending_access_requests": pending_access_requests,
        "active_consultations": active_consultations,
        "total_patients": total_patients,
        "prescriptions_today": prescriptions_today,
    }
    
    # Active approved patients (with non-expired approved access)
    _expire_access_requests(db)
    active_approved_patients = (
        db.query(AccessRequest.patient_id)
        .filter(
            AccessRequest.doctor_id == doctor.user_id,
            AccessRequest.status == "approved",
            AccessRequest.expires_at > _now_utc()
        )
        .distinct()
        .count()
    )
    
    return DoctorDashboardStats(
        total_patients=total_patients,
        prescriptions_today=prescriptions_today,
        pending_access_requests=pending_access_requests,
        active_approved_patients=active_approved_patients,
    )


def _require_admin(current_user: UserModel | Admin) -> Admin:
    # Handle direct Admin object (from updated _current_user_from_token)
    if isinstance(current_user, Admin):
        return current_user
    
    # Handle UserModel with admin relationship (legacy)
    if current_user.role != "admin" or not current_user.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user.admin


@router.get("/admin/doctors", response_model=list[AdminDoctorPublic])
def admin_list_doctors(
    status: str = Query(default="pending"),
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    print("=== ADMIN ENDPOINT HIT ===")
    _require_admin(current_user)
    print(f"ADMIN DOCTORS (AUTH.PY) - Querying Doctor table with status_filter: {status}")
    q = db.query(Doctor)
    print(f"ADMIN DOCTORS (AUTH.PY) - Base Query Row Count: {q.count()}")
    
    if status == "pending":
        q = q.filter(Doctor.verification_status.in_(["PENDING_EMAIL_VERIFICATION", "PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"]))
    elif status != "all":
        q = q.filter(Doctor.verification_status == status)
        
    print(f"ADMIN DOCTORS (AUTH.PY) - Generated SQL: {q}")
    doctors = q.order_by(Doctor.created_at.desc()).all()
    print(f"ADMIN DOCTORS (AUTH.PY) - Found {len(doctors)} doctors post-filtering")
    for doc in doctors:
        print(f"  - Doctor: {doc.full_name}, email: {doc.email}, user_id: {doc.user_id}, status: {doc.verification_status}")
    return doctors


# Keep backward-compat alias
@router.get("/admin/doctors/pending", response_model=list[AdminDoctorPublic])
def admin_list_pending_doctors(
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    pending_doctors = (
        db.query(Doctor)
        .filter(Doctor.verification_status.in_(["PENDING_EMAIL_VERIFICATION", "PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"]))
        .order_by(Doctor.created_at.desc())
        .all()
    )
    return pending_doctors


@router.post("/admin/doctors/{doctor_user_id}/approve")
def admin_approve_doctor(
    doctor_user_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    doctor = (
        db.query(Doctor)
        .filter(Doctor.user_id == doctor_user_id)
        .first()
    )
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found",
        )
    
    user = db.query(UserModel).filter(UserModel.id == doctor_user_id).first()
    if user:
        user.verification_status = "APPROVED"
    doctor.verification_status = "APPROVED"
    doctor.is_verified = True
    db.commit()
    db.refresh(doctor)
    
    # Audit log
    from services.otp_service import log_security_event
    log_security_event(db, doctor_user_id, doctor.email, "SUPER_ADMIN_APPROVAL", "SUCCESS", "Doctor approved by admin")

    # Send approval email to doctor
    from services.email_service import send_approval_email
    send_approval_email(doctor.email)
    
    return {"message": "Doctor approved successfully"}


@router.post("/admin/doctors/{doctor_user_id}/reject")
def admin_reject_doctor(
    doctor_user_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    doctor = (
        db.query(Doctor)
        .filter(Doctor.user_id == doctor_user_id)
        .first()
    )
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found",
        )
    
    user = db.query(UserModel).filter(UserModel.id == doctor_user_id).first()
    if user:
        user.verification_status = "REJECTED"
    doctor.verification_status = "REJECTED"
    doctor.is_verified = False
    db.commit()
    db.refresh(doctor)
    
    # Audit log
    from services.otp_service import log_security_event
    log_security_event(db, doctor_user_id, doctor.email, "SUPER_ADMIN_REJECTION", "SUCCESS", "Doctor rejected by admin")

    # Send rejection email to doctor
    from services.email_service import send_rejection_email
    send_rejection_email(doctor.email, "Your medical license registration details could not be validated.")
    
    return {"message": "Doctor rejected successfully"}


# ---------------------------------------------------------------------------
# Secure verification document viewer (admin only)
# ---------------------------------------------------------------------------
@router.get("/admin/verification-document/{doc_type}/{entity_id}")
def admin_view_verification_document(
    doc_type: str,
    entity_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    """Serve a verification document securely for admin review."""
    _require_admin(current_user)

    if doc_type == "doctor":
        entity = db.query(Doctor).filter(Doctor.user_id == entity_id).first()
        if not entity:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")
        doc_url = entity.verification_document_url
    elif doc_type == "lab":
        entity = db.query(Laboratory).filter(Laboratory.id == entity_id).first()
        if not entity:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Laboratory not found")
        doc_url = entity.verification_document_url
    else:
        raise HTTPException(status_code=400, detail="Invalid document type")

    if not doc_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No verification document uploaded")

    # Strip leading /uploads/ prefix
    relative_path = doc_url.lstrip("/").removeprefix("uploads/")
    file_path = UPLOAD_DIR / relative_path

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification document file not found on server")

    return FileResponse(
        path=file_path,
        content_disposition_type="inline",
        filename=file_path.name,
    )


# ---------------------------------------------------------------------------
# Laboratory Registration
# ---------------------------------------------------------------------------
@router.post("/register-lab")
def register_laboratory(
    lab_name: str = Form(...),
    lab_license_number: str = Form(...),
    lab_address: str = Form(default=""),
    tech_name: str = Form(...),
    tech_employee_id: str = Form(...),
    tech_email: str = Form(...),
    tech_phone: str = Form(default=""),
    password: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Register a new laboratory and its primary technician. Status starts as pending."""
    # Uniqueness checks
    email_lower = tech_email.strip().lower()
    if db.query(LabTechnician).filter(LabTechnician.email == email_lower).first():
        raise HTTPException(status_code=400, detail="Technician email already registered")

    license_clean = lab_license_number.strip().upper()
    if db.query(Laboratory).filter(Laboratory.license_number == license_clean).first():
        raise HTTPException(status_code=400, detail="Laboratory license number already registered")

    # Save verification document
    extension = _safe_upload_extension(file.filename)
    verification_dir = UPLOAD_DIR / "verification_documents"
    verification_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"lab_verification_{secrets.token_urlsafe(16)}{extension}"
    destination = verification_dir / stored_filename

    bytes_written = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(status_code=400, detail="File size must be less than 10MB")
                buffer.write(chunk)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail="Failed to save verification document") from e

    verification_document_url = f"/uploads/verification_documents/{stored_filename}"

    # Create laboratory, user, and technician inside a transaction block
    try:
        lab = Laboratory(
            name=lab_name.strip(),
            license_number=license_clean,
            address=lab_address.strip() or None,
            is_active=False,
            verification_status="PENDING_EMAIL_VERIFICATION",
            verification_document_url=verification_document_url,
        )
        db.add(lab)
        db.flush()

        # Create user
        hashed = hash_password(password)
        db_user = UserModel(
            role="lab_tech",
            password=hashed,
            email=email_lower,
            verification_status="PENDING_EMAIL_VERIFICATION"
        )
        db.add(db_user)
        db.flush()

        # Create technician
        employee_id_clean = tech_employee_id.strip() or f"EMP{db_user.id}"
        technician = LabTechnician(
            user_id=db_user.id,
            laboratory_id=lab.id,
            full_name=tech_name.strip(),
            employee_id=employee_id_clean,
            email=email_lower,
            is_active=False,
        )
        db.add(technician)
        db.commit()
    except Exception as e:
        db.rollback()
        try:
            destination.unlink(missing_ok=True)
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction failed: {str(e)}"
        )

    try:
        from services.otp_service import generate_verification_otp, log_security_event
        log_security_event(db, db_user.id, email_lower, "REGISTRATION_STARTED", "SUCCESS", "Laboratory registration created, sending OTP")
        generate_verification_otp(db, db_user.id, email_lower)
    except Exception as otp_err:
        print(f"Failed to generate/send OTP: {otp_err}")

    return {
        "message": "Registration successful. Please verify email OTP.",
        "email": email_lower
    }


# ---------------------------------------------------------------------------
# Admin: List / Approve / Reject Laboratories
# ---------------------------------------------------------------------------
@router.get("/admin/laboratories")
def admin_list_laboratories(
    status: str = Query(default="pending"),
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    q = db.query(Laboratory)
    if status == "pending":
        q = q.filter(Laboratory.verification_status.in_(["PENDING_EMAIL_VERIFICATION", "PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"]))
    elif status != "all":
        q = q.filter(Laboratory.verification_status == status)
    labs = q.order_by(Laboratory.created_at.desc()).all()

    results = []
    for lab in labs:
        # Get primary technician
        tech = db.query(LabTechnician).filter(LabTechnician.laboratory_id == lab.id).first()
        results.append({
            "id": lab.id,
            "name": lab.name,
            "license_number": lab.license_number,
            "address": lab.address,
            "verification_status": lab.verification_status,
            "verification_document_url": lab.verification_document_url,
            "created_at": lab.created_at.isoformat() if lab.created_at else None,
            "technician_name": tech.full_name if tech else None,
            "technician_email": tech.email if tech else None,
            "technician_employee_id": tech.employee_id if tech else None,
        })
    return results


@router.post("/admin/laboratories/{lab_id}/approve")
def admin_approve_laboratory(
    lab_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found")

    lab.verification_status = "VERIFIED"
    lab.is_active = True

    # Activate all technicians for this lab
    db.query(LabTechnician).filter(LabTechnician.laboratory_id == lab_id).update({"is_active": True})
    db.commit()

    print(f"ADMIN - Approved laboratory '{lab.name}' (id={lab_id})")
    return {"message": f"Laboratory '{lab.name}' approved successfully"}


@router.post("/admin/laboratories/{lab_id}/reject")
def admin_reject_laboratory(
    lab_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    lab = db.query(Laboratory).filter(Laboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found")

    lab.verification_status = "rejected"
    lab.is_active = False
    db.query(LabTechnician).filter(LabTechnician.laboratory_id == lab_id).update({"is_active": False})
    db.commit()

    print(f"ADMIN - Rejected laboratory '{lab.name}' (id={lab_id})")
    return {"message": f"Laboratory '{lab.name}' rejected"}


@router.post("/doctor/upload-verification-document")
def upload_verification_document(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_current_doctor(current_user)
    
    # Validate file extension
    extension = _safe_upload_extension(file.filename)
    
    # Create verification documents directory if it doesn't exist
    verification_dir = UPLOAD_DIR / "verification_documents"
    verification_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    stored_filename = f"doctor_{doctor.user_id}_{secrets.token_urlsafe(16)}{extension}"
    destination = verification_dir / stored_filename
    
    # Save file
    bytes_written = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="File size should be less than 10MB",
                    )
                buffer.write(chunk)
    except Exception as e:
        print(f"VERIFICATION DOCUMENT SAVE FAILED: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save verification document.",
        ) from e
    
    # Update doctor record with verification document URL
    doctor.verification_document_url = f"/uploads/verification_documents/{stored_filename}"
    db.commit()
    db.refresh(doctor)
    
    return {"message": "Verification document uploaded successfully", "document_url": doctor.verification_document_url}


@router.get("/doctor/patient/{patient_uid}", response_model=PatientSearchResult)
def doctor_patient_search(
    patient_uid: str,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_user)
    patient = (
        db.query(Patient)
        .filter(Patient.patient_uid == patient_uid.strip())
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found for this Patient ID",
        )
    return patient


@router.get("/doctor/patient-by-id/{patient_id}", response_model=PatientProfile)
def doctor_patient_by_id(
    patient_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_user)
    patient = (
        db.query(Patient)
        .filter(Patient.id == patient_id)
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found for this ID",
        )
    return patient


@router.post(
    "/doctor/request-access/{patient_uid}",
    response_model=DoctorAccessRequestResponse,
)
def doctor_request_access(
    patient_uid: str,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_user)
    patient = (
        db.query(Patient)
        .filter(Patient.patient_uid == patient_uid.strip())
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found for this Patient ID",
        )

    active_request = _active_access_request(
        db,
        patient_id=patient.id,
        doctor_id=doctor.user_id,
    )
    if active_request:
        return DoctorAccessRequestResponse(
            id=active_request.id,
            status=active_request.status,
            message="Access already approved. Temporary record access is active.",
            expires_at=active_request.expires_at,
        )

    pending_request = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.patient_id == patient.id,
            AccessRequest.doctor_id == doctor.user_id,
            AccessRequest.status == "pending",
        )
        .order_by(AccessRequest.id.desc())
        .first()
    )
    if pending_request:
        return DoctorAccessRequestResponse(
            id=pending_request.id,
            status=pending_request.status,
            message="Waiting for patient approval.",
            expires_at=pending_request.expires_at,
        )

    # User Request: VERIFY BACKEND AUTHORIZATION
    # Verify that the doctor has an appointment with this patient
    from models import Appointment
    has_appointment = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.user_id,
        Appointment.patient_id == patient.id
    ).first()
    if not has_appointment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot request access: No appointment exists with this patient."
        )

    print(f"\n[ACCESS REQUEST DEBUG]")
    print(f"doctor_id={doctor.user_id}")
    print(f"appointment_uid={has_appointment.appointment_uid}")
    print(f"patient_id={patient.id}")
    print(f"patient_uid={patient.patient_uid}")

    access_request = AccessRequest(
        patient_id=patient.id,
        doctor_id=doctor.user_id,
        status="pending",
    )
    db.add(access_request)
    db.commit()
    db.refresh(access_request)

    return DoctorAccessRequestResponse(
        id=access_request.id,
        status=access_request.status,
        message="Waiting for patient approval.",
        expires_at=access_request.expires_at,
    )


@router.get(
    "/doctor/patient/{patient_uid}/access-status",
    response_model=DoctorAccessRequestResponse,
)
def doctor_patient_access_status(
    patient_uid: str,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_user)
    patient = (
        db.query(Patient)
        .filter(Patient.patient_uid == patient_uid.strip())
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found for this Patient ID",
        )

    access_request = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.patient_id == patient.id,
            AccessRequest.doctor_id == doctor.user_id,
        )
        .order_by(AccessRequest.id.desc())
        .first()
    )
    if not access_request:
        return DoctorAccessRequestResponse(
            id=0,
            status="none",
            message="No access request has been sent.",
            expires_at=None,
        )

    _expire_access_request_if_needed(access_request, db)
    messages = {
        "pending": "Waiting for patient approval.",
        "approved": "Temporary record access is active.",
        "denied": "Patient denied this access request.",
        "expired": "Temporary access has expired.",
    }
    return DoctorAccessRequestResponse(
        id=access_request.id,
        status=access_request.status,
        message=messages.get(access_request.status, "Access status updated."),
        expires_at=access_request.expires_at,
    )


@router.get(
    "/doctor/patient/{patient_uid}/records",
    response_model=list[MedicalRecordPublic],
)
def doctor_patient_records(
    patient_uid: str,
    q: str | None = Query(default=None, max_length=100),
    filter_by: str = Query(default="all", alias="filter"),
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_user)
    patient = (
        db.query(Patient)
        .filter(Patient.patient_uid == patient_uid.strip())
        .first()
    )
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient found for this Patient ID",
        )

    active_request = _active_access_request(
        db,
        patient_id=patient.id,
        doctor_id=doctor.user_id,
    )
    if not active_request:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient approval is required before viewing records",
        )

    # 1. Fetch physical medical records
    db_records = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.patient_id == patient.id)
        .filter(MedicalRecord.uploaded_by != doctor.user_id)
        .all()
    )
    public_records = [_medical_record_public(r) for r in db_records]

    # 2. Fetch digital prescriptions
    db_prescriptions = (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient.id, Prescription.deleted_at.is_(None))
        .all()
    )
    prescription_records = [_prescription_to_medical_record_public(p, db) for p in db_prescriptions]

    # 3. Merge, filter, and sort
    merged = public_records + prescription_records
    if q and q.strip():
        merged = [r for r in merged if _matches_search(r, q.strip(), filter_by)]

    merged.sort(key=lambda r: r.uploaded_at or datetime.min, reverse=True)
    return merged


@router.get("/patient/me", response_model=PatientProfile)
def patient_me(current_user: UserModel = Depends(_current_user_from_token)):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient profile is available only for patient accounts",
        )

    return current_user.patient


@router.get("/patient/access-requests", response_model=list[AccessRequestPublic])
def patient_access_requests(
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can view access requests",
        )

    _expire_access_requests(db, patient_id=current_user.patient.id)
    requests = (
        db.query(AccessRequest)
        .filter(AccessRequest.patient_id == current_user.patient.id)
        .order_by(AccessRequest.id.desc())
        .all()
    )
    for request in requests:
        _expire_access_request_if_needed(request, db)
    return [_access_request_public(request) for request in requests]


@router.post(
    "/patient/access-requests/{request_id}/approve",
    response_model=AccessRequestPublic,
)
def patient_approve_access_request(
    request_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can approve access requests",
        )

    access_request = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.id == request_id,
            AccessRequest.patient_id == current_user.patient.id,
        )
        .first()
    )
    if not access_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    _expire_access_request_if_needed(access_request, db)
    if access_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending access requests can be approved",
        )

    access_request.status = "approved"
    access_request.expires_at = _now_utc() + timedelta(minutes=ACCESS_DURATION_MINUTES)
    db.commit()
    db.refresh(access_request)

    return _access_request_public(access_request)


@router.post(
    "/patient/access-requests/{request_id}/deny",
    response_model=AccessRequestPublic,
)
def patient_deny_access_request(
    request_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can deny access requests",
        )

    access_request = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.id == request_id,
            AccessRequest.patient_id == current_user.patient.id,
        )
        .first()
    )
    if not access_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Access request not found",
        )

    _expire_access_request_if_needed(access_request, db)
    if access_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending access requests can be denied",
        )

    access_request.status = "denied"
    access_request.expires_at = None
    db.commit()
    db.refresh(access_request)

    return _access_request_public(access_request)


@router.post("/records/upload", response_model=MedicalRecordPublic)
def upload_medical_record(
    record_type: str = Form(...),
    notes: str = Form(default=""),
    file: UploadFile = File(...),
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    import time
    upload_start_time = time.time()
    
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patient accounts can upload medical records",
        )

    normalized_type = record_type.strip().lower()
    if normalized_type not in ALLOWED_RECORD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Record type must be prescription, report, scan, or other",
        )

    original_filename = _safe_original_filename(file.filename)
    extension = _safe_upload_extension(original_filename)
    stored_filename = f"{current_user.patient.id}_{secrets.token_urlsafe(16)}{extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination = UPLOAD_DIR / stored_filename

    bytes_written = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="File size should be less than 10MB",
                    )
                buffer.write(chunk)
        print(f"FILE SAVED: {destination}")

    except Exception as e:
        print(f"FILE SAVE FAILED: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file.",
        ) from e


    file_to_clean: Path | None = destination
    compressed_path: Path | None = None
    upload_succeeded = False
    try:
        # New Processing Pipeline - Gemini as Primary Structurer
        start_time = time.time()
        print("[UPLOAD] UPLOAD STARTED")

        # Step 1: Compress image if needed
        print(f"[UPLOAD] Compression check for {destination}")
        compressed_path = compress_image(destination)
        ocr_file_path = compressed_path

        # Step 2: OCR with proper error handling
        print(f"[UPLOAD] OCR STARTED for {ocr_file_path}")
        print(f"[UPLOAD] OCR FILE EXISTS: {ocr_file_path.exists()}")

        try:
            extracted_text = extract_text_from_file(ocr_file_path)
            print(f"[UPLOAD] OCR SUCCESS (time: {time.time() - start_time:.2f}s)")
            print(f"[UPLOAD] OCR TEXT LENGTH: {len(extracted_text)}")
        except OCRError as e:
            print(f"[UPLOAD] OCR FAILED: {e.message} (type: {e.error_type})")

            # Return appropriate HTTP error but mask the internal technical message
            if e.error_type == "payload_too_large":
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="File is too large. Please upload a smaller PDF or image."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Unable to process this PDF. Please upload another PDF or image."
                )

        print(f"[UPLOAD] OCR RESULT RECEIVED (length: {len(extracted_text)})")

        # Use Gemini for all structuring with new AI pipeline
        print(f"[GEMINI] GEMINI STRUCTURING STARTED")

        # Initialize with safe fallback values
        gemini_result = {
            "cleaned_text": extracted_text,
            "medicines": [],
            "possible_conditions": [],
            "confidence_score": 0,
            "ai_summary": "",
            "doctor_or_hospital": "",
            "document_type": "unknown",
            "classification_confidence": 0,
            "classification_reason": "",
            "ocr_quality_score": 0,
            "processing_time": 0,
            "schema_validation_passed": False,
            "validation_errors": "",
            "rejected": False,
            "rejection_reason": ""
        }

        # Check if the PDF has native text, which we can parse as is_digital
        file_suffix = destination.suffix.lower()
        is_pdf_with_selectable_text = False
        if file_suffix == ".pdf":
            try:
                from services.ocr_service import extract_native_text_from_pdf
                pdf_t = extract_native_text_from_pdf(destination)
                if len(pdf_t.strip()) > 30:
                    is_pdf_with_selectable_text = True
            except Exception:
                pass
        
        try:
            gemini_result = structure_medical_text(
                ocr_text=extracted_text, 
                file_path=destination, 
                is_digital=is_pdf_with_selectable_text
            )
            print("\n" + "=" * 80)
            print("[GEMINI] FULL AI RESULT")
            print(gemini_result)
            print("=" * 80 + "\n")
            # Check if document was rejected by AI pipeline
            if gemini_result.get("rejected", False):
                rejection_reason = gemini_result.get("rejection_reason", "Unknown reason")
                print(f"[UPLOAD] DOCUMENT REJECTED: {rejection_reason}")

                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=rejection_reason if rejection_reason != "Document classified as non-medical" else "This document does not appear to be a medical record."
                )

            detected_medicines = gemini_result.get("medicines", [])
            final_conditions = gemini_result.get("possible_conditions", [])
            confidence_score = gemini_result.get("confidence_score", 0)
            ai_summary = gemini_result.get(
                "ai_summary",
                f"AI inference with {confidence_score}% confidence"
            )
            doctor_or_hospital = gemini_result.get("doctor_or_hospital", "")

            # New AI pipeline fields
            document_type = gemini_result.get("document_type", "unknown")
            classification_confidence = gemini_result.get("classification_confidence", 0)
            classification_reason = gemini_result.get("classification_reason", "")
            ocr_quality_score = gemini_result.get("ocr_quality_score", 0)
            processing_time = gemini_result.get("processing_time", 0)
            schema_validation_passed = gemini_result.get("schema_validation_passed", False)
            validation_errors = gemini_result.get("validation_errors", "")

            print(f"[GEMINI] DETECTED MEDICINES: {detected_medicines}")
            print(f"[GEMINI] FINAL CONDITIONS: {final_conditions}")
            print(f"[GEMINI] CONFIDENCE SCORE: {confidence_score}")
            print(f"[GEMINI] DOCTOR/HOSPITAL: {doctor_or_hospital}")
            print(f"[GEMINI] DOCUMENT TYPE: {document_type}")
            print(f"[GEMINI] CLASSIFICATION CONFIDENCE: {classification_confidence}")
            print(f"[GEMINI] OCR QUALITY: {ocr_quality_score}")
            print(f"[GEMINI] PROCESSING TIME: {processing_time}")
        except Exception as e:
            print(f"[GEMINI] GEMINI STRUCTURING FAILED: {e}")
            import traceback
            traceback.print_exc()
            detected_medicines = []
            final_conditions = []
            confidence_score = 0
            ai_summary = "AI unavailable"
            doctor_or_hospital = ""
            document_type = "unknown"
            classification_confidence = 0
            classification_reason = ""
            ocr_quality_score = 0
            processing_time = 0
            schema_validation_passed = False
            validation_errors = str(e)

        upload_time = _now_utc()
        # Re-evaluate smart filename with actual AI data
        smart_filename = _smart_record_filename(
            patient_id=current_user.patient.id,
            record_type=normalized_type,
            extension=extension,
            ai_data={
                "possible_conditions": final_conditions,
                "confidence": confidence_score,
                "summary": ai_summary,
            },
            upload_time=upload_time,
        )
        smart_destination = UPLOAD_DIR / smart_filename
        print(f"[UPLOAD] RENAMING FILE: {destination} -> {smart_destination}")

        destination.replace(smart_destination)
        destination = smart_destination
        file_to_clean = smart_destination
        print(f"[UPLOAD] FILE RENAMED: {destination}")

        # Check if extraction produced meaningful data
        has_medicines = bool(detected_medicines)
        has_conditions = bool(final_conditions)
        has_doctor = bool(doctor_or_hospital.strip())
        has_text = bool(extracted_text and len(extracted_text.strip()) > 50)

        if not (has_medicines or has_conditions or has_doctor or has_text):
            print(f"[UPLOAD] VALIDATION FAILED: No meaningful data extracted")
            print(f"[UPLOAD]  - Medicines: {has_medicines}")
            print(f"[UPLOAD]  - Conditions: {has_conditions}")
            print(f"[UPLOAD]  - Doctor/Hospital: {has_doctor}")
            print(f"[UPLOAD]  - Text length: {len(extracted_text) if extracted_text else 0}")

            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to extract meaningful information from the uploaded prescription."
            )

        # Determine clean condition and document_title
        is_prescription = (normalized_type == "prescription" or document_type == "prescription")
        new_doc_title = None
        new_cond = None
        new_cond_status = None

        if is_prescription:
            clean_cond = ""
            if final_conditions and isinstance(final_conditions, list):
                raw_cond = final_conditions[0] if final_conditions else ""
                clean_cond = raw_cond.replace("Possible related condition:", "").replace("Possible condition:", "").strip()
            
            if not clean_cond:
                raw_cond = gemini_result.get("diagnosis", "")
                if raw_cond:
                    clean_cond = raw_cond.replace("Possible related condition:", "").replace("Possible condition:", "").strip()

            if clean_cond and clean_cond.lower() != "unknown" and clean_cond.lower() != "not detected":
                new_doc_title = f"Prescription — {clean_cond}"
                new_cond = clean_cond
                new_cond_status = "probable"
            else:
                new_doc_title = "Prescription"
        else:
            new_doc_title = smart_filename

        # Prepare AI structured data for storage
        ai_structured_data = {
            "possible_conditions": final_conditions,
            "confidence": confidence_score,
            "summary": ai_summary,
            "doctor_or_hospital": doctor_or_hospital,
            "doctor_name": gemini_result.get("doctor_name") or (doctor_or_hospital.split(" - ")[0].strip() if " - " in doctor_or_hospital else doctor_or_hospital),
            "hospital": gemini_result.get("hospital") or (doctor_or_hospital.split(" - ")[1].strip() if " - " in doctor_or_hospital else ""),
            "document_title": new_doc_title,
            "component_confidence": gemini_result.get("component_confidence", {}),
            "ai_status": gemini_result.get("ai_status", "AI_PROCESSING_PENDING"),
        }

        record = MedicalRecord(
            patient_id=current_user.patient.id,
            record_type=normalized_type,
            file_url=f"/uploads/{smart_filename}",
            original_filename=smart_filename,
            uploaded_by=current_user.id,
            notes=notes.strip() or None,
            extracted_text=extracted_text or None,
            cleaned_text=gemini_result.get("cleaned_text", extracted_text) or None,
            detected_medicines=_json_dumps(detected_medicines),
            probable_conditions=_json_dumps(final_conditions),
            ai_structured_data=_json_dumps(ai_structured_data),
            confidence_score=confidence_score,
            ai_summary=_json_dumps(ai_summary),
            # New AI pipeline fields
            document_type=document_type,
            classification_confidence=classification_confidence,
            classification_reason=classification_reason or None,
            ocr_quality_score=ocr_quality_score,
            processing_time=processing_time,
            ai_version="v2.0",
            schema_validation_passed=schema_validation_passed,
            validation_errors=json.dumps(validation_errors) if validation_errors else None,
            component_confidence=json.dumps(gemini_result.get("component_confidence", {})) if gemini_result.get("component_confidence") else None,
            ai_status=gemini_result.get("ai_status", "AI_PROCESSING_PENDING"),
            document_title=new_doc_title,
            condition=new_cond,
            condition_status=new_cond_status,
        )
        print(f"[DB] DB INSERT VALUES:")
        print(f"[DB]   extracted_text: {record.extracted_text[:100] if record.extracted_text else None}...")
        print(f"[DB]   cleaned_text: {record.cleaned_text[:100] if record.cleaned_text else None}...")
        print(f"[DB]   detected_medicines: {record.detected_medicines}")
        print(f"[DB]   probable_conditions: {record.probable_conditions}")
        print(f"[DB] DB SAVE STARTED for patient {current_user.patient.id}")

        try:
            db.add(record)
            db.commit()
            db.refresh(record)

        except Exception as e:
            print("\n" + "=" * 80)
            print("[DB] DATABASE SAVE FAILED")
            traceback.print_exc()
            print("Exception:", repr(e))
            print("=" * 80 + "\n")

            db.rollback()

            raise

        elapsed_time = time.time() - upload_start_time
        print(
            f"[UPLOAD] UPLOAD COMPLETE for record {record.id} "
            f"(took {elapsed_time:.2f}s)"
        )

        upload_succeeded = True
        return _medical_record_public(record)

    finally:
        if not upload_succeeded:
            if file_to_clean is not None:
                file_to_clean.unlink(missing_ok=True)
            if compressed_path is not None and compressed_path != destination and compressed_path.exists():
                compressed_path.unlink(missing_ok=True)


def my_medical_records(
    q: str | None = Query(default=None, max_length=100),
    filter_by: str = Query(default="all", alias="filter"),
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patient accounts can view their own medical records",
        )

    query = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.patient_id == current_user.patient.id)
    )
    return [
        _medical_record_public(record)
        for record in _apply_record_search(query, q, filter_by)
        .order_by(MedicalRecord.uploaded_at.desc(), MedicalRecord.id.desc())
        .all()
    ]


def delete_medical_record(
    record_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owning patient can delete medical records",
        )

    record = (
        db.query(MedicalRecord)
        .filter(
            MedicalRecord.id == record_id,
            MedicalRecord.patient_id == current_user.patient.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found",
        )

    file_path = _record_file_path(record)
    db.delete(record)
    db.commit()
    file_path.unlink(missing_ok=True)
    return {"message": "Medical record deleted successfully"}



def view_medical_record_file(
    record_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    record = db.query(MedicalRecord).filter(MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found",
        )

    allowed = False
    if current_user.role == "patient" and current_user.patient:
        allowed = record.patient_id == current_user.patient.id
    elif current_user.role == "doctor" and current_user.doctor:
        doctor = _require_verified_doctor(current_user)
        allowed = (
            _active_access_request(
                db,
                patient_id=record.patient_id,
                doctor_id=doctor.user_id,
            )
            is not None
        )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient approval is required before viewing this file",
        )

    file_path = _record_file_path(record)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file is not available",
        )

    return FileResponse(
        path=file_path,
        filename=record.original_filename,
        content_disposition_type="inline",
    )


@router.get("/records/my-records", response_model=list[MedicalRecordPublic])
def my_medical_records(
    q: str | None = Query(default=None, max_length=100),
    filter_by: str = Query(default="all", alias="filter"),
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patient accounts can view their own medical records",
        )

    # 1. Fetch physical medical records
    record_query = db.query(MedicalRecord).filter(MedicalRecord.patient_id == current_user.patient.id)
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        record_query = record_query.join(Patient, MedicalRecord.patient_id == Patient.id).filter(
            (MedicalRecord.document_title.ilike(term)) |
            (MedicalRecord.probable_conditions.ilike(term)) |
            (MedicalRecord.detected_medicines.ilike(term)) |
            (MedicalRecord.original_filename.ilike(term)) |
            (MedicalRecord.extracted_text.ilike(term)) |
            (MedicalRecord.cleaned_text.ilike(term)) |
            (MedicalRecord.notes.ilike(term)) |
            (MedicalRecord.ai_summary.ilike(term)) |
            (MedicalRecord.ai_structured_data.ilike(term)) |
            (MedicalRecord.record_type.ilike(term)) |
            (MedicalRecord.document_type.ilike(term)) |
            (Patient.full_name.ilike(term))
        )
    db_records = record_query.all()
    public_records = [_medical_record_public(r) for r in db_records]

    # 2. Fetch digital prescriptions
    prescription_query = db.query(Prescription).filter(
        Prescription.patient_id == current_user.patient.id,
        Prescription.deleted_at.is_(None)
    )
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        prescription_query = prescription_query.join(Patient, Prescription.patient_id == Patient.id).join(Doctor, Prescription.doctor_id == Doctor.user_id).outerjoin(PrescriptionMedicine, Prescription.id == PrescriptionMedicine.prescription_id).filter(
            (Prescription.diagnosis.ilike(term)) |
            (Prescription.symptoms.ilike(term)) |
            (Prescription.notes.ilike(term)) |
            (Prescription.chief_complaint.ilike(term)) |
            (Prescription.clinical_findings.ilike(term)) |
            (Prescription.doctor_advice.ilike(term)) |
            (Prescription.lifestyle_recommendations.ilike(term)) |
            (Doctor.full_name.ilike(term)) |
            (Doctor.hospital.ilike(term)) |
            (PrescriptionMedicine.medicine_name.ilike(term)) |
            (Patient.full_name.ilike(term))
        )
    db_prescriptions = prescription_query.all()
    prescription_records = [_prescription_to_medical_record_public(p, db) for p in db_prescriptions]

    # 3. Merge, filter, and sort
    merged = public_records + prescription_records
    merged.sort(key=lambda r: r.uploaded_at or datetime.min, reverse=True)
    return merged


@router.delete("/records/{record_id}")
def delete_medical_record(
    record_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if current_user.role != "patient" or not current_user.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owning patient can delete medical records",
        )

    record = (
        db.query(MedicalRecord)
        .filter(
            MedicalRecord.id == record_id,
            MedicalRecord.patient_id == current_user.patient.id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found",
        )

    file_path = _record_file_path(record)
    db.delete(record)
    db.commit()
    file_path.unlink(missing_ok=True)
    return {"message": "Medical record deleted successfully"}


@router.get("/records/{record_id}/file")
def view_medical_record_file(
    record_id: int,
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    record = db.query(MedicalRecord).filter(MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found",
        )

    allowed = False
    if current_user.role == "patient" and current_user.patient:
        allowed = record.patient_id == current_user.patient.id
    elif current_user.role == "doctor" and current_user.doctor:
        doctor = _require_verified_doctor(current_user)
        allowed = (
            record.uploaded_by != doctor.user_id and
            _active_access_request(
                db,
                patient_id=record.patient_id,
                doctor_id=doctor.user_id,
            )
            is not None
        )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient approval is required before viewing this file",
        )

    file_path = _record_file_path(record)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file is not available",
        )

    return FileResponse(
        path=file_path,
        filename=record.original_filename,
        content_disposition_type="inline",
    )


# ─────────────────────────────────────────────────────────────
# REAL-TIME VALIDATION ENDPOINTS (no auth required)
# ─────────────────────────────────────────────────────────────

@router.get("/validate/email")
def validate_email_availability(
    email: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Check if an email is available for hospital/stakeholder registration.
    Orphan-aware: only blocks if the email is linked to a live organization.
    """
    email_norm = str(email or "").strip().lower()
    if not email_norm or "@" not in email_norm:
        return {"available": False, "message": "Invalid email address"}

    from org_models import OrganizationMembership
    existing_user = db.query(UserModel).filter(UserModel.email == email_norm).first()
    if not existing_user:
        return {"available": True, "message": "Email is available"}

    # Check for live organization membership
    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == existing_user.id
    ).first()
    if not membership:
        return {"available": True, "message": "Email is available (prior incomplete registration will be cleaned up)"}

    # Fetch org name for helpful message
    from org_models import Organization
    org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
    org_name = org.name if org else f"organization #{membership.organization_id}"
    return {
        "available": False,
        "message": f'This email is already the administrator of "{org_name}". Please use a different email address.'
    }


@router.get("/validate/phone")
def validate_phone_availability(
    phone: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Check if a phone number is available for hospital/stakeholder registration.
    Orphan-aware: only blocks if the phone is linked to a live organization.
    """
    try:
        normalized = normalize_phone_number(phone)
    except ValueError as e:
        return {"available": False, "message": str(e)}

    from org_models import OrganizationMembership
    phone_variants = [normalized, f"+91{normalized}", f"91{normalized}"]
    existing_user = db.query(UserModel).filter(
        UserModel.phone_number.in_(phone_variants)
    ).first()
    if not existing_user:
        return {"available": True, "message": "Phone number is available"}

    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == existing_user.id
    ).first()
    if not membership:
        return {"available": True, "message": "Phone number is available (prior incomplete registration will be cleaned up)"}

    return {"available": False, "message": "This phone number is already registered with an organization."}


@router.get("/validate/org-name")
def validate_org_name_availability(
    name: str = Query(...),
    db: Session = Depends(get_db)
):
    """Check if an organization name is available."""
    name_stripped = str(name or "").strip()
    if not name_stripped:
        return {"available": False, "message": "Organization name is required"}

    from org_models import Organization
    existing = db.query(Organization).filter(Organization.name == name_stripped).first()
    if existing:
        return {"available": False, "message": f'An organization named "{name_stripped}" is already registered.'}
    return {"available": True, "message": "Organization name is available"}


@router.get("/validate/reg-number")
def validate_reg_number_availability(
    reg_number: str = Query(...),
    db: Session = Depends(get_db)
):
    """Check if a registration number is already in use."""
    reg = str(reg_number or "").strip()
    if not reg:
        return {"available": False, "message": "Registration number is required"}

    from org_models import Organization
    existing = db.query(Organization).filter(Organization.registration_number == reg).first()
    if existing:
        return {"available": False, "message": f'Registration number "{reg}" is already associated with an existing organization.'}
    return {"available": True, "message": "Registration number is available"}


# ─────────────────────────────────────────────────────────────
# APPLICATION STATUS (public, by Application ID)
# ─────────────────────────────────────────────────────────────

@router.get("/application-status")
def get_application_status(
    app_id: str = Query(..., description="Application ID in the format VR-APP-YYYY-NNNNNN"),
    db: Session = Depends(get_db)
):
    """
    Public endpoint: returns registration status for an Application ID.
    Application IDs are in the format VR-APP-{year}-{org_id:06d}.
    No authentication required, no sensitive data exposed.
    """
    from org_models import Organization, HospitalVerificationHistory
    import re

    # Parse org_id from the application ID
    match = re.match(r"VR-APP-\d{4}-(\d+)", str(app_id or "").strip().upper())
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid Application ID format. Expected: VR-APP-YYYY-NNNNNN"
        )
    org_id = int(match.group(1))

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Application not found. Please check your Application ID."
        )

    # Fetch verification history for status timeline
    history = db.query(HospitalVerificationHistory).filter(
        HospitalVerificationHistory.organization_id == org_id
    ).order_by(HospitalVerificationHistory.id.asc()).all()

    status_display_map = {
        "PENDING_EMAIL_VERIFICATION": "Email Verification Pending",
        "PENDING_ADMIN_VERIFICATION": "Under Review",
        "PENDING_ADMIN_APPROVAL": "Under Review",
        "APPROVED": "Approved",
        "REJECTED": "Rejected",
        "SUSPENDED": "Suspended",
        "REQUEST_DOCS": "Additional Documents Required",
    }

    current_status = org.verification_status or "PENDING_EMAIL_VERIFICATION"
    display_status = status_display_map.get(current_status.upper(), current_status)

    status_timeline = []
    # Always add submitted
    submitted_at = None
    if hasattr(org, 'created_at') and org.created_at:
        submitted_at = org.created_at.isoformat() if org.created_at else None
        status_timeline.append({"status": "Submitted", "timestamp": submitted_at, "note": "Application received"})

    for h in history:
        status_timeline.append({
            "status": status_display_map.get(h.to_status.upper(), h.to_status),
            "timestamp": h.created_at.isoformat() if hasattr(h, 'created_at') and h.created_at else None,
            "note": h.admin_notes or ""
        })

    return {
        "application_id": app_id,
        "organization_name": org.name,
        "organization_type": org.organization_type,
        "status": display_status,
        "status_code": current_status,
        "submitted_at": submitted_at,
        "vritan_id": org.vritan_id,
        "timeline": status_timeline,
        "message": (
            "Your application is under review. This typically takes 2–5 business days."
            if current_status in ("PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "PENDING_EMAIL_VERIFICATION")
            else "Your organization has been approved! Check your email for login credentials."
            if current_status == "APPROVED"
            else "Your application requires attention. Please check your registered email."
        )
    }


# ─────────────────────────────────────────────────────────────
# PASSWORD SETUP TOKEN (used after admin approval)
# ─────────────────────────────────────────────────────────────

@router.get("/validate-setup-token")
def validate_setup_token(
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """Validate a password setup token (issued on admin approval). No auth required."""
    from models import EmailVerificationToken
    from datetime import datetime, timezone

    rec = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token,
        EmailVerificationToken.token_type == "PASSWORD_SETUP",
        EmailVerificationToken.is_used == False
    ).first()

    if not rec:
        return {"valid": False, "message": "This setup link is invalid or has already been used."}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if rec.expires_at < now:
        return {"valid": False, "message": "This setup link has expired (24-hour limit). Please contact support for a new link."}

    return {"valid": True, "email": rec.email, "message": "Token is valid. Please set your password."}


@router.post("/complete-setup-password")
def complete_setup_password(payload: dict, db: Session = Depends(get_db)):
    """
    Complete password setup after admin approval.
    Accepts: { token, new_password }
    Marks token as used, sets the new hashed password on the user account.
    """
    from models import EmailVerificationToken
    from datetime import datetime, timezone

    token = str(payload.get("token") or "").strip()
    new_password = str(payload.get("new_password") or "").strip()

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new_password are required.")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    rec = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token,
        EmailVerificationToken.token_type == "PASSWORD_SETUP",
        EmailVerificationToken.is_used == False
    ).first()

    if not rec:
        raise HTTPException(status_code=400, detail="Invalid or already-used setup link.")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if rec.expires_at < now:
        raise HTTPException(status_code=400, detail="Setup link expired. Please contact support for a new link.")

    user = db.query(UserModel).filter(UserModel.id == rec.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    # Set the new password and mark token as used
    user.password = hash_password(new_password)
    rec.is_used = True
    db.commit()

    print(f"[SETUP_PASSWORD] user_id={user.id} successfully set password via setup token.")
    return {"message": "Password set successfully. You can now log in with your Vritan credentials."}


from pydantic import BaseModel

class TokenValidationPayload(BaseModel):
    token: str

@router.post("/organizations/invitations/validate")
def validate_invite_token(
    payload: TokenValidationPayload,
    db: Session = Depends(get_db)
):
    """
    Validate an invitation token.
    Returns invitation details to prefill registration.
    """
    import hashlib
    from org_models import OrganizationInvitation, Organization, Branch, Department, InvitationStatus
    from datetime import datetime, timezone
    
    token = payload.token.strip()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    inv = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.invite_token_hash == token_hash,
        OrganizationInvitation.status == InvitationStatus.PENDING
    ).first()
    
    if not inv:
        # Check if already accepted or cancelled
        existing = db.query(OrganizationInvitation).filter(
            OrganizationInvitation.invite_token_hash == token_hash
        ).first()
        if existing:
            status_str = existing.status.value if hasattr(existing.status, 'value') else str(existing.status)
            raise HTTPException(
                status_code=400,
                detail=f"This invitation link is no longer active. Status: {status_str}."
            )
        raise HTTPException(
            status_code=400,
            detail="This invitation link is invalid or has already been accepted/cancelled."
        )
        
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if inv.expires_at < now:
        inv.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="This invitation link has expired (7-day limit)."
        )
        
    org = db.query(Organization).filter(Organization.id == inv.organization_id).first()
    branch = db.query(Branch).filter(Branch.id == inv.branch_id).first()
    dept = db.query(Department).filter(Department.id == inv.department_id).first() if inv.department_id else None
    
    return {
        "valid": True,
        "email": inv.email,
        "role": inv.role.value if hasattr(inv.role, 'value') else str(inv.role),
        "organization_name": org.name if org else "Vritan Hospital",
        "branch_name": branch.name if branch else "Main Branch",
        "department_name": dept.name if dept else None,
        "designation": inv.designation,
        "message": f"Welcome! {org.name if org else 'Vritan Hospital'} invited you to join as a {inv.role.value}."
    }







