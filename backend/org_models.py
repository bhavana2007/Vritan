import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Enum, func
from sqlalchemy.orm import relationship
import uuid

from database import Base
from appointment_models import AuditMixin

class Organization(Base, AuditMixin):
    __tablename__ = 'organizations'

    id = Column(Integer, primary_key=True, index=True)
    organization_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    vritan_id = Column(String(50), unique=True, index=True, nullable=True) # e.g. VR-HOSP-000123
    name = Column(String(255), nullable=False, unique=True)
    registration_number = Column(String(100), nullable=True)
    organization_type = Column(String(100), nullable=True) # SOLO_CLINIC, SMALL_HOSPITAL, HOSPITAL_NETWORK
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    contact_email = Column(String(255), nullable=True) # Legacy compatibility
    legal_name = Column(String(255), nullable=True)
    ownership = Column(String(100), nullable=True) # Private, Government, Trust, Corporate
    specialties = Column(Text, nullable=True)
    hospital_level = Column(String(100), nullable=True) # Primary, Secondary, Tertiary
    abha_facility_id = Column(String(100), nullable=True)
    nabh_status = Column(String(50), nullable=True)
    nabl_status = Column(String(50), nullable=True)
    gst_number = Column(String(50), nullable=True)
    pan_number = Column(String(50), nullable=True)
    official_email = Column(String(255), nullable=True)
    official_phone = Column(String(50), nullable=True)
    emergency_contact = Column(String(50), nullable=True)
    district = Column(String(100), nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    representative_name = Column(String(255), nullable=True)
    representative_designation = Column(String(100), nullable=True)
    representative_mobile = Column(String(50), nullable=True)
    representative_email = Column(String(255), nullable=True)
    verification_status = Column(String(50), default="PENDING_EMAIL_VERIFICATION", nullable=False) # PENDING_EMAIL_VERIFICATION, PENDING_ADMIN_VERIFICATION, VERIFIED, REJECTED, SUSPENDED
    reg_cert_url = Column(String(255), nullable=True)
    nabh_cert_url = Column(String(255), nullable=True)
    gst_doc_url = Column(String(255), nullable=True)
    pan_doc_url = Column(String(255), nullable=True)
    hospital_license_url = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    logo_url = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="ACTIVE")
    subscription_plan = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)

    branches = relationship('Branch', back_populates='organization', cascade='all, delete-orphan')
    memberships = relationship('OrganizationMembership', back_populates='organization', cascade='all, delete-orphan')
    labs = relationship('OrganizationLab', back_populates='organization', cascade='all, delete-orphan')
    pharmacies = relationship('OrganizationPharmacy', back_populates='organization', cascade='all, delete-orphan')
    settings = relationship('OrganizationSettings', back_populates='organization', uselist=False, cascade='all, delete-orphan')
    audit_logs = relationship('AuditLog', back_populates='organization', cascade='all, delete-orphan')
    invitations = relationship('OrganizationInvitation', back_populates='organization', cascade='all, delete-orphan')

class Branch(Base, AuditMixin):
    __tablename__ = 'branches'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False)
    branch_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    latitude = Column(String(50), nullable=True)
    longitude = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True) # Legacy compatibility
    status = Column(String(50), nullable=False, default="DOCUMENTS_REQUIRED") # State machine primary status
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False, nullable=False)
    
    # Branch Admin registration details (pre-approval)
    admin_name = Column(String(255), nullable=True)
    admin_email = Column(String(255), nullable=True)
    admin_mobile = Column(String(50), nullable=True)
    
    # Verification workflow fields
    verification_status = Column(String(50), default="PENDING_EMAIL_VERIFICATION")
    email_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime, nullable=True)
    email_verification_token = Column(String(64), nullable=True, unique=True, index=True) # SHA-256 hash
    submitted_for_review_at = Column(DateTime, nullable=True)
    super_admin_approved = Column(Boolean, default=False)
    approved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    correction_requested_at = Column(DateTime, nullable=True)
    
    organization = relationship('Organization', back_populates='branches')
    departments = relationship('Department', back_populates='branch', cascade='all, delete-orphan')
    documents = relationship('BranchDocument', back_populates='branch', cascade='all, delete-orphan')
    approver = relationship('User', foreign_keys=[approved_by])

class Department(Base, AuditMixin):
    __tablename__ = 'departments'
    
    id = Column(Integer, primary_key=True, index=True)
    department_uid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    branch = relationship('Branch', back_populates='departments')

class OrganizationMembership(Base, AuditMixin):
    __tablename__ = 'organization_memberships'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    role = Column(String(50), nullable=False) # 'doctor', 'receptionist', 'admin', 'branch_admin', 'lab_tech', 'pharmacist'
    status = Column(String(50), nullable=False, default="ACTIVE")
    
    organization = relationship('Organization', back_populates='memberships')
    user = relationship('User', foreign_keys=[user_id])
    branch = relationship('Branch')

class OrganizationLab(Base, AuditMixin):
    __tablename__ = 'organization_labs'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False)
    laboratory_id = Column(Integer, ForeignKey('laboratories.id'), nullable=False)
    
    organization = relationship('Organization', back_populates='labs')
    laboratory = relationship('Laboratory')

class OrganizationPharmacy(Base, AuditMixin):
    __tablename__ = 'organization_pharmacies'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False)
    pharmacy_id = Column(Integer, ForeignKey('pharmacies.id'), nullable=False)
    
    organization = relationship('Organization', back_populates='pharmacies')
    pharmacy = relationship('Pharmacy')

