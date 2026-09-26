from database import SessionLocal
from models import Appointment, AppointmentSlot, User, Doctor, Department

db = SessionLocal()

doctor_id = 294

# Fetch all appointments for doctor 294
apts = db.query(Appointment).filter(Appointment.doctor_id == doctor_id).all()
print(f"Total appointments for doctor {doctor_id}: {len(apts)}")
for a in apts:
    slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == a.slot_id).first()
    print(f"- Appointment {a.id} on {slot.date} at {slot.start_time}")

db.close()
