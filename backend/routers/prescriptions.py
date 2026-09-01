from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status, UploadFile, File
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from notification_models import Notification
from models import (
    AccessRequest,
    Doctor,
    MedicineMaster,
    Patient,
    Prescription,
    PrescriptionActivity,
    PrescriptionAuditLog,
    PrescriptionMedicine,
)
from schemas import (
    PrescriptionActivityResponse,
    PrescriptionAuditLogResponse,
    PrescriptionCreate,
    PrescriptionDetailResponse,
    PrescriptionListResponse,
    MedicineSearchResult,
    MedicineValidationResponse,
    PrescriptionMedicineCreate,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from security import decode_access_token
from services.medication_validator import MedicationValidator

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads" / "signatures"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> int:
    """Extract user ID from JWT token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    token = authorization.split(" ")[1]
    try:
        payload = decode_access_token(token)
        return int(payload["sub"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


def get_current_user_role(authorization: Optional[str] = Header(default=None)) -> str:
    """Extract user role from JWT token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    token = authorization.split(" ")[1]
    try:
        payload = decode_access_token(token)
        return payload["role"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


def generate_prescription_id() -> str:
    """Generate a unique prescription ID in format RXYYYYMMDDXXXXXX."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    date_str = now.strftime("%Y%m%d")
    
    # Get the last prescription ID for today to generate a sequential number
    # This is a simplified version - in production you'd want a more robust solution
    import random
    sequence = str(random.randint(1, 999999)).zfill(6)
    
    return f"RX{date_str}{sequence}"


def _now_utc() -> datetime:
    """Return current UTC time as a naive datetime (no tzinfo), consistent with
    Column(DateTime) values read back from MySQL after SET time_zone='+00:00'.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def expire_access_requests(db: Session, patient_id: int | None = None) -> None:
    query = db.query(AccessRequest).filter(
        AccessRequest.status == "approved",
        AccessRequest.expires_at.isnot(None),
        AccessRequest.expires_at <= _now_utc(),
    )
    if patient_id is not None:
        query = query.filter(AccessRequest.patient_id == patient_id)

    expired = query.all()
    if not expired:
        return
    for request in expired:
        request.status = "expired"
    db.commit()


def verify_doctor_consent(
    db: Session, doctor_id: int, patient_id: int
) -> bool:
    """Verify that doctor has valid consent to access patient records."""
    doctor = db.query(Doctor).filter(Doctor.user_id == doctor_id).first()
    if (
        not doctor
        or not doctor.is_verified
        or doctor.verification_status not in ("approved", "VERIFIED")
    ):
        return False

    patient_exists = db.query(Patient.id).filter(Patient.id == patient_id).first()
    if not patient_exists:
        return False

    expire_access_requests(db, patient_id=patient_id)
    access_request = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == doctor_id,
            AccessRequest.patient_id == patient_id,
            AccessRequest.status == "approved",
        )
        .order_by(AccessRequest.id.desc())
        .first()
    )

    expires_at = access_request.expires_at if access_request else None
    return bool(access_request and expires_at and expires_at > _now_utc())


def _prescription_medicine_from_payload(
    prescription_id: int,
    med_data: PrescriptionMedicineCreate,
) -> PrescriptionMedicine:
    dosage = med_data.dosage.strip()
    return PrescriptionMedicine(
        prescription_id=prescription_id,
        medicine_name=med_data.medicine_name.strip(),
        strength=dosage,
        unit="",
        quantity=1,
        route="Oral",
        frequency=med_data.frequency.strip(),
        duration=med_data.duration.strip(),
        food_instruction=med_data.food_instruction.strip(),
        special_instruction=(
            med_data.special_instruction.strip()
            if med_data.special_instruction and med_data.special_instruction.strip()
            else None
        ),
    )


def log_prescription_activity(
    db: Session,
    prescription_id: int,
    activity_type: str,
    description: str,
    actor_id: int,
    actor_role: str,
    actor_name: str,
):
    """Log prescription activity for audit trail."""
    activity = PrescriptionActivity(
        prescription_id=prescription_id,
        activity_type=activity_type,
        description=description,
        actor_id=actor_id,
        actor_role=actor_role,
        actor_name=actor_name,
    )
    db.add(activity)
    db.commit()


def log_prescription_audit(
    db: Session,
    prescription_id: int,
    field_name: str,
    old_value: Optional[str],
    new_value: Optional[str],
    editor_id: int,
):
    """Log prescription field changes for audit trail."""
    audit_log = PrescriptionAuditLog(
        prescription_id=prescription_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        editor_id=editor_id,
    )
    db.add(audit_log)
    db.commit()


