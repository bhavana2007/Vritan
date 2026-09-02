from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
from pydantic import BaseModel
from enum import Enum

from database import get_db
from models import User, Patient, Appointment, MedicalRecord, Prescription, Notification, Doctor, AppointmentSlot, DoctorProfile
from org_models import Organization, Branch, Department
from security import get_current_user
from dependencies.patient_profile import get_active_patient
from schemas import UserRegister, MedicalRecordPublic

router = APIRouter(prefix="/patient", tags=["Patient Portal"])

def require_patient(current_user: User = Depends(get_current_user)):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Not a patient")
    return current_user

# --- Profiles ---

@router.get("/profiles")
def get_profiles(current_user: User = Depends(require_patient), db: Session = Depends(get_db)):
    return [
        {
            "id": p.id,
            "full_name": p.full_name,
            "is_primary": p.is_primary,
            "relationship": p.relationship_to_account,
            "patient_uid": p.patient_uid,
            "date_of_birth": p.date_of_birth,
            "gender": p.gender,
            "blood_group": p.blood_group,
        }
        for p in current_user.patients
    ]

@router.post("/profiles")
def add_profile(
    name: str,
    date_of_birth: str,
    gender: str,
    relationship: str,
    blood_group: Optional[str] = None,
    pin_code: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    mandal: Optional[str] = None,
    city: Optional[str] = None,
    municipality: Optional[str] = None,
    urban_rural: Optional[str] = None,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db)
):
    from routers.auth import _make_patient_uid
    import datetime as dt
    dob = None
    if date_of_birth:
        dob = dt.datetime.strptime(date_of_birth, "%Y-%m-%d").date()

    new_profile = Patient(
        user_id=current_user.id,
        patient_uid=_make_patient_uid(current_user.id) + f"-{len(current_user.patients) + 1}",
        full_name=name.strip(),
        date_of_birth=dob,
        gender=gender,
        blood_group=blood_group,
        pin_code=pin_code,
        state=state,
        district=district,
        mandal=mandal,
        city=city,
        municipality=municipality,
        urban_rural=urban_rural,
        is_primary=False,
        relationship_to_account=relationship,
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return {"message": "Profile added successfully", "profile": {"id": new_profile.id, "full_name": new_profile.full_name}}

# --- Profile ---

@router.get("/me")
def get_me(patient: Patient = Depends(get_active_patient)):
    return patient

# --- Dashboard ---

@router.get("/dashboard-summary")
def get_dashboard_summary(db: Session = Depends(get_db), patient: Patient = Depends(get_active_patient)):
    from appointment_utils import sync_appointment_status
    import zoneinfo
    from datetime import datetime
    
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(IST)
    today_ist = now_ist.date()
    current_time_str = now_ist.strftime("%H:%M")

    # Upcoming appointment
    from sqlalchemy import or_, and_
    upcoming_apt_slot = db.query(Appointment, AppointmentSlot).join(
        AppointmentSlot, Appointment.slot_id == AppointmentSlot.id
    ).filter(
        Appointment.patient_id == patient.id,
        Appointment.status == "Confirmed",
        or_(
            AppointmentSlot.date > today_ist,
            and_(
                AppointmentSlot.date == today_ist,
                AppointmentSlot.start_time >= current_time_str
            )
        )
    ).order_by(
        AppointmentSlot.date.asc(),
        AppointmentSlot.start_time.asc()
    ).first()
    
    upcoming_apt = None
    doctor = None
    slot = None
    
    if upcoming_apt_slot:
        upcoming_apt, slot = upcoming_apt_slot
        if sync_appointment_status(upcoming_apt, slot):
            db.commit()
            db.refresh(upcoming_apt)
        
        if upcoming_apt.status == "Confirmed":
            doctor = db.query(Doctor).filter(Doctor.user_id == upcoming_apt.doctor_id).first()
        else:
            upcoming_apt = None
            slot = None
            
    upcoming_apt_dict = None
    if upcoming_apt and slot:
        time_str = slot.start_time
        try:
            from datetime import datetime
            time_str = datetime.strptime(slot.start_time, "%H:%M").strftime("%I:%M %p")
        except:
            pass
            
        hospital_name = "Unknown Hospital"
        department_name = "Unknown Department"
        if upcoming_apt.branch_id:
            # Global imports are used
            branch = db.query(Branch).filter(Branch.id == upcoming_apt.branch_id).first()
            if branch:
                org = db.query(Organization).filter(Organization.id == branch.organization_id).first()
                if org:
                    hospital_name = org.name
        if upcoming_apt.department_id:
            dept = db.query(Department).filter(Department.id == upcoming_apt.department_id).first()
            if dept:
                department_name = dept.name
            
        upcoming_apt_dict = {
            "appointment_uid": upcoming_apt.appointment_uid,
            "id": upcoming_apt.id,
            "patient_id": upcoming_apt.patient_id,
            "doctor_id": upcoming_apt.doctor_id,
            "doctor_name": doctor.full_name if doctor else "Unknown",
            "hospital_name": hospital_name,
            "department_name": department_name,
            "branch_id": upcoming_apt.branch_id,
            "date": slot.date.strftime("%Y-%m-%d") if slot.date else None,
            "start_time": slot.start_time,
            "end_time": slot.end_time,
            "status": upcoming_apt.status,
            "token": upcoming_apt.token_number or f"TKN-{upcoming_apt.id}"
        }
    
    # Recent record
    recent_record = db.query(MedicalRecord).filter(
        MedicalRecord.patient_id == patient.id
    ).order_by(MedicalRecord.uploaded_at.desc()).first()
    
    # Latest prescription
    latest_rx = db.query(Prescription).filter(
        Prescription.patient_id == patient.id
    ).order_by(Prescription.created_at.desc()).first()
    
    return {
        "upcoming_appointment": upcoming_apt_dict,
        "recent_record": recent_record,
        "latest_prescription": latest_rx
    }

# --- Appointments ---

@router.get("/appointments")
def get_patient_appointments(db: Session = Depends(get_db), patient: Patient = Depends(get_active_patient)):
    from appointment_utils import sync_appointment_status
    
    try:
        appointments = db.query(Appointment).filter(Appointment.patient_id == patient.id).all()
        result = []
        
        needs_commit = False
        for apt in appointments:
            slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == apt.slot_id).first()
            
            if sync_appointment_status(apt, slot):
                needs_commit = True
            
            doctor = db.query(Doctor).filter(Doctor.user_id == apt.doctor_id).first()
            
            hospital_name = "Unknown Hospital"
            if apt.branch_id:
                branch = db.query(Branch).filter(Branch.id == apt.branch_id).first()
                if branch:
                    org = db.query(Organization).filter(Organization.id == branch.organization_id).first()
                    if org:
                        hospital_name = org.name

            # Map backend status to UI status
            status = apt.status
            if status == "Confirmed":
                status = "Upcoming"
                
            date_str = slot.date.strftime("%Y-%m-%d") if slot and slot.date else None
            
            department_name = "Unknown Department"
            if apt.department_id:
                dept = db.query(Department).filter(Department.id == apt.department_id).first()
                if dept:
                    department_name = dept.name
                    
            branch_name = "Unknown Branch"
            if apt.branch_id:
                b = db.query(Branch).filter(Branch.id == apt.branch_id).first()
                if b:
                    branch_name = b.name

            result.append({
                "appointment_uid": apt.appointment_uid,
                "id": apt.id,
                "patient_id": apt.patient_id,
                "doctor_id": apt.doctor_id,
                "doctor_name": doctor.full_name if doctor else "Unknown Doctor",
                "hospital_id": getattr(apt, "organization_id", None) or getattr(apt, "hospital_id", None),
                "hospital_name": hospital_name,
                "branch_id": apt.branch_id,
                "branch_name": branch_name,
                "department_id": apt.department_id,
                "department_name": department_name,
                "slot_id": apt.slot_id,
                "date": date_str,
                "start_time": slot.start_time if slot else None,
                "end_time": slot.end_time if slot else None,
                "token": apt.token_number or f"TKN-{apt.id}",
                "status": status,
                "consultation_mode": getattr(apt, "consultation_mode", "Offline")
            })
            
        if needs_commit:
            db.commit()
            
        # Sort by descending ID so newest is first
        result.reverse()
        return result
    except Exception as e:
        import traceback
        return {"success": False, "traceback": traceback.format_exc(), "error": str(e)}

