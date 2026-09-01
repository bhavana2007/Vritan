from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import User
from security import get_current_user
from repositories.appointment_repos import slot_repo
from utils.responses import success_response, error_response

router = APIRouter(prefix="/api/v1/slots", tags=["Appointment Slots"])

class SlotLockRequest(BaseModel):
    slot_id: int
    patient_id: int

@router.post("/{slot_id}/lock")
def lock_slot(
    slot_id: int,
    request: SlotLockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lock an appointment slot for 5 minutes.
    """
    if current_user.role != "patient":
        return error_response("Unauthorized", "UNAUTHORIZED_ROLE", 403)
        
    slot = slot_repo.get_by_id(db, slot_id)
    if not slot:
        return error_response("Slot not found", "SLOT_NOT_FOUND", 404)
        
    if slot.status != "AVAILABLE":
        return error_response("Selected slot is already locked or booked.", "APPOINTMENT_SLOT_UNAVAILABLE", 400)
        
    success = slot_repo.lock_slot(db, slot_id, request.patient_id)
    if success:
        return success_response({"slot_id": slot_id, "locked_until": "5 minutes from now"}, "Slot locked successfully.")
    else:
        return error_response("Failed to lock slot", "SLOT_LOCK_FAILED", 500)
