import subprocess
import time
import requests
from database import SessionLocal
from models import Patient, User
from security import create_access_token
from datetime import timedelta

def test_server():
    print("Starting uvicorn server...")
    process = subprocess.Popen(
        ["uvicorn", "main:app", "--port", "8125"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    time.sleep(4) # Wait for startup
    
    try:
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
        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-Patient-Profile-ID": str(patient.id)
        }
        
        print("Sending request to server...")
        response = requests.get("http://127.0.0.1:8125/patient/appointments", headers=headers)
        print("Status:", response.status_code)
    finally:
        process.terminate()
        
    out, _ = process.communicate()
    print("Server Logs:\n", out)

if __name__ == "__main__":
    test_server()
