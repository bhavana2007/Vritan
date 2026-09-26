from database import SessionLocal
from models import Patient, Appointment, AppointmentSlot, Doctor, Branch, Organization
from appointment_utils import sync_appointment_status

def test_db_appointments_for_248():
    db = SessionLocal()
    patient_id = 248
    
    # Alternatively find by name "Bhavana Kolli"
    patient = db.query(Patient).filter(Patient.full_name.like("%Bhavana Kolli%")).first()
    if patient:
        print(f"Found patient: {patient.full_name} (ID: {patient.id})")
        patient_id = patient.id
    else:
        print("Patient 'Bhavana Kolli' not found, using ID 248")

    appointments = db.query(Appointment).filter(Appointment.patient_id == patient_id).all()
    print(f"Total appointments for patient {patient_id}: {len(appointments)}")
    
    for apt in appointments:
        print(f"\nEvaluating Appointment {apt.id} ({apt.appointment_uid}) - Status: {apt.status}")
        try:
            slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == apt.slot_id).first()
            if slot:
                print(f"  Slot {slot.id}: date={slot.date}, start={slot.start_time}, end={slot.end_time}")
            else:
                print("  Slot: None")
        except Exception as e:
            print(f"  SLOT ERROR: {e}")
            continue
            
        try:
            if sync_appointment_status(apt, slot):
                db.commit()
            print(f"  After sync: {apt.status}")
        except Exception as e:
            print(f"  SYNC ERROR: {e}")
            import traceback
            traceback.print_exc()
            
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

if __name__ == "__main__":
    test_db_appointments_for_248()
