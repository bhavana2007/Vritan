from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from datetime import datetime, date, timedelta
from pydantic import BaseModel
import uuid

from database import get_db
from org_models import OrganizationMembership, OrganizationEmployeeAssignment
from models import Appointment, User, Doctor, Patient, Branch, Department, DoctorAvailability, DoctorAvailabilityException, AppointmentSlot, AppointmentSlotLock
from security import get_current_user

router = APIRouter(prefix="/api/v1/appointments", tags=["Appointments"])

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user
    return role_checker


class LockSlotPayload(BaseModel):
    doctor_id: int
    date: date
    start_time: str
    branch_id: Optional[int] = None


@router.get("/slots")
def get_available_slots(
    doctor_id: int,
    date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dynamically generates bookable slots based on doctor availability, exceptions, and existing bookings.
    """
    # 0. RBAC Validation for Hospital Admin
    if current_user.role == "hospital_admin":
        memberships = db.query(OrganizationMembership).filter(
            OrganizationMembership.user_id == current_user.id,
            OrganizationMembership.role == "admin",
            OrganizationMembership.status == "ACTIVE"
        ).all()
        org_ids = [m.organization_id for m in memberships]
        if not org_ids:
            raise HTTPException(status_code=403, detail="Not authorized for any organization")
            
        assignment = db.query(OrganizationEmployeeAssignment).filter(
            OrganizationEmployeeAssignment.user_id == doctor_id,
            OrganizationEmployeeAssignment.organization_id.in_(org_ids),
            OrganizationEmployeeAssignment.status == "ACTIVE"
        ).first()
        
        if not assignment:
            raise HTTPException(status_code=403, detail="Not authorized to view this doctor's slots")

    # 1. Fetch weekly schedule for the given day of week (0=Monday)
    day_of_week = date.weekday()
    availabilities = db.query(DoctorAvailability).filter(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.day_of_week == day_of_week
    ).all()

    # 2. Fetch exceptions for the given date
    exception = db.query(DoctorAvailabilityException).filter(
        DoctorAvailabilityException.doctor_id == doctor_id,
        DoctorAvailabilityException.exception_date == date
    ).first()

    # If full day leave
    if exception and exception.exception_type in ["Holiday", "Emergency Leave", "Leave"]:
        if not exception.start_time and not exception.end_time:
            return [] # Full day leave

    # Determine base intervals
    base_intervals = []
    if exception and exception.exception_type == "Partial":
        # Override the whole day with this specific time block
        base_intervals.append({
            "start": exception.start_time,
            "end": exception.end_time,
            "duration": 30 # Default if unknown
        })
    else:
        for a in availabilities:
            base_intervals.append({
                "start": a.start_time,
                "end": a.end_time,
                "duration": a.slot_duration_minutes
            })

    if not base_intervals:
        return []

    # Generate all possible slots
    all_slots = []
    for interval in base_intervals:
        duration = interval["duration"] or 30
        curr = datetime.strptime(interval["start"], "%H:%M")
        end_time = datetime.strptime(interval["end"], "%H:%M")
        
        while curr + timedelta(minutes=duration) <= end_time:
            slot_start = curr.strftime("%H:%M")
            slot_end = (curr + timedelta(minutes=duration)).strftime("%H:%M")
            
            # Format time like "09:00 AM" for frontend compatibility
            time_formatted = curr.strftime("%I:%M %p")
            
            all_slots.append({
                "time": time_formatted,
                "start_time": slot_start,
                "end_time": slot_end,
                "available": True,
                "id": f"temp-{slot_start}"
            })
            curr += timedelta(minutes=duration)

    import zoneinfo
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(IST)
    today_ist = now_ist.date()
    current_ist_time_str = now_ist.strftime("%H:%M")

    # 3. Check existing locks and bookings
    # Need to find existing AppointmentSlot for this doctor/date
    db_slots = db.query(AppointmentSlot).filter(
        AppointmentSlot.doctor_id == doctor_id,
        AppointmentSlot.date == date
    ).all()
    
    db_slot_map = {s.start_time: s for s in db_slots}
    
    # Also check direct appointments just in case
    appointments = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        # scheduled_date is currently string in some old records, but we'll check slot_id
    ).all()
    booked_slot_ids = {a.slot_id for a in appointments}

    current_time = datetime.utcnow()

    # Update availability
    for s in all_slots:
        # Check if slot is in the past for today
        if date == today_ist and s["start_time"] < current_ist_time_str:
            s["available"] = False

        db_slot = db_slot_map.get(s["start_time"])
        if db_slot:
            s["id"] = db_slot.id # Use real ID if exists
            
            # Check if booked
            if db_slot.status == "BOOKED" or db_slot.id in booked_slot_ids:
                s["available"] = False
            elif db_slot.status == "LOCKED":
                # Check if lock expired
                lock = db.query(AppointmentSlotLock).filter(AppointmentSlotLock.slot_id == db_slot.id).first()
                if lock and lock.expires_at > current_time:
                    # If this user holds the lock, they can see it as locked for them
                    # But for now, we just mark it unavailable to others
                    s["available"] = False
                else:
                    # Lock expired, free it up
                    db_slot.status = "AVAILABLE"
                    db.commit()

    return all_slots


@router.post("/slots/lock")
def lock_slot(
    payload: LockSlotPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["patient"]))
):
    from dependencies.patient_profile import get_active_patient
    patient = get_active_patient(None, current_user, db)

    # Convert frontend time format "09:00 AM" to "HH:MM"
    try:
        parsed_time = datetime.strptime(payload.start_time, "%I:%M %p")
        db_start_time = parsed_time.strftime("%H:%M")
        db_end_time = (parsed_time + timedelta(minutes=30)).strftime("%H:%M") # Assuming 30 for simplicity, should derive from schedule
    except ValueError:
        db_start_time = payload.start_time
        try:
            db_end_time = (datetime.strptime(db_start_time, "%H:%M") + timedelta(minutes=30)).strftime("%H:%M")
        except:
            db_end_time = db_start_time

    # Find or create AppointmentSlot
    db_slot = db.query(AppointmentSlot).filter(
        AppointmentSlot.doctor_id == payload.doctor_id,
        AppointmentSlot.date == payload.date,
        AppointmentSlot.start_time == db_start_time
    ).first()
    
    import zoneinfo
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(IST)
    try:
        payload_date = datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError:
        payload_date = payload.date
        
    if payload_date < now_ist.date():
        raise HTTPException(status_code=400, detail="Cannot lock an appointment in the past.")
    elif payload_date == now_ist.date() and db_start_time < now_ist.strftime("%H:%M"):
        raise HTTPException(status_code=400, detail="Cannot lock a past time slot.")

    if not db_slot:
        db_slot = AppointmentSlot(
            doctor_id=payload.doctor_id,
            branch_id=payload.branch_id,
            date=payload.date,
            start_time=db_start_time,
            end_time=db_end_time,
            status="AVAILABLE"
        )
        db.add(db_slot)
        db.commit()
        db.refresh(db_slot)

    current_time = datetime.utcnow()

    if db_slot.status == "BOOKED":
        raise HTTPException(status_code=400, detail="Slot is already booked.")
    
    if db_slot.status == "LOCKED":
        existing_lock = db.query(AppointmentSlotLock).filter(AppointmentSlotLock.slot_id == db_slot.id).first()
        if existing_lock and existing_lock.expires_at > current_time:
            if existing_lock.patient_id != patient.id:
                raise HTTPException(status_code=400, detail="Slot is currently locked by another user.")
            else:
                # Renew lock for current user
                existing_lock.expires_at = current_time + timedelta(minutes=5)
                db.commit()
                return {"message": "Lock renewed", "slot_id": db_slot.id}

    # Acquire lock
    db_slot.status = "LOCKED"
    
    # Delete any stale locks
    db.query(AppointmentSlotLock).filter(AppointmentSlotLock.slot_id == db_slot.id).delete()
    
    new_lock = AppointmentSlotLock(
        slot_id=db_slot.id,
        patient_id=patient.id,
        locked_at=current_time,
        expires_at=current_time + timedelta(minutes=5)
    )
    db.add(new_lock)
    db.commit()
    
    return {"message": "Slot locked successfully", "slot_id": db_slot.id}


class BookAppointmentPayload(BaseModel):
    doctor_id: int
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    date: str # YYYY-MM-DD
    time: str # 09:00 AM
    slot_id: Optional[Union[int, str]] = None
    appointment_type: Optional[str] = "Physical"

@router.post("/book", status_code=status.HTTP_201_CREATED)
def book_appointment(
    payload: BookAppointmentPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["patient"]))
):
    """
    Book a new appointment.
    """
    from dependencies.patient_profile import get_active_patient
    patient = get_active_patient(None, current_user, db)
    
    current_time = datetime.utcnow()

    # Find slot
    db_slot = None
    if payload.slot_id and not str(payload.slot_id).startswith("temp-"):
        db_slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == int(payload.slot_id)).first()
    else:
        # Fallback to finding by time
        try:
            parsed_time = datetime.strptime(payload.time, "%I:%M %p")
            db_start_time = parsed_time.strftime("%H:%M")
        except ValueError:
            db_start_time = payload.time
            
        db_slot = db.query(AppointmentSlot).filter(
            AppointmentSlot.doctor_id == payload.doctor_id,
            AppointmentSlot.date == payload.date,
            AppointmentSlot.start_time == db_start_time
        ).first()

    if not db_slot:
        raise HTTPException(status_code=400, detail="Invalid slot. Please select a slot first.")

    import zoneinfo
    IST = zoneinfo.ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(IST)
    
    if db_slot.date < now_ist.date():
        raise HTTPException(status_code=400, detail="Cannot book an appointment in the past.")
    elif db_slot.date == now_ist.date() and db_slot.start_time < now_ist.strftime("%H:%M"):
        raise HTTPException(status_code=400, detail="Cannot book a past time slot.")

    # BOOKING DEBUG
    print("\n--- BOOKING DEBUG ---")
    print(f"patient_id={patient.id}")
    print(f"hospital_id={payload.organization_id if hasattr(payload, 'organization_id') else 'N/A'}")
    print(f"branch_id={payload.branch_id}")
    print(f"department_id={payload.department_id}")
    print(f"doctor_id={payload.doctor_id}")
    print(f"appointment_date={payload.date}")
    print(f"slot_id={db_slot.id if db_slot else 'N/A'}")
    print(f"slot_date={db_slot.date if db_slot else 'N/A'}")
    print(f"slot_start={db_slot.start_time if db_slot else 'N/A'}")
    print(f"slot_end={db_slot.end_time if db_slot else 'N/A'}")
    
    if db_slot.status == "BOOKED":
        raise HTTPException(status_code=400, detail="Slot is already booked.")

    # Verify lock
    if db_slot.status == "LOCKED":
        lock = db.query(AppointmentSlotLock).filter(AppointmentSlotLock.slot_id == db_slot.id).first()
        if lock and lock.expires_at > current_time and lock.patient_id != patient.id:
            raise HTTPException(status_code=400, detail="Slot is currently locked by another user.")

    # Convert slot to booked
    db_slot.status = "BOOKED"

    new_apt = Appointment(
        appointment_uid=f"APT-{uuid.uuid4().hex[:8].upper()}",
        token_number=f"TKN-{uuid.uuid4().hex[:4].upper()}",
        patient_id=patient.id,
        doctor_id=payload.doctor_id,
        branch_id=payload.branch_id,
        department_id=payload.department_id,
        slot_id=db_slot.id,
        appointment_type=payload.appointment_type or "Physical",
        status="Confirmed" # Auto confirm for MVP
    )
    
    db.add(new_apt)
    # Remove lock
    db.query(AppointmentSlotLock).filter(AppointmentSlotLock.slot_id == db_slot.id).delete()
    db.commit()
    db.refresh(new_apt)
    
    # Reload for debugging
    saved_apt = db.query(Appointment).filter(Appointment.id == new_apt.id).first()
    print("\n--- CREATED APPOINTMENT DEBUG ---")
    print(f"appointment_id={saved_apt.id}")
    print(f"doctor_id={saved_apt.doctor_id}")
    print(f"doctor_name={saved_apt.doctor.full_name if saved_apt.doctor else 'N/A'}")
    print(f"hospital={saved_apt.branch.organization.name if saved_apt.branch and hasattr(saved_apt.branch, 'organization') and saved_apt.branch.organization else 'N/A'}")
    print(f"branch={saved_apt.branch.name if saved_apt.branch else 'N/A'}")
    print(f"department={saved_apt.department.name if saved_apt.department else 'N/A'}")
    print(f"slot_id={saved_apt.slot_id}")
    print(f"status={saved_apt.status}")
    print(f"token={saved_apt.token_number}")
    print("---------------------------------\n")
    # Fetch relations for response
    doctor_name = "Unknown"
    doctor_user = db.query(User).filter(User.id == new_apt.doctor_id).first()
    if doctor_user:
        doctor_name = doctor_user.full_name
        
    hospital_name = None
    branch_name = None
    if new_apt.branch_id:
        branch = db.query(Branch).filter(Branch.id == new_apt.branch_id).first()
        if branch:
            branch_name = branch.name
            from org_models import Organization
            org = db.query(Organization).filter(Organization.id == branch.organization_id).first()
            if org:
                hospital_name = org.name
                
    department_name = None
    if new_apt.department_id:
        dept = db.query(Department).filter(Department.id == new_apt.department_id).first()
        if dept:
            department_name = dept.name
    
    # Notify Patient and Doctor (mocked hook)
    try:
        from services.notification_service import send_notification
        send_notification(new_apt.patient_id, "Appointment Booked", f"Your appointment is confirmed.")
        send_notification(new_apt.doctor_id, "New Appointment", f"New appointment scheduled.")
    except Exception:
        pass
    
    return {
        "id": new_apt.id,
        "appointment_uid": new_apt.appointment_uid,
        "patient_id": new_apt.patient_id,
        "doctor_id": new_apt.doctor_id,
        "doctor_name": doctor_name,
        "hospital_name": hospital_name,
        "branch_name": branch_name,
        "department_name": department_name,
        "slot_id": new_apt.slot_id,
        "date": db_slot.date.isoformat() if db_slot.date else None,
        "start_time": db_slot.start_time,
        "end_time": db_slot.end_time,
        "appointment_type": new_apt.appointment_type,
        "status": new_apt.status,
        "token": new_apt.token_number
    }


@router.get("/my-appointments")
def get_my_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get appointments for the current user (either patient or doctor).
    """
    if current_user.role == "patient":
        from dependencies.patient_profile import get_active_patient
        try:
            patient = get_active_patient(None, current_user, db)
            return db.query(Appointment).filter(Appointment.patient_id == patient.id).all()
        except HTTPException as e:
            raise e
        except Exception:
            raise HTTPException(status_code=404, detail="Active patient profile not found")
        
    elif current_user.role == "doctor":
        # Get doctor id from user id
        doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor profile not found")
            
        from appointment_utils import sync_appointment_status
        from org_models import Organization
        # Return full details for dashboard
        appointments = db.query(Appointment).filter(Appointment.doctor_id == doctor.user_id).all()
        result = []
        has_changes = False
        
        # Resolve doctor name once
        doctor_name = doctor.full_name if doctor else "Unknown"
        
        for apt in appointments:
            # Need to get slot to know time
            slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == apt.slot_id).first()
            
            # Sync stale appointments
            changed = sync_appointment_status(apt, slot)
            if changed:
                has_changes = True
                
            # Resolve hospital and branch
            hospital_name = None
            branch_name = None
            if apt.branch_id:
                branch = db.query(Branch).filter(Branch.id == apt.branch_id).first()
                if branch:
                    branch_name = branch.name
                    org = db.query(Organization).filter(Organization.id == branch.organization_id).first()
                    if org:
                        hospital_name = org.name
                        
            # Resolve department
            department_name = None
            if apt.department_id:
                dept = db.query(Department).filter(Department.id == apt.department_id).first()
                if dept:
                    department_name = dept.name
            
            # Resolve patient
            patient = db.query(Patient).filter(Patient.id == apt.patient_id).first()
            patient_name = patient.full_name if patient else "Unknown"
            patient_uid = patient.patient_uid if patient else None
            
            print(f"\n[APPOINTMENT PATIENT DEBUG]")
            print(f"appointment_uid={apt.appointment_uid}")
            print(f"appointment.patient_id={apt.patient_id}")
            if patient:
                print(f"resolved_patient.id={patient.id}")
                print(f"resolved_patient.patient_uid={patient.patient_uid}")
                print(f"resolved_patient.name={patient.full_name}")
            else:
                print("resolved_patient=None")
            
            result.append({
                "id": apt.id,
                "appointment_uid": apt.appointment_uid,
                "patient_id": apt.patient_id,
                "patient_uid": patient_uid,
                "patient_name": patient_name,
                "doctor_id": apt.doctor_id,
                "doctor_name": doctor_name,
                "hospital_name": hospital_name,
                "branch_name": branch_name,
                "department_name": department_name,
                "slot_id": apt.slot_id,
                "date": slot.date if slot else None,
                "start_time": slot.start_time if slot else None,
                "end_time": slot.end_time if slot else None,
                "token": apt.token_number,
                "status": apt.status,
                "appointment_type": apt.appointment_type,
                "consultation_mode": apt.consultation_mode
            })
            
        if has_changes:
            db.commit()
            
        return result


@router.put("/{appointment_id_or_uid}/start")
def start_appointment(
    appointment_id_or_uid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["doctor"]))
):
    """
    Start an appointment (Transitions to In Progress).
    """
    try:
        id_val = int(appointment_id_or_uid)
        apt = db.query(Appointment).filter(Appointment.id == id_val).first()
    except ValueError:
        apt = db.query(Appointment).filter(Appointment.appointment_uid == appointment_id_or_uid).first()
        
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    if apt.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    apt.status = "In Progress"
    db.commit()
    
    return {"message": "Appointment started successfully."}


@router.put("/{appointment_id_or_uid}/complete")
def complete_appointment(
    appointment_id_or_uid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["doctor"]))
):
    """
    Complete an appointment.
    """
    try:
        id_val = int(appointment_id_or_uid)
        apt = db.query(Appointment).filter(Appointment.id == id_val).first()
    except ValueError:
        apt = db.query(Appointment).filter(Appointment.appointment_uid == appointment_id_or_uid).first()
        
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    if apt.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    apt.status = "Completed"
    db.commit()
    
    return {"message": "Appointment completed successfully."}
