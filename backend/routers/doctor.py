from datetime import datetime, timedelta, timezone
from typing import Optional
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import AccessRequest, Doctor, Patient, Prescription, MedicalRecord, User as UserModel
from schemas import (
    AccessRequestPublic,
    DoctorDashboardStats,
    DoctorInsights,
    DoctorProfile,
    MedicalRecordPublic,
    PatientProfile,
    PatientSearchResult,
    PrescriptionListResponse,
    RecentActivityItem,
    UpcomingFollowUp,
)
from security import InvalidTokenError, create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/doctor", tags=["doctor"])


def _now_utc() -> datetime:
    """Return current UTC time as a naive datetime (no tzinfo), consistent with
    Column(DateTime) values read back from MySQL after SET time_zone='+00:00'.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _current_user_from_token(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
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
    
    # For doctor role, validate that the doctor record exists
    doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Doctor profile not found",
        )
    return doctor


def _require_verified_doctor(current_doctor: Doctor) -> Doctor:
    if current_doctor.verification_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your verification request was rejected. Please contact support.",
        )
    if not current_doctor.is_verified or current_doctor.verification_status not in ("approved", "VERIFIED"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor account must be verified before searching patients",
        )
    return current_doctor


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


@router.get("/me", response_model=DoctorProfile)
def doctor_me(current_doctor: Doctor = Depends(_current_user_from_token)):
    return current_doctor


@router.get("/dashboard-stats", response_model=DoctorDashboardStats)
def doctor_dashboard_stats(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)

    # Total patients (unique patients the doctor has interacted with via access requests)
    total_patients = (
        db.query(AccessRequest.patient_id)
        .filter(AccessRequest.doctor_id == current_doctor.user_id)
        .distinct()
        .count()
    )

    # Prescriptions today
    import zoneinfo

    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
    today_ist_dt = datetime.now(IST)
    today = today_ist_dt.date()
    
    # We still need UTC bounds for querying created_at which is stored in UTC
    start_of_day_ist = today_ist_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day_ist = start_of_day_ist + timedelta(days=1)
    
    start_of_day = start_of_day_ist.astimezone(timezone.utc).replace(tzinfo=None)
    end_of_day = end_of_day_ist.astimezone(timezone.utc).replace(tzinfo=None)

    prescriptions_today = (
        db.query(Prescription)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.created_at >= start_of_day,
            Prescription.created_at < end_of_day,
        )
        .count()
    )

    # Prescriptions this month
    current_month_start = today.replace(day=1)
    prescriptions_this_month = (
        db.query(Prescription)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.created_at >= current_month_start,
            Prescription.created_at < (current_month_start + timedelta(days=31)).replace(day=1)
        )
        .count()
    )

    # Total prescriptions
    total_prescriptions = (
        db.query(Prescription)
        .filter(Prescription.doctor_id == current_doctor.user_id)
        .count()
    )

    # Pending access requests
    pending_access_requests = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            AccessRequest.status == "pending",
        )
        .count()
    )

    # Active approved patients (with non-expired approved access)
    _expire_access_requests(db)
    active_approved_patients = (
        db.query(AccessRequest.patient_id)
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            AccessRequest.status == "approved",
            AccessRequest.expires_at > _now_utc(),
        )
        .distinct()
        .count()
    )
    
    # Recently accessed patients
    recently_accessed_patients_ids = (
        db.query(AccessRequest.patient_id)
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            AccessRequest.status == "approved",
        )
        .order_by(AccessRequest.expires_at.desc())
        .limit(5)
        .distinct()
        .subquery()
    )
    recently_accessed_patients = (
        db.query(Patient)
        .join(recently_accessed_patients_ids, Patient.id == recently_accessed_patients_ids.c.patient_id)
        .all()
    )

    # Appointments and queues
    from models import Appointment, AppointmentSlot
    
    today_appointments = (
        db.query(Appointment)
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .filter(
            Appointment.doctor_id == current_doctor.user_id,
            AppointmentSlot.date == today
        )
        .count()
    )
    
    waiting_queue = (
        db.query(Appointment)
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .filter(
            Appointment.doctor_id == current_doctor.user_id,
            AppointmentSlot.date == today,
            Appointment.status.in_(["Checked-In", "Waiting"])
        )
        .count()
    )
    
    active_consultations = (
        db.query(Appointment)
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .filter(
            Appointment.doctor_id == current_doctor.user_id,
            AppointmentSlot.date == today,
            Appointment.status == "In Progress"
        )
        .count()
    )

    return DoctorDashboardStats(
        total_patients=total_patients,
        prescriptions_today=prescriptions_today,
        prescriptions_this_month=prescriptions_this_month,
        total_prescriptions=total_prescriptions,
        pending_access_requests=pending_access_requests,
        active_approved_patients=active_approved_patients,
        recently_accessed_patients=[PatientSearchResult.model_validate(p) for p in recently_accessed_patients],
        today_appointments=today_appointments,
        waiting_queue=waiting_queue,
        active_consultations=active_consultations,
    )


@router.get("/patients/approved", response_model=list[AccessRequestPublic])
def get_approved_patients(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    _expire_access_requests(db, patient_id=None)

    approved_requests = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            AccessRequest.status == "approved",
            AccessRequest.expires_at > _now_utc(),
        )
        .join(Patient, AccessRequest.patient_id == Patient.id)
        .add_columns(Patient.full_name, Patient.patient_uid)
        .order_by(AccessRequest.expires_at.asc())
        .all()
    )
    
    results = []
    for req, patient_name, patient_uid in approved_requests:
        results.append(AccessRequestPublic(
            id=req.id,
            status=req.status,
            created_at=req.created_at,
            expires_at=req.expires_at,
            patient_name=patient_name,
            patient_uid=patient_uid,
        ))
    return results


@router.get("/patients/pending-requests", response_model=list[AccessRequestPublic])
def get_pending_access_requests(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    _expire_access_requests(db, patient_id=None)

    pending_requests = (
        db.query(AccessRequest)
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            or_(
                AccessRequest.status == "pending",
                AccessRequest.status == "denied",
                AccessRequest.status == "expired",
            )
        )
        .join(Patient, AccessRequest.patient_id == Patient.id)
        .add_columns(Patient.full_name, Patient.patient_uid)
        .order_by(AccessRequest.created_at.desc())
        .all()
    )
    
    results = []
    for req, patient_name, patient_uid in pending_requests:
        results.append(AccessRequestPublic(
            id=req.id,
            status=req.status,
            created_at=req.created_at,
            expires_at=req.expires_at,
            patient_name=patient_name,
            patient_uid=patient_uid,
        ))
    return results


@router.get("/patient-search", response_model=list[PatientSearchResult])
def doctor_patient_smart_search(
    query: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(default=10, ge=1, le=50),
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    search_pattern = f"%{query.strip().lower()}%"

    patients = (
        db.query(Patient)
        .filter(
            or_(
                func.lower(Patient.full_name).like(search_pattern),
                func.lower(Patient.patient_uid).like(search_pattern),
                func.lower(Patient.mobile).like(search_pattern),
            )
        )
        .limit(limit)
        .all()
    )
    return [PatientSearchResult.model_validate(p) for p in patients]


@router.get("/patient/{patient_id}/full-record", response_model=PatientProfile)
def get_patient_full_record(
    patient_id: int,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_doctor)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()

    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Patient not found")
    
    # Verify access to patient records
    if not _active_access_request(
        db,
        patient_id=patient.id,
        doctor_id=doctor.user_id,
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access to patient records is not approved or has expired.")

    return PatientProfile.model_validate(patient)


@router.get(
    "/patient/{patient_id}/medical-records",
    response_model=list[MedicalRecordPublic],
)
def get_patient_medical_records(
    patient_id: int,
    q: str | None = Query(default=None, max_length=100),
    filter_by: str = Query(default="all", alias="filter"),
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_doctor)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Verify access to patient records
    if not _active_access_request(
        db,
        patient_id=patient.id,
        doctor_id=doctor.user_id,
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access to patient records is not approved or has expired.")

    query = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient.id)
    # Removed _apply_record_search as it was imported from auth.py which is not ideal
    # This needs to be replaced with a proper search function if full-text search on medical records is needed
    return [
        MedicalRecordPublic.model_validate(record)
        for record in query.order_by(MedicalRecord.uploaded_at.desc(), MedicalRecord.id.desc()).all()
    ]

@router.get(
    "/patient/{patient_id}/prescriptions",
    response_model=list[PrescriptionListResponse],
)
def get_patient_prescriptions(
    patient_id: int,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_doctor)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()

    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Patient not found")
    
    # Verify access to patient records
    if not _active_access_request(
        db,
        patient_id=patient.id,
        doctor_id=doctor.user_id,
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access to patient records is not approved or has expired.")
    
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.doctor_id == current_doctor.user_id, # Only show prescriptions created by this doctor
        Prescription.deleted_at.is_(None)
    ).order_by(Prescription.created_at.desc()).all()

    return [PrescriptionListResponse.model_validate(p) for p in prescriptions]


@router.get(
    "/patient/{patient_id}/timeline",
    response_model=list[dict],
)
def get_patient_timeline(
    patient_id: int,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_doctor)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()

    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Patient not found")
    
    # Verify access to patient records
    if not _active_access_request(
        db,
        patient_id=patient.id,
        doctor_id=doctor.user_id,
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access to patient records is not approved or has expired.")

    timeline_events = []

    # Prescriptions
    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient.id,
        Prescription.doctor_id == doctor.user_id,
        Prescription.deleted_at.is_(None)
    ).all()
    for p in prescriptions:
        timeline_events.append({
            "type": "Prescription Created",
            "timestamp": p.created_at,
            "description": f"Prescription {p.prescription_id} created for {p.diagnosis}",
            "id": p.id,
            "details": PrescriptionListResponse.model_validate(p).model_dump()
        })

    # Medical Records (Uploads)
    medical_records = db.query(MedicalRecord).filter(
        MedicalRecord.patient_id == patient.id
    ).all()
    for mr in medical_records:
        timeline_events.append({
            "type": "Medical Report Uploaded",
            "timestamp": mr.uploaded_at,
            "description": f"Medical record '{mr.original_filename}' uploaded (Type: {mr.record_type})",
            "id": mr.id,
            "details": MedicalRecordPublic.model_validate(mr).model_dump()
        })

    # Access Requests (Granted/Expired - related to THIS doctor)
    access_requests = db.query(AccessRequest).filter(
        AccessRequest.patient_id == patient.id,
        AccessRequest.doctor_id == doctor.user_id,
        or_(
            AccessRequest.status == "approved",
            AccessRequest.status == "expired"
        )
    ).all()
    for ar in access_requests:
        if ar.status == "approved":
            timeline_events.append({
                "type": "Doctor Access Granted",
                "timestamp": ar.created_at,
                "description": f"Access granted by patient, expires at {ar.expires_at.strftime('%Y-%m-%d %H:%M') if ar.expires_at else 'N/A'}",
                "id": ar.id,
                "details": AccessRequestPublic.model_validate(ar).model_dump()
            })
        elif ar.status == "expired":
            timeline_events.append({
                "type": "Doctor Access Expired",
                "timestamp": ar.expires_at,
                "description": f"Access to patient records expired",
                "id": ar.id,
                "details": AccessRequestPublic.model_validate(ar).model_dump()
            })

    # Sort events by timestamp, newest first
    timeline_events.sort(key=lambda x: x["timestamp"], reverse=True)

    return timeline_events


from pydantic import BaseModel
class AISummaryRequest(BaseModel):
    prompt: str

class AISummaryResponse(BaseModel):
    summary: str
    sources: list[str]

@router.post("/patient/{patient_id}/ai-summary", response_model=AISummaryResponse)
def generate_ai_summary(
    patient_id: int,
    req: AISummaryRequest,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    doctor = _require_verified_doctor(current_doctor)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()

    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Patient not found")
    
    # Verify access to patient records
    if not _active_access_request(
        db,
        patient_id=patient.id,
        doctor_id=doctor.user_id,
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access to patient records is not approved or has expired.")

    # Fetch context: medical records and prescriptions
    medical_records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient.id).order_by(MedicalRecord.uploaded_at.desc()).limit(10).all()
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient.id).order_by(Prescription.created_at.desc()).limit(10).all()

    context_lines = []
    sources = []

    for mr in medical_records:
        src_name = f"Medical Record - {mr.original_filename} ({mr.uploaded_at.strftime('%Y-%m-%d')})"
        sources.append(src_name)
        text_content = mr.extracted_text or mr.cleaned_text or mr.ai_summary or "No content."
        context_lines.append(f"--- {src_name} ---\n{text_content}\n")
        
    for p in prescriptions:
        src_name = f"Prescription - {p.prescription_id} ({p.created_at.strftime('%Y-%m-%d')})"
        sources.append(src_name)
        meds = ", ".join([m.medicine_name for m in p.medicines]) if p.medicines else "None"
        context_lines.append(f"--- {src_name} ---\nDiagnosis: {p.diagnosis}\nMedicines: {meds}\nNotes: {p.notes or ''}\n")

    if not context_lines:
        return AISummaryResponse(
            summary="No supporting information was found in the available records.",
            sources=[]
        )

    full_context = "\n".join(context_lines)
    
    prompt = f"""
