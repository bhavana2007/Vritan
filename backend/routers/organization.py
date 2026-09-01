from fastapi import APIRouter, Depends, status, HTTPException, Query, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
import secrets
import hashlib
import os
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from database import get_db
from models import User, Doctor, LabTechnician
from security import get_current_user
from org_models import (
    Organization, Branch, Department, OrganizationMembership, 
    BranchDoctorAffiliation, HospitalDocument, OrganizationInvitation,
    InvitationStatus, EmploymentType, StaffRole, OrganizationEmployeeAssignment, BranchDocument
)
from schemas.response_schema import APIResponse, success_response, error_response
from utils.middleware import get_current_request_id
from services.audit_service import AuditService
from repositories.audit_repo import AuditRepository

router = APIRouter(prefix="/api/v1/organizations", tags=["Organizations"])

# -----------------
# Helper Resolver & Auth Checkers
# -----------------
def resolve_org(org_id: str, db: Session) -> Organization:
    """
    Resolves an organization by its numeric ID or its public VR-HOSP-XXXXXXXX vritan_id.
    """
    if org_id.isdigit():
        org = db.query(Organization).filter(Organization.id == int(org_id)).first()
        if org:
            return org
    org = db.query(Organization).filter(Organization.vritan_id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization not found with identifier '{org_id}'"
        )
    return org

def verify_admin_access(org: Organization, user: User, db: Session):
    """
    Verifies that the user has administrator access to the organization.
    """
    # Allow Super Admin bypass
    if user.role == "admin":
        return True
    
    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.role == "admin",
        OrganizationMembership.status == "ACTIVE"
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not an administrator of this organization."
        )

def verify_member_access(org: Organization, user: User, db: Session):
    """
    Verifies that the user is a member of the organization (doctor, admin, etc.)
    """
    if user.role == "admin":
        return True
        
    membership = db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.status == "ACTIVE"
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not a member of this organization."
        )

