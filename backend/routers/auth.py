"""Registration and login endpoints."""
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
import time
import traceback
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import AccessRequest, Admin, Doctor, MedicalRecord, Patient, Prescription, User as UserModel
from schemas import AccessRequestPublic
from schemas import DoctorAccessRequestResponse, DoctorProfile
from schemas import DoctorResetOtpRequest, DoctorResetPasswordRequest
from schemas import DoctorVerifyResetOtpRequest, LoginResponse, MedicalRecordPublic
from schemas import PatientOtpLoginRequest, PatientProfile, PatientSearchResult
from schemas import SendOtpRequest, UserLogin, UserPublic, AdminDoctorPublic
from schemas import UserRegister, VerifyOtpRequest
from schemas import DoctorDashboardStats
from security import InvalidTokenError, create_access_token, decode_access_token
from security import hash_password, verify_password
from services.gemini_service import structure_medical_text
from services.ocr_service import extract_text_from_file, OCRError, compress_image
from services.email_service import (
    send_doctor_verification_request_to_admin,
    send_doctor_approval_email,
    send_doctor_rejection_email,
)

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
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _patient_mobile_exists(db: Session, mobile: str) -> bool:
    return db.query(Patient).filter(Patient.mobile == mobile).first() is not None


def normalize_mobile_digits(value: str) -> str:
    """Remove all non-digit characters from a phone number."""
    import re
    return re.sub(r"\D", "", str(value or ""))


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


def _resolve_doctor_login_user(db: Session, identifier_raw: str) -> UserModel | None:
    email = identifier_raw.strip().lower()
    if not email:
        return None
    return (
        db.query(UserModel)
        .join(Doctor)
        .filter(Doctor.email == email)
        .first()
    )


def _resolve_password_login_user(db: Session, identifier_raw: str) -> UserModel | None:
    return _resolve_doctor_login_user(db, identifier_raw)


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
    if not doctor.is_verified or doctor.verification_status != "approved":
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


def _medical_record_public(record: MedicalRecord) -> MedicalRecordPublic:
    ai_structured_data = _json_loads(record.ai_structured_data, None)
    detected_medicines = _json_loads(record.detected_medicines, [])
    probable_conditions = _json_loads(record.probable_conditions, [])
    return MedicalRecordPublic(
        id=record.id,
        record_type=record.record_type,
        file_url=f"/records/{record.id}/file",
        original_filename=record.original_filename,
        display_title=_record_display_title(record),
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
        document_title=ai_structured_data.get("document_title") if ai_structured_data else None,
        component_confidence=ai_structured_data.get("component_confidence") if ai_structured_data else None,
    )


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


def _public_user(user: UserModel) -> UserPublic:
    if user.role == "patient" and user.patient:
        patient = user.patient
        return UserPublic(
            id=user.id,
            role=user.role,
            name=patient.full_name or "",
            patient_uid=patient.patient_uid or "",
            mobile=patient.mobile or "",
            is_verified=True,
        )

    if user.role == "doctor" and user.doctor:
        doctor = user.doctor
        return UserPublic(
            id=user.id,
            role=user.role,
            name=doctor.full_name or "",
            email=doctor.email or "",
            hospital=doctor.hospital or "",
            is_verified=bool(doctor.is_verified),
            verification_status=doctor.verification_status or "pending",
        )

    return UserPublic(
        id=user.id,
        role=user.role,
        name="",
    )


def _login_response_for_user(user: UserModel) -> LoginResponse:
    if user.role not in ("patient", "doctor"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account has an unsupported role",
        )

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=(user.doctor.email if user.doctor else ""),
        mobile=(user.patient.mobile if user.patient else ""),
        is_verified=bool(user.doctor.is_verified if user.doctor else True),
    )

    return LoginResponse(access_token=token, user=_public_user(user))


@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    mobile_exists = _patient_mobile_exists(db, payload.mobile)
    if payload.purpose == "register" and mobile_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
