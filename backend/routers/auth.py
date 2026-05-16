"""Registration and login endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Doctor, Patient, User as UserModel
from schemas import LoginResponse, UserLogin, UserPublic, UserRegister
from schemas import normalize_mobile_digits
from security import create_access_token, hash_password, verify_password

router = APIRouter(tags=["auth"])


def _is_bcrypt_hash(value: str) -> bool:
    return (
        value.startswith("$2a$")
        or value.startswith("$2b$")
        or value.startswith("$2y$")
    )


def _password_matches(plain: str, stored_hash: str) -> bool:
    if _is_bcrypt_hash(stored_hash):
        return verify_password(plain, stored_hash)
    return plain == stored_hash


def _make_patient_uid(user_id: int) -> str:
    return f"PAT-{user_id:06d}"


def _resolve_login_user(db: Session, identifier_raw: str) -> UserModel | None:
    ident = identifier_raw.strip()
    if not ident:
        return None
    # Doctors sign in with professional email addresses.
    if "@" in ident:
        email = ident.lower()
        return (
            db.query(UserModel)
            .join(Doctor)
            .filter(Doctor.email == email)
            .first()
        )
    try:
        mobile_digits = normalize_mobile_digits(ident)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid mobile number (digits only, 10-15 digits)",
        ) from None
    return (
        db.query(UserModel)
        .join(Patient)
        .filter(Patient.mobile == mobile_digits)
        .first()
    )


def _public_user(user: UserModel) -> UserPublic:
    if user.role == "patient" and user.patient:
        patient = user.patient
        return UserPublic(
            id=user.id,
            role=user.role,
            name=patient.full_name or "",
            patient_uid=patient.patient_uid or "",
            mobile=patient.mobile or "",
            is_verified=True,
        )

    if user.role == "doctor" and user.doctor:
        doctor = user.doctor
        return UserPublic(
            id=user.id,
            role=user.role,
            name=doctor.full_name or "",
            email=doctor.email or "",
            hospital=doctor.hospital or "",
            is_verified=bool(doctor.is_verified),
        )

    return UserPublic(
        id=user.id,
        role=user.role,
        name="",
    )


@router.post("/register")
def register(payload: UserRegister, db: Session = Depends(get_db)):
    hashed = hash_password(payload.password)

    if payload.role == "patient":
        exists = (
            db.query(Patient)
            .filter(Patient.mobile == payload.mobile)
            .first()
        )
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This mobile number is already registered",
            )
        db_user = UserModel(
            role=payload.role,
            password=hashed,
        )
        db.add(db_user)
        db.flush()
        db.add(
            Patient(
                user_id=db_user.id,
                patient_uid=_make_patient_uid(db_user.id),
                full_name=payload.name.strip(),
                mobile=payload.mobile,
            )
        )
    else:
        exists = (
            db.query(Doctor)
            .filter(Doctor.email == str(payload.email).lower())
            .first()
        )
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        db_user = UserModel(
            role=payload.role,
            password=hashed,
        )
        db.add(db_user)
        db.flush()
        db.add(
            Doctor(
                user_id=db_user.id,
                full_name=payload.name.strip(),
                email=str(payload.email).lower(),
                hospital=payload.hospital.strip(),
                is_verified=False,
            )
        )

    db.commit()
    db.refresh(db_user)

    return {"message": f"{payload.role} registered successfully"}


@router.post("/login", response_model=LoginResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    try:
        user = _resolve_login_user(db, credentials.identifier)
    except HTTPException:
        raise

    if not user or not _password_matches(credentials.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile/email or password",
        )

    if not _is_bcrypt_hash(user.password):
        user.password = hash_password(credentials.password)
        db.commit()
        db.refresh(user)

    if user.role not in ("patient", "doctor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account has an unsupported role",
        )

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=(user.doctor.email if user.doctor else ""),
        mobile=(user.patient.mobile if user.patient else ""),
        is_verified=bool(user.doctor.is_verified if user.doctor else True),
    )

    safe_user = _public_user(user)

    return LoginResponse(access_token=token, user=safe_user)