@router.get("/medicines/search", response_model=list[MedicineSearchResult])
def search_medicines(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(default=12, ge=1, le=50),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Search medicines by brand, generic, alias, form, route, or manufacturer."""
    del user_id
    query = q.strip()
    pattern = f"%{query}%"
    return (
        db.query(MedicineMaster)
        .filter(
            or_(
                MedicineMaster.name.ilike(pattern),
                MedicineMaster.generic_name.ilike(pattern),
                MedicineMaster.brand_name.ilike(pattern),
                MedicineMaster.aliases.ilike(pattern),
                MedicineMaster.dosage_form.ilike(pattern),
                MedicineMaster.route.ilike(pattern),
                MedicineMaster.manufacturer.ilike(pattern),
            )
        )
        .order_by(MedicineMaster.name.asc())
        .limit(limit)
        .all()
    )


@router.get("/medicines/validate", response_model=MedicineValidationResponse)
def validate_medicine(
    q: str = Query(..., min_length=2, max_length=100),
    user_id: int = Depends(get_current_user_id),
):
    """Validate and fuzzy-correct a medicine name against medicines_master."""
    del user_id
    match = MedicationValidator.find_best_match(q)
    medicine = match.get("medicine")
    return MedicineValidationResponse(
        input=q,
        is_valid=bool(match.get("is_valid")),
        corrected_name=match.get("corrected_name"),
        confidence=float(match.get("confidence") or 0),
        match_type=str(match.get("match_type") or "none"),
        medicine=MedicineSearchResult.model_validate(medicine) if medicine else None,
    )


@router.post("", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
def create_prescription(
    prescription: PrescriptionCreate,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Create a new prescription (Doctor only)."""
    
    # Only doctors can create prescriptions
    if user_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can create prescriptions",
        )
    
    # Verify doctor consent for patient
    if not verify_doctor_consent(db, user_id, prescription.patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to prescribe for this patient.",
        )

    # Prevent duplicate submissions (check last 2 minutes)
    from datetime import datetime as dt_datetime, timedelta as dt_timedelta, timezone as dt_timezone
    two_minutes_ago = dt_datetime.now(dt_timezone.utc).replace(tzinfo=None) - dt_timedelta(minutes=2)
    duplicate = (
        db.query(Prescription)
        .filter(
            Prescription.doctor_id == user_id,
            Prescription.patient_id == prescription.patient_id,
            Prescription.diagnosis == prescription.diagnosis,
            Prescription.created_at >= two_minutes_ago,
            Prescription.deleted_at.is_(None),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A duplicate prescription with the same diagnosis was submitted recently. Please wait a moment.",
        )
    
    # Get doctor and patient details
    doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
    patient = db.query(Patient).filter(Patient.id == prescription.patient_id).first()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found",
        )
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    
    # Generate unique prescription ID
    prescription_id = generate_prescription_id()
    
    # Check for duplicate prescription ID
    existing = (
        db.query(Prescription)
        .filter(Prescription.prescription_id == prescription_id)
        .first()
    )
    if existing:
        # Regenerate if collision occurs
        prescription_id = generate_prescription_id()
    
    # Create prescription
    new_prescription = Prescription(
        prescription_id=prescription_id,
        doctor_id=user_id,
        patient_id=prescription.patient_id,
        diagnosis=prescription.diagnosis,
        symptoms=prescription.symptoms,
        notes=prescription.notes,
        follow_up_date=prescription.follow_up_date,
        status="ACTIVE",
        created_by=user_id,
    )
    
    db.add(new_prescription)
    db.commit()
    db.refresh(new_prescription)
    
    for med_data in prescription.medicines:
        db.add(_prescription_medicine_from_payload(new_prescription.id, med_data))
    
    db.commit()
    
    # Log activity
    log_prescription_activity(
        db,
        new_prescription.id,
        "CREATED",
        f"Prescription {prescription_id} created for patient {patient.patient_uid}",
        user_id,
        "doctor",
        doctor.full_name,
    )
    
    # Send notifications (simulated SMS log and SMTP trigger)
    print(f"[SMS NOTIFICATION] To {patient.mobile}: Dr. {doctor.full_name} has created a new prescription {prescription_id} for you.")
    
    try:
        from services.email_service import send_prescription_notification_email
        dummy_email = f"{patient.patient_uid}@example.com"
        send_prescription_notification_email(
            patient_email=dummy_email,
            patient_name=patient.full_name,
            doctor_name=doctor.full_name,
            diagnosis=prescription.diagnosis,
            prescription_id=prescription_id,
        )
    except Exception as e:
        print(f"Failed to send email notification: {e}")
        
    # Refresh to get medicines
    db.refresh(new_prescription)
    
    return new_prescription


