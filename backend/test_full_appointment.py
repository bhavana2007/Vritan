import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
import routers.auth
routers.auth.verify_firebase_token = lambda x: {'uid': 'firebase_uid_upload_test', 'phone_number': '+919876543211'}
reg_payload = {'role': 'patient', 'name': 'Integration Test Patient', 'mobile': '9876543211', 'firebase_id_token': '123', 'date_of_birth': '1990-05-15', 'gender': 'Male', 'blood_group': 'A+', 'pin_code': '560001', 'country': 'India', 'state': 'Karnataka', 'district': 'Bangalore', 'mandal': 'Bangalore', 'city': 'Bangalore', 'consent_status': True, 'consent_terms': True, 'consent_privacy': True, 'consent_medical_storage': True, 'consent_analytics': True}
client.post('/register', json=reg_payload)
login_resp = client.post('/login/patient-firebase', json={'firebase_id_token': '123', 'mobile': '9876543211'})
access_token = login_resp.json()['access_token']
headers = {'Authorization': f'Bearer {access_token}'}
orgs = client.get('/patient/appointments/organizations', headers=headers).json()
cherry_org = next((o for o in orgs if 'cherry' in (o.get('name') or '').lower()), None)
if not cherry_org: print('Cherry org not found!'); exit(1)
org_id = cherry_org['id']
print('Org ID:', org_id)
branches = client.get(f'/patient/appointments/organizations/{org_id}/branches', headers=headers).json()
print('Branches:', [b['id'] for b in branches])
if not branches: exit(0)
branch_id = branches[0]['id']
depts = client.get(f'/patient/appointments/branches/{branch_id}/departments', headers=headers).json()
print('Departments:', [d['id'] for d in depts])
if not depts: exit(0)
dept_id = depts[0]['id']
doctors = client.get(f'/patient/appointments/departments/{dept_id}/doctors', headers=headers).json()
print('Doctors:', [d['user_id'] for d in doctors])
if not doctors: exit(0)
doctor_id = doctors[0]['user_id']
doc_details = client.get(f'/patient/appointments/doctors/by-user/{doctor_id}', headers=headers).json()
print('Doctor Name:', doc_details.get('name', 'Unknown'))
