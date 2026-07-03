"""Dedicated admin authentication and protected admin endpoints."""
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from models import Admin, Doctor
from schemas import (
    AdminDoctorPublic,
    AdminLoginRequest,
    AdminProfile,
    LoginResponse,
    UserPublic,
)
from security import InvalidTokenError, create_access_token, decode_access_token
from security import verify_password

router = APIRouter(prefix="/admin", tags=["admin"])


def _public_admin(admin: Admin) -> UserPublic:
    return UserPublic(
        id=admin.id,
        role="admin",
        name="Admin",
        email=admin.email,
        is_verified=bool(admin.is_active),
        patient_uid="",
        mobile="",
        hospital="",
        verification_status="approved",
    )


def require_current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Admin:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        admin_id = int(payload.get("sub", ""))
    except (InvalidTokenError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account not found or inactive",
        )
    return admin


@router.post("/login", response_model=LoginResponse)
def admin_login(credentials: AdminLoginRequest, db: Session = Depends(get_db)):
    email = str(credentials.email).strip().lower()
    admin = db.query(Admin).filter(Admin.email == email).first()

    if (
        not admin
        or not admin.is_active
        or not verify_password(credentials.password, admin.password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    token = create_access_token(
        user_id=admin.id,
        role="admin",
        email=admin.email,
        mobile=None,
        is_verified=True,
    )
    return LoginResponse(access_token=token, user=_public_admin(admin))


@router.get("/profile", response_model=AdminProfile)
def admin_profile(current_admin: Admin = Depends(require_current_admin)):
    return current_admin


@router.get("/doctors", response_model=list[AdminDoctorPublic])
def admin_doctors(
    status_filter: str = Query(default="pending", alias="status"),
    current_admin: Admin = Depends(require_current_admin),
    db: Session = Depends(get_db),
):
    del current_admin
    print(f"ADMIN DOCTORS - Querying Doctor table with status_filter: {status_filter}")
    query = db.query(Doctor)
    if status_filter != "all":
        query = query.filter(Doctor.verification_status == status_filter)
    doctors = query.order_by(Doctor.created_at.desc(), Doctor.user_id.desc()).all()
    print(f"ADMIN DOCTORS - Found {len(doctors)} doctors")
    for doc in doctors:
        print(f"  - Doctor: {doc.full_name}, email: {doc.email}, user_id: {doc.user_id}, status: {doc.verification_status}")
    return doctors


@router.post("/doctors/{doctor_user_id}/approve", response_model=AdminDoctorPublic)
def admin_approve_doctor(
    doctor_user_id: int,
    current_admin: Admin = Depends(require_current_admin),
    db: Session = Depends(get_db),
):
    del current_admin
    doctor = db.query(Doctor).filter(Doctor.user_id == doctor_user_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found",
        )
    doctor.is_verified = True
    doctor.verification_status = "approved"
    db.commit()
    db.refresh(doctor)
    return doctor


@router.post("/doctors/{doctor_user_id}/reject", response_model=AdminDoctorPublic)
def admin_reject_doctor(
    doctor_user_id: int,
    current_admin: Admin = Depends(require_current_admin),
    db: Session = Depends(get_db),
):
    del current_admin
    doctor = db.query(Doctor).filter(Doctor.user_id == doctor_user_id).first()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found",
        )
    doctor.is_verified = False
    doctor.verification_status = "rejected"
    db.commit()
    db.refresh(doctor)
    return doctor
