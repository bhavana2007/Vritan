import requests
from database import SessionLocal
from models import Patient, User
from security import create_access_token
from datetime import timedelta

def test_api():
    db = SessionLocal()
    patient = db.query(Patient).filter(Patient.full_name.like("%Bhavana Kolli%")).first()
    if not patient: patient = db.query(Patient).filter(Patient.id == 248).first()
    if not patient:
        print("Bhavana Kolli not found")
        return
        
    user = db.query(User).filter(User.id == patient.user_id).first()
    db.close()
    
    print(f"Testing for patient: {patient.full_name}, ID: {patient.id}")
    
    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
        mobile=user.phone_number,
        is_verified=True
    )
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-Patient-Profile-ID": str(patient.id)
    }
    
    url = "http://127.0.0.1:8000/patient/appointments"
    print(f"GET {url}")
    response = requests.get(url, headers=headers)
    
    print("Status Code:", response.status_code)
    try:
        print("Response JSON:", response.json())
    except:
        print("Response Text:", response.text)

if __name__ == "__main__":
    test_api()
