from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import Patient, User, Appointment, AppointmentSlot, Doctor

client = TestClient(app)

def test_appointments():
    db = SessionLocal()
    # Create a dummy "Confirmed" appointment
    patient = db.query(Patient).first()
    doctor = db.query(Doctor).first()
    slot = db.query(AppointmentSlot).first()
    
    if not patient or not doctor or not slot:
        print("Missing required entities to test.")
        return
        
    # Add a mock confirmed appointment
    new_apt = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.user_id,
        slot_id=slot.id,
        status="Confirmed"
    )
    db.add(new_apt)
    db.commit()
    db.refresh(new_apt)
    
    print(f"Added mock Confirmed appointment {new_apt.id}")

    user = db.query(User).filter(User.id == patient.user_id).first()
    
    def override_get_current_user():
        db = SessionLocal()
        u = db.query(User).filter(User.id == user.id).first()
        db.close()
        return u
        
    def override_get_active_patient():
        db = SessionLocal()
        p = db.query(Patient).filter(Patient.id == patient.id).first()
        db.close()
        return p
        
    app.dependency_overrides[get_active_patient] = override_get_active_patient
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    print("Sending GET /patient/appointments")
    response = client.get("/patient/appointments")
    print("Status:", response.status_code)
    try:
        print("Response JSON:", response.json())
    except:
        print("Response Text:", response.text)
        
    # Cleanup
    db = SessionLocal()
    apt_to_del = db.query(Appointment).filter(Appointment.id == new_apt.id).first()
    if apt_to_del:
        db.delete(apt_to_del)
        db.commit()
    db.close()

if __name__ == "__main__":
    from dependencies.patient_profile import get_active_patient
    from security import get_current_user
    test_appointments()
