from sqlalchemy.orm import Session
from datetime import datetime

from repositories.appointment_repos import slot_repo, appointment_repo
from services.appointment_workflow import AppointmentWorkflowEngine

class AppointmentEngine:
    """
    Core engine handling complex appointment logic like booking flows and conflict resolution.
    """
    
    @staticmethod
    def book_appointment(db: Session, patient_id: int, slot_id: int, doctor_id: int, branch_id: int, dept_id: int) -> dict:
        """
        Finalize booking for a locked or available slot.
        """
        # Ensure slot is available or locked by this patient
        slot = slot_repo.get_by_id(db, slot_id)
        if not slot:
            raise ValueError("Slot not found")
            
        if slot.status == "BOOKED":
            raise ValueError("Slot is already booked")
            
        # Create appointment in 'Requested' state
        new_appointment = appointment_repo.create(db, {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "branch_id": branch_id,
            "department_id": dept_id,
            "slot_id": slot_id,
            "status": "Requested"
        })
        
        # Mark slot as booked
        slot_repo.update(db, slot, {"status": "BOOKED"})
        
        # Transition immediately to Confirmed as a side effect (mocking a synchronous confirm)
        AppointmentWorkflowEngine.transition_state(new_appointment, "Confirmed", user_id=patient_id)
        db.commit()
        
        return new_appointment
