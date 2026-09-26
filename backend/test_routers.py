import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from routers.patient_portal import get_dashboard_summary, get_patient_appointments
from models import Patient

db = SessionLocal()
patient = db.query(Patient).filter(Patient.id == 33).first()

if not patient:
    print("Patient 33 not found")
else:
    try:
        summary = get_dashboard_summary(db=db, patient=patient)
        print("Dashboard Summary:")
        print(summary)
    except Exception as e:
        print(f"Error in dashboard: {e}")

    try:
        apts = get_patient_appointments(db=db, patient=patient)
        print("\nPatient Appointments:")
        print(apts)
    except Exception as e:
        print(f"Error in appointments: {e}")

db.close()
