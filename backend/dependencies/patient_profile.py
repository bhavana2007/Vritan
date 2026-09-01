from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Patient, User
from security import get_current_user

def get_active_patient(
    x_patient_profile_id: str | None = Header(None, alias="X-Patient-Profile-ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Patient:
    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active patient profile is available only for patient accounts",
        )
    
    # Try resolving via request header if present
    if x_patient_profile_id:
        try:
            profile_id = int(x_patient_profile_id)
            patient = db.query(Patient).filter(
                Patient.id == profile_id,
                Patient.user_id == current_user.id
            ).first()
            if patient:
                return patient
        except ValueError:
            pass

    # Fallback to the primary patient profile or first profile linked to this user
    patient = current_user.patient
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No patient profile found for this account",
        )
    return patient
