from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# -----------------
# Settings Schemas
# -----------------
class OrganizationSettingsBase(BaseModel):
    timezone: Optional[str] = "UTC"
    currency: Optional[str] = "USD"
    appointment_slot_duration: Optional[int] = 30
    features: Optional[Dict[str, Any]] = {}

class OrganizationSettingsResponse(OrganizationSettingsBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# -----------------
# Organization Schemas
# -----------------
class OrganizationBase(BaseModel):
    name: str = Field(..., max_length=255)
    registration_number: Optional[str] = None
    organization_type: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    subscription_plan: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    registration_number: Optional[str] = None
    organization_type: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None
    subscription_plan: Optional[str] = None

class OrganizationResponse(OrganizationBase):
    id: int
    organization_uid: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# -----------------
# Branch Schemas
# -----------------
class BranchBase(BaseModel):
    name: str = Field(..., max_length=255)
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[str] = "ACTIVE"

class BranchCreate(BranchBase):
    organization_id: int

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[str] = None

class BranchResponse(BranchBase):
    id: int
    branch_uid: str
    organization_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# -----------------
# Department Schemas
# -----------------
class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    branch_id: Optional[int] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int
    department_uid: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# -----------------
# Membership Schemas
# -----------------
class OrganizationMembershipBase(BaseModel):
    user_id: int
    role: str = Field(..., description="Role of the user in the organization e.g. doctor, admin, receptionist")
    status: Optional[str] = "ACTIVE"

class OrganizationMembershipCreate(OrganizationMembershipBase):
    organization_id: int

class OrganizationMembershipResponse(OrganizationMembershipBase):
    id: int
    organization_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# -----------------
# Lab and Pharmacy Assignment Schemas
# -----------------
class OrganizationLabCreate(BaseModel):
    organization_id: int
    laboratory_id: int

class OrganizationPharmacyCreate(BaseModel):
    organization_id: int
    pharmacy_id: int
