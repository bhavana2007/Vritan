import os
import sys
from pathlib import Path
from datetime import datetime, date, timedelta

# Add backend to python path
backend_dir = str(Path(__file__).resolve().parents[1])
sys.path.append(backend_dir)

# Set dev mode env var
os.environ["DEV_MODE"] = "true"

from database import SessionLocal
from models import User, Doctor, Patient, Admin, EmailVerificationToken
from org_models import Organization, Branch, Department, OrganizationMembership, BranchDoctorAffiliation, HospitalDocument
from appointment_models import AppointmentSlot
from security import hash_password
from main import app
from fastapi.testclient import TestClient
from sqlalchemy import text

def seed_data():
    db = SessionLocal()
    
    # Ensure Admin account is reset/exists with password Admin@123
    print("Ensuring Admin account exists with default credentials...")
    admin = db.query(Admin).filter(Admin.email == "admin@medilocker.com").first()
    if admin:
        admin.password = hash_password("Admin@123")
        admin.is_active = True
    else:
        db.add(Admin(email="admin@medilocker.com", password=hash_password("Admin@123"), is_active=True))
    db.commit()
    
    # 1. Clean previous seeds
    emails_to_clean = [
        "bhavanakolli983@gmail.com",
        "bhavanakolli760@gmail.com",
        "24b01a4255@svecw.edu.in",
        "charithapolavarapu13@gmail.com",
        "charithapolavarapu11@gmail.com",
        "24b01a4294@svecw.edu.in",
        "polavarapucharitha0@gmail.com",
        "24b01a4563@svecw.edu.in",
        "komminahansika@gmail.com",
        "komminahansika07@gmail.com",
        "revathimurala07@gmail.com",
        "24b01a4585@svecw.edu.in",
        "muralarevathi40@gmail.com",
        "revathimurala2007@gmail.com",
        "muralarevathi2007@gmail.com",
        "24b01a45b9@svecw.edu.in",
        "suzanne.thodeti@gmail.com",
        "suzanne.kathyrene@gmail.com",
    ]
    phones_to_clean = [f"98765{i:05d}" for i in range(1, 40)]
    
    print("Cleaning old seed data...")
    try:
        # Disable foreign key checks for safe cleaning of dev seeds
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        
        # Get doctor user IDs from doctor emails/phones
        doctors_query = db.query(Doctor).filter(
            (Doctor.email.in_(emails_to_clean)) | 
            (Doctor.phone.in_(phones_to_clean)) |
            (Doctor.email.like("%@medilocker.com"))
        ).all()
        doctor_user_ids = [d.user_id for d in doctors_query if d.email != "robert.smith@medilocker.com"]
        
        org_admins_query = db.query(User).filter(
            (User.email.in_(emails_to_clean)) | 
            (User.email.like("%@medilocker.com"))
        ).all()
        org_admin_user_ids = [u.id for u in org_admins_query if u.email not in ("admin@medilocker.com", "robert.smith@medilocker.com")]
        
        all_user_ids = list(set(doctor_user_ids + org_admin_user_ids))
        
        if all_user_ids:
            user_ids_str = ",".join(map(str, all_user_ids))
            db.execute(text(f"DELETE FROM email_verification_tokens WHERE user_id IN ({user_ids_str});"))
            db.execute(text(f"DELETE FROM branch_doctor_affiliations WHERE doctor_id IN ({user_ids_str});"))
            db.execute(text(f"DELETE FROM organization_memberships WHERE user_id IN ({user_ids_str});"))
            db.execute(text(f"DELETE FROM doctors WHERE user_id IN ({user_ids_str});"))
            db.execute(text(f"DELETE FROM users WHERE id IN ({user_ids_str});"))
            db.execute(text(f"DELETE FROM appointment_slots WHERE doctor_id IN ({user_ids_str});"))
            
        # Clean orgs
        orgs = db.query(Organization).filter(
            (Organization.email.in_(emails_to_clean)) |
            (Organization.email.like("%@medilocker.com"))
        ).all()
        org_ids = [o.id for o in orgs]
        
        if org_ids:
            org_ids_str = ",".join(map(str, org_ids))
            db.execute(text(f"DELETE FROM hospital_documents WHERE organization_id IN ({org_ids_str});"))
            db.execute(text(f"DELETE FROM hospital_verification_histories WHERE organization_id IN ({org_ids_str});"))
            db.execute(text(f"DELETE FROM organization_memberships WHERE organization_id IN ({org_ids_str});"))
            db.execute(text(f"DELETE FROM branches WHERE organization_id IN ({org_ids_str});"))
            db.execute(text(f"DELETE FROM organizations WHERE id IN ({org_ids_str});"))
            
        # Clean orphan branches/departments/affiliations
        db.execute(text("DELETE FROM branches WHERE organization_id IS NULL;"))
        db.execute(text("DELETE FROM departments WHERE branch_id NOT IN (SELECT id FROM branches);"))
        db.execute(text("DELETE FROM branch_doctor_affiliations WHERE branch_id NOT IN (SELECT id FROM branches);"))
        
        db.commit()
        print("Cleaning completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error during cleaning: {e}")
    finally:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.close()
        
    client = TestClient(app)
    
    # Get Admin Token for Approvals
    print("Logging in as Admin...")
    admin_login_res = client.post("/admin/login", json={"email": "admin@medilocker.com", "password": "Admin@123"})
    if admin_login_res.status_code != 200:
        print(f"Failed to login as Admin: {admin_login_res.json()}")
        return
    admin_token = admin_login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # helper lists
    output_table = []
    
    def approve_doc_and_add_slots(email, branch_id):
        # Resolve doctor
        db_query = SessionLocal()
        d_record = db_query.query(Doctor).filter(Doctor.email == email).first()
        doc_user_id = d_record.user_id if d_record else None
        db_query.close()
        
        if not doc_user_id:
            print(f"ERROR: Doctor record not found for {email}")
            return
            
        # Approve Doctor
        d_app = client.post(f"/admin/doctors/{doc_user_id}/approve", headers=admin_headers)
        if d_app.status_code != 200:
            print(f"Failed to approve doctor {email}: {d_app.json()}")
            return
            
        # Generate 30 days of slots
        db_slots = SessionLocal()
        try:
            for day_offset in range(30):
                slot_date = date.today() + timedelta(days=day_offset)
                for time_str in ["09:00 AM", "11:00 AM", "03:00 PM"]:
                    db_slots.add(AppointmentSlot(
                        doctor_id=doc_user_id,
                        branch_id=branch_id,
                        date=slot_date,
                        start_time=time_str,
                        end_time=time_str,
                        status="AVAILABLE"
                    ))
            db_slots.commit()
            print(f"Generated 30 days slots for {email}.")
        except Exception as es:
            db_slots.rollback()
            print(f"Error generating slots: {es}")
        finally:
            db_slots.close()
            
    # --- ST. JUDE HOSPITAL ---
    print("\n--- Registering St. Jude Hospital Network ---")
    h1_reg = client.post("/register-hospital", json={
        "name": "St. Jude Hospital Network", "legal_name": "St. Jude Hospital Pvt Ltd",
        "registration_number": "REG-HOSP-7788", "gst_number": "GST77889900", "nabh_status": "Accredited",
        "official_email": "bhavanakolli983@gmail.com", "official_phone": "9876500001",
        "admin_name": "Bhavana Kolli", "admin_email": "bhavanakolli983@gmail.com", "admin_phone": "9876500001",
        "password": "Password@123", "address": "123 Healthcare Blvd", "city": "Hyderabad", "state": "Telangana", "pincode": "500081"
    })
    h1_id = h1_reg.json()["organization_id"]
    client.post(f"/admin/organizations/hospital/{h1_id}/action", json={"action": "APPROVE", "reason": "Seeding"}, headers=admin_headers)
    h1_login = client.post("/login", json={"identifier": "bhavanakolli983@gmail.com", "password": "Password@123"})
    h1_headers = {"Authorization": f"Bearer {h1_login.json()['access_token']}"}
    
    b1_id = client.post(f"/api/v1/organizations/{h1_id}/branches", json={"name": "St. Jude Main Branch", "address": "123 Healthcare Blvd, Hyderabad", "phone": "9876500001", "email": "main@stjude.com"}, headers=h1_headers).json()["data"]["id"]
    d1_id = client.post(f"/api/v1/organizations/{h1_id}/departments", json={"name": "Cardiology", "description": "Heart care", "branch_id": b1_id}, headers=h1_headers).json()["data"]["id"]
    d2_id = client.post(f"/api/v1/organizations/{h1_id}/departments", json={"name": "Pediatrics", "description": "Child care", "branch_id": b1_id}, headers=h1_headers).json()["data"]["id"]
    
    output_table.append(["St. Jude Hospital Network", "Org Admin", "bhavanakolli983@gmail.com", "Password@123", "VERIFIED", "St. Jude Main Branch", "—"])
    
    # Doctors
    client.post("/register", json={"role": "doctor", "name": "Dr. Bhavana Kolli", "password": "DocBhavana@123", "email": "bhavanakolli760@gmail.com", "phone": "9876500002", "medical_license_number": "LIC-BHA-760", "practice_type": "Hospital"})
    approve_doc_and_add_slots("bhavanakolli760@gmail.com", b1_id)
    client.post(f"/api/v1/organizations/{h1_id}/invite-doctor", json={"doctor_email_or_id": "bhavanakolli760@gmail.com", "branch_id": b1_id, "department_id": d1_id}, headers=h1_headers)
    output_table.append(["St. Jude Hospital Network", "Hospital Doctor", "bhavanakolli760@gmail.com", "DocBhavana@123", "VERIFIED", "St. Jude Main Branch", "Cardiology"])
    
    client.post("/register", json={"role": "doctor", "name": "Dr. Kolli Bhavana", "password": "DocKolli@123", "email": "24b01a4255@svecw.edu.in", "phone": "9876500003", "medical_license_number": "LIC-BHA-255", "practice_type": "Hospital"})
    approve_doc_and_add_slots("24b01a4255@svecw.edu.in", b1_id)
    client.post(f"/api/v1/organizations/{h1_id}/invite-doctor", json={"doctor_email_or_id": "24b01a4255@svecw.edu.in", "branch_id": b1_id, "department_id": d2_id}, headers=h1_headers)
    output_table.append(["St. Jude Hospital Network", "Hospital Doctor", "24b01a4255@svecw.edu.in", "DocKolli@123", "VERIFIED", "St. Jude Main Branch", "Pediatrics"])
    
    # --- APOLLO HOSPITALS ---
    print("\n--- Registering Apollo Hospitals ---")
    h2_reg = client.post("/register-hospital", json={
        "name": "Apollo Hospitals", "legal_name": "Apollo Hospitals Group",
        "registration_number": "REG-APOLLO-1010", "gst_number": "GST10102020", "nabh_status": "Accredited",
        "official_email": "apollo_admin@medilocker.com", "official_phone": "9876500021",
        "admin_name": "Apollo Admin", "admin_email": "apollo_admin@medilocker.com", "admin_phone": "9876500021",
        "password": "ApolloAdminPass@123", "address": "Jubilee Hills", "city": "Hyderabad", "state": "Telangana", "pincode": "500033"
    })
    h2_id = h2_reg.json()["organization_id"]
    client.post(f"/admin/organizations/hospital/{h2_id}/action", json={"action": "APPROVE", "reason": "Seeding"}, headers=admin_headers)
    h2_login = client.post("/login", json={"identifier": "apollo_admin@medilocker.com", "password": "ApolloAdminPass@123"})
    h2_headers = {"Authorization": f"Bearer {h2_login.json()['access_token']}"}
    
    b2_id = client.post(f"/api/v1/organizations/{h2_id}/branches", json={"name": "Apollo Jubilee Hills", "address": "Jubilee Hills, Hyderabad", "phone": "9876500021", "email": "jubilee@apollo.com"}, headers=h2_headers).json()["data"]["id"]
    d3_id = client.post(f"/api/v1/organizations/{h2_id}/departments", json={"name": "Cardiology", "description": "Heart care", "branch_id": b2_id}, headers=h2_headers).json()["data"]["id"]
    d4_id = client.post(f"/api/v1/organizations/{h2_id}/departments", json={"name": "Neurology", "description": "Neurological care", "branch_id": b2_id}, headers=h2_headers).json()["data"]["id"]
    
    output_table.append(["Apollo Hospitals", "Org Admin", "apollo_admin@medilocker.com", "ApolloAdminPass@123", "VERIFIED", "Apollo Jubilee Hills", "—"])
    
    client.post("/register", json={"role": "doctor", "name": "Dr. Apollo Cardiology", "password": "ApolloCardio@123", "email": "apollo_cardio@medilocker.com", "phone": "9876500022", "medical_license_number": "LIC-APO-CARD", "practice_type": "Hospital"})
    approve_doc_and_add_slots("apollo_cardio@medilocker.com", b2_id)
    client.post(f"/api/v1/organizations/{h2_id}/invite-doctor", json={"doctor_email_or_id": "apollo_cardio@medilocker.com", "branch_id": b2_id, "department_id": d3_id}, headers=h2_headers)
    output_table.append(["Apollo Hospitals", "Hospital Doctor", "apollo_cardio@medilocker.com", "ApolloCardio@123", "VERIFIED", "Apollo Jubilee Hills", "Cardiology"])
    
    client.post("/register", json={"role": "doctor", "name": "Dr. Apollo Neurology", "password": "ApolloNeuro@123", "email": "apollo_neuro@medilocker.com", "phone": "9876500023", "medical_license_number": "LIC-APO-NEUR", "practice_type": "Hospital"})
    approve_doc_and_add_slots("apollo_neuro@medilocker.com", b2_id)
    client.post(f"/api/v1/organizations/{h2_id}/invite-doctor", json={"doctor_email_or_id": "apollo_neuro@medilocker.com", "branch_id": b2_id, "department_id": d4_id}, headers=h2_headers)
    output_table.append(["Apollo Hospitals", "Hospital Doctor", "apollo_neuro@medilocker.com", "ApolloNeuro@123", "VERIFIED", "Apollo Jubilee Hills", "Neurology"])
    
    # --- FORTIS HEALTHCARE ---
    print("\n--- Registering Fortis Healthcare ---")
    h3_reg = client.post("/register-hospital", json={
        "name": "Fortis Healthcare", "legal_name": "Fortis Healthcare Ltd",
        "registration_number": "REG-FORTIS-2020", "gst_number": "GST20203030", "nabh_status": "Accredited",
        "official_email": "fortis_admin@medilocker.com", "official_phone": "9876500024",
        "admin_name": "Fortis Admin", "admin_email": "fortis_admin@medilocker.com", "admin_phone": "9876500024",
        "password": "FortisAdminPass@123", "address": "Bannerghatta Road", "city": "Bengaluru", "state": "Karnataka", "pincode": "560076"
    })
    h3_id = h3_reg.json()["organization_id"]
    client.post(f"/admin/organizations/hospital/{h3_id}/action", json={"action": "APPROVE", "reason": "Seeding"}, headers=admin_headers)
    h3_login = client.post("/login", json={"identifier": "fortis_admin@medilocker.com", "password": "FortisAdminPass@123"})
    h3_headers = {"Authorization": f"Bearer {h3_login.json()['access_token']}"}
    
    b3_id = client.post(f"/api/v1/organizations/{h3_id}/branches", json={"name": "Fortis Bannerghatta", "address": "Bannerghatta Rd, Bengaluru", "phone": "9876500024", "email": "bannerghatta@fortis.com"}, headers=h3_headers).json()["data"]["id"]
    d5_id = client.post(f"/api/v1/organizations/{h3_id}/departments", json={"name": "Orthopedics", "description": "Bone care", "branch_id": b3_id}, headers=h3_headers).json()["data"]["id"]
    d6_id = client.post(f"/api/v1/organizations/{h3_id}/departments", json={"name": "Pediatrics", "description": "Child care", "branch_id": b3_id}, headers=h3_headers).json()["data"]["id"]
    
    output_table.append(["Fortis Healthcare", "Org Admin", "fortis_admin@medilocker.com", "FortisAdminPass@123", "VERIFIED", "Fortis Bannerghatta", "—"])
    
    client.post("/register", json={"role": "doctor", "name": "Dr. Fortis Orthopedics", "password": "FortisOrtho@123", "email": "fortis_ortho@medilocker.com", "phone": "9876500025", "medical_license_number": "LIC-FOR-ORTH", "practice_type": "Hospital"})
    approve_doc_and_add_slots("fortis_ortho@medilocker.com", b3_id)
    client.post(f"/api/v1/organizations/{h3_id}/invite-doctor", json={"doctor_email_or_id": "fortis_ortho@medilocker.com", "branch_id": b3_id, "department_id": d5_id}, headers=h3_headers)
    output_table.append(["Fortis Healthcare", "Hospital Doctor", "fortis_ortho@medilocker.com", "FortisOrtho@123", "VERIFIED", "Fortis Bannerghatta", "Orthopedics"])
    
    client.post("/register", json={"role": "doctor", "name": "Dr. Fortis Pediatrics", "password": "FortisPedi@123", "email": "fortis_pedi@medilocker.com", "phone": "9876500026", "medical_license_number": "LIC-FOR-PEDI", "practice_type": "Hospital"})
    approve_doc_and_add_slots("fortis_pedi@medilocker.com", b3_id)
    client.post(f"/api/v1/organizations/{h3_id}/invite-doctor", json={"doctor_email_or_id": "fortis_pedi@medilocker.com", "branch_id": b3_id, "department_id": d6_id}, headers=h3_headers)
    output_table.append(["Fortis Healthcare", "Hospital Doctor", "fortis_pedi@medilocker.com", "FortisPedi@123", "VERIFIED", "Fortis Bannerghatta", "Pediatrics"])
    
    # --- MAX SUPER SPECIALITY HOSPITAL ---
    print("\n--- Registering Max Super Speciality Hospital ---")
    h4_reg = client.post("/register-hospital", json={
        "name": "Max Super Speciality Hospital", "legal_name": "Max Healthcare Institute Ltd",
        "registration_number": "REG-MAX-3030", "gst_number": "GST30304040", "nabh_status": "Accredited",
        "official_email": "max_admin@medilocker.com", "official_phone": "9876500027",
        "admin_name": "Max Admin", "admin_email": "max_admin@medilocker.com", "admin_phone": "9876500027",
        "password": "MaxAdminPass@123", "address": "Saket", "city": "New Delhi", "state": "Delhi", "pincode": "110017"
    })
    h4_id = h4_reg.json()["organization_id"]
    client.post(f"/admin/organizations/hospital/{h4_id}/action", json={"action": "APPROVE", "reason": "Seeding"}, headers=admin_headers)
    h4_login = client.post("/login", json={"identifier": "max_admin@medilocker.com", "password": "MaxAdminPass@123"})
    h4_headers = {"Authorization": f"Bearer {h4_login.json()['access_token']}"}
    
    b4_id = client.post(f"/api/v1/organizations/{h4_id}/branches", json={"name": "Max Saket", "address": "Saket, New Delhi", "phone": "9876500027", "email": "saket@maxhealthcare.com"}, headers=h4_headers).json()["data"]["id"]
    d7_id = client.post(f"/api/v1/organizations/{h4_id}/departments", json={"name": "Dermatology", "description": "Skin care", "branch_id": b4_id}, headers=h4_headers).json()["data"]["id"]
    
    output_table.append(["Max Super Speciality Hospital", "Org Admin", "max_admin@medilocker.com", "MaxAdminPass@123", "VERIFIED", "Max Saket", "—"])
    
    client.post("/register", json={"role": "doctor", "name": "Dr. Max Dermatology", "password": "MaxDerma@123", "email": "max_derma@medilocker.com", "phone": "9876500028", "medical_license_number": "LIC-MAX-DERM", "practice_type": "Hospital"})
    approve_doc_and_add_slots("max_derma@medilocker.com", b4_id)
    client.post(f"/api/v1/organizations/{h4_id}/invite-doctor", json={"doctor_email_or_id": "max_derma@medilocker.com", "branch_id": b4_id, "department_id": d7_id}, headers=h4_headers)
    output_table.append(["Max Super Speciality Hospital", "Hospital Doctor", "max_derma@medilocker.com", "MaxDerma@123", "VERIFIED", "Max Saket", "Dermatology"])
    
    # --- MANIPAL HOSPITAL ---
    print("\n--- Registering Manipal Hospital ---")
    h5_reg = client.post("/register-hospital", json={
        "name": "Manipal Hospital", "legal_name": "Manipal Health Enterprise Pvt Ltd",
        "registration_number": "REG-MANIPAL-4040", "gst_number": "GST40405050", "nabh_status": "Accredited",
        "official_email": "manipal_admin@medilocker.com", "official_phone": "9876500029",
        "admin_name": "Manipal Admin", "admin_email": "manipal_admin@medilocker.com", "admin_phone": "9876500029",
        "password": "ManipalAdminPass@123", "address": "Whitefield", "city": "Bengaluru", "state": "Karnataka", "pincode": "560066"
    })
    h5_id = h5_reg.json()["organization_id"]
    client.post(f"/admin/organizations/hospital/{h5_id}/action", json={"action": "APPROVE", "reason": "Seeding"}, headers=admin_headers)
    h5_login = client.post("/login", json={"identifier": "manipal_admin@medilocker.com", "password": "ManipalAdminPass@123"})
    h5_headers = {"Authorization": f"Bearer {h5_login.json()['access_token']}"}
    
    b5_id = client.post(f"/api/v1/organizations/{h5_id}/branches", json={"name": "Manipal Whitefield", "address": "Whitefield, Bengaluru", "phone": "9876500029", "email": "whitefield@manipal.com"}, headers=h5_headers).json()["data"]["id"]
    d8_id = client.post(f"/api/v1/organizations/{h5_id}/departments", json={"name": "Gastroenterology", "description": "Digestive care", "branch_id": b5_id}, headers=h5_headers).json()["data"]["id"]
    
    output_table.append(["Manipal Hospital", "Org Admin", "manipal_admin@medilocker.com", "ManipalAdminPass@123", "VERIFIED", "Manipal Whitefield", "—"])
    
    client.post("/register", json={"role": "doctor", "name": "Dr. Manipal Gastro", "password": "ManipalGastro@123", "email": "manipal_gastro@medilocker.com", "phone": "9876500030", "medical_license_number": "LIC-MAN-GAST", "practice_type": "Hospital"})
    approve_doc_and_add_slots("manipal_gastro@medilocker.com", b5_id)
    client.post(f"/api/v1/organizations/{h5_id}/invite-doctor", json={"doctor_email_or_id": "manipal_gastro@medilocker.com", "branch_id": b5_id, "department_id": d8_id}, headers=h5_headers)
    output_table.append(["Manipal Hospital", "Hospital Doctor", "manipal_gastro@medilocker.com", "ManipalGastro@123", "VERIFIED", "Manipal Whitefield", "Gastroenterology"])
    
    # --- INDEPENDENT CLINIC DOCTORS ---
    print("\n--- Registering Clinic Doctors ---")
    clinic_docs = [
        {"name": "Dr. Clinic Eye", "email": "clinic_eye@medilocker.com", "phone": "9876500031", "lic": "LIC-CLIN-EYE", "pass": "ClinicEye@123", "spec": "Ophthalmology"},
        {"name": "Dr. Clinic ENT", "email": "clinic_ent@medilocker.com", "phone": "9876500032", "lic": "LIC-CLIN-ENT", "pass": "ClinicEnt@123", "spec": "ENT Speciality"}
    ]
    for doc in clinic_docs:
        client.post("/register", json={
            "role": "doctor", "name": doc["name"], "password": doc["pass"], "email": doc["email"], "phone": doc["phone"],
            "medical_license_number": doc["lic"], "years_of_experience": 11, "qualification": "MBBS, MS",
            "practice_type": "Independent Clinic", "languages_spoken": "English, Hindi", "consultation_modes": "Offline",
            "clinic_name": f"{doc['name']} Specialty Clinic", "clinic_address": "Kondapur, Hyderabad", "clinic_pin_code": "500084",
            "clinic_state": "Telangana", "clinic_district": "Rangareddy", "clinic_city": "Hyderabad"
        })
        approve_doc_and_add_slots(doc["email"], None)
        output_table.append(["—", "Clinic Doctor", doc["email"], doc["pass"], "VERIFIED", "—", "—"])
        
    # --- TELEMEDICINE DOCTORS ---
    print("\n--- Registering Telemedicine Doctors ---")
    tele_docs = [
        {"name": "Dr. Tele Psychiatrist", "email": "tele_psych@medilocker.com", "phone": "9876500033", "lic": "LIC-TELE-PSY", "pass": "TelePsych@123"},
        {"name": "Dr. Tele GP", "email": "tele_gp@medilocker.com", "phone": "9876500034", "lic": "LIC-TELE-GP", "pass": "TeleGp@123"}
    ]
    for doc in tele_docs:
        client.post("/register", json={
            "role": "doctor", "name": doc["name"], "password": doc["pass"], "email": doc["email"], "phone": doc["phone"],
            "medical_license_number": doc["lic"], "years_of_experience": 9, "qualification": "MBBS, MD",
            "practice_type": "Telemedicine", "languages_spoken": "English, Telugu", "consultation_modes": "Video, Audio"
        })
        approve_doc_and_add_slots(doc["email"], None)
        output_table.append(["—", "Telemedicine Doctor", doc["email"], doc["pass"], "VERIFIED", "—", "—"])
        
    # --- HYBRID DOCTORS ---
    print("\n--- Registering Hybrid Doctors ---")
    hybrid_docs = [
        {"name": "Dr. Hybrid Gynaecology", "email": "hybrid_gynae@medilocker.com", "phone": "9876500035", "lic": "LIC-HYB-GYN", "pass": "HybridGynae@123"}
    ]
    for doc in hybrid_docs:
        client.post("/register", json={
            "role": "doctor", "name": doc["name"], "password": doc["pass"], "email": doc["email"], "phone": doc["phone"],
            "medical_license_number": doc["lic"], "years_of_experience": 10, "qualification": "MBBS, DGO",
            "practice_type": "Hybrid", "languages_spoken": "English, Telugu, Hindi", "consultation_modes": "Offline, Video",
            "clinic_name": "Grace Women's Clinic", "clinic_address": "Madhapur, Hyderabad", "clinic_pin_code": "500081",
            "clinic_state": "Telangana", "clinic_district": "Rangareddy", "clinic_city": "Hyderabad"
        })
        approve_doc_and_add_slots(doc["email"], None)
        output_table.append(["—", "Hybrid Doctor", doc["email"], doc["pass"], "VERIFIED", "—", "—"])
        
    # Print formatted markdown table
    print("\n=== MARKDOWN TABLE OUTPUT ===")
    print("| Organization Name | Account Type | Email | Temporary Password | Approval Status | Assigned Branch | Assigned Department |")
    print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    for row in output_table:
        print(f"| {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]} | {row[6]} |")
        
    print("\n==========================================")
    print("DEVELOPMENT SEEDING SUCCESSFULLY COMPLETED")
    print("==========================================")

if __name__ == "__main__":
    seed_data()