def register(payload: UserRegister, db: Session = Depends(get_db)):
    try:
        if payload.role == "patient":
            if _patient_mobile_exists(db, payload.mobile):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This mobile number is already registered",
                )
            saved_otp = patient_otp_store.get(payload.mobile)
            if not saved_otp or not saved_otp.get("verified"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please verify OTP before registration",
                )
            db_user = UserModel(
                role=payload.role,
                password=None,
            )
            db.add(db_user)
            db.flush()
            db.add(
                Patient(
                    user_id=db_user.id,
                    patient_uid=_make_patient_uid(db_user.id),
                    full_name=payload.name.strip(),
                    mobile=payload.mobile,
                    date_of_birth=payload.date_of_birth,
                    gender=payload.gender,
                    blood_group=payload.blood_group,
                    height=payload.height,
                    weight=payload.weight,
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
            db_user = UserModel(
                role=payload.role,
                password=hashed,
            )
            db.add(db_user)
            db.flush()
            db.add(
                Doctor(
                    user_id=db_user.id,
                    full_name=payload.name.strip(),
                    email=str(payload.email).lower(),
                    phone=payload.phone,
                    hospital=payload.hospital.strip(),
                    specialization=payload.specialization.strip() if payload.specialization else None,
                    medical_license_number=payload.medical_license_number.strip(),
                    years_of_experience=payload.years_of_experience,
                    is_verified=False,
                    verification_status="pending",
                )
            )

        db.commit()
        db.refresh(db_user)

        if payload.role == "patient":
            patient_otp_store.pop(payload.mobile, None)
        else:
            # Send email notification to admin about new doctor registration
            send_doctor_verification_request_to_admin(
                doctor_name=payload.name.strip(),
                doctor_email=str(payload.email).lower(),
                doctor_phone=payload.phone,
                medical_license_number=payload.medical_license_number.strip(),
                hospital=payload.hospital.strip(),
                specialization=payload.specialization.strip() if payload.specialization else None,
                years_of_experience=payload.years_of_experience,
            )

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
    hospital: str = Form(...),
    medical_license_number: str = Form(...),
    years_of_experience: int = Form(...),
    password: str = Form(...),
    specialization: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Uniqueness checks for doctors
    email_exists = (
        db.query(Doctor)
        .filter(Doctor.email == str(email).lower())
        .first()
    )
    if email_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    phone_digits = normalize_mobile_digits(phone)
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
    
    # Validate file
    extension = _safe_upload_extension(file.filename)
    
    # Create verification documents directory if it doesn't exist
    verification_dir = UPLOAD_DIR / "verification_documents"
    verification_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    stored_filename = f"doctor_verification_{secrets.token_urlsafe(16)}{extension}"
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
    
    # Create user and doctor
    hashed = hash_password(password)
    db_user = UserModel(
        role="doctor",
        password=hashed,
    )
    db.add(db_user)
    db.flush()
    
    verification_document_url = f"/uploads/verification_documents/{stored_filename}"
    
    db.add(
        Doctor(
            user_id=db_user.id,
            full_name=name.strip(),
            email=str(email).lower(),
            phone=phone_digits,
            hospital=hospital.strip(),
            specialization=specialization.strip() if specialization else None,
            medical_license_number=medical_license_number.strip(),
            years_of_experience=years_of_experience,
            verification_document_url=verification_document_url,
            is_verified=False,
            verification_status="pending",
        )
    )
    
    db.commit()
    db.refresh(db_user)
    
    print("EMAIL TRIGGER - Sending doctor verification request to admin")
    # Send email notification to admin about new doctor registration
    email_sent = send_doctor_verification_request_to_admin(
        doctor_name=name.strip(),
        doctor_email=str(email).lower(),
        doctor_phone=phone_digits,
        medical_license_number=medical_license_number.strip(),
        hospital=hospital.strip(),
        specialization=specialization.strip() if specialization else None,
        years_of_experience=years_of_experience,
    )
    print(f"EMAIL RESULT - Email sent: {email_sent}")
    
    return {"message": "Doctor registration submitted for verification", "email_sent": email_sent}


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


@router.post("/login", response_model=LoginResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = _resolve_password_login_user(db, credentials.identifier)

    if not user or not _password_matches(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.role == "doctor" and user.doctor:
        if user.doctor.verification_status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your verification request was rejected. Please contact support.",
            )
        if user.doctor.verification_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is pending verification. Please wait for admin approval.",
            )
        if not user.doctor.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not verified. Please wait for admin approval.",
            )

    if not _is_bcrypt_hash(user.password):
        user.password = hash_password(credentials.password)
        db.commit()
        db.refresh(user)

    return _login_response_for_user(user)


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


@router.post("/login/patient-otp", response_model=LoginResponse)
def patient_otp_login(payload: PatientOtpLoginRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.mobile == payload.mobile).first()
    if not patient or not patient.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient account found for this mobile number",
        )

    saved = patient_otp_store.get(payload.mobile)
    if (
        not saved
        or saved.get("otp") != payload.otp
        or saved.get("purpose") != "login"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP",
        )

    patient_otp_store.pop(payload.mobile, None)
    return _login_response_for_user(patient.user)


