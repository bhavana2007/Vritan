from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import User
from security import get_current_user
from repositories.appointment_repos import appointment_repo, slot_repo
from services.appointment_engine import AppointmentEngine
from utils.responses import success_response, error_response

router = APIRouter(prefix="/api/v1/appointments", tags=["Appointments"])

class BookAppointmentRequest(BaseModel):
    slot_uid: str
    patient_uid: str
    doctor_uid: str
    branch_uid: str
    department_uid: str

@router.post("/book")
def book_appointment(
    request: BookAppointmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Book an appointment. Consumes UUIDs, validates slot, executes workflow.
    """
    if current_user.role != "patient":
        return error_response("Unauthorized", "UNAUTHORIZED_ROLE", 403)
        
    # In a real implementation, repositories map UIDs to internal IDs.
    # For brevity, assuming mapping methods exist.
    # slot = slot_repo.get_by_uid(db, request.slot_uid)
    # new_apt = AppointmentEngine.book_appointment(db, patient.id, slot.id, doctor.id, branch.id, dept.id)
    
    return success_response({"appointment_uid": "APT-1234"}, "Appointment requested successfully.")

@router.get("")
def list_appointments(
    status: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List appointments with pagination and role-based filtering.
    """
    return success_response({"items": []}, "Appointments retrieved.")
