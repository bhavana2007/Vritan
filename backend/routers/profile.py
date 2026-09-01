import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db
from models import Patient, Doctor, LabTechnician, User as UserModel
from security import decode_access_token, InvalidTokenError

router = APIRouter(prefix="/profile", tags=["profile"])

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
PROFILE_PICS_DIR = UPLOAD_DIR / "profile_pictures"
PROFILE_PICS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def _get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> UserModel:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", ""))
    except (InvalidTokenError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/upload-image")
def upload_profile_image(
    file: UploadFile = File(...),
    user: UserModel = Depends(_get_current_user),
    db: Session = Depends(get_db)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG and PNG allowed.")
    
    filename = f"{user.id}_{uuid.uuid4().hex}{ext}"
    filepath = PROFILE_PICS_DIR / filename
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_url = f"/uploads/profile_pictures/{filename}"
    
    # Update the correct profile based on role
    if user.role == "patient":
        profile = db.query(Patient).filter(Patient.user_id == user.id).first()
    elif user.role == "doctor":
        profile = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    elif user.role == "lab_tech":
        profile = db.query(LabTechnician).filter(LabTechnician.user_id == user.id).first()
    else:
        raise HTTPException(status_code=400, detail="Role does not support profile images")
        
    if profile:
        profile.profile_image_url = file_url
        db.commit()
        
    return {"profile_image_url": file_url}


@router.put("/patient")
def update_patient_profile(
    address: str | None = Form(default=None),
    emergency_contact: str | None = Form(default=None),
    aadhaar_number: str | None = Form(default=None),
    insurance_provider: str | None = Form(default=None),
    insurance_policy_number: str | None = Form(default=None),
    user: UserModel = Depends(_get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "patient":
        raise HTTPException(status_code=403, detail="Not a patient")
        
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    if address is not None: patient.address = address
    if emergency_contact is not None: patient.emergency_contact = emergency_contact
    if aadhaar_number is not None: patient.aadhaar_number = aadhaar_number
    if insurance_provider is not None: patient.insurance_provider = insurance_provider
    if insurance_policy_number is not None: patient.insurance_policy_number = insurance_policy_number
    
    db.commit()
    return {"message": "Profile updated"}


@router.put("/lab-tech")
def update_lab_tech_profile(
    phone: str | None = Form(default=None),
    user: UserModel = Depends(_get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "lab_tech":
        raise HTTPException(status_code=403, detail="Not a lab technician")
        
    lab_tech = db.query(LabTechnician).filter(LabTechnician.user_id == user.id).first()
    if not lab_tech:
        raise HTTPException(status_code=404, detail="Lab profile not found")
        
    if phone is not None: lab_tech.phone = phone
    
    db.commit()
    return {"message": "Profile updated"}
