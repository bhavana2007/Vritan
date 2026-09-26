from database import SessionLocal
from models import Appointment, AppointmentSlot, User, Doctor, Department

db = SessionLocal()

print("="*50)
print("STEP 6 — CHECK APPOINTMENT ID 12")
print("="*50)

apt = db.query(Appointment).filter(Appointment.id == 12).first()
if apt:
    print(f"Appointment 12:")
    print(f"  uid: {apt.appointment_uid}")
    print(f"  doctor_id: {apt.doctor_id}")
    print(f"  slot_id: {apt.slot_id}")
    print(f"  branch_id: {apt.branch_id}")
    print(f"  department_id: {apt.department_id}")
    
    slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == apt.slot_id).first()
    if slot:
        print(f"\nAppointmentSlot {slot.id}:")
        print(f"  doctor_id: {slot.doctor_id}")
        print(f"  date: {slot.date}")
        print(f"  start_time: {slot.start_time}")
        print(f"  end_time: {slot.end_time}")
    else:
        print("\nAppointmentSlot NOT FOUND")
        
    doc_user = db.query(User).filter(User.id == apt.doctor_id).first()
    if doc_user:
        print(f"\nDoctor User {doc_user.id}:")
        print(f"  full_name: {doc_user.full_name}")
    else:
        print("\nDoctor User NOT FOUND")
else:
    print("Appointment 12 NOT FOUND")

db.close()
