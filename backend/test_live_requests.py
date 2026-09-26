import requests
from database import SessionLocal
from models import Patient, User
from security import create_access_token

def run():
  db = SessionLocal()
  p = db.query(Patient).first()
  u = db.query(User).filter(User.id == p.user_id).first()
  token = create_access_token(user_id=u.id, role=u.role, email=u.email, mobile=u.phone_number, is_verified=True)
  db.close()
  headers = {'Authorization': f'Bearer {token}', 'X-Patient-Profile-ID': str(p.id)}
  print('Fetching orgs...')
  r1 = requests.get('http://127.0.0.1:8000/patient/appointments/organizations', headers=headers)
  print('Orgs:', r1.status_code)
  try: print(r1.json())
  except: print(r1.text)
  print('Fetching apts...')
  r2 = requests.get('http://127.0.0.1:8000/patient/appointments', headers=headers)
  print('Apts:', r2.status_code)
  try: print(r2.json())
  except: print(r2.text)
run()
