import subprocess
import time
import requests

def test_server():
    print("Starting uvicorn server...")
    with open("server_log.txt", "w") as f:
        process = subprocess.Popen(
            ["uvicorn", "main:app", "--port", "8126"],
            stdout=f,
            stderr=subprocess.STDOUT
        )
    
    time.sleep(3) # Wait for startup
    
    try:
        from database import SessionLocal
        from models import Patient, User
        from security import create_access_token
        
        db = SessionLocal()
        patient = db.query(Patient).filter(Patient.full_name.like("%Bhavana Kolli%")).first()
        if not patient: patient = db.query(Patient).filter(Patient.id == 248).first()
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
        try:
            response = requests.get("http://127.0.0.1:8126/patient/appointments", headers=headers)
            print("Status:", response.status_code)
            print("Response:", response.text)
        except Exception as e:
            print("Request failed:", e)
    finally:
        process.terminate()

if __name__ == "__main__":
    test_server()
