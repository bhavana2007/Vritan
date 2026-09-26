import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from models import User, Doctor
from appointment_models import Appointment, AppointmentSlot

db = SessionLocal()

print("--- DOCTOR 294 ---")
try:
    doc = db.query(Doctor).filter(Doctor.user_id == 294).first()
    if doc:
        print(f"ID: {doc.user_id}")
        print(f"Name: {doc.full_name}")
        
        # We need to find the department and branch this doctor is associated with
        # Let's check if there is an org_models relation
        # Just printing Doctor fields for now
        print(f"Hospital: {doc.hospital}")
        print(f"Practice: {doc.practice_type}")
        print(f"Spec: {doc.specialization}")
        print(f"Status: {doc.is_verified}")
    else:
        print("Doctor 294 not found")
except Exception as e:
    print(f"Error: {e}")

print("\n--- APPOINTMENT 11 ---")
try:
    apt = db.query(Appointment).filter(Appointment.id == 11).first()
    if apt:
        print(f"ID: {apt.id}")
        print(f"UID: {apt.appointment_uid}")
        print(f"Doctor ID: {apt.doctor_id}")
        print(f"Patient ID: {apt.patient_id}")
        print(f"Org ID: {getattr(apt, 'organization_id', 'N/A')}")
        print(f"Branch ID: {getattr(apt, 'branch_id', 'N/A')}")
        print(f"Dept ID: {getattr(apt, 'department_id', 'N/A')}")
        print(f"Slot ID: {getattr(apt, 'slot_id', 'N/A')}")
        print(f"Token: {apt.token_number}")
        print(f"Status: {apt.status}")
    else:
        print("Appointment 11 not found")
except Exception as e:
    print(f"Error: {e}")

print("\n--- APPOINTMENT SLOT 3523 ---")
try:
    slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == 3523).first()
    if slot:
        print(f"ID: {slot.id}")
        print(f"Doctor ID: {slot.doctor_id}")
        print(f"Date: {slot.date}")
        print(f"Start Time: {slot.start_time}")
        print(f"End Time: {slot.end_time}")
        print(f"Status: {slot.status}")
        print(f"Token: {slot.token_number}")
    else:
        print("Slot 3523 not found")
except Exception as e:
    print(f"Error: {e}")

db.close()