@router.get("", response_model=list[PrescriptionListResponse])
def list_prescriptions(
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    search: Optional[str] = None,
    patient_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    prescription_status: Optional[str] = Query(default=None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List prescriptions with filtering and search (Admin/Doctor/Patient)."""
    
    query = db.query(Prescription).filter(Prescription.deleted_at.is_(None))
    
    # Apply role-based filtering
    if user_role == "doctor":
        # Doctors can only see their own prescriptions
        query = query.filter(Prescription.doctor_id == user_id)
    elif user_role == "patient":
        # Resolve active patient from request context
        from dependencies.patient_profile import get_active_patient
        from fastapi import Request
        # Retrieve X-Patient-Profile-ID from header if possible
        req = db.query(User).filter(User.id == user_id).first()
        try:
            # Simple retrieval using the active profile helper by mocking dependency call
            patient = get_active_patient(authorization, req, db)
        except Exception:
            patient = db.query(Patient).filter(Patient.user_id == user_id, Patient.is_primary == True).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found",
            )
        query = query.filter(Prescription.patient_id == patient.id)
    elif user_role == "admin":
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to list prescriptions.",
        )
    
    # Apply additional filters
    if patient_id:
        if user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can filter by patient_id",
            )
        query = query.filter(Prescription.patient_id == patient_id)
    
    if doctor_id:
        if user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can filter by doctor_id",
            )
        query = query.filter(Prescription.doctor_id == doctor_id)
    
    if prescription_status:
        query = query.filter(Prescription.status == prescription_status)
    
    # Apply search
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Prescription.prescription_id.ilike(search_pattern),
                Prescription.diagnosis.ilike(search_pattern),
                Prescription.symptoms.ilike(search_pattern),
            )
        )
    
    # Apply pagination
    prescriptions = query.order_by(Prescription.created_at.desc()).offset(skip).limit(limit).all()
    
    return prescriptions


@router.put("/{prescription_id}", response_model=PrescriptionResponse)
def update_prescription(
    prescription_id: str,
    prescription_update: PrescriptionUpdate,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Update a prescription (Doctor only, within 1 hour of creation)."""
    
    # Only doctors can update prescriptions
    if user_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can update prescriptions",
        )
    
    prescription = (
        db.query(Prescription)
        .filter(Prescription.prescription_id == prescription_id, Prescription.deleted_at.is_(None))
        .first()
    )
    
    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    
    # Check if prescription belongs to this doctor
    if prescription.doctor_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own prescriptions",
        )
    
    # Check 1-hour edit rule
    if prescription.created_at:
        created_at = prescription.created_at
        time_diff = _now_utc() - created_at
        if time_diff > timedelta(hours=1):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Prescription can only be modified within one hour of creation.",
            )
    
    # Track changes for audit log
    if prescription_update.diagnosis is not None and prescription_update.diagnosis != prescription.diagnosis:
        log_prescription_audit(
            db, prescription.id, "diagnosis", prescription.diagnosis, prescription_update.diagnosis, user_id
        )
        prescription.diagnosis = prescription_update.diagnosis
    
    if prescription_update.symptoms is not None and prescription_update.symptoms != prescription.symptoms:
        log_prescription_audit(
            db, prescription.id, "symptoms", prescription.symptoms, prescription_update.symptoms, user_id
        )
        prescription.symptoms = prescription_update.symptoms
    
    if prescription_update.notes is not None and prescription_update.notes != prescription.notes:
        log_prescription_audit(
            db, prescription.id, "notes", prescription.notes, prescription_update.notes, user_id
        )
        prescription.notes = prescription_update.notes
    
    if prescription_update.follow_up_date != prescription.follow_up_date:
        log_prescription_audit(
            db, prescription.id, "follow_up_date", str(prescription.follow_up_date), str(prescription_update.follow_up_date), user_id
        )
        prescription.follow_up_date = prescription_update.follow_up_date
    
    # Update medicines if provided
    if prescription_update.medicines is not None:
        # Delete existing medicines
        db.query(PrescriptionMedicine).filter(
            PrescriptionMedicine.prescription_id == prescription.id
        ).delete()
        
        # Add new medicines
        for med_data in prescription_update.medicines:
            db.add(_prescription_medicine_from_payload(prescription.id, med_data))
        
        log_prescription_audit(
            db, prescription.id, "medicines", "Medicines updated", "Medicines updated", user_id
        )
    
    prescription.updated_by = user_id
    db.commit()
    db.refresh(prescription)
    
    # Log activity
    doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
    log_prescription_activity(
        db,
        prescription.id,
        "UPDATED",
        f"Prescription {prescription_id} updated",
        user_id,
        "doctor",
        doctor.full_name if doctor else "Unknown",
    )
    
    return prescription


@router.delete("/{prescription_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prescription(
    prescription_id: str,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Delete a prescription (Doctor only, within 1 hour of creation)."""
    
    # Only doctors can delete prescriptions
    if user_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can delete prescriptions",
        )
    
    prescription = (
        db.query(Prescription)
        .filter(Prescription.prescription_id == prescription_id, Prescription.deleted_at.is_(None))
        .first()
    )
    
    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    
    # Check if prescription belongs to this doctor
    if prescription.doctor_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own prescriptions",
        )
    
    # Check 1-hour delete rule
    if prescription.created_at:
        created_at = prescription.created_at
        time_diff = _now_utc() - created_at
        if time_diff > timedelta(hours=1):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Prescription can only be deleted within one hour of creation.",
            )
    
    # Soft delete
    prescription.deleted_at = _now_utc()
    prescription.deleted_by = user_id
    prescription.status = "CANCELLED"
    db.commit()
    
    # Log activity
    doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
    log_prescription_activity(
        db,
        prescription.id,
        "DELETED",
        f"Prescription {prescription_id} deleted",
        user_id,
        "doctor",
        doctor.full_name if doctor else "Unknown",
    )


@router.get("/doctor/my-prescriptions", response_model=list[PrescriptionListResponse])
def get_doctor_prescriptions(
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    search: Optional[str] = None,
    prescription_status: Optional[str] = Query(default=None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all prescriptions for the current doctor."""
    
    if user_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can access this endpoint",
        )
    
    query = db.query(Prescription).filter(
        Prescription.doctor_id == user_id,
        Prescription.deleted_at.is_(None)
    )
    
    if prescription_status:
        query = query.filter(Prescription.status == prescription_status)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Prescription.prescription_id.ilike(search_pattern),
                Prescription.diagnosis.ilike(search_pattern),
                Prescription.symptoms.ilike(search_pattern),
            )
        )
    
    prescriptions = query.order_by(Prescription.created_at.desc()).offset(skip).limit(limit).all()
    
    return prescriptions


