import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


def normalize_mobile_digits(value: str) -> str:
    digits = re.sub(r"\D", "", (value or "").strip())
    if len(digits) < 10 or len(digits) > 15:
        raise ValueError("Mobile must be 10-15 digits")
    return digits


class UserRegister(BaseModel):
    """Public registration allows only patient and doctor (never admin)."""

    role: str = Field(..., pattern="^(patient|doctor)$")
    name: str
    password: str = Field(..., min_length=1)
    hospital: str = ""
    # Doctor only
    email: EmailStr | None = None
    # Patient only
    mobile: str | None = None

    @model_validator(mode="after")
    def validate_by_role(self):
        if self.role == "patient":
            if not (self.mobile and str(self.mobile).strip()):
                raise ValueError("Mobile number is required for patients")
            self.mobile = normalize_mobile_digits(str(self.mobile))
            self.email = None
            self.hospital = ""
        else:
            if not self.email:
                raise ValueError("Email is required for doctors")
            if not self.hospital.strip():
                raise ValueError("Hospital name is required for doctors")
            self.mobile = None
        return self


class UserLogin(BaseModel):
    """Single field: doctors type email; patients type mobile."""

    identifier: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UserPublic(BaseModel):
    id: int
    role: str
    name: str
    email: str = ""
    mobile: str = ""
    hospital: str = ""
    is_verified: bool = False

    model_config = {"from_attributes": True}

    @field_validator("email", mode="before")
    @classmethod
    def coerce_email(cls, v):
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