class OrganizationSettings(Base, AuditMixin):
    __tablename__ = 'organization_settings'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False, unique=True)
    
    # Configuration JSON or specific fields
    timezone = Column(String(50), default="UTC")
    currency = Column(String(10), default="USD")
    appointment_slot_duration = Column(Integer, default=30)
    features = Column(JSON, default=dict)
    
    organization = relationship('Organization', back_populates='settings')

class AuditLog(Base, AuditMixin):
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, default=lambda: str(uuid.uuid4().hex)) # Blockchain ready ID
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    
    event_type = Column(String(100), nullable=False, index=True) # e.g. 'OrganizationCreated', 'DoctorAssigned'
    entity_type = Column(String(100), nullable=False) # 'Organization', 'Doctor', 'Branch'
    entity_id = Column(String(100), nullable=False)
    action = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="SUCCESS")
    
    ip_address = Column(String(50), nullable=True)
    hash = Column(String(255), nullable=True) # Future blockchain integration
    
    organization = relationship('Organization', back_populates='audit_logs')
    user = relationship('User', foreign_keys=[user_id])

class HospitalVerificationHistory(Base, AuditMixin):
    __tablename__ = 'hospital_verification_histories'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False)
    from_status = Column(String(50), nullable=False)
    to_status = Column(String(50), nullable=False)
    admin_notes = Column(Text, nullable=True)
    updated_by_admin_id = Column(Integer, nullable=True)
    
    organization = relationship('Organization')

class BranchDoctorAffiliation(Base, AuditMixin):
    __tablename__ = 'branch_doctor_affiliations'
    
    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=False)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=False) # user_id maps to doctors.user_id
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    employment_type = Column(String(50), default="EMPLOYED") # 'EMPLOYED', 'VISITING'
    status = Column(String(50), default="ACTIVE") # 'ACTIVE', 'INACTIVE'
    
    branch = relationship('Branch')
    department = relationship('Department')

class HospitalDocument(Base, AuditMixin):
    __tablename__ = 'hospital_documents'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False)
    document_type = Column(String(100), nullable=False) # e.g. 'REGISTRATION_CERTIFICATE', 'GOVT_LICENSE', 'NABH_CERTIFICATE', 'GST_CERTIFICATE', 'LOGO'
    document_url = Column(String(255), nullable=False)
    status = Column(String(50), default="PENDING") # PENDING, VERIFIED, REJECTED
    
    organization = relationship('Organization')

class BranchDocument(Base, AuditMixin):
    __tablename__ = 'branch_documents'
    
    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=False, index=True)
    document_type = Column(String(100), nullable=False) # BRANCH_REGISTRATION, ADDRESS_PROOF, FIRE_SAFETY_CERTIFICATE, HEALTHCARE_LICENSE, OTHER_SUPPORTING_DOCUMENT
    file_path = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    verification_status = Column(String(50), default="PENDING") # PENDING, VERIFIED, REJECTED
    verified_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    branch = relationship('Branch', back_populates='documents')
    uploader = relationship('User', foreign_keys=[uploaded_by])
    verifier = relationship('User', foreign_keys=[verified_by])


class InvitationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    SUPERSEDED = "SUPERSEDED"

class EmploymentType(str, enum.Enum):
    EMPLOYED = "EMPLOYED"
    VISITING = "VISITING"
    CONTRACT = "CONTRACT"

class StaffRole(str, enum.Enum):
    DOCTOR = "doctor"
    PHARMACIST = "pharmacist"
    NURSE = "nurse"
    LAB_TECHNICIAN = "lab_technician"
    ADMIN = "admin"
    BRANCH_ADMIN = "branch_admin"
    STAFF = "staff"


class OrganizationInvitation(Base, AuditMixin):
    __tablename__ = 'organization_invitations'

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    designation = Column(String(100), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    role = Column(Enum(StaffRole), nullable=False)
    invite_token_hash = Column(String(64), nullable=False, unique=True, index=True) # SHA-256 hash
    status = Column(Enum(InvitationStatus), default=InvitationStatus.PENDING, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    invited_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    accepted_by_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    custom_permissions = Column(JSON, nullable=True)

    # Relationships
    organization = relationship('Organization', back_populates='invitations')
    branch = relationship('Branch')
    department = relationship('Department')
    invited_by = relationship('User', foreign_keys=[invited_by_id])
    accepted_by = relationship('User', foreign_keys=[accepted_by_id])


class OrganizationEmployeeAssignment(Base, AuditMixin):
    __tablename__ = 'organization_employee_assignments'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    designation = Column(String(100), nullable=True)
    role = Column(Enum(StaffRole), nullable=False)
    employment_type = Column(Enum(EmploymentType), default=EmploymentType.EMPLOYED, nullable=False)
    status = Column(String(50), default="ACTIVE")
    custom_permissions = Column(JSON, nullable=True)

    # Relationships
    organization = relationship('Organization')
    branch = relationship('Branch')
    department = relationship('Department')
    user = relationship('User', foreign_keys=[user_id])


class DoctorTransferRequest(Base, AuditMixin):
    __tablename__ = 'doctor_transfer_requests'
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    from_branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    to_branch_id = Column(Integer, ForeignKey('branches.id'), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    status = Column(String(50), default="PENDING") # PENDING, APPROVED, REJECTED, EXPIRED
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    requested_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    organization = relationship('Organization')
    doctor = relationship('User', foreign_keys=[doctor_id])
    from_branch = relationship('Branch', foreign_keys=[from_branch_id])
    to_branch = relationship('Branch', foreign_keys=[to_branch_id])
    department = relationship('Department')
    requested_by = relationship('User', foreign_keys=[requested_by_id])