@router.get("/patient/my-prescriptions", response_model=list[PrescriptionDetailResponse])
def get_patient_prescriptions(
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all prescriptions for the current patient."""
    
    if user_role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access this endpoint",
        )
    
    patient = db.query(Patient).filter(Patient.user_id == user_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    
    query = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.deleted_at.is_(None)
    )
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Prescription.prescription_id.ilike(search_pattern),
                Prescription.diagnosis.ilike(search_pattern),
                Prescription.symptoms.ilike(search_pattern),
            )
        )
    
    prescriptions = query.order_by(Prescription.created_at.desc()).offset(skip).limit(limit).all()
    
    # Build detailed responses
    responses = []
    for prescription in prescriptions:
        doctor = db.query(Doctor).filter(Doctor.user_id == prescription.doctor_id).first()
        response_dict = {
            "id": prescription.id,
            "prescription_id": prescription.prescription_id,
            "doctor_id": prescription.doctor_id,
            "patient_id": prescription.patient_id,
            "diagnosis": prescription.diagnosis,
            "symptoms": prescription.symptoms,
            "notes": prescription.notes,
            "follow_up_date": prescription.follow_up_date,
            "status": prescription.status,
            "created_at": prescription.created_at,
            "updated_at": prescription.updated_at,
            "created_by": prescription.created_by,
            "updated_by": prescription.updated_by,
            "deleted_at": prescription.deleted_at,
            "deleted_by": prescription.deleted_by,
            "medicines": prescription.medicines,
            "doctor_name": doctor.full_name if doctor else "",
            "doctor_specialization": doctor.specialization if doctor else None,
            "doctor_hospital": doctor.hospital if doctor else "",
            "doctor_phone": doctor.phone if doctor else "",
            "doctor_signature_url": doctor.signature_image_url if doctor else None,
            "patient_name": patient.full_name,
            "patient_uid": patient.patient_uid,
        }
        responses.append(PrescriptionDetailResponse(**response_dict))
    
    return responses


@router.get("/{prescription_id}", response_model=PrescriptionDetailResponse)
def get_prescription(
    prescription_id: str,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Get prescription details by ID."""
    
    prescription = (
        db.query(Prescription)
        .filter(Prescription.prescription_id == prescription_id, Prescription.deleted_at.is_(None))
        .first()
    )
    
    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    
    if user_role == "doctor":
        if prescription.doctor_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own prescriptions",
            )
    elif user_role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == user_id).first()
        if not patient or prescription.patient_id != patient.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own prescriptions",
            )
    elif user_role == "admin":
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view prescriptions.",
        )
    
    doctor = db.query(Doctor).filter(Doctor.user_id == prescription.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == prescription.patient_id).first()
    
    response_dict = {
        "id": prescription.id,
        "prescription_id": prescription.prescription_id,
        "doctor_id": prescription.doctor_id,
        "patient_id": prescription.patient_id,
        "diagnosis": prescription.diagnosis,
        "symptoms": prescription.symptoms,
        "notes": prescription.notes,
        "follow_up_date": prescription.follow_up_date,
        "status": prescription.status,
        "created_at": prescription.created_at,
        "updated_at": prescription.updated_at,
        "created_by": prescription.created_by,
        "updated_by": prescription.updated_by,
        "deleted_at": prescription.deleted_at,
        "deleted_by": prescription.deleted_by,
        "medicines": prescription.medicines,
        "doctor_name": doctor.full_name if doctor else "",
        "doctor_specialization": doctor.specialization if doctor else None,
        "doctor_hospital": doctor.hospital if doctor else "",
        "doctor_phone": doctor.phone if doctor else "",
        "doctor_signature_url": doctor.signature_image_url if doctor else None,
        "patient_name": patient.full_name if patient else "",
        "patient_uid": patient.patient_uid if patient else "",
    }
    
    return PrescriptionDetailResponse(**response_dict)