You are a medical AI assistant. The doctor has asked the following about the patient:
\"{req.prompt}\"

Here are the available medical records for this patient:
{full_context}

Please provide a concise and professional summary answering the doctor's request.
CRITICAL RULES:
1. ONLY use the supplied patient records above.
2. DO NOT invent diagnoses, dates, medications, lab values, symptoms, procedures, or outcomes.
3. If the information requested is not available in the context, explicitly state: "No supporting information was found in the available records."
4. Do not present your output as an independently verified diagnosis. State that it is a summary based on the provided records.
"""
    from services.gemini_service import GEMINI_API_URL, GEMINI_API_KEY
    import requests

    if not GEMINI_API_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Gemini API key is not configured.")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
        },
    }

    try:
        response = requests.post(
            GEMINI_API_URL,
            params={"key": GEMINI_API_KEY},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()
        candidates = result.get("candidates") or []
        content = candidates[0].get("content", {}) if candidates else {}
        parts = content.get("parts") or []
        summary = "\n".join(
            part.get("text", "")
            for part in parts
            if isinstance(part, dict) and part.get("text")
        )
        
        if not summary:
            raise ValueError("Empty response from Gemini")
            
        return AISummaryResponse(
            summary=summary,
            sources=sources
        )
    except Exception as e:
        print(f"Gemini AI Summary Error: {e}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate AI summary. Please try again later.")


@router.get("/recent-activity", response_model=list[RecentActivityItem])
def get_recent_activity(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    
    activities = []
    
    # Recent prescriptions (last 10)
    recent_prescriptions = (
        db.query(Prescription, Patient)
        .join(Patient, Prescription.patient_id == Patient.id)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.deleted_at.is_(None)
        )
        .order_by(Prescription.created_at.desc())
        .limit(10)
        .all()
    )
    
    for prescription, patient in recent_prescriptions:
        activities.append({
            "id": prescription.id,
            "activity_type": "prescription_created",
            "description": f"Prescription created for {patient.full_name}",
            "timestamp": prescription.created_at,
            "patient_name": patient.full_name,
            "patient_uid": patient.patient_uid,
        })
    
    # Recent access approvals (last 10)
    recent_approvals = (
        db.query(AccessRequest, Patient)
        .join(Patient, AccessRequest.patient_id == Patient.id)
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            AccessRequest.status == "approved"
        )
        .order_by(AccessRequest.created_at.desc())
        .limit(10)
        .all()
    )
    
    for access_request, patient in recent_approvals:
        activities.append({
            "id": access_request.id,
            "activity_type": "access_approved",
            "description": f"Patient access approved for {patient.full_name}",
            "timestamp": access_request.created_at,
            "patient_name": patient.full_name,
            "patient_uid": patient.patient_uid,
        })
    
    # Sort all activities by timestamp, newest first
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Return top 15 activities
    return activities[:15]


@router.get("/upcoming-follow-ups", response_model=list[UpcomingFollowUp])
def get_upcoming_follow_ups(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    
    from datetime import date
    
    today = date.today()
    
    # Get prescriptions with follow-up dates from today onwards
    follow_ups = (
        db.query(Prescription, Patient)
        .join(Patient, Prescription.patient_id == Patient.id)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.follow_up_date >= today,
            Prescription.deleted_at.is_(None)
        )
        .order_by(Prescription.follow_up_date.asc())
        .limit(10)
        .all()
    )
    
    results = []
    for prescription, patient in follow_ups:
        results.append({
            "id": prescription.id,
            "prescription_id": prescription.prescription_id,
            "patient_name": patient.full_name,
            "patient_uid": patient.patient_uid,
            "diagnosis": prescription.diagnosis,
            "follow_up_date": prescription.follow_up_date,
            "status": prescription.status,
        })
    
    return results


@router.get("/insights", response_model=DoctorInsights)
def get_doctor_insights(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    
    from datetime import date, timedelta
    from collections import Counter
    
    # Most common diagnosis
    diagnoses = (
        db.query(Prescription.diagnosis)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.deleted_at.is_(None)
        )
        .all()
    )
    
    diagnosis_counter = Counter([d[0] for d in diagnoses if d[0]])
    most_common_diagnosis = diagnosis_counter.most_common(1)[0][0] if diagnosis_counter else "N/A"
    
    # Most prescribed medicine
    from models import PrescriptionMedicine
    
    medicines = (
        db.query(PrescriptionMedicine.medicine_name)
        .join(Prescription, PrescriptionMedicine.prescription_id == Prescription.id)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.deleted_at.is_(None)
        )
        .all()
    )
    
    medicine_counter = Counter([m[0] for m in medicines if m[0]])
    most_prescribed_medicine = medicine_counter.most_common(1)[0][0] if medicine_counter else "N/A"
    
    # Average follow-up duration
    prescriptions_with_followup = (
        db.query(Prescription.created_at, Prescription.follow_up_date)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.follow_up_date.isnot(None),
            Prescription.deleted_at.is_(None)
        )
        .all()
    )
    
    follow_up_days = []
    for created_at, follow_up_date in prescriptions_with_followup:
        if created_at and follow_up_date:
            days = (follow_up_date - created_at.date()).days
            if days > 0:
                follow_up_days.append(days)
    
    average_follow_up_days = sum(follow_up_days) / len(follow_up_days) if follow_up_days else 0.0
    
    # Patients seen this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    patients_seen_this_week = (
        db.query(Prescription.patient_id)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.created_at >= week_ago,
            Prescription.deleted_at.is_(None)
        )
        .distinct()
        .count()
    )
    
    # Dynamic clinical alerts and recommendations
    clinical_alerts = []
    recommendations = []

    approved_requests = db.query(AccessRequest).filter(
        AccessRequest.doctor_id == current_doctor.user_id,
        AccessRequest.status == "approved"
    ).all()

    for ar in approved_requests:
        patient = ar.patient
        if patient.allergies:
            clinical_alerts.append({
                "title": f"Allergy Alert: {patient.full_name}",
                "message": f"Patient has documented allergies: {patient.allergies}. Review before prescribing."
            })
        if patient.weight and patient.height:
            height_m = patient.height / 100.0
            bmi = patient.weight / (height_m * height_m)
            if bmi >= 30.0:
                clinical_alerts.append({
                    "title": f"High BMI Alert: {patient.full_name}",
                    "message": f"Patient BMI is {bmi:.1f} (Obese). Consider lifestyle recommendations."
                })

    from datetime import date as dt_date
    today_date = dt_date.today()
    upcoming = db.query(Prescription, Patient).join(Patient, Prescription.patient_id == Patient.id).filter(
        Prescription.doctor_id == current_doctor.user_id,
        Prescription.follow_up_date >= today_date,
        Prescription.deleted_at.is_(None)
    ).all()

    for p, patient in upcoming:
        recommendations.append({
            "title": f"Follow-up Scheduled: {patient.full_name}",
            "message": f"Follow-up for {p.diagnosis} is scheduled on {p.follow_up_date.strftime('%Y-%m-%d')}."
        })

    if not recommendations:
        recommendations.append({
            "title": "Welcome to Vritan Insights",
            "message": "All patient follow-ups and sessions are currently on schedule."
        })

    return DoctorInsights(
        most_common_diagnosis=most_common_diagnosis,
        most_prescribed_medicine=most_prescribed_medicine,
        average_follow_up_days=round(average_follow_up_days, 1),
        patients_seen_this_week=patients_seen_this_week,
        clinical_alerts=clinical_alerts,
        recommendations=recommendations,
    )


@router.get("/metrics")
def get_doctor_analytics(
    time_range: str = Query("week"),
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    from datetime import date
    from collections import Counter, defaultdict
    import calendar

    today = date.today()

    if time_range == "week":
        start_date = today - timedelta(days=today.weekday())
        periods = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        
        def get_period_label(dt_val) -> str:
            if isinstance(dt_val, datetime):
                dt_val = dt_val.date()
            return dt_val.strftime("%a")

    elif time_range == "month":
        start_date = today.replace(day=1)
        last_day = calendar.monthrange(today.year, today.month)[1]
        periods = ["1-7", "8-14", "15-21", "22-28"]
        if last_day >= 29:
            periods.append(f"29-{last_day}")
            
        def get_period_label(dt_val) -> str:
            if isinstance(dt_val, datetime):
                dt_val = dt_val.date()
            d = dt_val.day
            if d <= 7: return "1-7"
            elif d <= 14: return "8-14"
            elif d <= 21: return "15-21"
            elif d <= 28: return "22-28"
            else: return f"29-{last_day}"

    else:
        start_date = today.replace(month=1, day=1)
        periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        def get_period_label(dt_val) -> str:
            if isinstance(dt_val, datetime):
                dt_val = dt_val.date()
            return dt_val.strftime("%b")

    # Fetch prescriptions efficiently
    prescriptions_data = (
        db.query(Prescription.id, Prescription.patient_id, Prescription.created_at, Prescription.diagnosis)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.created_at >= start_date,
            Prescription.deleted_at.is_(None),
        )
        .all()
    )

    # 1. Patients Seen
    patients_seen_map = {p: set() for p in periods}
    for p_id, pt_id, created_at, diag in prescriptions_data:
        lbl = get_period_label(created_at)
        if lbl in patients_seen_map:
            patients_seen_map[lbl].add(pt_id)
            
    patients_seen = [{"period": p, "count": len(patients_seen_map.get(p, set()))} for p in periods]

    # 2. Prescription Trends
    presc_counts = Counter()
    for p_id, pt_id, created_at, diag in prescriptions_data:
        lbl = get_period_label(created_at)
        presc_counts[lbl] += 1
        
    prescription_trends = [{"period": p, "count": presc_counts[p]} for p in periods]

    # 3. Common Diagnoses
    diagnoses = [diag for _, _, _, diag in prescriptions_data if diag]
    diagnoses_counter = Counter(diagnoses)
    common_diagnoses = [
        {"diagnosis": diag, "count": cnt}
        for diag, cnt in diagnoses_counter.most_common(5)
    ]

    # 4. Common Medicines
    from models import PrescriptionMedicine
    presc_ids = [p_id for p_id, _, _, _ in prescriptions_data]
    medicines = []
    if presc_ids:
        med_records = (
            db.query(PrescriptionMedicine.medicine_name)
            .filter(PrescriptionMedicine.prescription_id.in_(presc_ids))
            .all()
        )
        medicines = [m[0] for m in med_records if m[0]]
    med_counter = Counter(medicines)
    common_medicines = [
        {"medicine": med, "count": cnt} for med, cnt in med_counter.most_common(5)
    ]

    # 5. Follow-up Rate
    followup_presc = (
        db.query(Prescription.patient_id, Prescription.follow_up_date)
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.follow_up_date.isnot(None),
            Prescription.deleted_at.is_(None),
        )
        .all()
    )
    if not followup_presc:
        follow_up_completion = 100
    else:
        completed = 0
        patient_ids_with_followup = list(set([f[0] for f in followup_presc]))
        future_presc = (
            db.query(Prescription.patient_id, Prescription.created_at)
            .filter(
                Prescription.patient_id.in_(patient_ids_with_followup),
                Prescription.deleted_at.is_(None),
            )
            .all()
        )
        
        patient_presc_dates = defaultdict(list)
        for pt_id, cat in future_presc:
            if isinstance(cat, datetime):
                cat = cat.date()
            patient_presc_dates[pt_id].append(cat)
            
        for pt_id, f_date in followup_presc:
            if isinstance(f_date, datetime):
                f_date = f_date.date()
            if any(p_date > f_date for p_date in patient_presc_dates[pt_id]):
                completed += 1
                
        follow_up_completion = int((completed / len(followup_presc)) * 100)

    # 6. Record Uploads
    approved_patient_ids = [
        ar[0]
        for ar in db.query(AccessRequest.patient_id)
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            AccessRequest.status == "approved",
        )
        .distinct()
        .all()
    ]
    
    record_uploads = []
    if approved_patient_ids:
        count = (
            db.query(func.count(MedicalRecord.id))
            .filter(
                MedicalRecord.patient_id.in_(approved_patient_ids),
                MedicalRecord.uploaded_at >= start_date,
            )
            .scalar()
        )
        record_uploads = [1] * (count or 0)

    # 7. Patient Growth
    patient_earliest = {}
    
    min_presc = (
        db.query(Prescription.patient_id, func.min(Prescription.created_at))
        .filter(
            Prescription.doctor_id == current_doctor.user_id,
            Prescription.deleted_at.is_(None),
        )
        .group_by(Prescription.patient_id)
        .all()
    )
    for pid, created_at in min_presc:
        patient_earliest[pid] = created_at
        
    min_access = (
        db.query(AccessRequest.patient_id, func.min(AccessRequest.created_at))
        .filter(
            AccessRequest.doctor_id == current_doctor.user_id,
            AccessRequest.status == "approved",
        )
        .group_by(AccessRequest.patient_id)
        .all()
    )
    for pid, created_at in min_access:
        if pid not in patient_earliest or created_at < patient_earliest[pid]:
            patient_earliest[pid] = created_at

    growth_counts = Counter()
    for created_at in patient_earliest.values():
        c_date = created_at.date() if isinstance(created_at, datetime) else created_at
        if c_date >= start_date:
            growth_counts[get_period_label(c_date)] += 1
            
    baseline = sum(
        1 for created_at in patient_earliest.values() 
        if (created_at.date() if isinstance(created_at, datetime) else created_at) < start_date
    )
    
    patient_growth = []
    cumulative = baseline
    for p in periods:
        cumulative += growth_counts.get(p, 0)
        patient_growth.append({"period": p, "count": cumulative})

    return {
        "patientsSeen": patients_seen,
        "prescriptionTrends": prescription_trends,
        "commonDiagnoses": common_diagnoses,
        "commonMedicines": common_medicines,
        "followUpCompletion": follow_up_completion,
        "recordUploads": record_uploads,
        "patientGrowth": patient_growth,
    }


@router.get("/patient/{patient_uid}/ai-summary")
def get_patient_ai_summary(
    patient_uid: str,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    _require_verified_doctor(current_doctor)
    patient = db.query(Patient).filter(Patient.patient_uid == patient_uid.strip()).first()
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Patient not found")

    # Verify doctor consent for patient
    if not _active_access_request(db, patient_id=patient.id, doctor_id=current_doctor.user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to patient records is not approved or has expired.",
        )

    # Fetch dynamic snapshot without persisting
    from services.clinical_snapshot import ClinicalSnapshotService
    snapshot = ClinicalSnapshotService.generate_snapshot(db, patient)
    
    return snapshot


@router.get("/settings")
def get_settings(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    return {
        "email_notifications": current_doctor.email_notifications,
        "prescription_alerts": current_doctor.prescription_alerts,
        "access_requests": current_doctor.access_requests,
        "profile_visibility": current_doctor.profile_visibility,
    }


@router.patch("/settings")
def update_settings(
    payload: dict,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    if "email_notifications" in payload:
        current_doctor.email_notifications = bool(payload["email_notifications"])
    if "prescription_alerts" in payload:
        current_doctor.prescription_alerts = bool(payload["prescription_alerts"])
    if "access_requests" in payload:
        current_doctor.access_requests = bool(payload["access_requests"])
    if "profile_visibility" in payload:
        current_doctor.profile_visibility = str(payload["profile_visibility"])
    db.commit()
    return {"message": "Settings updated successfully"}


@router.post("/change-password")
def change_password(
    payload: dict,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    current_password = payload.get("current_password")
    new_password = payload.get("new_password")
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing current or new password")

    user = db.query(UserModel).filter(UserModel.id == current_doctor.user_id).first()
    if not user or not verify_password(current_password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    user.password = hash_password(new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.delete("/account")
def delete_account(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db),
):
    user = db.query(UserModel).filter(UserModel.id == current_doctor.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(current_doctor)
    db.delete(user)
    db.commit()
    return {"message": "Account deleted successfully"}

# --- Doctor Availability & Settings Endpoints ---

@router.get("/availability")
def get_availability(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db)
):
    from appointment_models import DoctorAvailability
    availabilities = db.query(DoctorAvailability).filter(DoctorAvailability.doctor_id == current_doctor.user_id).all()
    return [
        {
            "id": a.id,
            "branch_id": a.branch_id,
            "day_of_week": a.day_of_week,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "slot_duration_minutes": a.slot_duration_minutes
        } for a in availabilities
    ]

@router.post("/availability")
def save_availability(
    payload: dict,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db)
):
    from appointment_models import DoctorAvailability
    # Clear existing weekly slots
    db.query(DoctorAvailability).filter(DoctorAvailability.doctor_id == current_doctor.user_id).delete()
    
    avail_list = payload.get("availabilities", [])
    for item in avail_list:
        avail = DoctorAvailability(
            doctor_id=current_doctor.user_id,
            branch_id=item.get("branch_id"), # Nullable for telemedicine
            day_of_week=item.get("day_of_week"),
            start_time=item.get("start_time"),
            end_time=item.get("end_time"),
            slot_duration_minutes=item.get("slot_duration_minutes", 30)
        )
        db.add(avail)
    db.commit()
    return {"message": "Availability settings saved successfully"}

@router.get("/availability/exceptions")
def get_exceptions(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db)
):
    from appointment_models import DoctorAvailabilityException
    exceptions = db.query(DoctorAvailabilityException).filter(DoctorAvailabilityException.doctor_id == current_doctor.user_id).all()
    return [
        {
            "id": e.id,
            "exception_date": str(e.exception_date) if e.exception_date else None,
            "exception_type": e.exception_type,
            "start_time": e.start_time,
            "end_time": e.end_time,
            "is_recurring": e.is_recurring,
            "recurrence_pattern": e.recurrence_pattern
        } for e in exceptions
    ]

@router.post("/availability/exceptions")
def add_exception(
    payload: dict,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db)
):
    from appointment_models import DoctorAvailabilityException
    from datetime import datetime
    
    is_recurring = bool(payload.get("is_recurring", False))
    recurrence_pattern = payload.get("recurrence_pattern")
    
    exc_date = None
    if not is_recurring:
        date_str = payload.get("exception_date")
        if date_str:
            exc_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            
            # Clear generated slots for this doctor on this day
            from appointment_models import AppointmentSlot
            db.query(AppointmentSlot).filter(
                AppointmentSlot.doctor_id == current_doctor.user_id,
                AppointmentSlot.date == exc_date
            ).delete()

    exc = DoctorAvailabilityException(
        doctor_id=current_doctor.user_id,
        exception_date=exc_date,
        exception_type=payload.get("exception_type", "Leave"),
        start_time=payload.get("start_time"),
        end_time=payload.get("end_time"),
        is_recurring=is_recurring,
        recurrence_pattern=recurrence_pattern
    )
    db.add(exc)
    db.commit()
    return {"message": "Exception/Leave configuration added successfully"}

@router.get("/profile-settings")
def get_profile_settings(
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db)
):
    from appointment_models import DoctorProfile
    profile = db.query(DoctorProfile).filter(DoctorProfile.doctor_id == current_doctor.user_id).first()
    if not profile:
        # Auto-create profile if missing
        profile = DoctorProfile(
            doctor_id=current_doctor.user_id,
            consultation_fee=500.0,
            languages="",
            qualification="",
            rating=4.5,
            buffer_minutes=0,
            max_appointments_per_day=20,
            advance_booking_window_days=30,
            cancellation_notice_hours=24
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
    return {
        "consultation_fee": profile.consultation_fee,
        "buffer_minutes": profile.buffer_minutes,
        "max_appointments_per_day": profile.max_appointments_per_day,
        "advance_booking_window_days": profile.advance_booking_window_days,
        "cancellation_notice_hours": profile.cancellation_notice_hours
    }

@router.patch("/profile-settings")
def update_profile_settings(
    payload: dict,
    current_doctor: Doctor = Depends(_current_user_from_token),
    db: Session = Depends(get_db)
):
    from appointment_models import DoctorProfile
    profile = db.query(DoctorProfile).filter(DoctorProfile.doctor_id == current_doctor.user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Doctor profile settings not found")
        
    if "consultation_fee" in payload:
        profile.consultation_fee = float(payload["consultation_fee"])
    if "buffer_minutes" in payload:
        profile.buffer_minutes = int(payload["buffer_minutes"])
    if "max_appointments_per_day" in payload:
        profile.max_appointments_per_day = int(payload["max_appointments_per_day"])
    if "advance_booking_window_days" in payload:
        profile.advance_booking_window_days = int(payload["advance_booking_window_days"])
    if "cancellation_notice_hours" in payload:
        profile.cancellation_notice_hours = int(payload["cancellation_notice_hours"])
        
    db.commit()
    return {"message": "Profile settings updated successfully"}
