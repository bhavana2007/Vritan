from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from pydantic import BaseModel, Field

from database import get_db
from models import User, Doctor, DoctorAvailability, DoctorAvailabilityException
from org_models import OrganizationMembership, OrganizationEmployeeAssignment
from security import get_current_user
from routers.appointments import require_role

router = APIRouter(prefix="/api/v1/doctor-schedule", tags=["Doctor Schedule"])


class DailyAvailability(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: str = Field(..., description="HH:MM format")
    end_time: str = Field(..., description="HH:MM format")


class AvailabilityPayload(BaseModel):
    slot_duration_minutes: int = Field(default=30)
    availability: List[DailyAvailability]


class ExceptionPayload(BaseModel):
    exception_date: date
    exception_type: str = Field(..., description="Holiday, Emergency Leave, Temporary Block, Partial")
    start_time: Optional[str] = None
    end_time: Optional[str] = None

def verify_doctor_schedule_read_access(db: Session, current_user: User, doctor_id: Optional[int]) -> Doctor:
    if doctor_id is None:
        if current_user.role != "doctor":
            raise HTTPException(status_code=403, detail="Doctor ID required for non-doctors")
        target_doctor_id = current_user.id
    else:
        target_doctor_id = doctor_id
        
        # If doctor is checking their own schedule
        if current_user.role == "doctor" and current_user.id != target_doctor_id:
            raise HTTPException(status_code=403, detail="Not authorized to view other doctors' schedules")
            
        # If hospital admin is checking
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
                OrganizationEmployeeAssignment.user_id == target_doctor_id,
                OrganizationEmployeeAssignment.organization_id.in_(org_ids),
                OrganizationEmployeeAssignment.status == "ACTIVE"
            ).first()
            
            if not assignment:
                raise HTTPException(status_code=403, detail="Not authorized to view this doctor's schedule")

    doctor = db.query(Doctor).filter(Doctor.user_id == target_doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
        
    return doctor

@router.get("/availability")
def get_availability(
    doctor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["doctor", "hospital_admin", "admin"]))
):
    """
    Get the weekly availability for the specified doctor or logged-in doctor.
    """
    doctor = verify_doctor_schedule_read_access(db, current_user, doctor_id)

    availabilities = db.query(DoctorAvailability).filter(DoctorAvailability.doctor_id == doctor.user_id).all()
    
    slot_duration = 30
    if availabilities:
        slot_duration = availabilities[0].slot_duration_minutes

    return {
        "slot_duration_minutes": slot_duration,
        "availability": [
            {
                "day_of_week": a.day_of_week,
                "start_time": a.start_time,
                "end_time": a.end_time
            } for a in availabilities
        ]
    }


@router.put("/availability")
def update_availability(
    payload: AvailabilityPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["doctor"]))
):
    """
    Update the weekly availability for the logged-in doctor.
    Replaces existing weekly availability.
    """
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    # Clear existing availability
    db.query(DoctorAvailability).filter(DoctorAvailability.doctor_id == doctor.user_id).delete()

    # Add new availability
    for item in payload.availability:
        # Basic time validation
        if item.start_time >= item.end_time:
            raise HTTPException(status_code=400, detail="Start time must be before end time.")

        db.add(DoctorAvailability(
            doctor_id=doctor.user_id,
            branch_id=doctor.branch_id if hasattr(doctor, 'branch_id') else None,
            day_of_week=item.day_of_week,
            start_time=item.start_time,
            end_time=item.end_time,
            slot_duration_minutes=payload.slot_duration_minutes
        ))

    db.commit()
    return {"message": "Weekly availability updated successfully"}


@router.get("/exceptions")
def get_exceptions(
    doctor_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["doctor", "hospital_admin", "admin"]))
):
    """
    Get the date-specific exceptions/leaves for the specified doctor or logged-in doctor.
    """
    doctor = verify_doctor_schedule_read_access(db, current_user, doctor_id)

    exceptions = db.query(DoctorAvailabilityException).filter(DoctorAvailabilityException.doctor_id == doctor.user_id).all()
    
    return [
        {
            "id": e.id,
            "exception_date": e.exception_date,
            "exception_type": e.exception_type,
            "start_time": e.start_time,
            "end_time": e.end_time
        } for e in exceptions
    ]


@router.post("/exceptions")
def add_exception(
    payload: ExceptionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["doctor"]))
):
    """
    Add a new date-specific exception (e.g. Leave or partial day override).
    """
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    # Check for existing override on this date
    existing = db.query(DoctorAvailabilityException).filter(
        DoctorAvailabilityException.doctor_id == doctor.user_id,
        DoctorAvailabilityException.exception_date == payload.exception_date
    ).first()

    if existing:
        # Update existing
        existing.exception_type = payload.exception_type
        existing.start_time = payload.start_time
        existing.end_time = payload.end_time
        exc = existing
    else:
        # Create new
        exc = DoctorAvailabilityException(
            doctor_id=doctor.user_id,
            exception_date=payload.exception_date,
            exception_type=payload.exception_type,
            start_time=payload.start_time,
            end_time=payload.end_time
        )
        db.add(exc)

    db.commit()
    return {"message": "Exception added successfully", "id": exc.id}


@router.delete("/exceptions/{exception_id}")
def delete_exception(
    exception_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["doctor"]))
):
    """
    Remove a date-specific exception.
    """
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    exc = db.query(DoctorAvailabilityException).filter(
        DoctorAvailabilityException.id == exception_id,
        DoctorAvailabilityException.doctor_id == doctor.user_id
    ).first()

    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")

    db.delete(exc)
    db.commit()
    return {"message": "Exception deleted successfully"}