# -----------------
# Schema Payloads
# -----------------
class OrganizationUpdatePayload(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    organization_type: Optional[str] = None
    gst_number: Optional[str] = None
    nabh_status: Optional[str] = None
    nabl_status: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    district: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    logo_url: Optional[str] = None

class BranchCreatePayload(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    admin_name: str
    admin_email: str
    admin_mobile: str

class BranchVerifyOtpPayload(BaseModel):
    otp: str

class BranchUpdatePayload(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None # 'ACTIVE', 'INACTIVE'

class DepartmentCreatePayload(BaseModel):
    branch_id: int
    name: str
    description: Optional[str] = None

class DepartmentUpdatePayload(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class DoctorAffiliatePayload(BaseModel):
    doctor_email_or_id: str # Can be email or vritan_id
    branch_id: int
    department_id: Optional[int] = None
    employment_type: Optional[str] = "EMPLOYED" # 'EMPLOYED', 'VISITING'

class MemberInvitePayload(BaseModel):
    email_or_id: str
    role: str # doctor, pharmacist, nurse, lab_technician, admin, staff
    branch_id: int
    department_id: Optional[int] = None
    employment_type: Optional[str] = "EMPLOYED" # EMPLOYED, VISITING, CONTRACT
    designation: Optional[str] = None

class DoctorTransferPayload(BaseModel):
    to_branch_id: int
    department_id: Optional[int] = None

class DoctorTransferConfirmPayload(BaseModel):
    token: str

# -----------------
# API Endpoints
# -----------------

@router.get("/{org_id}", summary="Get Organization Profile")
def get_organization_profile(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    # Hide database internal ID, expose only public details
    return success_response(
        data={
            "vritan_id": org.vritan_id,
            "name": org.name,
            "legal_name": org.legal_name,
            "organization_type": org.organization_type,
            "registration_number": org.registration_number,
            "gst_number": org.gst_number,
            "nabh_status": org.nabh_status,
            "nabl_status": org.nabl_status,
            "website": org.website,
            "address": org.address,
            "city": org.city,
            "state": org.state,
            "country": org.country,
            "pincode": org.pincode,
            "district": org.district,
            "latitude": org.latitude,
            "longitude": org.longitude,
            "logo_url": org.logo_url,
            "verification_status": org.verification_status,
            "status": org.status,
            "representative_name": org.representative_name,
            "representative_designation": org.representative_designation,
        },
        message="Organization profile retrieved successfully",
        request_id=get_current_request_id()
    )

@router.put("/{org_id}", summary="Update Organization Profile")
def update_organization_profile(
    org_id: str,
    payload: OrganizationUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(org, key, val)
        
    db.commit()
    db.refresh(org)
    
    # Log audit event
    audit = AuditService(AuditRepository(db))
    audit.log_enterprise_event(
        event_type="OrganizationUpdated",
        entity_type="Organization",
        entity_id=str(org.id),
        action=f"Organization profile updated by {current_user.email}",
        organization_id=org.id,
        user_id=current_user.id
    )
    
    return success_response(
        data={"vritan_id": org.vritan_id, "status": "Updated"},
        message="Organization profile updated successfully"
    )

# Branches CRUD
@router.post("/{org_id}/branches", summary="Create Branch")
def create_branch(
    org_id: str,
    payload: BranchCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    if payload.admin_email.strip().lower() == current_user.email.strip().lower():
        raise HTTPException(status_code=400, detail="Branch Admin must be a distinct user from the Main Admin")
        
    branch = Branch(
        organization_id=org.id,
        name=payload.name,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        phone=payload.phone,
        email=payload.email,
        admin_name=payload.admin_name,
        admin_email=payload.admin_email,
        admin_mobile=payload.admin_mobile,
        status="AWAITING_MAIN_ADMIN_OTP",
        verification_status="PENDING_EMAIL_VERIFICATION",
        is_active=False
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    
    try:
        from services.otp_service import generate_verification_otp, log_security_event
        generate_verification_otp(db, current_user.id, current_user.email)
        log_security_event(db, current_user.id, current_user.email, "BRANCH_REGISTRATION_OTP", "SUCCESS", f"OTP sent to main admin for branch {branch.id}")
    except Exception as e:
        print(f"[BRANCH REGISTRATION EMAIL ERROR]: {e}")
    
    return success_response(
        data={
            "id": branch.id,
            "branch_uid": branch.branch_uid,
            "name": branch.name,
            "status": branch.status
        },
        message="OTP sent to your registered email to authorize branch creation."
    )

@router.post("/{org_id}/branches/{branch_id}/verify-creation-otp", summary="Verify Branch Creation OTP")
def verify_branch_creation_otp(
    org_id: str,
    branch_id: int,
    payload: BranchVerifyOtpPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.organization_id == org.id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
        
    if branch.status != "AWAITING_MAIN_ADMIN_OTP":
        raise HTTPException(status_code=400, detail="Branch is not awaiting OTP verification")
        
    try:
        from services.otp_service import verify_verification_otp, log_security_event
        verify_verification_otp(db, current_user.email, payload.otp)
        log_security_event(db, current_user.id, current_user.email, "BRANCH_REGISTRATION_OTP_VERIFIED", "SUCCESS", f"Branch {branch.id} authorized by main admin")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    branch.status = "PENDING_VERIFICATION"
    branch.verification_status = "PENDING_ADMIN_APPROVAL"
    db.commit()
    db.refresh(branch)
    
    audit = AuditService(AuditRepository(db))
    audit.log_enterprise_event(
        event_type="BranchCreated",
        entity_type="Branch",
        entity_id=str(branch.id),
        action=f"Branch '{branch.name}' application authorized by '{current_user.email}'",
        organization_id=org.id,
        user_id=current_user.id
    )
    
    return success_response(
        data={"id": branch.id, "status": branch.status},
        message="Branch application successfully authorized and is now pending Super Admin approval."
    )

@router.get("/{org_id}/branches", summary="List Branches")
def list_branches(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
    branch_data = []
    
    # Fetch all branch admins for this organization
    branch_admins = db.query(OrganizationMembership, User).join(User, User.id == OrganizationMembership.user_id).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.role == "branch_admin",
        OrganizationMembership.status == "ACTIVE"
    ).all()
    
    admin_map = {mem.OrganizationMembership.branch_id: mem.User for mem in branch_admins}
    
    for b in branches:
        admin_info = None
        if b.id in admin_map:
            admin_user = admin_map[b.id]
            admin_info = {
                "name": admin_user.doctor.full_name if admin_user.doctor else (admin_user.email or "Unknown"),
                "email": admin_user.email,
                "status": "ACTIVE"
            }
            
        branch_data.append({
            "id": b.id,
            "branch_uid": b.branch_uid,
            "name": b.name,
            "address": b.address,
            "phone": b.phone,
            "email": b.email,
            "status": b.status,
            "is_active": b.is_active,
            "branch_admin": admin_info
        })
        
    return success_response(
        data=branch_data,
        message="Branches retrieved successfully"
    )

@router.put("/{org_id}/branches/{branch_id}", summary="Update/Disable Branch")
def update_branch(
    org_id: str,
    branch_id: int,
    payload: BranchUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.organization_id == org.id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        if key == "status" and val:
            if val == "ACTIVE" and not branch.is_default and branch.verification_status not in ["APPROVED", "VERIFIED"] and not branch.super_admin_approved:
                raise HTTPException(status_code=403, detail="Branch must be approved by Super Admin before it can be activated")
            branch.status = val
            branch.is_active = (val == "ACTIVE")
        elif val is not None:
            setattr(branch, key, val)
            
    db.commit()
    db.refresh(branch)
    
    return success_response(
        data={"id": branch.id, "name": branch.name, "status": branch.status},
        message="Branch updated successfully"
    )

# Departments CRUD
@router.post("/{org_id}/departments", summary="Create Department")
def create_department(
    org_id: str,
    payload: DepartmentCreatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    # Ensure branch belongs to this org
    branch = db.query(Branch).filter(Branch.id == payload.branch_id, Branch.organization_id == org.id).first()
    if not branch:
        raise HTTPException(status_code=400, detail="Branch not found or unauthorized")
        
    dept = Department(
        branch_id=branch.id,
        name=payload.name,
        description=payload.description,
        is_active=True
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    
    return success_response(
        data={"id": dept.id, "name": dept.name, "branch_id": dept.branch_id},
        message="Department created successfully"
    )

@router.get("/{org_id}/departments", summary="List Departments")
def list_departments(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    # Fetch all branches first
    branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
    branch_ids = [b.id for b in branches]
    
    departments = db.query(Department).filter(Department.branch_id.in_(branch_ids)).all()
    return success_response(
        data=[
            {
                "id": d.id,
                "department_uid": d.department_uid,
                "name": d.name,
                "description": d.description,
                "branch_id": d.branch_id,
                "branch_name": next((b.name for b in branches if b.id == d.branch_id), "Unknown"),
                "is_active": d.is_active
            } for d in departments
        ],
        message="Departments retrieved successfully"
    )

@router.put("/{org_id}/departments/{dept_id}", summary="Update/Archive Department")
def update_department(
    org_id: str,
    dept_id: int,
    payload: DepartmentUpdatePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    # Ensure department is in a branch belonging to this org
    dept = db.query(Department).join(Branch).filter(
        Department.id == dept_id,
        Branch.organization_id == org.id
    ).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found under this organization")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(dept, key, val)
        
    db.commit()
    db.refresh(dept)
    
    return success_response(
        data={"id": dept.id, "name": dept.name, "is_active": dept.is_active},
        message="Department updated successfully"
    )

# Doctor Affiliations CRUD
# generic Employee Invitation and Affiliation
@router.post("/{org_id}/invite-member", summary="Invite / Affiliate Staff Member")
def invite_member(
    org_id: str,
    payload: MemberInvitePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import secrets
    import hashlib
    from datetime import datetime, timezone, timedelta
    
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    # Resolve enums
    try:
        role_enum = StaffRole(payload.role.strip().lower())
    except ValueError:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid invited role. Supported roles: {[r.value for r in StaffRole]}"
        )
        
    try:
        emp_type_enum = EmploymentType(payload.employment_type.strip().upper())
    except ValueError:
        emp_type_enum = EmploymentType.EMPLOYED

    # Ensure branch belongs to org
    branch = db.query(Branch).filter(Branch.id == payload.branch_id, Branch.organization_id == org.id).first()
    if not branch:
        raise HTTPException(status_code=400, detail="Branch not found under this organization")
        
    # Search User table first
    invited_user = None
    target_identifier = payload.email_or_id.strip()
    
    invited_user = db.query(User).filter(
        (User.email == target_identifier.lower()) |
        (User.phone_number == target_identifier)
    ).first()
    
    if not invited_user and target_identifier.startswith("VR-"):
        # Fallback to profile table lookup by Vritan ID
        if target_identifier.startswith("VR-DOC-"):
            doc = db.query(Doctor).filter(Doctor.vritan_id == target_identifier).first()
            if doc:
                invited_user = db.query(User).filter(User.id == doc.user_id).first()
                
    audit = AuditService(AuditRepository(db))
    
    # Check if target profile exists
    has_profile = False
    if invited_user:
        if role_enum == StaffRole.DOCTOR:
            has_profile = db.query(Doctor).filter(Doctor.user_id == invited_user.id).first() is not None
        elif role_enum == StaffRole.LAB_TECHNICIAN:
            has_profile = db.query(LabTechnician).filter(LabTechnician.user_id == invited_user.id).first() is not None
        else:
            # For simpler roles, check if the user is already bound or default to True
            has_profile = True

    # --- CASE 1: User exists and role-specific profile exists -> Instant Affiliation ---
    if invited_user and has_profile:
        # Create organization membership
        existing_membership = db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.user_id == invited_user.id
        ).first()
        
        if not existing_membership:
            membership = OrganizationMembership(
                organization_id=org.id,
                user_id=invited_user.id,
                role=role_enum.value,
                status="ACTIVE"
            )
            db.add(membership)
        else:
            existing_membership.status = "ACTIVE"
            
        # Create organization employee assignment
        existing_assignment = db.query(OrganizationEmployeeAssignment).filter(
            OrganizationEmployeeAssignment.organization_id == org.id,
            OrganizationEmployeeAssignment.branch_id == branch.id,
            OrganizationEmployeeAssignment.user_id == invited_user.id,
            OrganizationEmployeeAssignment.role == role_enum
        ).first()
        
        if not existing_assignment:
            assignment = OrganizationEmployeeAssignment(
                organization_id=org.id,
                branch_id=branch.id,
                department_id=payload.department_id,
                user_id=invited_user.id,
                role=role_enum,
                designation=payload.designation or payload.employment_type,
                employment_type=emp_type_enum,
                status="ACTIVE"
            )
            db.add(assignment)
        else:
            existing_assignment.status = "ACTIVE"
            existing_assignment.department_id = payload.department_id
            existing_assignment.designation = payload.designation or payload.employment_type
            existing_assignment.employment_type = emp_type_enum
            
        # Update doctor table to link hospital (for backward compatibility)
        if role_enum == StaffRole.DOCTOR:
            doc_prof = db.query(Doctor).filter(Doctor.user_id == invited_user.id).first()
            if doc_prof:
                doc_prof.hospital_vritan_id = org.vritan_id
                doc_prof.hospital_registered = True
                doc_prof.hospital = org.name
                
        db.commit()
        
        # Send instant affiliation notification email
        from services.email_service import send_member_affiliation_notification_email
        send_member_affiliation_notification_email(
            to_email=invited_user.email,
            member_name=invited_user.email,
            org_name=org.name,
            role=role_enum.value
        )
        
        # Create in-app Notification record
        try:
            from notification_models import Notification
            notif = Notification(
                user_id=invited_user.id,
                title=f"Affiliated with {org.name}",
                message=f"You have been affiliated with {org.name} as a {role_enum.value.title()}.",
                category="System",
                priority="Normal",
                type="info"
            )
            db.add(notif)
            db.commit()
        except Exception as e:
            print(f"[NOTIFICATION ERROR] Failed to send in-app notification: {e}")
            
        # Log audit event
        audit.log_enterprise_event(
            event_type="MEMBERSHIP_CREATED",
            entity_type="Membership",
            entity_id=str(invited_user.id),
            action=f"User {invited_user.email} affiliated with Branch '{branch.name}' as {role_enum.value}",
            organization_id=org.id,
            user_id=current_user.id
        )
        
        return success_response(
            data={"user_id": invited_user.id, "status": "AFFILIATED"},
            message=f"{role_enum.value.title()} affiliated successfully."
        )

    # --- CASE 2: User doesn't exist OR profile doesn't exist -> Create Pending Invitation ---
    else:
        invite_email = target_identifier.lower()
        if "@" not in invite_email:
            raise HTTPException(
                status_code=400,
                detail="A valid email address is required to invite a new member to the system."
            )
            
        # Mark any previous pending invitations as SUPERSEDED
        db.query(OrganizationInvitation).filter(
            OrganizationInvitation.organization_id == org.id,
            OrganizationInvitation.email == invite_email,
            OrganizationInvitation.role == role_enum,
            OrganizationInvitation.status == InvitationStatus.PENDING
        ).update({OrganizationInvitation.status: InvitationStatus.SUPERSEDED})
        db.commit()
        
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        
        invitation = OrganizationInvitation(
            organization_id=org.id,
            branch_id=branch.id,
            department_id=payload.department_id,
            designation=payload.designation or payload.employment_type,
            email=invite_email,
            role=role_enum,
            invite_token_hash=token_hash,
            status=InvitationStatus.PENDING,
            expires_at=now_utc + timedelta(days=7),
            invited_by_id=current_user.id
        )
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        
        # Send in-app notification if user exists
        if invited_user:
            try:
                from notification_models import Notification
                notif = Notification(
                    user_id=invited_user.id,
                    title=f"Invitation from {org.name}",
                    message=f"You have been invited to join {org.name} as a {role_enum.value.title()}.",
                    category="System",
                    priority="Normal",
                    type="info"
                )
                db.add(notif)
                db.commit()
            except Exception as e:
                print(f"[NOTIFICATION ERROR] Failed to send in-app notification: {e}")

        # Send invite email
        from services.email_service import send_member_invitation_email
        invite_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/register?invite={raw_token}"
        dept_name = ""
        if payload.department_id:
            dept = db.query(Department).filter(Department.id == payload.department_id).first()
            if dept:
                dept_name = dept.name
                
        send_member_invitation_email(
            to_email=invite_email,
            org_name=org.name,
            org_vritan_id=org.vritan_id,
            branch_name=branch.name,
            department_name=dept_name,
            designation=payload.designation or payload.employment_type,
            role=role_enum.value,
            invite_link=invite_link
        )
        
        # Log audit event
        audit.log_enterprise_event(
            event_type="INVITATION_CREATED",
            entity_type="Invitation",
            entity_id=str(invitation.id),
            action=f"Invitation sent to {invite_email} as {role_enum.value} for Branch '{branch.name}'",
            organization_id=org.id,
            user_id=current_user.id
        )
        
        # We return the raw_token once to allow Copy Link functionality to work cleanly on creation
        return success_response(
            data={"status": "INVITED", "raw_token": raw_token},
            message="Invitation sent successfully."
        )


class DoctorInvitePayload(BaseModel):
    doctor_email_or_id: str
    branch_id: int
    department_id: Optional[int] = None

@router.post("/{org_id}/invite-doctor", summary="Legacy invite-doctor endpoint mapping to invite-member")
def invite_doctor_legacy(
    org_id: str,
    payload: DoctorInvitePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    member_payload = MemberInvitePayload(
        email_or_id=payload.doctor_email_or_id,
        role="doctor",
        branch_id=payload.branch_id,
        department_id=payload.department_id,
        employment_type="EMPLOYED",
        designation="Doctor"
    )
    return invite_member(org_id=org_id, payload=member_payload, current_user=current_user, db=db)

@router.delete("/{org_id}/doctors/{doctor_id}", summary="Remove Doctor Affiliation")
def remove_doctor_affiliation(
    org_id: str,
    doctor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    # Remove from organization employee assignments
    db.query(OrganizationEmployeeAssignment).filter(
        OrganizationEmployeeAssignment.organization_id == org.id,
        OrganizationEmployeeAssignment.user_id == doctor_id,
        OrganizationEmployeeAssignment.role == StaffRole.DOCTOR
    ).delete(synchronize_session=False)
    
    # Also clean legacy branch affiliations
    branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
    branch_ids = [b.id for b in branches]
    db.query(BranchDoctorAffiliation).filter(
        BranchDoctorAffiliation.branch_id.in_(branch_ids),
        BranchDoctorAffiliation.doctor_id == doctor_id
    ).delete(synchronize_session=False)
    
    # Remove organization membership
    db.query(OrganizationMembership).filter(
        OrganizationMembership.organization_id == org.id,
        OrganizationMembership.user_id == doctor_id,
        OrganizationMembership.role == "doctor"
    ).delete(synchronize_session=False)
    
    # Unlink hospital public fields from doctor profile
    doc_prof = db.query(Doctor).filter(Doctor.user_id == doctor_id).first()
    if doc_prof and doc_prof.hospital_vritan_id == org.vritan_id:
        doc_prof.hospital_vritan_id = None
        doc_prof.hospital_registered = False
        doc_prof.hospital = None
        
    db.commit()
    
    return success_response(
        data={"doctor_id": doctor_id, "status": "REMOVED"},
        message="Doctor affiliation terminated successfully"
    )

@router.put("/{org_id}/doctors/{doctor_id}/transfer", summary="Initiate Doctor Transfer Between Branches")
def transfer_doctor(
    org_id: str,
    doctor_id: int,
    payload: DoctorTransferPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    # Check if target branch belongs to org
    to_branch = db.query(Branch).filter(Branch.id == payload.to_branch_id, Branch.organization_id == org.id).first()
    if not to_branch:
        raise HTTPException(status_code=400, detail="Target branch not found or unauthorized")
        
    doctor = db.query(User).filter(User.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    # Get current branch assignment
    assignment = db.query(OrganizationEmployeeAssignment).filter(
        OrganizationEmployeeAssignment.organization_id == org.id,
        OrganizationEmployeeAssignment.user_id == doctor_id,
        OrganizationEmployeeAssignment.role == StaffRole.DOCTOR
    ).first()
    
    from_branch_id = assignment.branch_id if assignment else None
    
    # Create transfer request
    import secrets as _sec
    import hashlib
    from datetime import datetime as _dt, timedelta as _td, timezone as _tz
    from org_models import DoctorTransferRequest
    
    raw_token = _sec.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = _dt.now(_tz.utc).replace(tzinfo=None) + _td(days=7)
    
    transfer_req = DoctorTransferRequest(
        organization_id=org.id,
        doctor_id=doctor_id,
        from_branch_id=from_branch_id,
        to_branch_id=to_branch.id,
        department_id=payload.department_id,
        status="PENDING",
        token_hash=token_hash,
        requested_by_id=current_user.id,
        expires_at=expires_at
    )
    db.add(transfer_req)
    db.commit()
    
    # Send email to doctor
    try:
        from services.email_service import send_email
        frontend_base = os.getenv("FRONTEND_URL", "http://localhost:5173")
        confirm_link = f"{frontend_base}/doctor/transfer-confirm?token={raw_token}"
        
        email_html = f"""
        <html>
            <body>
                <h2>Doctor Transfer Request</h2>
                <p>Hello Dr. {doctor.full_name},</p>
                <p>A transfer request has been initiated for you to move to the <strong>{to_branch.name}</strong> branch.</p>
                <p>Organization: {org.name} ({org.vritan_id})</p>
                <p>Destination Branch: {to_branch.name} ({to_branch.branch_uid})</p>
                <p>Please click the button below to confirm the transfer:</p>
                <a href="{confirm_link}" style="display:inline-block;padding:10px 20px;background-color:#059669;color:white;text-decoration:none;border-radius:5px;">Confirm Transfer</a>
                <p>If you did not expect this request, you can ignore this email.</p>
            </body>
        </html>
        """
        send_email(doctor.email, "Action Required: Branch Transfer Request", email_html)
        from services.otp_service import log_security_event
        log_security_event(db, doctor.id, doctor.email, "TRANSFER_REQUEST_EMAIL_SENT", "SUCCESS", f"Sent transfer email for branch {to_branch.id}")
    except Exception as e:
        print(f"[DOCTOR TRANSFER EMAIL ERROR]: {e}")
        
    return success_response(
        data={"doctor_id": doctor_id, "transfer_status": "PENDING"},
        message="Transfer request initiated. An email has been sent to the doctor for confirmation."
    )

@router.post("/{org_id}/doctors/transfer/confirm", summary="Confirm Doctor Transfer")
def confirm_doctor_transfer(
    org_id: str,
    payload: DoctorTransferConfirmPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import hashlib
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    
    from org_models import DoctorTransferRequest
    from datetime import datetime as _dt, timezone as _tz
    
    req = db.query(DoctorTransferRequest).filter(
        DoctorTransferRequest.token_hash == token_hash,
        DoctorTransferRequest.status == "PENDING"
    ).first()
    
    if not req:
        raise HTTPException(status_code=400, detail="Invalid or expired transfer token")
        
    if req.expires_at < _dt.now(_tz.utc).replace(tzinfo=None):
        req.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=400, detail="Transfer token has expired")
        
    if req.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to confirm this transfer")
        
    # Apply transfer
    assignment = db.query(OrganizationEmployeeAssignment).filter(
        OrganizationEmployeeAssignment.organization_id == req.organization_id,
        OrganizationEmployeeAssignment.user_id == req.doctor_id,
        OrganizationEmployeeAssignment.role == StaffRole.DOCTOR
    ).first()
    
    if not assignment:
        assignment = OrganizationEmployeeAssignment(
            organization_id=req.organization_id,
            branch_id=req.to_branch_id,
            department_id=req.department_id,
            user_id=req.doctor_id,
            role=StaffRole.DOCTOR,
            designation="Transfer Doctor",
            employment_type=EmploymentType.EMPLOYED,
            status="ACTIVE"
        )
        db.add(assignment)
    else:
        assignment.branch_id = req.to_branch_id
        if req.department_id:
            assignment.department_id = req.department_id
            
    # Legacy affiliation update
    branches = db.query(Branch).filter(Branch.organization_id == req.organization_id).all()
    branch_ids = [b.id for b in branches]
    
    db.query(BranchDoctorAffiliation).filter(
        BranchDoctorAffiliation.branch_id.in_(branch_ids),
        BranchDoctorAffiliation.doctor_id == req.doctor_id
    ).delete(synchronize_session=False)
    
    affiliation = BranchDoctorAffiliation(
        branch_id=req.to_branch_id,
        doctor_id=req.doctor_id,
        department_id=req.department_id,
        status="ACTIVE"
    )
    db.add(affiliation)
    
    req.status = "APPROVED"
    db.commit()
    
    return success_response(
        data={"doctor_id": req.doctor_id, "new_branch_id": req.to_branch_id},
        message="Transfer confirmed successfully."
    )

@router.get("/{org_id}/doctors", summary="List Affiliated Doctors")
def list_affiliated_doctors(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
    branch_map = {b.id: b.name for b in branches}
    
    # Query OrganizationEmployeeAssignment as primary source of truth
    affiliations = db.query(OrganizationEmployeeAssignment).filter(
        OrganizationEmployeeAssignment.organization_id == org.id,
        OrganizationEmployeeAssignment.role == StaffRole.DOCTOR,
        OrganizationEmployeeAssignment.status == "ACTIVE"
    ).all()
    
    doc_ids = [aff.user_id for aff in affiliations]
    doctors = db.query(Doctor).filter(Doctor.user_id.in_(doc_ids)).all() if doc_ids else []
    doc_map = {d.user_id: d for d in doctors}
    
    result = []
    for aff in affiliations:
        doc_prof = doc_map.get(aff.user_id)
        if doc_prof:
            # Resolve department
            dept_name = "N/A"
            if aff.department_id:
                dept = db.query(Department).filter(Department.id == aff.department_id).first()
                if dept:
                    dept_name = dept.name
            result.append({
                "id": doc_prof.user_id,
                "name": doc_prof.full_name,
                "email": doc_prof.email,
                "phone": doc_prof.phone,
                "vritan_id": doc_prof.vritan_id,
                "specialization": doc_prof.specialization,
                "branch_id": aff.branch_id,
                "branch_name": branch_map.get(aff.branch_id, "Unknown"),
                "department_id": aff.department_id,
                "department_name": dept_name,
                "employment_type": aff.employment_type.value if hasattr(aff.employment_type, 'value') else str(aff.employment_type),
                "status": aff.status
            })
            
    return success_response(
        data=result,
        message="Affiliated doctors retrieved successfully"
    )

@router.get("/{org_id}/metrics", summary="Get Organization Dashboard Analytics")
@router.get("/{org_id}/analytics", summary="Get Organization Dashboard Analytics")
def get_dashboard_analytics(
    org_id: str,
    branch_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from services.analytics_service import OrganizationAnalyticsService
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    analytics_svc = OrganizationAnalyticsService(db)
    metrics = analytics_svc.get_live_metrics(org, branch_id=branch_id, start_date=start_date, end_date=end_date)
    
    return success_response(
        data=metrics,
        message="Analytics retrieved successfully"
    )

@router.get("/{org_id}/staff", summary="Get Organization Staff List")
def get_organization_staff(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from services.organization_service import OrganizationService
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    org_svc = OrganizationService(db)
    staff_list = org_svc.get_staff_list(org)
    
    return success_response(
        data={"staff": staff_list},
        message="Staff registry retrieved successfully"
    )

@router.get("/{org_id}/monitoring/{module}", summary="Get Organization Monitoring Data")
def get_organization_monitoring(
    org_id: str,
    module: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from services.analytics_service import OrganizationAnalyticsService
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    analytics_svc = OrganizationAnalyticsService(db)
    monitoring_data = analytics_svc.get_monitoring_data(org, module)
    
    return success_response(
        data=monitoring_data,
        message="Monitoring metrics retrieved successfully"
    )


@router.get("/{org_id}/appointments", summary="Get Organization Appointments")
def get_organization_appointments(
    org_id: str,
    branch_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    doctor_id: Optional[int] = Query(None),
    date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from appointment_models import Appointment, AppointmentSlot
    from models import Patient, Doctor
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id, Branch.organization_id == org.id).first()
        if not branch:
            raise HTTPException(status_code=403, detail="Branch does not belong to this organization")
        branch_ids = [branch_id]
    else:
        branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        
    if not branch_ids:
        return success_response(data={"appointments": [], "total": 0}, message="No branches found, hence no appointments.")
        
    query = db.query(Appointment).filter(Appointment.branch_id.in_(branch_ids))
    
    if department_id:
        query = query.filter(Appointment.department_id == department_id)
        
    if doctor_id:
        query = query.filter(Appointment.doctor_id == doctor_id)
        
    if status:
        query = query.filter(Appointment.status == status)
        
    if date:
        query = query.join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id).filter(AppointmentSlot.date == date)
        
    if search:
        search_term = f"%{search}%"
        from sqlalchemy import or_
        query = query.join(Patient, Appointment.patient_id == Patient.id).outerjoin(Doctor, Appointment.doctor_id == Doctor.user_id).filter(
            or_(
                Patient.full_name.ilike(search_term),
                Patient.patient_uid.ilike(search_term),
                Doctor.full_name.ilike(search_term)
            )
        )
        
    query = query.order_by(Appointment.id.desc())
    total = query.count()
    appointments = query.offset(offset).limit(limit).all()
    
    result = []
    for apt in appointments:
        slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == apt.slot_id).first()
        result.append({
            "id": apt.id,
            "appointment_uid": apt.appointment_uid,
            "token_number": apt.token_number,
            "patient_name": apt.patient.full_name if apt.patient else "Unknown Patient",
            "patient_uid": apt.patient.patient_uid if apt.patient else "N/A",
            "patient_phone": apt.patient.mobile if apt.patient else "N/A",
            "doctor_name": apt.doctor.full_name if apt.doctor else "Unknown Doctor",
            "branch_name": apt.branch.name if apt.branch else "Unknown Branch",
            "department_name": apt.department.name if apt.department else "Unknown Department",
            "date": str(slot.date) if slot else "N/A",
            "start_time": slot.start_time if slot else "N/A",
            "end_time": slot.end_time if slot else "N/A",
            "status": apt.status,
            "appointment_type": apt.appointment_type,
            "consultation_mode": apt.consultation_mode
        })
        
    return success_response(data={"appointments": result, "total": total}, message="Appointments retrieved successfully")


# ─────────────────────────────────────────────────────────────
# DOCTOR INVITATIONS MANAGEMENT
# ─────────────────────────────────────────────────────────────

@router.get("/{org_id}/invitations", summary="List Organization Invitations")
def list_invitations(
    org_id: str,
    status: str = Query(None, description="Optional status filter (e.g. PENDING)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    query = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.organization_id == org.id,
        OrganizationInvitation.is_deleted == False
    )
    
    if status:
        query = query.filter(OrganizationInvitation.status == status)
        
    invites = query.order_by(OrganizationInvitation.created_at.desc()).all()
    
    # Resolve creator email
    from models import User as UserModel
    creator_ids = [inv.invited_by_id for inv in invites if inv.invited_by_id]
    creators = db.query(UserModel).filter(UserModel.id.in_(creator_ids)).all() if creator_ids else []
    creator_map = {c.id: c.email for c in creators}
    
    # Resolve branch name
    branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
    branch_map = {b.id: b.name for b in branches}
    
    # Resolve department name
    branch_ids = [b.id for b in branches]
    departments = db.query(Department).filter(Department.branch_id.in_(branch_ids)).all() if branch_ids else []
    dept_map = {d.id: d.name for d in departments}

    result = []
    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    
    for inv in invites:
        status_val = inv.status.value if hasattr(inv.status, 'value') else str(inv.status)
        if status_val == "PENDING" and inv.expires_at < now_utc:
            status_val = "EXPIRED"
            
        result.append({
            "id": inv.id,
            "email": inv.email,
            "branch_id": inv.branch_id,
            "branch_name": branch_map.get(inv.branch_id, "Unknown Branch"),
            "department_id": inv.department_id,
            "department_name": dept_map.get(inv.department_id, "N/A") if inv.department_id else "N/A",
            "designation": inv.designation,
            "role": inv.role.value if hasattr(inv.role, 'value') else str(inv.role),
            "invite_token": "", # Hashed in DB, do not expose
            "status": status_val,
            "expires_at": inv.expires_at.isoformat(),
            "created_by_email": creator_map.get(inv.invited_by_id, "System"),
            "created_at": inv.created_at.isoformat() if inv.created_at else None
        })
        
    return success_response(data=result, message="Invitations retrieved successfully")


@router.post("/{org_id}/invitations/{invite_id}/resend", summary="Resend Staff Invitation")
def resend_invitation(
    org_id: str,
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import secrets
    import hashlib
    from datetime import datetime, timedelta, timezone
    
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    invite = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.id == invite_id,
        OrganizationInvitation.organization_id == org.id,
        OrganizationInvitation.is_deleted == False
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    invite.invite_token_hash = token_hash
    invite.status = InvitationStatus.PENDING
    invite.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
    invite.invited_by_id = current_user.id
    db.commit()
    
    # Send email
    from services.email_service import send_member_invitation_email
    invite_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/register?invite={raw_token}"
    dept_name = ""
    if invite.department_id:
        dept = db.query(Department).filter(Department.id == invite.department_id).first()
        if dept:
            dept_name = dept.name
    branch = db.query(Branch).filter(Branch.id == invite.branch_id).first()
    branch_name = branch.name if branch else "Main Branch"
    
    send_member_invitation_email(
        to_email=invite.email,
        org_name=org.name,
        org_vritan_id=org.vritan_id,
        branch_name=branch_name,
        department_name=dept_name,
        designation=invite.designation,
        role=invite.role.value if hasattr(invite.role, 'value') else str(invite.role),
        invite_link=invite_link
    )
    
    # Log audit event
    audit = AuditService(AuditRepository(db))
    audit.log_enterprise_event(
        event_type="INVITATION_RESENT",
        entity_type="Invitation",
        entity_id=str(invite.id),
        action=f"Invitation to {invite.email} resent by {current_user.email}",
        organization_id=org.id,
        user_id=current_user.id
    )
    
    return success_response(data={"id": invite.id, "status": "PENDING", "raw_token": raw_token}, message="Invitation resent successfully")


@router.post("/{org_id}/invitations/{invite_id}/cancel", summary="Cancel/Revoke Staff Invitation")
def cancel_invitation(
    org_id: str,
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org = resolve_org(org_id, db)
    verify_admin_access(org, current_user, db)
    
    invite = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.id == invite_id,
        OrganizationInvitation.organization_id == org.id,
        OrganizationInvitation.is_deleted == False
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    invite.status = InvitationStatus.CANCELLED
    db.commit()
    
    # Log audit event
    audit = AuditService(AuditRepository(db))
    audit.log_enterprise_event(
        event_type="INVITATION_CANCELLED",
        entity_type="Invitation",
        entity_id=str(invite.id),
        action=f"Invitation to {invite.email} cancelled by {current_user.email}",
        organization_id=org.id,
        user_id=current_user.id
    )
    
    return success_response(data={"id": invite.id, "status": "CANCELLED"}, message="Invitation cancelled successfully")
@router.get("/{org_id}/patients", summary="Get Organization Patients")
def get_organization_patients(
    org_id: str,
    search: Optional[str] = Query(None),
    branch_id: Optional[int] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from appointment_models import Appointment
    from models import Patient
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id, Branch.organization_id == org.id).first()
        if not branch:
            raise HTTPException(status_code=403, detail="Branch does not belong to this organization")
        branch_ids = [branch_id]
    else:
        branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        
    if not branch_ids:
        return success_response(data={"patients": [], "total": 0}, message="No patients found")
        
    query = db.query(Patient).join(Appointment, Appointment.patient_id == Patient.id).filter(
        Appointment.branch_id.in_(branch_ids)
    )
    
    if search:
        search_term = f"%{search}%"
        from sqlalchemy import or_
        query = query.filter(or_(
            Patient.full_name.ilike(search_term),
            Patient.patient_uid.ilike(search_term),
            Patient.mobile.ilike(search_term),
            Patient.email.ilike(search_term)
        ))
        
    query = query.distinct()
    total = query.count()
    patients = query.offset(offset).limit(limit).all()
    
    result = []
    for p in patients:
        latest_apt = db.query(Appointment).filter(
            Appointment.patient_id == p.id,
            Appointment.branch_id.in_(branch_ids)
        ).order_by(Appointment.id.desc()).first()
        
        branch_name = "N/A"
        apt_date = "N/A"
        apt_status = "N/A"
        
        if latest_apt:
            if latest_apt.branch:
                branch_name = latest_apt.branch.name
            apt_status = latest_apt.status
            from appointment_models import AppointmentSlot
            slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == latest_apt.slot_id).first()
            if slot:
                apt_date = str(slot.date)
                
        result.append({
            "id": p.id,
            "patient_uid": p.patient_uid,
            "full_name": p.full_name,
            "mobile": p.mobile,
            "email": p.email,
            "gender": p.gender,
            "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
            "branch_name": branch_name,
            "latest_appointment_date": apt_date,
            "status": apt_status
        })
        
    return success_response(data={"patients": result, "total": total}, message="Patients retrieved successfully")


@router.get("/{org_id}/laboratories", summary="Get Organization Laboratories")
def get_organization_laboratories(
    org_id: str,
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from org_models import OrganizationLab
    from models import Laboratory
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    query = db.query(Laboratory).join(OrganizationLab, OrganizationLab.laboratory_id == Laboratory.id).filter(
        OrganizationLab.organization_id == org.id
    )
    
    total = query.count()
    labs = query.offset(offset).limit(limit).all()
    
    result = []
    for lab in labs:
        result.append({
            "id": lab.id,
            "name": lab.name,
            "email": lab.email,
            "phone": lab.phone,
            "license_number": lab.license_number if hasattr(lab, 'license_number') else getattr(lab, 'registration_number', 'N/A'),
            "status": lab.status if hasattr(lab, 'status') else 'ACTIVE'
        })
        
    return success_response(data={"laboratories": result, "total": total}, message="Laboratories retrieved successfully")


@router.get("/{org_id}/pharmacies", summary="Get Organization Pharmacies")
def get_organization_pharmacies(
    org_id: str,
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from org_models import OrganizationPharmacy
    from pharmacy_models import Pharmacy
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    query = db.query(Pharmacy).join(OrganizationPharmacy, OrganizationPharmacy.pharmacy_id == Pharmacy.id).filter(
        OrganizationPharmacy.organization_id == org.id
    )
    
    total = query.count()
    pharmacies = query.offset(offset).limit(limit).all()
    
    result = []
    for pharm in pharmacies:
        result.append({
            "id": pharm.id,
            "name": pharm.name,
            "email": pharm.email,
            "phone": pharm.phone,
            "license_number": pharm.license_number if hasattr(pharm, 'license_number') else 'N/A',
            "status": pharm.status if hasattr(pharm, 'status') else 'ACTIVE'
        })
        
    return success_response(data={"pharmacies": result, "total": total}, message="Pharmacies retrieved successfully")


@router.get("/{org_id}/medical-records", summary="Get Organization Medical Records")
def get_organization_medical_records(
    org_id: str,
    search: Optional[str] = Query(None),
    branch_id: Optional[int] = Query(None),
    record_type: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import MedicalRecord, Patient
    from appointment_models import Appointment
    from sqlalchemy import or_
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id, Branch.organization_id == org.id).first()
        if not branch:
            raise HTTPException(status_code=403, detail="Branch does not belong to this organization")
        branch_ids = [branch_id]
    else:
        branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        
    if not branch_ids:
        return success_response(data={"records": [], "total": 0}, message="No records found")
        
    patients_query = db.query(Patient.id).join(Appointment, Appointment.patient_id == Patient.id).filter(
        Appointment.branch_id.in_(branch_ids)
    )
    
    query = db.query(MedicalRecord).filter(MedicalRecord.patient_id.in_(patients_query))
    
    if record_type:
        query = query.filter(MedicalRecord.record_type == record_type)
        
    if search:
        search_term = f"%{search}%"
        query = query.join(Patient, Patient.id == MedicalRecord.patient_id).filter(
            or_(
                Patient.full_name.ilike(search_term),
                Patient.patient_uid.ilike(search_term),
                MedicalRecord.notes.ilike(search_term)
            )
        )
        
    query = query.order_by(MedicalRecord.uploaded_at.desc())
    total = query.count()
    records = query.offset(offset).limit(limit).all()
    
    result = []
    for rec in records:
        patient = db.query(Patient).filter(Patient.id == rec.patient_id).first()
        uploader = db.query(User).filter(User.id == rec.uploaded_by).first()
        
        uploader_name = "Unknown"
        if uploader:
            doc = db.query(Doctor).filter(Doctor.user_id == uploader.id).first()
            if doc:
                uploader_name = f"Dr. {doc.full_name}"
            else:
                uploader_name = uploader.email
                
        branch_name = "N/A"
        latest_apt = db.query(Appointment).filter(
            Appointment.patient_id == rec.patient_id,
            Appointment.branch_id.in_(branch_ids)
        ).order_by(Appointment.id.desc()).first()
        
        if latest_apt and latest_apt.branch:
            branch_name = latest_apt.branch.name
            
        result.append({
            "id": rec.id,
            "patient_name": patient.full_name if patient else "Unknown",
            "patient_uid": patient.patient_uid if patient else "Unknown",
            "record_type": rec.record_type,
            "uploaded_at": rec.uploaded_at.isoformat() if rec.uploaded_at else None,
            "uploaded_by_name": uploader_name,
            "branch_name": branch_name,
            "notes": rec.notes,
            "view_url": f"/api/v1/organizations/{org_id}/medical-records/{rec.id}/view"
        })
        
    return success_response(data={"records": result, "total": total}, message="Medical records retrieved successfully")


@router.get("/{org_id}/medical-records/{record_id}/view", summary="View Secure Medical Record")
def view_medical_record(
    org_id: str,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import MedicalRecord, Patient
    from appointment_models import Appointment
    from fastapi.responses import FileResponse
    import os
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    record = db.query(MedicalRecord).filter(MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found")
        
    branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
    branch_ids = [b.id for b in branches]
    
    apt = db.query(Appointment).filter(
        Appointment.patient_id == record.patient_id,
        Appointment.branch_id.in_(branch_ids)
    ).first()
    
    if not apt:
        raise HTTPException(status_code=403, detail="Record does not belong to a patient of this organization")
        
    file_path = record.file_url
    if file_path.startswith('/'):
        file_path = file_path[1:]
        
    if not os.path.exists(file_path):
        fallback_path = os.path.join("uploads", os.path.basename(file_path))
        if os.path.exists(fallback_path):
            file_path = fallback_path
        else:
            raise HTTPException(status_code=404, detail="File not found on server")
            
    return FileResponse(file_path, filename=record.original_filename)
