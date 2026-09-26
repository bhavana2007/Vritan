from database import SessionLocal
from models import Appointment, AppointmentSlot, Doctor, Branch, Organization
from appointment_utils import sync_appointment_status

def test_db_appointments():
    db = SessionLocal()
    appointments = db.query(Appointment).all()
    print(f"Total appointments: {len(appointments)}")
    for apt in appointments:
        print(f"\nEvaluating Appointment {apt.id} ({apt.appointment_uid}) - Status: {apt.status}")
        slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == apt.slot_id).first()
        if slot:
            print(f"  Slot {slot.id}: date={slot.date}, start={slot.start_time}, end={slot.end_time}")
        else:
            print("  Slot: None")
            
        try:
            if sync_appointment_status(apt, slot):
                db.commit()
            print(f"  After sync: {apt.status}")
        except Exception as e:
            print(f"  SYNC ERROR: {e}")
            
        try:
            doctor = db.query(Doctor).filter(Doctor.user_id == apt.doctor_id).first()
            print(f"  Doctor: {doctor.full_name if doctor else 'None'}")
        except Exception as e:
            print(f"  DOCTOR ERROR: {e}")
            
        hospital_name = "Unknown Hospital"
        try:
            if apt.branch_id:
                branch = db.query(Branch).filter(Branch.id == apt.branch_id).first()
                if branch:
                    org = db.query(Organization).filter(Organization.id == branch.organization_id).first()
                    if org:
                        hospital_name = org.name
            print(f"  Hospital: {hospital_name}")
        except Exception as e:
            print(f"  HOSPITAL ERROR: {e}")
            
        # Map backend status to UI status
        status = apt.status
        if status == "Confirmed":
            status = "Upcoming"
            
        date_str = slot.date.strftime("%b %d, %Y") if slot and slot.date else "Unknown Date"
        
        # Format time to 12h format
        time_str = "Unknown Time"
        if slot and slot.start_time:
            try:
                from datetime import datetime
                time_obj = datetime.strptime(slot.start_time, "%H:%M")
                time_str = time_obj.strftime("%I:%M %p")
            except Exception as e:
                time_str = slot.start_time
                print(f"  TIME FORMAT ERROR: {e}")
                
        print(f"  Final: status={status}, date={date_str}, time={time_str}")

if __name__ == "__main__":
    test_db_appointments()