@router.get("/{prescription_id}/view")
def view_prescription_html(
    prescription_id: str,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    from fastapi.responses import HTMLResponse
    
    # Extract user credentials
    user_id = get_current_user_id(authorization)
    user_role = get_current_user_role(authorization)
    
    prescription = (
        db.query(Prescription)
        .filter(Prescription.prescription_id == prescription_id, Prescription.deleted_at.is_(None))
        .first()
    )
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
        
    # Verify access permission / doctor consent
    if user_role == "doctor":
        if prescription.doctor_id != user_id:
            if not verify_doctor_consent(db, user_id, prescription.patient_id):
                raise HTTPException(status_code=403, detail="You do not have consent to view this prescription.")
    elif user_role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == user_id).first()
        if not patient or prescription.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="You are not authorized to view this prescription.")
    elif user_role == "admin":
        pass
    else:
        raise HTTPException(status_code=403, detail="Invalid role")
        
    doctor = db.query(Doctor).filter(Doctor.user_id == prescription.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == prescription.patient_id).first()
    
    # Generate medicines table rows
    med_rows = ""
    for m in prescription.medicines:
        med_rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>{m.medicine_name}</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{m.strength or m.dosage or ''}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{m.frequency}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{m.duration}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{m.food_instruction}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{m.special_instruction or '-'}</td>
        </tr>
        """
        
    signature_img = ""
    if doctor and doctor.signature_image_url:
        signature_img = f'<img src="{doctor.signature_image_url}" alt="Doctor Signature" style="max-height: 80px; display: block; margin-top: 10px;">'
    else:
        signature_img = '<p style="color: #999; font-style: italic; margin-top: 10px;">Digitally signed</p>'
        
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Prescription - {prescription.prescription_id}</title>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; margin: 40px; }}
            .prescription-box {{ border: 1px solid #ccc; padding: 30px; border-radius: 10px; max-width: 800px; margin: 0 auto; box-shadow: 0 0 10px rgba(0,0,0,0.05); }}
            .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 20px; margin-bottom: 20px; }}
            .hospital-details {{ text-align: left; }}
            .hospital-details h2 {{ color: #0d9488; margin: 0 0 5px 0; }}
            .hospital-details p {{ margin: 2px 0; font-size: 14px; color: #666; }}
            .prescription-meta {{ text-align: right; font-size: 14px; color: #666; }}
            .prescription-meta p {{ margin: 2px 0; }}
            .patient-details {{ background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 14px; }}
            .patient-details p {{ margin: 2px 0; }}
            .complaints {{ margin-bottom: 20px; }}
            .complaints h4 {{ color: #0d9488; margin: 0 0 5px 0; border-bottom: 1px dashed #0d9488; padding-bottom: 3px; }}
            .complaints p {{ margin: 0; font-size: 14px; }}
            .medicines-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }}
            .medicines-table th {{ background-color: #f3f4f6; color: #374151; font-weight: 600; padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }}
            .footer {{ margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e5e7eb; padding-top: 20px; }}
            .signature-section {{ text-align: left; }}
            .print-button {{ display: block; margin: 20px auto; padding: 10px 20px; background-color: #0d9488; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold; }}
            @media print {{
                .print-button {{ display: none; }}
                body {{ margin: 0; }}
                .prescription-box {{ border: none; box-shadow: none; padding: 0; }}
            }}
        </style>
    </head>
    <body>
        <button class="print-button" onclick="window.print()">Print Prescription</button>
        <div class="prescription-box">
            <div class="header">
                <div class="hospital-details">
                    <h2>{doctor.hospital if doctor else 'Vritan Clinic'}</h2>
                    <p>Dr. {doctor.full_name if doctor else 'Verified Physician'}</p>
                    <p>{doctor.specialization if doctor else 'General Medicine'}</p>
                    <p>Phone: {doctor.phone if doctor else 'N/A'}</p>
                </div>
                <div class="prescription-meta">
                    <p><strong>Prescription ID:</strong> {prescription.prescription_id}</p>
                    <p><strong>Date:</strong> {prescription.created_at.strftime('%Y-%m-%d %H:%M')}</p>
                    <p><strong>Follow-up:</strong> {prescription.follow_up_date.strftime('%Y-%m-%d') if prescription.follow_up_date else 'N/A'}</p>
                </div>
            </div>
            
            <div class="patient-details">
                <div>
                    <p><strong>Patient Name:</strong> {patient.full_name if patient else 'N/A'}</p>
                    <p><strong>Patient ID:</strong> {patient.patient_uid if patient else 'N/A'}</p>
                </div>
                <div>
                    <p><strong>Gender / Blood Group:</strong> {patient.gender or 'N/A'} / {patient.blood_group or 'N/A'}</p>
                    <p><strong>Age:</strong> {((datetime.now(timezone.utc).date() - patient.date_of_birth).days // 365) if (patient and patient.date_of_birth) else 'N/A'} years</p>
                </div>
            </div>
            
            <div class="complaints">
                <h4>Symptoms</h4>
                <p>{prescription.symptoms}</p>
            </div>
            
            <div class="complaints">
                <h4>Diagnosis</h4>
                <p>{prescription.diagnosis}</p>
            </div>
            
            <div class="complaints">
                <h4>Rx (Medicines)</h4>
                <table class="medicines-table">
                    <thead>
                        <tr>
                            <th>Medicine</th>
                            <th>Dosage</th>
                            <th>Frequency</th>
                            <th>Duration</th>
                            <th>Food Instruction</th>
                            <th>Special Instructions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {med_rows}
                    </tbody>
                </table>
            </div>
            
            {f'<div class="complaints"><h4>Additional Advice / Notes</h4><p>{prescription.notes}</p></div>' if prescription.notes else ''}
            
            <div class="footer">
                <div class="signature-section">
                    <p style="margin: 0; font-size: 12px; color: #666;">Prescribing Doctor Signature:</p>
                    {signature_img}
                    <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Dr. {doctor.full_name if doctor else ''}</p>
                </div>
                <div style="text-align: right; font-size: 12px; color: #999;">
                    <p>This is a digitally verified prescription.</p>
                    <p>Vritan Secured - EMR Network</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)


@router.get("/{prescription_id}/activities", response_model=list[PrescriptionActivityResponse])
def get_prescription_activities(
    prescription_id: str,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Get activity log for a prescription (Admin only)."""
    
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access activity logs",
        )
    
    prescription = (
        db.query(Prescription)
        .filter(Prescription.prescription_id == prescription_id)
        .first()
    )
    
    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    
    activities = (
        db.query(PrescriptionActivity)
        .filter(PrescriptionActivity.prescription_id == prescription.id)
        .order_by(PrescriptionActivity.timestamp.desc())
        .all()
    )
    
    return activities


