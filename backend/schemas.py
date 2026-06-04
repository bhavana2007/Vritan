import re
from datetime import date, datetime
from typing import Any
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


def normalize_mobile_digits(value: str) -> str:
    digits = re.sub(r"\D", "", (value or "").strip())
    if len(digits) < 10 or len(digits) > 15:
        raise ValueError("Mobile must be 10-15 digits")
    return digits


PASSWORD_RULE_MESSAGE = (
    "Doctor password must be at least 8 characters and include uppercase, "
    "lowercase, number, and special character."
)


def validate_doctor_password(value: str) -> str:
    password = str(value or "")
    has_special = re.search(r"[^A-Za-z0-9]", password) is not None
    if (
        len(password) < 8
        or re.search(r"[A-Z]", password) is None
        or re.search(r"[a-z]", password) is None
        or re.search(r"\d", password) is None
        or not has_special
    ):
        raise ValueError(PASSWORD_RULE_MESSAGE)
    return password


class UserRegister(BaseModel):
    """Public registration allows only patient and doctor (never admin)."""

    role: str = Field(..., pattern="^(patient|doctor)$")
    name: str
    password: str | None = None
    hospital: str = ""
    # Doctor only
    email: EmailStr | None = None
    # Patient only
    mobile: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    height: float | None = Field(default=None, ge=0)
    weight: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_by_role(self):
        self.name = self.name.strip()
        if not self.name:
            raise ValueError("Full name is required")

        if self.role == "patient":
            if not (self.mobile and str(self.mobile).strip()):
                raise ValueError("Mobile number is required for patients")
            self.mobile = normalize_mobile_digits(str(self.mobile))
            self.email = None
            self.hospital = ""
            self.password = None
            self.gender = self.gender.strip() if isinstance(self.gender, str) else None
            self.blood_group = (
                self.blood_group.strip().upper()
                if isinstance(self.blood_group, str)
                else None
            )
        else:
            if not self.email:
                raise ValueError("Email is required for doctors")
            if not self.hospital.strip():
                raise ValueError("Hospital name is required for doctors")
            self.password = validate_doctor_password(self.password or "")
            self.mobile = None
        return self


class UserLogin(BaseModel):
    """Doctors and password-based staff accounts sign in with email/password."""

    identifier: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class SendOtpRequest(BaseModel):
    mobile: str
    purpose: Literal["register", "login"] = "register"

    @field_validator("mobile", mode="before")
    @classmethod
    def normalize_mobile(cls, v):
        return normalize_mobile_digits(str(v))


class VerifyOtpRequest(BaseModel):
    mobile: str
    otp: str = Field(..., min_length=6, max_length=6)
    purpose: Literal["register", "login"] = "register"

    @field_validator("mobile", mode="before")
    @classmethod
    def normalize_mobile(cls, v):
        return normalize_mobile_digits(str(v))

    @field_validator("otp", mode="before")
    @classmethod
    def normalize_otp(cls, v):
        digits = re.sub(r"\D", "", str(v or ""))
        if len(digits) != 6:
            raise ValueError("OTP must be 6 digits")
        return digits


class PatientOtpLoginRequest(BaseModel):
    mobile: str
    otp: str = Field(..., min_length=6, max_length=6)

    @field_validator("mobile", mode="before")
    @classmethod
    def normalize_mobile(cls, v):
        return normalize_mobile_digits(str(v))

    @field_validator("otp", mode="before")
    @classmethod
    def normalize_otp(cls, v):
        digits = re.sub(r"\D", "", str(v or ""))
        if len(digits) != 6:
            raise ValueError("OTP must be 6 digits")
        return digits


class UserPublic(BaseModel):
    id: int
    role: str
    name: str
    patient_uid: str = ""
    email: str = ""
    mobile: str = ""
    hospital: str = ""
    is_verified: bool = False
    verification_status: str = "approved"

    model_config = {"from_attributes": True}

    @field_validator("email", mode="before")
    @classmethod
    def coerce_email(cls, v):
        return "" if v is None else str(v)

    @field_validator("patient_uid", mode="before")
    @classmethod
    def coerce_patient_uid(cls, v):
        return "" if v is None else str(v)

    @field_validator("mobile", mode="before")
    @classmethod
    def coerce_mobile(cls, v):
        return "" if v is None else str(v)

    @field_validator("hospital", mode="before")
    @classmethod
    def coerce_hospital(cls, v):
        return "" if not isinstance(v, str) else v

    @field_validator("is_verified", mode="before")
    @classmethod
    def coerce_verified(cls, v):
        if v is None:
            return False
        return bool(v)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class PatientProfile(BaseModel):
    full_name: str = ""
    patient_uid: str = ""
    mobile: str = ""
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    height: float | None = None
    weight: float | None = None

    model_config = {"from_attributes": True}


class DoctorResetOtpRequest(BaseModel):
    email: EmailStr


class DoctorVerifyResetOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

    @field_validator("otp", mode="before")
    @classmethod
    def normalize_otp(cls, v):
        digits = re.sub(r"\D", "", str(v or ""))
        if len(digits) != 6:
            raise ValueError("OTP must be 6 digits")
        return digits


class DoctorResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str

    @field_validator("otp", mode="before")
    @classmethod
    def normalize_otp(cls, v):
        digits = re.sub(r"\D", "", str(v or ""))
        if len(digits) != 6:
            raise ValueError("OTP must be 6 digits")
        return digits

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        return validate_doctor_password(v)


class DoctorProfile(BaseModel):
    full_name: str = ""
    email: str = ""
    hospital: str = ""
    specialization: str | None = None
    is_verified: bool = False
    verification_status: str = "pending"

    model_config = {"from_attributes": True}


class PatientSearchResult(BaseModel):
    full_name: str = ""
    patient_uid: str = ""
    blood_group: str | None = None
    gender: str | None = None

    model_config = {"from_attributes": True}


class MedicalRecordPublic(BaseModel):
    id: int
    record_type: str
    file_url: str
    original_filename: str
    display_title: str = ""
    uploaded_at: datetime | None = None
    notes: str | None = None
    extracted_text: str | None = None
    cleaned_text: str | None = None
    detected_medicines: list[dict[str, str]] = Field(default_factory=list)
    probable_conditions: list[str] = Field(default_factory=list)
    ai_structured_data: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class AdminDoctorPublic(BaseModel):
    user_id: int
    full_name: str = ""
    email: str = ""
    hospital: str = ""
    specialization: str | None = None
    is_verified: bool = False
    verification_status: str = "pending"
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class AccessRequestPublic(BaseModel):
    id: int
    status: str
    doctor_name: str = ""
    hospital: str = ""
    created_at: datetime | None = None
    expires_at: datetime | None = None


class DoctorAccessRequestResponse(BaseModel):
    id: int
    status: str
    message: str
    expires_at: datetime | None = None
