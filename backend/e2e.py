import sys, os
sys.path.append('d:/Vritan/backend')
from database import SessionLocal
from models import User, Patient, Doctor, Appointment, AppointmentSlot, AccessRequest, Prescription
from security import create_access_token
from datetime import datetime, timedelta

db = SessionLocal()

doctor_user = db.query(User).filter(User.role == 'doctor').first()
doctor = db.query(Doctor).filter(Doctor.user_id == doctor_user.id).first()
if not doctor:
    print('Doctor not found!')
    sys.exit(1)

patient_user = db.query(User).filter(User.role == 'patient').first()
patient = db.query(Patient).filter(Patient.user_id == patient_user.id).first()
if not patient:
    print('No patient user found!')
    sys.exit(1)


doctor_token = create_access_token(user_id=doctor.user_id, role='doctor', email=doctor_user.email, mobile=doctor_user.phone_number, is_verified=True)
patient_token = create_access_token(user_id=patient.user_id, role='patient', email=patient_user.email, mobile=patient_user.phone_number, is_verified=True)

import requests

BASE_URL = 'http://localhost:8000/api/v1'
headers_doctor = {'Authorization': f'Bearer {doctor_token}'}
headers_patient = {'Authorization': f'Bearer {patient_token}'}

print(f'Using Doctor {doctor.user_id} and Patient {patient.user_id}')
print('1. Doctor fetches slots...')
date_str = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
res = requests.get(f'{BASE_URL}/patient/appointments/doctors/{doctor.user_id}/slots?date={date_str}', headers=headers_patient)
slots = res.json()
if not slots:
    print('No slots available.')
else:
    slot = slots[0]
    print('2. Patient books appointment...')
    res = requests.post(f'{BASE_URL}/appointments/book', headers=headers_patient, json={
        'doctor_id': doctor.user_id,
        'date': date_str,
        'time': slot['time'],
        'slot_id': slot['id'],
        'appointment_type': 'Telemedicine'
    })
    print(res.status_code, res.json())
    uid = res.json().get('id') or res.json().get('appointment_uid')

    print('3. Doctor fetches appointments...')
    res = requests.get(f'{BASE_URL}/appointments/my-appointments', headers=headers_doctor)
    print('Appointments fetched:', len(res.json()))
    
    if not uid:
        my_apts = res.json()
        if my_apts: uid = my_apts[-1]['appointment_uid']

    if uid:
        print('4. Doctor starts consultation for uid', uid)
        res = requests.put(f'{BASE_URL}/appointments/{uid}/start', headers=headers_doctor)
        print(res.status_code, res.json())

        print('5. Doctor requests document access...')
        res = requests.post(f'{BASE_URL}/auth/doctor/request-access/{patient.patient_uid}', headers=headers_doctor)
        print(res.status_code, res.json())
        
        print('6. Patient fetches access requests and approves...')
        res = requests.get(f'{BASE_URL}/auth/patient/access-requests', headers=headers_patient)
        reqs = res.json()
        print('Pending reqs:', reqs)
        if reqs:
            req_id = reqs[-1]['id'] # Get the latest request
            res = requests.post(f'{BASE_URL}/auth/patient/access-requests/{req_id}/approve', headers=headers_patient)
            print(res.status_code, res.json())

        print('7. Doctor tests AI Summary...')
        res = requests.post(f'{BASE_URL}/doctor/patient/{patient.id}/ai-summary', headers=headers_doctor, json={
            'prompt': 'Summarise his diabetes history'
        })
        print(res.status_code, str(res.json())[:200])

        print('8. Complete Consultation...')
        res = requests.put(f'{BASE_URL}/appointments/{uid}/complete', headers=headers_doctor)
        print(res.status_code, res.json())
    else:
        print('Could not determine UID of booked appointment.')