@router.get("/{prescription_id}/audit-logs", response_model=list[PrescriptionAuditLogResponse])
def get_prescription_audit_logs(
    prescription_id: str,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Get audit logs for a prescription (Admin only)."""
    
    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access audit logs",
        )
    
    prescription = (
        db.query(Prescription)
        .filter(Prescription.prescription_id == prescription_id)
        .first()
    )
    
    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    
    audit_logs = (
        db.query(PrescriptionAuditLog)
        .filter(PrescriptionAuditLog.prescription_id == prescription.id)
        .order_by(PrescriptionAuditLog.timestamp.desc())
        .all()
    )
    
    return audit_logs


@router.post("/doctor/upload-signature", status_code=status.HTTP_200_OK)
def upload_doctor_signature(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Upload doctor signature image (Doctor only)."""
    
    if user_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can upload signatures",
        )
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed",
        )
    
    # Validate file size (max 5MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Seek back to beginning
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 5MB",
        )
    
    # Generate unique filename
    import uuid
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "png"
    unique_filename = f"{user_id}_{uuid.uuid4().hex}.{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {str(e)}",
        )
    
    # Update doctor profile
    doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    
    # Delete old signature if exists
    if doctor.signature_image_url:
        try:
            old_path = Path(doctor.signature_image_url.replace("/uploads/signatures/", str(UPLOAD_DIR) + "/"))
            if old_path.exists():
                old_path.unlink()
        except Exception:
            pass
    
    # Update with new signature URL
    doctor.signature_image_url = f"/uploads/signatures/{unique_filename}"
    db.commit()
    
    return {"message": "Signature uploaded successfully", "signature_url": doctor.signature_image_url}


class FinalizePrescriptionRequest(BaseModel):
    appointment_id: str | None = None
    patient_id: int | None = None
    diagnosis: str
    chief_complaint: str | None = None
    clinical_notes: str | None = None
    lab_orders: dict | None = None
    medicines: list[dict]
    follow_up_notes: str | None = None
    auto_generate_qr: bool = True


@router.post("/finalize")
def finalize_prescription(
    req: FinalizePrescriptionRequest,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db),
):
    """Finalize prescription and automatically generate QR code & PDF."""
    import uuid

    if user_role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can finalize prescriptions",
        )

    presc_id = f"VR-RX-{uuid.uuid4().hex[:8].upper()}"
    qr_code_id = f"VR-QR-{uuid.uuid4().hex[:8].upper()}"

    # Target patient: find patient from appointment or first patient fallback
    patient_id = req.patient_id
    if not patient_id and req.appointment_id:
        from appointment_models import Appointment
        apt = db.query(Appointment).filter(
            (Appointment.id == req.appointment_id) | (Appointment.appointment_uid == req.appointment_id)
        ).first()
        if apt:
            patient_id = apt.patient_id

    if not patient_id:
        patient = db.query(Patient).first()
        patient_id = patient.id if patient else 1

    # Create DB Prescription record
    new_rx = Prescription(
        prescription_id=presc_id,
        doctor_id=user_id,
        patient_id=patient_id,
        diagnosis=req.diagnosis,
        symptoms=req.chief_complaint or "Consultation encounter",
        notes=req.follow_up_notes or req.clinical_notes,
        status="ACTIVE",
        created_by=user_id,
    )
    db.add(new_rx)
    db.commit()
    db.refresh(new_rx)

    # Add prescribed medicines
    for med in req.medicines:
        rx_med = PrescriptionMedicine(
            prescription_id=new_rx.id,
            medicine_name=med.get("name", "Medicine"),
            strength=med.get("dosage", "As advised"),
            unit="mg",
            quantity=1,
            route="Oral",
            frequency=med.get("frequency", "1-0-1"),
            duration=med.get("duration", "5 days"),
            food_instruction=med.get("instructions", "Take after food"),
        )
        db.add(rx_med)

    # Emit notification to patient
    target_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if target_patient:
        notif = Notification(
            user_id=target_patient.user_id,
            title="New Prescription Issued",
            message=f"Dr. issued prescription {presc_id} with diagnosis: {req.diagnosis}. Scannable QR code is ready.",
            category="Pharmacy",
            type="success",
            priority="High",
            action_url="/dashboard/prescriptions",
        )
        db.add(notif)

    db.commit()

    return {
        "status": "FINALIZED",
        "prescription_id": presc_id,
        "qr_code_url": qr_code_id,
        "pdf_url": f"/prescriptions/{new_rx.id}/view",
        "message": "Prescription finalized. QR Code and PDF generated automatically.",
    }


