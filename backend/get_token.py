from database import SessionLocal
from models import Patient, User
from security import create_access_token
from datetime import timedelta

db = SessionLocal()
patient = db.query(Patient).filter(Patient.full_name.like("%Alice%")).first()
if not patient: patient = db.query(Patient).first()
user = db.query(User).filter(User.id == patient.user_id).first()
db.close()

access_token = create_access_token(
    user_id=user.id,
    role=user.role,
    email=user.email,
    mobile=user.phone_number,
    is_verified=True
)
print("TOKEN:", access_token)
print("PATIENT_ID:", patient.id)
