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
    phone: str | None = None
    specialization: str | None = None
    medical_license_number: str | None = None
    years_of_experience: int | None = Field(default=None, ge=0)
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
            self.phone = None
            self.hospital = ""
            self.password = None
            self.specialization = None
            self.medical_license_number = None
            self.years_of_experience = None
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
            if not self.phone:
                raise ValueError("Phone number is required for doctors")
            if not self.medical_license_number:
                raise ValueError("Medical license number is required for doctors")
            self.phone = normalize_mobile_digits(str(self.phone))
            self.password = validate_doctor_password(self.password or "")
            self.mobile = None
            self.date_of_birth = None
            self.gender = None
            self.blood_group = None
            self.height = None
            self.weight = None
        return self


class UserLogin(BaseModel):
    """Doctors sign in with email/password."""

    identifier: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class AdminProfile(BaseModel):
    id: int
    role: Literal["admin"] = "admin"
    email: str
    is_active: bool = True
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


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
    phone: str = ""
    hospital: str = ""
    specialization: str | None = None
    medical_license_number: str = ""
    years_of_experience: int | None = None
    verification_document_url: str | None = None
    is_verified: bool = False
    verification_status: str = "pending"

    model_config = {"from_attributes": True}


class PatientSearchResult(BaseModel):
    id :int
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
    confidence_score: float | None = None # New field for overall confidence
    ai_summary: str | None = None # New field for AI summary
    # AI pipeline fields
    document_type: str | None = None
    classification_confidence: float | None = None
    classification_reason: str | None = None
    ocr_quality_score: float | None = None
    processing_time: float | None = None
    ai_version: str | None = None
    schema_validation_passed: bool | None = None
    validation_errors: str | None = None
    document_title: str | None = None
    component_confidence: dict[str, float] | None = None

    model_config = {"from_attributes": True}


class AdminDoctorPublic(BaseModel):
    user_id: int
    full_name: str = ""
    email: str = ""
    phone: str = ""
    hospital: str = ""
    specialization: str | None = None
    medical_license_number: str = ""
    years_of_experience: int | None = None
    verification_document_url: str | None = None
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


class DoctorDashboardStats(BaseModel):
    total_patients: int = 0
    prescriptions_today: int = 0
    pending_access_requests: int = 0
    active_approved_patients: int = 0


class MedicineSearchResult(BaseModel):
    id: int
    name: str
    generic_name: str | None = None
    brand_name: str | None = None
    aliases: str | None = None
    dosage_form: str | None = None
    strength: str | None = None
    unit: str | None = None
    route: str | None = None
    manufacturer: str | None = None
    source: str | None = None
    source_id: str | None = None

    model_config = {"from_attributes": True}


class MedicineValidationResponse(BaseModel):
    input: str
    is_valid: bool
    corrected_name: str | None = None
    confidence: float = 0
    match_type: str = "none"
    medicine: MedicineSearchResult | None = None


# Prescription Schemas
class PrescriptionMedicineCreate(BaseModel):
    medicine_name: str = Field(..., min_length=1)
    dosage: str = Field(..., min_length=1)
    frequency: str = Field(..., min_length=1)
    duration: str = Field(..., min_length=1)
    food_instruction: str = Field(..., min_length=1)
    special_instruction: str | None = None

    @field_validator(
        "medicine_name",
        "dosage",
        "frequency",
        "duration",
        "food_instruction",
        mode="before",
    )
    @classmethod
    def strip_required_text(cls, value):
        cleaned = str(value or "").strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @field_validator("special_instruction", mode="before")
    @classmethod
    def strip_optional_text(cls, value):
        cleaned = str(value or "").strip()
        return cleaned or None


class PrescriptionMedicineResponse(BaseModel):
    id: int
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    food_instruction: str
    special_instruction: str | None = None

    model_config = {"from_attributes": True}


class PrescriptionCreate(BaseModel):
    patient_id: int = Field(..., gt=0)
    diagnosis: str = Field(..., min_length=1)
    symptoms: str = Field(..., min_length=1)
    medicines: list[PrescriptionMedicineCreate] = Field(..., min_length=1)
    notes: str | None = None
    follow_up_date: date | None = None


class PrescriptionUpdate(BaseModel):
    diagnosis: str | None = None
    symptoms: str | None = None
    medicines: list[PrescriptionMedicineCreate] | None = None
    notes: str | None = None
    follow_up_date: date | None = None


class PrescriptionResponse(BaseModel):
    id: int
    prescription_id: str
    doctor_id: int
    patient_id: int
    diagnosis: str
    symptoms: str
    notes: str | None = None
    follow_up_date: date | None = None
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    created_by: int
    updated_by: int | None = None
    deleted_at: datetime | None = None
    deleted_by: int | None = None
    medicines: list[PrescriptionMedicineResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PrescriptionListResponse(BaseModel):
    id: int
    prescription_id: str
    doctor_id: int
    patient_id: int
    diagnosis: str
    symptoms: str
    status: str
    created_at: datetime | None = None
    follow_up_date: date | None = None

    model_config = {"from_attributes": True}


class PrescriptionDetailResponse(BaseModel):
    id: int
    prescription_id: str
    doctor_id: int
    patient_id: int
    diagnosis: str
    symptoms: str
    notes: str | None = None
    follow_up_date: date | None = None
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    created_by: int
    updated_by: int | None = None
    deleted_at: datetime | None = None
    deleted_by: int | None = None
    medicines: list[PrescriptionMedicineResponse] = Field(default_factory=list)
    doctor_name: str = ""
    doctor_specialization: str | None = None
    doctor_hospital: str = ""
    doctor_phone: str = ""
    doctor_signature_url: str | None = None
    patient_name: str = ""
    patient_uid: str = ""

    model_config = {"from_attributes": True}


class PrescriptionActivityResponse(BaseModel):
    id: int
    activity_type: str
    description: str
    timestamp: datetime | None = None
    actor_name: str
    actor_role: str

    model_config = {"from_attributes": True}


class PrescriptionAuditLogResponse(BaseModel):
    id: int
    field_name: str
    old_value: str | None = None
    new_value: str | None = None
    timestamp: datetime | None = None
    editor_id: int

    model_config = {"from_attributes": True}
