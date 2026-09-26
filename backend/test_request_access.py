import requests, json
from database import SessionLocal
from models import Appointment, Doctor, User, Patient
from security import create_access_token

def run():
  db = SessionLocal()
  appts = db.query(Appointment).all()
  appt = None
  doc = None
  for a in appts:
    doc = db.query(Doctor).filter(Doctor.user_id == a.doctor_id).first()
    if doc: appt = a; break
  if not appt: print('No valid appointments'); return
  doc.is_verified = True
  doc.verification_status = 'approved'
  db.commit()
  u = db.query(User).filter(User.id == doc.user_id).first()
  pat = db.query(Patient).filter(Patient.id == appt.patient_id).first()
  token = create_access_token(user_id=u.id, role=u.role, email=u.email, mobile=u.phone_number, is_verified=True)
  db.close()
  print(f'Doctor: {u.email}, Patient: {pat.patient_uid}')
  headers = {'Authorization': f'Bearer {token}'}
  r = requests.post(f'http://127.0.0.1:8000/api/v1/auth/doctor/request-access/{pat.patient_uid}', headers=headers)
  print(r.status_code)
  print(r.text)
run()
