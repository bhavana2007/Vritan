import os
import sys
import uuid
from pathlib import Path

# Add backend to python path
backend_dir = str(Path(__file__).resolve().parent)
sys.path.append(backend_dir)

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from org_models import Organization, Branch, OrganizationEmployeeAssignment, BranchDoctorAffiliation
from models import Doctor

client = TestClient(app)

def run_test():
    db = SessionLocal()
    try:
        print("=== STEP 1: Test Hospital Search endpoints ===")
        # Test GET /api/v1/hospitals
        r1 = client.get("/api/v1/hospitals")
        assert r1.status_code == 200
        print("GET /api/v1/hospitals Status: OK")
        
        # Test GET /api/v1/hospitals/search with q
        r2 = client.get("/api/v1/hospitals/search?q=Apollo")
        assert r2.status_code == 200
        data2 = r2.json()["data"]["items"]
        assert len(data2) > 0
        apollo_vritan_id = data2[0]["vritan_id"]
        print(f"GET /api/v1/hospitals/search?q=Apollo found: {data2[0]['name']} ({apollo_vritan_id})")
        
        # Test GET /api/v1/hospitals/search with search (alias)
        r3 = client.get(f"/api/v1/hospitals/search?search={apollo_vritan_id}")
        assert r3.status_code == 200
        data3 = r3.json()["data"]["items"]
        assert len(data3) > 0
        assert data3[0]["vritan_id"] == apollo_vritan_id
        print("GET /api/v1/hospitals/search?search=<vritan_id> Status: OK")

        print("\n=== STEP 2: Register Doctor with Hospital Vritan ID ===")
        unique_suffix = uuid.uuid4().hex[:6]
        # Generate a valid 10-digit numeric phone number
        import random
        phone_num = str(random.randint(7000000000, 9999999999))  # always 10 digits, starts with 7-9
        payload = {
            "name": f"Dr. Integration Test {unique_suffix}",
            "email": f"integ_test_{unique_suffix}@vritan.com",
            "phone": phone_num,
            "hospital": "Apollo Hospitals",
            "hospital_vritan_id": apollo_vritan_id,
            "medical_license_number": f"LIC-INTEG-{unique_suffix}",
            "years_of_experience": "5",
            "password": "SecurePassword@123",
            "practice_type": "Hospital / Healthcare Organization",
            "qualification": "MBBS, MD",
            "registration_council": "Medical Council",
            "languages_spoken": "English"
        }
        
        # Create mock upload files — httpx requires (filename, file_obj, content_type)
        from io import BytesIO
        files = [
            ("file", ("license.pdf", BytesIO(b"license pdf data"), "application/pdf")),
            ("identity_proof", ("identity.pdf", BytesIO(b"id proof data"), "application/pdf")),
        ]
        
        r_reg = client.post("/register-doctor", data=payload, files=files)
        print("Register Doctor Status Code:", r_reg.status_code)
        if r_reg.status_code != 200:
            print("Register Doctor Error Body:", r_reg.text)
        assert r_reg.status_code == 200
        reg_json = r_reg.json()
        doc_vritan_id = reg_json.get("vritan_id")
        print(f"Registered Doctor successfully. Generated Vritan ID: {doc_vritan_id}")
        
        # Verify in DB
        db.close()
        db = SessionLocal()
        
        # Fetch the doctor object
        doctor = db.query(Doctor).filter(Doctor.vritan_id == doc_vritan_id).first()
        assert doctor is not None
        assert doctor.hospital_vritan_id == apollo_vritan_id
        assert doctor.hospital_registered is True
        print(f"Verified doctor record exists in database and links to {apollo_vritan_id}.")
        
        # Check active Employee Assignment
        assignment = db.query(OrganizationEmployeeAssignment).filter(
            OrganizationEmployeeAssignment.user_id == doctor.user_id
        ).first()
        assert assignment is not None
        assert assignment.organization_id == (db.query(Organization).filter(Organization.vritan_id == apollo_vritan_id).first().id)
        print("Verified active OrganizationEmployeeAssignment record created successfully.")
        
        # Check legacy BranchDoctorAffiliation
        legacy_aff = db.query(BranchDoctorAffiliation).filter(
            BranchDoctorAffiliation.doctor_id == doctor.user_id
        ).first()
        assert legacy_aff is not None
        print("Verified legacy BranchDoctorAffiliation record created successfully.")
        
        # Check list affiliated doctors route
        print("\n=== STEP 3: List Affiliated Doctors (Hospital Admin side) ===")
        # We need a mock user with role 'admin'
        from models import User as UserModel
        mock_user = UserModel(role="admin")
        
        # Call list_affiliated_doctors directly or via endpoint
        # Let's call GET /api/v1/organizations/{org_id}/doctors
        # We need to authenticate as hospital admin of Apollo Hospitals
        # For simplicity, we can test the API handler or endpoint by overriding dependencies if needed.
        # But we can also query the database directly as we did in organization.py list_affiliated_doctors:
        from routers.organization import list_affiliated_doctors
        res_list = list_affiliated_doctors(apollo_vritan_id, mock_user, db)
        assert res_list["success"] is True
        doc_list = res_list["data"]
        
        # Find our doctor in the list
        matched_doc = [d for d in doc_list if d["vritan_id"] == doc_vritan_id]
        assert len(matched_doc) == 1
        print(f"Verified Doctor {doc_vritan_id} is successfully listed in Apollo Hospital's affiliated doctors list!")

        print("\n=== E2E TESTING COMPLETED SUCCESSFULLY ===")
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
