from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status, UploadFile, File
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from database import get_db
from models import (
    AccessRequest,
    Doctor,
    Patient,
    Prescription,
    PrescriptionActivity,
    PrescriptionAuditLog,
    PrescriptionMedicine,
    User,
)
from schemas import (
    PrescriptionActivityResponse,
    PrescriptionAuditLogResponse,
    PrescriptionCreate,
    PrescriptionDetailResponse,
    PrescriptionListResponse,
    PrescriptionMedicineCreate,
    PrescriptionMedicineResponse,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from security import decode_access_token

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
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    
    # Get the last prescription ID for today to generate a sequential number
    # This is a simplified version - in production you'd want a more robust solution
    import random
    sequence = str(random.randint(1, 999999)).zfill(6)
    
    return f"RX{date_str}{sequence}"


def verify_doctor_conent(
    db: Session, doctor_id: int, patient_id: int
) -> bool:
    """Verify that doctor has valid consent to access patient records."""
    # Check if doctor is verified
    doctor = db.query(Doctor).filter(Doctor.user_id == doctor_id).first()
    if not doctor or not doctor.is_verified:
        return False
    
    # Check if there's an approved access request that hasn't expired
    access_request = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == doctor_id,
            AccessRequest.patient_id == patient_id,
            AccessRequest.status == "approved",
            AccessRequest.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    
    return access_request is not None


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
    if not verify_doctor_conent(db, user_id, prescription.patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to prescribe for this patient.",
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
    
    # Add medicines
    for med_data in prescription.medicines:
        medicine = PrescriptionMedicine(
            prescription_id=new_prescription.id,
            medicine_name=med_data.medicine_name,
            dosage=med_data.dosage,
            frequency=med_data.frequency,
            duration=med_data.duration,
            food_instruction=med_data.food_instruction,
            special_instruction=med_data.special_instruction,
        )
        db.add(medicine)
    
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
    status: Optional[str] = None,
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
        # Patients can only see their own prescriptions
        patient = db.query(Patient).filter(Patient.user_id == user_id).first()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found",
            )
        query = query.filter(Prescription.patient_id == patient.id)
    # Admin can see all prescriptions
    
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
    
    if status:
        query = query.filter(Prescription.status == status)
    
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
    
    # Check access permissions
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
    # Admin can view all
    
    # Get related data
    doctor = db.query(Doctor).filter(Doctor.user_id == prescription.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == prescription.patient_id).first()
    
    # Build response with additional fields
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
        time_diff = datetime.now(timezone.utc) - prescription.created_at
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
            medicine = PrescriptionMedicine(
                prescription_id=prescription.id,
                medicine_name=med_data.medicine_name,
                dosage=med_data.dosage,
                frequency=med_data.frequency,
                duration=med_data.duration,
                food_instruction=med_data.food_instruction,
                special_instruction=med_data.special_instruction,
            )
            db.add(medicine)
        
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
        time_diff = datetime.now(timezone.utc) - prescription.created_at
        if time_diff > timedelta(hours=1):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Prescription can only be deleted within one hour of creation.",
            )
    
    # Soft delete
    prescription.deleted_at = datetime.now(timezone.utc)
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
    status: Optional[str] = None,
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
    
    if status:
        query = query.filter(Prescription.status == status)
    
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