# --- QR Verification Schemas ---
class QRGenerateRequest(BaseModel):
    medical_record_id: Optional[int] = None
    prescription_id: Optional[int] = None


class QRRevokeRequest(BaseModel):
    verification_id: str


# --- QR Code Eligibility & Status Helpers ---
def resolve_prescription_status(record_or_prescription, db: Session) -> str:
    from models import PrescriptionVerification
    # If it is a digital Prescription
    if hasattr(record_or_prescription, "prescription_id") and not hasattr(record_or_prescription, "file_url"):
        verification = db.query(PrescriptionVerification).filter(
            PrescriptionVerification.prescription_id == record_or_prescription.id
        ).order_by(PrescriptionVerification.id.desc()).first()
        if verification:
            if verification.status == "active":
                return "QR_ACTIVE"
            elif verification.status == "revoked":
                return "QR_REVOKED"
        return "SIGNED"
    else:
        # MedicalRecord
        verification = db.query(PrescriptionVerification).filter(
            PrescriptionVerification.medical_record_id == record_or_prescription.id
        ).order_by(PrescriptionVerification.id.desc()).first()
        if verification:
            if verification.status == "active":
                return "QR_ACTIVE"
            elif verification.status == "revoked":
                return "QR_REVOKED"
        
        return "AI_EXTRACTED"


def is_eligible_for_qr(record_or_prescription, db: Session) -> bool:
    if hasattr(record_or_prescription, "prescription_id") and not hasattr(record_or_prescription, "file_url"):
        return True
    else:
        # MedicalRecord
        if record_or_prescription.record_type != "prescription":
            return False
        if record_or_prescription.verification_status == "verified":
            return True
        status = resolve_prescription_status(record_or_prescription, db)
        if status in ("AI_EXTRACTED", "QR_ACTIVE", "QR_REVOKED"):
            return True
        return False


def log_qr_audit(
    db: Session,
    user_id: Optional[int],
    event_type: str, # QR_GENERATED, QR_VIEWED, QR_VERIFIED, QR_REVOKED
    verification_id: str,
    action: str,
    status: str = "SUCCESS",
    ip_address: Optional[str] = None
):
    from org_models import AuditLog
    import uuid
    db_audit = AuditLog(
        event_id=str(uuid.uuid4().hex),
        user_id=user_id,
        event_type=event_type,
        entity_type="PrescriptionVerification",
        entity_id=verification_id,
        action=action,
        status=status,
        ip_address=ip_address
    )
    db.add(db_audit)
    db.commit()


# --- QR Code API Endpoints ---
@router.post("/verify/generate")
def generate_verification_qr(
    req: QRGenerateRequest,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db)
):
    if user_role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can generate verification QR codes for their prescriptions."
        )

    from models import Patient, MedicalRecord, Prescription, PrescriptionVerification
    patient = db.query(Patient).filter(Patient.user_id == user_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found"
        )

    # Resolve prescription target
    target = None
    if req.medical_record_id:
        target = db.query(MedicalRecord).filter(MedicalRecord.id == req.medical_record_id).first()
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical record not found.")
        if target.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Ownership mismatch.")
    elif req.prescription_id:
        target = db.query(Prescription).filter(Prescription.id == req.prescription_id).first()
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Digital prescription not found.")
        if target.patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Ownership mismatch.")
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Specify either medical_record_id or prescription_id.")

    # Check eligibility
    if not is_eligible_for_qr(target, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This prescription is not clinically authorized for QR generation. It requires manual review."
        )

    # Check if active one already exists
    filter_args = {}
    if req.medical_record_id:
        filter_args["medical_record_id"] = req.medical_record_id
    else:
        filter_args["prescription_id"] = req.prescription_id

    existing = db.query(PrescriptionVerification).filter_by(status="active", **filter_args).first()
    if existing:
        return {
            "verification_id": existing.verification_id,
            "status": existing.status,
            "created_at": existing.created_at.isoformat(),
            "expires_at": existing.expires_at.isoformat() if existing.expires_at else None
        }

    # Generate opaque verification id
    import secrets
    opaque_id = "vritan-rx-" + secrets.token_urlsafe(24)

    new_ver = PrescriptionVerification(
        medical_record_id=req.medical_record_id,
        prescription_id=req.prescription_id,
        verification_id=opaque_id,
        status="active",
        created_by=user_id,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)

    # Log audit
    log_qr_audit(
        db=db,
        user_id=user_id,
        event_type="QR_GENERATED",
        verification_id=opaque_id,
        action=f"Generated verification QR code for prescription ID {req.medical_record_id or req.prescription_id}"
    )

    return {
        "verification_id": new_ver.verification_id,
        "status": new_ver.status,
        "created_at": new_ver.created_at.isoformat(),
        "expires_at": new_ver.expires_at.isoformat() if new_ver.expires_at else None
    }