@router.post("/appointments/{appointment_uid}/cancel")
def cancel_appointment(appointment_uid: str, db: Session = Depends(get_db), patient: Patient = Depends(get_active_patient)):
    apt = db.query(Appointment).filter(Appointment.appointment_uid == appointment_uid, Appointment.patient_id == patient.id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    if apt.status not in ["Confirmed", "Requested", "Booked"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this appointment")
        
    apt.status = "Cancelled"
    
    # Free up slot
    if apt.slot_id:
        slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == apt.slot_id).first()
        if slot:
            slot.status = "AVAILABLE"
            
    db.commit()
    return {"message": "Appointment cancelled successfully"}

@router.get("/appointments/organizations")
def get_organizations(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    return db.query(Organization).filter(Organization.verification_status == "APPROVED", Organization.status == "ACTIVE").all()

@router.get("/appointments/organizations/{org_id}/branches")
def get_branches(org_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    return db.query(Branch).filter(Branch.organization_id == org_id, Branch.status == "ACTIVE").all()

@router.get("/appointments/branches/{branch_id}/departments")
def get_departments(branch_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    return db.query(Department).filter(Department.branch_id == branch_id, Department.is_active == True).all()

@router.get("/appointments/departments/{dept_id}/doctors")
def get_doctors(dept_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    from org_models import BranchDoctorAffiliation, Branch
    affiliations = db.query(BranchDoctorAffiliation).join(
        Branch, Branch.id == BranchDoctorAffiliation.branch_id
    ).filter(
        BranchDoctorAffiliation.department_id == dept_id,
        BranchDoctorAffiliation.status == "ACTIVE",
        Branch.status == "ACTIVE"
    ).all()
    doctor_ids = [aff.doctor_id for aff in affiliations]
    return db.query(Doctor).filter(Doctor.user_id.in_(doctor_ids), Doctor.verification_status == "APPROVED").all()

class PracticeTypeEnum(str, Enum):
    HOSPITAL = "HOSPITAL"
    INDEPENDENT = "INDEPENDENT"
    TELEMEDICINE = "TELEMEDICINE"
    HYBRID = "HYBRID"

class PatientAppointmentDoctorPublic(BaseModel):
    id: Optional[int] = None
    user_id: int
    full_name: str
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    years_of_experience: Optional[int] = None
    languages_spoken: Optional[str] = None
    consultation_fee: Optional[int] = 500
    practice_type: PracticeTypeEnum
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    profile_image_url: Optional[str] = None
    hospital: Optional[str] = None
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    organization_id: Optional[int] = None
    hospital_name: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/appointments/doctors/by-user/{user_id}", response_model=PatientAppointmentDoctorPublic)
def get_doctor_by_user_id(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    from org_models import BranchDoctorAffiliation, Branch, Department, Organization
    from appointment_models import DoctorProfile

    # Perform a single database query using explicit outer joins
    res = db.query(Doctor, DoctorProfile, BranchDoctorAffiliation, Branch, Department, Organization)\
        .outerjoin(DoctorProfile, DoctorProfile.doctor_id == Doctor.user_id)\
        .outerjoin(BranchDoctorAffiliation, BranchDoctorAffiliation.doctor_id == Doctor.user_id)\
        .outerjoin(Branch, Branch.id == BranchDoctorAffiliation.branch_id)\
        .outerjoin(Department, Department.id == BranchDoctorAffiliation.department_id)\
        .outerjoin(Organization, Organization.id == Branch.organization_id)\
        .filter(Doctor.user_id == user_id)\
        .first()

    if not res:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor, profile, affiliation, branch, department, organization = res

    # Validate that the doctor is active and verified
    if not doctor.is_verified or doctor.verification_status != "APPROVED":
        raise HTTPException(status_code=400, detail="Doctor is not verified or active")

    # Validate affiliation and branch are active if present
    if affiliation:
        if affiliation.status != "ACTIVE":
            raise HTTPException(status_code=400, detail="Doctor branch affiliation is not active")
        if branch and branch.status != "ACTIVE":
            raise HTTPException(status_code=400, detail="Doctor branch is not active")

    # Treat practice_type as a canonical enum
    def map_practice_type_to_enum(pt_str: str) -> PracticeTypeEnum:
        if not pt_str:
            return PracticeTypeEnum.HYBRID
        pt_lower = pt_str.lower()
        if "telemedicine" in pt_lower:
            return PracticeTypeEnum.TELEMEDICINE
        if "independent" in pt_lower or "clinic" in pt_lower:
            return PracticeTypeEnum.INDEPENDENT
        if "hospital" in pt_lower or "healthcare" in pt_lower:
            return PracticeTypeEnum.HOSPITAL
        return PracticeTypeEnum.HYBRID

    practice_type_enum = map_practice_type_to_enum(doctor.practice_type)

    # Resolve related fields
    branch_id = affiliation.branch_id if affiliation else None
    branch_name = branch.name if branch else None
    department_id = affiliation.department_id if affiliation else (profile.department_id if profile else None)
    department_name = department.name if department else (profile.department.name if (profile and profile.department) else None)
    organization_id = branch.organization_id if branch else None
    hospital_name = organization.name if organization else doctor.hospital

    return PatientAppointmentDoctorPublic(
        id=profile.id if profile else None,
        user_id=doctor.user_id,
        full_name=doctor.full_name or "Dr. Doctor",
        specialization=doctor.specialization,
        qualification=doctor.qualification,
        years_of_experience=doctor.years_of_experience,
        languages_spoken=doctor.languages_spoken,
        consultation_fee=int(profile.consultation_fee) if (profile and profile.consultation_fee) else 500,
        practice_type=practice_type_enum,
        clinic_name=doctor.clinic_name,
        clinic_address=doctor.clinic_address,
        profile_image_url=doctor.profile_image_url,
        hospital=doctor.hospital,
        branch_id=branch_id,
        branch_name=branch_name,
        department_id=department_id,
        department_name=department_name,
        organization_id=organization_id,
        hospital_name=hospital_name
    )

@router.get("/appointments/independent-doctors")
def get_independent_doctors(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    return db.query(Doctor).filter(
        Doctor.practice_type.in_(["Independent Clinic", "Independent Clinic / Private Practice", "Hybrid"]),
        Doctor.is_verified == True
    ).all()

@router.get("/appointments/telemedicine-doctors")
def get_telemedicine_doctors(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    return db.query(Doctor).filter(
        Doctor.practice_type.in_(["Telemedicine Only", "Telemedicine", "Hybrid"]),
        Doctor.is_verified == True
    ).all()

@router.get("/appointments/doctors/{doctor_id}/slots")
def get_slots(doctor_id: int, date: str, db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    # Convert date string to python Date
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    
    # Check if slots exist for this doctor on this date
    slots = db.query(AppointmentSlot).filter(
        AppointmentSlot.doctor_id == doctor_id,
        AppointmentSlot.date == target_date
    ).all()
    
    # If no slots exist, we generate availability-driven slots
    if not slots:
        from appointment_models import DoctorAvailability, DoctorAvailabilityException
        from org_models import BranchDoctorAffiliation
        from datetime import timedelta

        # 1. Check one-off exceptions (leaves/holidays)
        one_off_exc = db.query(DoctorAvailabilityException).filter(
            DoctorAvailabilityException.doctor_id == doctor_id,
            DoctorAvailabilityException.exception_date == target_date,
            DoctorAvailabilityException.is_recurring == False
        ).first()
        if one_off_exc:
            return []  # Doctor is on leave/holiday on this date

        # 2. Check recurring exceptions (e.g. Saturday OFF)
        recurring_exceptions = db.query(DoctorAvailabilityException).filter(
            DoctorAvailabilityException.doctor_id == doctor_id,
            DoctorAvailabilityException.is_recurring == True
        ).all()
        
        is_blocked = False
        for exc in recurring_exceptions:
            pattern = exc.recurrence_pattern
            if pattern == "EVERY_SATURDAY" and target_date.weekday() == 5:
                is_blocked = True
                break
            elif pattern == "EVERY_SUNDAY" and target_date.weekday() == 6:
                is_blocked = True
                break
            elif pattern == "EVERY_SECOND_FRIDAY" and target_date.weekday() == 4:
                if 8 <= target_date.day <= 14:
                    is_blocked = True
                    break
        
        if is_blocked:
            return []

        # 3. Get weekday availability
        day_of_week = target_date.weekday()
        availabilities = db.query(DoctorAvailability).filter(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.day_of_week == day_of_week
        ).all()

        # Resolve branch ID and check branch status
        affiliation = db.query(BranchDoctorAffiliation).filter(
            BranchDoctorAffiliation.doctor_id == doctor_id,
            BranchDoctorAffiliation.status == "ACTIVE"
        ).first()
        branch_id = affiliation.branch_id if affiliation else None
        
        if branch_id:
            from org_models import Branch
            branch = db.query(Branch).filter(Branch.id == branch_id).first()
            if not branch or branch.status != "ACTIVE":
                return [] # Block slots if branch is not active

        # Helper to convert HH:MM to 12-hour AM/PM format
        def format_time_12h(time_str: str) -> str:
            t = datetime.strptime(time_str, "%H:%M")
            return t.strftime("%I:%M %p")

        if availabilities:
            for avail in availabilities:
                start_dt = datetime.strptime(avail.start_time, "%H:%M")
                end_dt = datetime.strptime(avail.end_time, "%H:%M")
                duration = avail.slot_duration_minutes or 30
                
                curr_dt = start_dt
                while curr_dt + timedelta(minutes=duration) <= end_dt:
                    slot_start = curr_dt.strftime("%H:%M")
                    time_str = format_time_12h(slot_start)
                    
                    new_slot = AppointmentSlot(
                        doctor_id=doctor_id,
                        branch_id=branch_id,
                        date=target_date,
                        start_time=time_str,
                        end_time=time_str,
                        status="AVAILABLE"
                    )
                    db.add(new_slot)
                    curr_dt += timedelta(minutes=duration)
            db.commit()
        else:
            # Fallback to standard times if no custom availability configured
            if day_of_week < 5:
                standard_times = ["09:00 AM", "10:00 AM", "11:00 AM", "01:00 PM", "02:00 PM", "04:00 PM"]
                for time_str in standard_times:
                    new_slot = AppointmentSlot(
                        doctor_id=doctor_id,
                        branch_id=branch_id,
                        date=target_date,
                        start_time=time_str,
                        end_time=time_str,
                        status="AVAILABLE"
                    )
                    db.add(new_slot)
                db.commit()

        # Re-fetch generated slots
        slots = db.query(AppointmentSlot).filter(
            AppointmentSlot.doctor_id == doctor_id,
            AppointmentSlot.date == target_date
        ).all()
        
    result = []
    for s in slots:
        result.append({
            "id": s.id,
            "time": s.start_time,
            "available": s.status == "AVAILABLE"
        })
    return result

from pydantic import BaseModel

class BookAppointmentRequest(BaseModel):
    doctor_id: int
    department_id: Optional[int] = None
    branch_id: Optional[int] = None
    organization_id: Optional[int] = None
    date: str
    time: str
    slot_id: int
    appointment_type: str # Hospital, Independent Clinic, Telemedicine

@router.post("/appointments/book")
def book_appointment(req: BookAppointmentRequest, db: Session = Depends(get_db), patient: Patient = Depends(get_active_patient)):
    # Validate based on appointment type
    if req.appointment_type == "Hospital":
        if not req.organization_id or not req.branch_id or not req.department_id:
            raise HTTPException(status_code=400, detail="Hospital appointments require Hospital, Branch, and Department.")
    elif req.appointment_type in ("Independent Clinic", "Telemedicine"):
        req.organization_id = None
        req.branch_id = None
        req.department_id = None
    else:
        raise HTTPException(status_code=400, detail="Invalid appointment_type")

    # Verify slot is available
    slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == req.slot_id).first()
    if not slot or slot.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Slot is no longer available")
    
    # Mark slot as booked
    slot.status = "BOOKED"
    
    # Create appointment
    new_apt = Appointment(
        patient_id=patient.id,
        doctor_id=req.doctor_id,
        branch_id=req.branch_id,
        department_id=req.department_id,
        slot_id=req.slot_id,
        appointment_type=req.appointment_type,
        status="Confirmed"
    )
    
    db.add(new_apt)
    db.commit()
    db.refresh(new_apt)
    
    return {
        "id": new_apt.appointment_uid,
        "token": new_apt.token_number or f"TKN-{new_apt.id}",
        "status": new_apt.status,
        "message": "Appointment successfully booked."
    }

# --- Records ---

@router.get("/records", response_model=List[MedicalRecordPublic])
def get_records(
    request: Request,
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    patient: Patient = Depends(get_active_patient)
):
    from routers.auth import _medical_record_public
    
    log_file = r"C:\Users\bhava\.gemini\antigravity\brain\ad970455-fb7a-447f-85e0-218b967365bc\scratch\auth_debug.log"
    auth_header = request.headers.get("Authorization")
    
    with open(log_file, "a") as f:
        f.write(f"\n=== GET /records === {datetime.now().isoformat()}\n")
        f.write(f"Incoming JWT (Auth Header): {auth_header}\n")
        f.write(f"Resolved Patient: ID={patient.id}, UID={patient.patient_uid}, user_id={patient.user_id}\n")
        f.write(f"Search Query: {search}\n")
        
    query = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient.id)
    
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.join(Patient, MedicalRecord.patient_id == Patient.id).filter(
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
        
    records = query.order_by(MedicalRecord.uploaded_at.desc()).all()
    
    with open(log_file, "a") as f:
        f.write(f"Query Result Count: {len(records)}\n")
        
    return [_medical_record_public(r) for r in records]

# --- Prescriptions ---

@router.get("/prescriptions")
def get_prescriptions(request: Request, db: Session = Depends(get_db), patient: Patient = Depends(get_active_patient)):
    log_file = r"C:\Users\bhava\.gemini\antigravity\brain\ad970455-fb7a-447f-85e0-218b967365bc\scratch\auth_debug.log"
    auth_header = request.headers.get("Authorization")
    
    with open(log_file, "a") as f:
        f.write(f"\n=== GET /prescriptions === {datetime.now().isoformat()}\n")
        f.write(f"Incoming JWT (Auth Header): {auth_header}\n")
        f.write(f"Resolved Patient: ID={patient.id}, UID={patient.patient_uid}, user_id={patient.user_id}\n")
        
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient.id).order_by(Prescription.created_at.desc()).all()
    
    with open(log_file, "a") as f:
        f.write(f"SQL Executed: SELECT * FROM prescriptions WHERE patient_id = {patient.id}\n")
        f.write(f"Query Result Count: {len(prescriptions)}\n")
        
    return prescriptions

# --- Notifications ---

@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()

@router.get("/notifications/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    count = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).count()
    return {"count": count}

@router.put("/notifications/{id}/read")
def mark_read(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    notification = db.query(Notification).filter(Notification.id == id, Notification.user_id == current_user.id).first()
    if notification:
        notification.is_read = True
        db.commit()
    return {"success": True}

@router.put("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(require_patient)):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}
