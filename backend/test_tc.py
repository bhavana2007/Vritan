from fastapi.testclient import TestClient
from main import app
from security import create_access_token
from database import SessionLocal
from models import Patient, User
db=SessionLocal()
p=db.query(Patient).first()
u=db.query(User).filter(User.id==p.user_id).first()
token=create_access_token(u.id, u.role, u.email, u.phone_number, True)
db.close()
c=TestClient(app)
headers={'Authorization':f'Bearer {token}', 'X-Patient-Profile-ID':str(p.id)}
r=c.get('/patient/appointments/organizations', headers=headers)
print('Organizations Status:', r.status_code)
if r.status_code == 200: print('Organizations len:', len(r.json()))
print('Organizations JSON:', r.json())
r2=c.get('/patient/appointments', headers=headers)
print('Appointments Status:', r2.status_code)
if r2.status_code == 200: print('Appointments len:', len(r2.json()))
print('Appointments JSON:', r2.json())