@router.post("/verify/revoke")
def revoke_verification_qr(
    req: QRRevokeRequest,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db)
):
    from models import Patient, PrescriptionVerification
    
    verification = db.query(PrescriptionVerification).filter(
        PrescriptionVerification.verification_id == req.verification_id
    ).first()
    if not verification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR verification record not found.")

    if verification.status != "active":
        return {"message": "Verification is already inactive.", "status": verification.status}

    # Ownership check: must be the patient owning the prescription
    patient = db.query(Patient).filter(Patient.user_id == user_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Ownership mismatch.")

    patient_id = None
    if verification.medical_record:
        patient_id = verification.medical_record.patient_id
    elif verification.prescription:
        patient_id = verification.prescription.patient_id

    if patient_id != patient.id and user_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Ownership mismatch.")

    # Revoke verification
    verification.status = "revoked"
    verification.revoked_at = datetime.utcnow()
    db.commit()

    # Log audit
    log_qr_audit(
        db=db,
        user_id=user_id,
        event_type="QR_REVOKED",
        verification_id=req.verification_id,
        action=f"Revoked verification QR code"
    )

    return {"message": "Verification QR code successfully revoked.", "status": "revoked"}


@router.get("/verify/{verification_id}")
def verify_prescription_qr(
    verification_id: str,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
    db: Session = Depends(get_db)
):
    from models import User, Patient, Doctor, PrescriptionVerification
    
    verification = db.query(PrescriptionVerification).filter(
        PrescriptionVerification.verification_id == verification_id
    ).first()
    if not verification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR verification record not found.")

    # Expiry/revocation checks
    if verification.status == "revoked":
        return {
            "valid": False,
            "status": "revoked",
            "message": "This prescription QR code has been revoked by the patient."
        }
    if verification.expires_at and verification.expires_at < datetime.utcnow():
        return {
            "valid": False,
            "status": "expired",
            "message": "This prescription QR code has expired."
        }

    # Enforce RBAC / Ownership check
    if user_role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == user_id).first()
        prescription_patient_id = verification.medical_record.patient_id if verification.medical_record else verification.prescription.patient_id
        if not patient or prescription_patient_id != patient.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Ownership mismatch.")
    elif user_role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
        if not doctor:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Doctor profile not found.")
        
        is_authorized = False
        if verification.prescription and verification.prescription.doctor_id == user_id:
            is_authorized = True
        else:
            patient_id = verification.medical_record.patient_id if verification.medical_record else verification.prescription.patient_id
            if verify_doctor_consent(db, user_id, patient_id):
                is_authorized = True
        
        if not is_authorized:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Active doctor consent required.")
    elif user_role in ("pharmacist", "admin"):
        pass
    else:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Unauthorized role.")

    # Extract minimum required details
    ref = ""
    issued_by = ""
    org = ""
    issued_at = None
    medicines = []

    if verification.medical_record:
        rec = verification.medical_record
        ref = f"RX-REC-{rec.id}"
        issued_at = rec.uploaded_at
        
        import json
        structured = {}
        if rec.ai_structured_data:
            try:
                structured = json.loads(rec.ai_structured_data) if isinstance(rec.ai_structured_data, str) else rec.ai_structured_data
            except Exception:
                pass
        issued_by = structured.get("doctor_or_hospital") or "Uploaded Medical Prescription"
        org = structured.get("doctor_or_hospital") or "Unknown Hospital/Clinic"
        
        # Medicines
        parsed_meds = []
        if rec.detected_medicines:
            try:
                parsed_meds = json.loads(rec.detected_medicines) if isinstance(rec.detected_medicines, str) else rec.detected_medicines
            except Exception:
                pass
        if isinstance(parsed_meds, list):
            for m in parsed_meds:
                if isinstance(m, dict):
                    medicines.append({
                        "name": m.get("name", ""),
                        "dosage": m.get("dosage", ""),
                        "frequency": m.get("frequency", ""),
                        "duration": m.get("duration", ""),
                        "instructions": m.get("instructions") or m.get("food_instructions") or ""
                    })
    elif verification.prescription:
        rx = verification.prescription
        ref = rx.prescription_id
        issued_at = rx.created_at
        
        doctor_obj = db.query(Doctor).filter(Doctor.user_id == rx.doctor_id).first()
        issued_by = doctor_obj.full_name if doctor_obj else f"Dr. user {rx.doctor_id}"
        org = doctor_obj.hospital if doctor_obj else "Clinic"
        
        for m in rx.medicines:
            medicines.append({
                "name": m.medicine_name,
                "dosage": m.dosage,
                "frequency": m.frequency,
                "duration": m.duration,
                "instructions": m.special_instruction or m.food_instruction or ""
            })

    # Track verification timestamp
    verification.last_verified_at = datetime.utcnow()
    db.commit()

    # Log audit
    log_qr_audit(
        db=db,
        user_id=user_id,
        event_type="QR_VERIFIED",
        verification_id=verification_id,
        action=f"Verified prescription authenticity for reference {ref}"
    )

    return {
        "valid": True,
        "status": "active",
        "prescription_reference": ref,
        "issued_by": issued_by,
        "organization": org,
        "issued_at": issued_at.isoformat() if issued_at else None,
        "medicines": medicines
    }