@router.get("/doctor/me", response_model=DoctorProfile)
def doctor_me(current_user: UserModel = Depends(_current_user_from_token)):
    return _require_current_doctor(current_user)


@router.get("/doctor/dashboard-stats", response_model=DoctorDashboardStats)
def doctor_dashboard_stats(
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    """Get dashboard statistics for the current doctor."""
    doctor = _require_verified_doctor(current_user)
    
    # Total patients (unique patients the doctor has interacted with via access requests)
    total_patients = (
        db.query(AccessRequest.patient_id)
        .filter(AccessRequest.doctor_id == doctor.user_id)
        .distinct()
        .count()
    )
    
    # Prescriptions today
    from datetime import date
    today = date.today()
    prescriptions_today = (
        db.query(Prescription)
        .filter(
            Prescription.doctor_id == doctor.user_id,
            func.date(Prescription.created_at) == today
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


@router.get("/admin/doctors/pending", response_model=list[AdminDoctorPublic])
def admin_list_pending_doctors(
    current_user: UserModel = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    print("ADMIN DOCTORS PENDING - Querying Doctor table")
    pending_doctors = (
        db.query(Doctor)
        .filter(Doctor.verification_status == "pending")
        .order_by(Doctor.created_at.desc())
        .all()
    )
    print(f"ADMIN DOCTORS PENDING - Found {len(pending_doctors)} doctors")
    for doc in pending_doctors:
        print(f"  - Doctor: {doc.full_name}, email: {doc.email}, user_id: {doc.user_id}")
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
    
    doctor.verification_status = "approved"
    doctor.is_verified = True
    db.commit()
    db.refresh(doctor)
    
    # Send approval email to doctor
    send_doctor_approval_email(
        doctor_email=doctor.email,
        doctor_name=doctor.full_name,
    )
    
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
    
    doctor.verification_status = "rejected"
    doctor.is_verified = False
    db.commit()
    db.refresh(doctor)
    
    # Send rejection email to doctor
    send_doctor_rejection_email(
        doctor_email=doctor.email,
        doctor_name=doctor.full_name,
    )
    
    return {"message": "Doctor rejected successfully"}


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


@router.get("/doctor/patient-by-id/{patient_id}", response_model=PatientSearchResult)
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

    query = (
        db.query(MedicalRecord)
        .filter(MedicalRecord.patient_id == patient.id)
    )
    return [
        _medical_record_public(record)
        for record in _apply_record_search(query, q, filter_by)
        .order_by(MedicalRecord.uploaded_at.desc(), MedicalRecord.id.desc())
        .all()
    ]


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

            # Return appropriate HTTP error
            if e.error_type == "payload_too_large":
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=e.message
                )
            elif e.error_type in ("timeout", "network"):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=e.message
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=e.message
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

        try:
            gemini_result = structure_medical_text(ocr_text=extracted_text)
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

        # Prepare AI structured data for storage
        ai_structured_data = {
            "possible_conditions": final_conditions,
            "confidence": confidence_score,
            "summary": ai_summary,
            "doctor_or_hospital": doctor_or_hospital,
            "document_title": gemini_result.get("document_title"),
            "component_confidence": gemini_result.get("component_confidence", {}),
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
