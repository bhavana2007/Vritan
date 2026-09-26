import requests, json
from database import SessionLocal
from models import Patient, User
from security import create_access_token

def run():
  db = SessionLocal()
  p = db.query(Patient).first()
  u = db.query(User).filter(User.id == p.user_id).first()
  token = create_access_token(user_id=u.id, role=u.role, email=u.email, mobile=u.phone_number, is_verified=True)
  db.close()
  headers = {'Authorization': f'Bearer {token}'}
  r = requests.get('http://127.0.0.1:8000/patient/appointments', headers=headers)
  print(r.status_code)
  print(r.text)
run()
