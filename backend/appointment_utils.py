import zoneinfo
from datetime import datetime, date
from sqlalchemy.orm import Session

IST = zoneinfo.ZoneInfo("Asia/Kolkata")

def get_current_ist_time():
    return datetime.now(IST)

def is_appointment_past(slot_date: date, end_time_str: str) -> bool:
    """Check if the appointment slot end time has passed in IST."""
    if not slot_date or not end_time_str:
        return False
        
    try:
        dt_str = f"{slot_date.strftime('%Y-%m-%d')} {end_time_str}"
        try:
            slot_end_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M").replace(tzinfo=IST)
        except ValueError:
            slot_end_dt = datetime.strptime(dt_str, "%Y-%m-%d %I:%M %p").replace(tzinfo=IST)
            
        current_time = get_current_ist_time()
        return slot_end_dt < current_time
    except Exception as e:
        print(f"Error parsing date/time for past check: {e}")
        return False

def sync_appointment_status(appointment, slot) -> bool:
    """
    If the appointment is in a pre-start state (Confirmed/Booked/Requested)
    but the slot time has passed, mark it as Missed.
    Returns True if the status was changed, False otherwise.
    """
    # 1. Terminal states remain terminal
    if appointment.status in ["Cancelled", "Completed", "Missed"]:
        return False
        
    # 2. In Progress remains In Progress
    if appointment.status == "In Progress":
        return False
        
    # 3. Confirmed + appointment end time passed -> Missed
    if appointment.status in ["Confirmed", "Booked", "Requested"]:
        if slot and slot.date and slot.end_time:
            if is_appointment_past(slot.date, slot.end_time):
                appointment.status = "Missed"
                return True
    
    return False
