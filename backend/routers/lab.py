import json
import secrets
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import AccessRequest, Doctor, Laboratory, LabTechnician, MedicalRecord, Patient, User as UserModel
from schemas import (
    LabDashboardStats,
    LabLoginRequest,
    LabPatientSearchResult,
    LabTechnicianPublic,
    MedicalRecordPublic,
)
from security import InvalidTokenError, create_access_token, decode_access_token, verify_password
from services.gemini_service import structure_medical_text
from services.ocr_service import extract_text_from_file

router = APIRouter(prefix="/lab", tags=["lab"])

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


def _now_utc() -> datetime:
    """Return current UTC time as a naive datetime (no tzinfo), consistent with
    Column(DateTime) values read back from MySQL after SET time_zone='+00:00'.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _safe_original_filename(filename: Optional[str]) -> str:
    if not filename:
        return "unnamed_report.pdf"
    import re
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)
    return cleaned


def _safe_upload_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return ".pdf"
    return ext


def _smart_record_filename(patient_id: int, record_type: str, extension: str, ai_data: dict, upload_time: datetime) -> str:
    ts = upload_time.strftime("%Y%m%d_%H%M%S")
    clean_type = "".join(c for c in record_type if c.isalnum())
    conditions = ai_data.get("possible_conditions", [])
    clean_cond = "healthy"
    if conditions:
        clean_cond = "".join(c for c in conditions[0] if c.isalnum() or c in ("-", "_")).lower()[:15]
    return f"patient_{patient_id}_lab_{clean_type}_{clean_cond}_{ts}{extension}"


def _current_user_from_token(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LabTechnician:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", ""))
    except (InvalidTokenError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )

    # Validate verification_status from database on every request
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

    tech = db.query(LabTechnician).filter(LabTechnician.user_id == user_id).first()
    if not tech:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Laboratory technician profile not found",
        )
    return tech


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
    def _json_loads(val, default):
        if not val:
            return default
        try:
            return json.loads(val)
        except Exception:
            return default

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


@router.post("/login")
def lab_login(payload: LabLoginRequest, db: Session = Depends(get_db)):
    tech = db.query(LabTechnician).filter(LabTechnician.email == payload.email.strip().lower()).first()
    if not tech:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    # Get user
    user = db.query(UserModel).filter(UserModel.id == tech.user_id).first()
    if not user or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check laboratory verification status (using UserModel.verification_status)
    status_str = (user.verification_status or "PENDING_EMAIL_VERIFICATION").upper()
    from models import VerificationState
    from services.otp_service import log_security_event

    if status_str == VerificationState.PENDING_EMAIL_VERIFICATION.value:
        log_security_event(db, user.id, tech.email, "LOGIN_BLOCKED_PENDING_VERIFICATION", "FAILED", "Email not verified")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete email verification first.",
        )
    elif status_str == VerificationState.PENDING_ADMIN_APPROVAL.value:
        log_security_event(db, user.id, tech.email, "LOGIN_BLOCKED_PENDING_APPROVAL", "FAILED", "Awaiting admin approval")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration is under review. Please wait for approval.",
        )
    elif status_str == VerificationState.REJECTED.value:
        log_security_event(db, user.id, tech.email, "LOGIN_BLOCKED_REJECTED", "FAILED", "Account rejected")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your application has been rejected. Contact support.",
        )
    elif status_str == VerificationState.SUSPENDED.value:
        log_security_event(db, user.id, tech.email, "LOGIN_BLOCKED_SUSPENDED", "FAILED", "Account suspended")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your organization account has been suspended by system administration.",
        )
    elif status_str != VerificationState.APPROVED.value:
        log_security_event(db, user.id, tech.email, "LOGIN_BLOCKED_UNAUTHORIZED", "FAILED", f"Unauthorized status: {status_str}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not approved.",
        )

    token = create_access_token(
        user_id=user.id,
        role="lab_tech",
        email=tech.email,
        mobile="",
        is_verified=True,
    )

    user_public = {
        "id": user.id,
        "role": user.role,
        "name": tech.full_name,
    }

    return {"access_token": token, "user": user_public}



@router.get("/me", response_model=LabTechnicianPublic)
def get_lab_me(tech: LabTechnician = Depends(_current_user_from_token), db: Session = Depends(get_db)):
    laboratory = db.query(Laboratory).filter(Laboratory.id == tech.laboratory_id).first()
    return LabTechnicianPublic(
        id=tech.id,
        full_name=tech.full_name,
        employee_id=tech.employee_id,
        email=tech.email,
        laboratory_name=laboratory.name if laboratory else "Unknown Lab",
        laboratory_license=laboratory.license_number if laboratory else "",
        laboratory_address=laboratory.address if laboratory else "",
    )


@router.get("/patient-search", response_model=list[LabPatientSearchResult])
def search_patients(
    q: str = Query("", max_length=100),
    tech: LabTechnician = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    query_str = q.strip()
    if not query_str:
        return []
    
    # Search by UID, Phone, or Name
    patients = db.query(Patient).filter(
        or_(
            Patient.patient_uid == query_str,
            Patient.mobile == query_str,
            Patient.full_name.like(f"%{query_str}%")
        )
    ).all()
    
    results = []
    for p in patients:
        age = None
        if p.date_of_birth:
            age = (datetime.now(timezone.utc).date() - p.date_of_birth).days // 365
        results.append(
            LabPatientSearchResult(
                id=p.id,
                patient_uid=p.patient_uid,
                full_name=p.full_name,
                gender=p.gender,
                age=age,
                mobile=p.mobile,
            )
        )
    return results


@router.get("/dashboard-stats", response_model=LabDashboardStats)
def get_lab_dashboard_stats(
    tech: LabTechnician = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    today = datetime.now(timezone.utc).date()
    
    # Today's Uploads
    today_uploads = db.query(MedicalRecord).filter(
        MedicalRecord.technician_id == tech.id,
        func.date(MedicalRecord.uploaded_at) == today
    ).count()
    
    # Pending AI Processing (missing summaries or validation status)
    pending_ai = db.query(MedicalRecord).filter(
        MedicalRecord.technician_id == tech.id,
        or_(
            MedicalRecord.verification_status == "pending",
            MedicalRecord.confidence_score.is_(None)
        )
    ).count()
    
    # Total Uploads
    total_uploads = db.query(MedicalRecord).filter(
        MedicalRecord.technician_id == tech.id
    ).count()
    
    # Patients Served
    patients_served = db.query(MedicalRecord.patient_id).filter(
        MedicalRecord.technician_id == tech.id
    ).distinct().count()
    
    # Success Rate (AI pipeline validation passed)
    success_count = db.query(MedicalRecord).filter(
        MedicalRecord.technician_id == tech.id,
        MedicalRecord.schema_validation_passed == True
    ).count()
    
    success_rate = 100
    if total_uploads > 0:
        success_rate = int((success_count / total_uploads) * 100)
        
    # Recent Uploads (limit 5)
    records = db.query(MedicalRecord).filter(
        MedicalRecord.laboratory_id == tech.laboratory_id
    ).order_by(MedicalRecord.uploaded_at.desc()).limit(5).all()
    
    recent_uploads = [_medical_record_public(r) for r in records]
    
    return LabDashboardStats(
        today_uploads=today_uploads,
        pending_ai=pending_ai,
        total_uploads=total_uploads,
        patients_served=patients_served,
        success_rate=success_rate,
        recent_uploads=recent_uploads,
    )


@router.post("/process-report")
def process_lab_report(
    patient_id: int = Form(...),
    notes: str = Form(default=""),
    file: UploadFile = File(...),
    tech: LabTechnician = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    original_filename = _safe_original_filename(file.filename)
    extension = _safe_upload_extension(original_filename)
    stored_filename = f"draft_lab_{patient_id}_{secrets.token_urlsafe(16)}{extension}"
    
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
                        status_code=400,
                        detail="File size should be less than 10MB",
                    )
                buffer.write(chunk)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")
        
    # Run OCR
    try:
        ocr_result = extract_text_from_file(str(destination))
        if isinstance(ocr_result, dict):
            extracted_text = ocr_result.get("text", "").strip()
        else:
            extracted_text = str(ocr_result).strip()
    except Exception as e:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"OCR processing failed: {e}")
        
    # Run Gemini AI Extraction
    gemini_result = {
        "cleaned_text": extracted_text,
        "medicines": [],
        "possible_conditions": [],
        "confidence_score": 100,
        "ai_summary": "Extracted laboratory parameters",
        "doctor_or_hospital": "",
        "document_type": "laboratory_report",
        "classification_confidence": 100,
        "classification_reason": "Processed by technician upload portal",
        "ocr_quality_score": 100,
        "processing_time": 0,
        "schema_validation_passed": True,
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
    except Exception as e:
        print(f"[AI] Gemini structuring failed, using fallbacks: {e}")
        
    # Smart rename file
    upload_time = _now_utc()
    smart_filename = _smart_record_filename(
        patient_id=patient.id,
        record_type="report",
        extension=extension,
        ai_data={
            "possible_conditions": gemini_result.get("possible_conditions", []),
            "confidence": gemini_result.get("confidence_score", 0),
            "summary": gemini_result.get("ai_summary", ""),
        },
        upload_time=upload_time,
    )
    smart_destination = UPLOAD_DIR / smart_filename
    destination.replace(smart_destination)
    
    lab_doc_title = f"Lab Report ({gemini_result.get('document_type') or 'General'})" if tech.laboratory_id else smart_filename

    ai_structured_data = {
        "possible_conditions": gemini_result.get("possible_conditions", []),
        "confidence": gemini_result.get("confidence_score", 0),
        "summary": gemini_result.get("ai_summary", ""),
        "doctor_or_hospital": gemini_result.get("doctor_or_hospital", ""),
        "doctor_name": gemini_result.get("doctor_name") or (gemini_result.get("doctor_or_hospital", "").split(" - ")[0].strip() if " - " in gemini_result.get("doctor_or_hospital", "") else gemini_result.get("doctor_or_hospital", "")),
        "hospital": gemini_result.get("hospital") or (gemini_result.get("doctor_or_hospital", "").split(" - ")[1].strip() if " - " in gemini_result.get("doctor_or_hospital", "") else ""),
        "document_title": lab_doc_title,
        "component_confidence": gemini_result.get("component_confidence", {}),
        "ai_status": gemini_result.get("ai_status", "AI_PROCESSING_PENDING"),
    }
    
    # Save as pending_verification
    record = MedicalRecord(
        patient_id=patient.id,
        record_type="report",
        file_url=f"/uploads/{smart_filename}",
        original_filename=smart_filename,
        uploaded_by=tech.user_id,
        laboratory_id=tech.laboratory_id,
        technician_id=tech.id,
        verification_status="pending",
        notes=notes.strip() or None,
        extracted_text=extracted_text or None,
        cleaned_text=gemini_result.get("cleaned_text", extracted_text) or None,
        detected_medicines=json.dumps(gemini_result.get("medicines", [])),
        probable_conditions=json.dumps(gemini_result.get("possible_conditions", [])),
        ai_structured_data=json.dumps(ai_structured_data),
        confidence_score=gemini_result.get("confidence_score", 100.0),
        ai_summary=gemini_result.get("ai_summary", ""),
        document_type=gemini_result.get("document_type", "laboratory_report"),
        document_title=lab_doc_title,
        classification_confidence=gemini_result.get("classification_confidence", 100.0),
        classification_reason=gemini_result.get("classification_reason", ""),
        ocr_quality_score=gemini_result.get("ocr_quality_score", 100.0),
        processing_time=gemini_result.get("processing_time", 0.0),
        ai_version="v2.0",
        schema_validation_passed=gemini_result.get("schema_validation_passed", True),
        validation_errors=json.dumps(gemini_result.get("validation_errors")) if gemini_result.get("validation_errors") else None,
        component_confidence=json.dumps(gemini_result.get("component_confidence", {})) if gemini_result.get("component_confidence") else None,
        ai_status=gemini_result.get("ai_status", "AI_PROCESSING_PENDING"),
    )
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    return _medical_record_public(record)


@router.post("/finalize-report/{record_id}")
def finalize_lab_report(
    record_id: int,
    notes: Optional[str] = Form(None),
    ai_summary: Optional[str] = Form(None),
    document_type: Optional[str] = Form(None),
    probable_conditions: Optional[str] = Form(None),  # JSON string
    tech: LabTechnician = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    record = db.query(MedicalRecord).filter(
        MedicalRecord.id == record_id,
        MedicalRecord.laboratory_id == tech.laboratory_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record report not found")
        
    if record.verification_status == "verified":
        raise HTTPException(status_code=400, detail="Report is already finalized and verified.")
        
    if notes is not None:
        record.notes = notes.strip() or None
    if ai_summary is not None:
        record.ai_summary = ai_summary.strip()
    if document_type is not None:
        record.document_type = document_type.strip()
    if probable_conditions is not None:
        try:
            parsed_cond = json.loads(probable_conditions)
            if isinstance(parsed_cond, list):
                record.probable_conditions = json.dumps(parsed_cond)
        except Exception:
            pass
            
    record.verification_status = "verified"
    db.commit()
    db.refresh(record)
    
    # 1. Send patient notification (log/SMS print)
    patient = db.query(Patient).filter(Patient.id == record.patient_id).first()
    laboratory = db.query(Laboratory).filter(Laboratory.id == tech.laboratory_id).first()
    
    if patient and laboratory:
        print(f"[SMS NOTIFICATION] To Patient {patient.mobile} ({patient.full_name}): Your laboratory report '{record.document_type or 'Diagnostic Report'}' has been uploaded by {laboratory.name} and is available in your medical records timeline.")
        
        # 2. Send doctor notification ONLY if doctor has valid approved patient consent
        active_consent_requests = db.query(AccessRequest).filter(
            AccessRequest.patient_id == patient.id,
            AccessRequest.status == "approved"
        ).all()
        
        for consent in active_consent_requests:
            # check expiry
            if consent.expires_at and consent.expires_at > _now_utc():
                doctor = db.query(Doctor).filter(Doctor.user_id == consent.doctor_id).first()
                if doctor:
                    print(f"[DOCTOR NOTIFICATION] To Doctor Dr. {doctor.full_name}: Lab report '{record.document_type or 'Diagnostic Report'}' for patient {patient.full_name} has been uploaded and verified by {laboratory.name}.")
                    
    return {"message": "Report finalized and verified successfully", "record": _medical_record_public(record)}


@router.get("/upload-history", response_model=list[MedicalRecordPublic])
def get_upload_history(
    tech: LabTechnician = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    records = db.query(MedicalRecord).filter(
        MedicalRecord.laboratory_id == tech.laboratory_id
    ).order_by(MedicalRecord.uploaded_at.desc()).all()
    
    return [_medical_record_public(r) for r in records]
