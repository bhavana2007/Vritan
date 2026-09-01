from datetime import datetime
from services.event_bus import domain_event_bus

class AppointmentWorkflowEngine:
    """
    Validates and executes appointment lifecycle transitions.
    Keeps business rules isolated from API controllers.
    """
    VALID_TRANSITIONS = {
        "Requested": ["Confirmed", "Cancelled"],
        "Confirmed": ["Checked-In", "Rescheduled", "Cancelled", "Missed"],
        "Checked-In": ["Waiting"],
        "Waiting": ["Consultation Started"],
        "Consultation Started": ["Prescription Generated", "Lab Tests Ordered", "Completed"],
        "Prescription Generated": ["Completed"],
        "Lab Tests Ordered": ["Completed"],
        "Rescheduled": ["Confirmed", "Cancelled"],
        # End states
        "Completed": [],
        "Cancelled": [],
        "Missed": []
    }

    @staticmethod
    def transition_state(appointment, new_state: str, user_id: int):
        """
        Transitions an appointment to a new state if valid, and fires domain events.
        """
        current_state = appointment.status
        
        if new_state not in AppointmentWorkflowEngine.VALID_TRANSITIONS.get(current_state, []):
            raise ValueError(f"Invalid transition from {current_state} to {new_state}")
            
        appointment.status = new_state
        appointment.updated_at = datetime.utcnow()
        
        if new_state == "Completed":
            appointment.completed_at = datetime.utcnow()
            
        # Fire Domain Events
        payload = {
            "appointment_id": appointment.id,
            "appointment_uid": getattr(appointment, 'appointment_uid', 'N/A'),
            "status": new_state,
            "actor_id": user_id
        }
        
        domain_event_bus.publish("APPOINTMENT_STATE_CHANGED", payload)
        
        if new_state == "Completed":
            domain_event_bus.publish("APPOINTMENT_COMPLETED", payload)
            
        return appointment
