"""Dedicated admin authentication and protected admin endpoints."""
import os
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
from pydantic import BaseModel
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
    print(f"AUTH DEBUG - Authorization header: {authorization[:25] if authorization else None}...")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        print(f"AUTH DEBUG - Decoded payload: {payload}")
        admin_id = int(payload.get("sub", ""))
        print(f"AUTH DEBUG - Token role: {payload.get('role')}, User ID: {admin_id}")
    except (InvalidTokenError, TypeError, ValueError) as e:
        print(f"AUTH DEBUG - Decode failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    if payload.get("role") != "admin":
        print(f"AUTH DEBUG - Rejecting role: {payload.get('role')}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if admin:
        print(f"AUTH DEBUG - Admin found: {admin.email}")
    else:
        print(f"AUTH DEBUG - Admin NOT found for ID {admin_id}")
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account not found or inactive",
        )
    return admin


@router.post("/login", response_model=LoginResponse)
def admin_login(credentials: AdminLoginRequest, db: Session = Depends(get_db)):
    import re
    identifier = credentials.identifier
    # Strip markdown if accidentally pasted (e.g., [email](mailto:email))
    match = re.search(r'\[(.*?)\]\(.*?\)', identifier)
    if match:
        identifier = match.group(1)
        
    email = str(identifier).strip().lower().replace("mailto:", "")
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
    print("=== ADMIN ENDPOINT HIT ===")
    del current_admin
    print(f"ADMIN DOCTORS - Querying Doctor table with status_filter: {status_filter}")
    query = db.query(Doctor)
    print(f"ADMIN DOCTORS - Base Query Row Count: {query.count()}")
    
    if status_filter == "pending":
        query = query.filter(Doctor.verification_status.in_(["PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"]))
    elif status_filter != "all":
        query = query.filter(Doctor.verification_status == status_filter)
        
    print(f"ADMIN DOCTORS - Generated SQL: {query}")
    doctors = query.order_by(Doctor.created_at.desc(), Doctor.user_id.desc()).all()
    print(f"ADMIN DOCTORS - Found {len(doctors)} doctors post-filtering")
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
    doctor.verification_status = "VERIFIED"
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


@router.get("/organizations/pending")
def admin_pending_organizations(
    current_admin: Admin = Depends(require_current_admin),
    db: Session = Depends(get_db),
):
    """Fetch all pending stakeholder organization applications for verification."""
    from org_models import Organization
    from pharmacy_models import Pharmacy
    from models import GovernmentAuthority, Doctor

    hospitals = db.query(Organization).filter(Organization.verification_status.in_(["PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"])).all()
    pharmacies = db.query(Pharmacy).filter(Pharmacy.verification_status.in_(["PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"])).all()
    gov_authorities = db.query(GovernmentAuthority).filter(GovernmentAuthority.verification_status.in_(["PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"])).all()
    doctors = db.query(Doctor).filter(Doctor.verification_status.in_(["PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"])).all()
    from org_models import Branch
    branches = db.query(Branch).filter(Branch.verification_status.in_(["PENDING_ADMIN_VERIFICATION", "PENDING_ADMIN_APPROVAL", "pending"])).all()

    return {
        "hospitals": [
            {
                "id": h.id,
                "name": h.name,
                "email": h.official_email or h.email,
                "vritan_id": h.vritan_id,
                "status": h.verification_status,
                "reg_number": h.registration_number,
                "type": h.organization_type,
                "docs": {
                    "reg_cert": h.reg_cert_url,
                    "nabh_cert": h.nabh_cert_url,
                    "gst_doc": h.gst_doc_url,
                    "pan_doc": h.pan_doc_url,
                    "hospital_license": h.hospital_license_url
                }
            } for h in hospitals
        ],
        "pharmacies": [
            {
                "id": p.id,
                "name": p.name,
                "email": p.official_email,
                "vritan_id": p.vritan_id,
                "status": p.verification_status,
                "drug_license": p.drug_license_number,
                "docs": {
                    "drug_license": p.drug_license_doc_url,
                    "gst_doc": p.gst_doc_url,
                    "owner_id": p.owner_id_doc_url,
                    "pharmacist_license": p.pharmacist_license_doc_url,
                    "store_image": p.store_image_url
                }
            } for p in pharmacies
        ],
        "government_authorities": [
            {
                "id": g.id,
                "agency_name": g.agency_name,
                "email": g.official_email,
                "vritan_id": g.vritan_id,
                "status": g.verification_status,
                "jurisdiction": f"{g.jurisdiction_level} - {g.jurisdiction_region}",
                "officer": g.authorized_officer_name,
                "docs": {
                    "gov_id_card": g.gov_id_card_url,
                    "authorization_letter": g.gov_authorization_letter_url,
                    "digital_signature": g.digital_signature_cert_url
                }
            } for g in gov_authorities
        ],
        "doctors": [
            {
                "id": d.user_id,
                "name": d.full_name,
                "email": d.email,
                "vritan_id": d.vritan_id,
                "status": d.verification_status,
                "license": d.medical_license_number,
                "hospital": d.hospital,
                "docs": {
                    "verification_doc": d.verification_document_url
                }
            } for d in doctors
        ],
        "branches": [
            {
                "id": b.id,
                "name": b.name,
                "email": b.email,
                "vritan_id": b.branch_uid,
                "status": b.verification_status,
                "organization_name": b.organization.name if b.organization else "Unknown",
                "docs": {}
            } for b in branches
        ]
    }


@router.post("/organizations/{org_type}/{org_id}/action")
def admin_organization_action(
    org_type: str,
    org_id: int,
    payload: dict,
    current_admin: Admin = Depends(require_current_admin),
    db: Session = Depends(get_db),
):
    """Approve, Reject, Suspend, or Request Docs for any stakeholder organization."""
    import uuid
    action = payload.get("action", "").upper() # 'APPROVE', 'REJECT', 'SUSPEND', 'REQUEST_DOCS'
    reason = payload.get("reason", "")

    from org_models import Organization, AuditLog, OrganizationMembership, Branch
    from pharmacy_models import Pharmacy
    from models import GovernmentAuthority, Doctor, Laboratory, LabTechnician, User as UserModel
    from services.otp_service import log_security_event
    from services.email_service import send_approval_email, send_rejection_email

    target_obj = None
    vritan_prefix = "VR-HOSP-" if org_type == "hospital" else "VR-PHAR-" if org_type == "pharmacy" else "VR-GOV-" if org_type == "government" else "VR-LAB-" if org_type in ("lab", "laboratory") else "VR-DOC-"

    if org_type == "hospital":
        target_obj = db.query(Organization).filter(Organization.id == org_id).first()
    elif org_type == "pharmacy":
        target_obj = db.query(Pharmacy).filter(Pharmacy.id == org_id).first()
    elif org_type == "government":
        target_obj = db.query(GovernmentAuthority).filter(GovernmentAuthority.id == org_id).first()
    elif org_type == "doctor":
        target_obj = db.query(Doctor).filter(Doctor.user_id == org_id).first()
    elif org_type in ("lab", "laboratory"):
        target_obj = db.query(Laboratory).filter(Laboratory.id == org_id).first()
    elif org_type == "branch":
        target_obj = db.query(Branch).filter(Branch.id == org_id).first()

    if not target_obj:
        raise HTTPException(status_code=404, detail="Organization record not found")

    old_status = getattr(target_obj, 'verification_status', 'UNKNOWN')
    new_status = old_status

    if action == "APPROVE":
        new_status = "APPROVED"
        target_obj.verification_status = "APPROVED"
        if hasattr(target_obj, 'is_verified'):
            target_obj.is_verified = True
        if hasattr(target_obj, 'is_active'):
            target_obj.is_active = True
        if hasattr(target_obj, 'status'):
            target_obj.status = "ACTIVE"
        if hasattr(target_obj, 'super_admin_approved'):
            target_obj.super_admin_approved = True
        if hasattr(target_obj, 'vritan_id') and not target_obj.vritan_id:
            if org_type == "hospital":
                import secrets as _secrets
                import string as _string
                alphabet = _string.ascii_uppercase + _string.digits
                code = ''.join(_secrets.choice(alphabet) for _ in range(8))
                target_obj.vritan_id = f"VR-HOSP-{code}"
            else:
                target_obj.vritan_id = f"{vritan_prefix}{uuid.uuid4().hex[:6].upper()}"
        _vid = getattr(target_obj, 'vritan_id', getattr(target_obj, 'branch_uid', ''))
        print(f"[ADMIN_APPROVE] {org_type} #{org_id} approved. vritan_id={_vid}")
    elif action == "REJECT":
        new_status = "REJECTED"
        target_obj.verification_status = "REJECTED"
        if hasattr(target_obj, 'is_verified'):
            target_obj.is_verified = False
        if hasattr(target_obj, 'is_active'):
            target_obj.is_active = False
        if hasattr(target_obj, 'status'):
            target_obj.status = "REJECTED"
        if hasattr(target_obj, 'super_admin_approved'):
            target_obj.super_admin_approved = False
    elif action == "SUSPEND":
        new_status = "SUSPENDED"
        target_obj.verification_status = "SUSPENDED"
        if hasattr(target_obj, 'is_verified'):
            target_obj.is_verified = False
        if hasattr(target_obj, 'is_active'):
            target_obj.is_active = False
        if hasattr(target_obj, 'status'):
            target_obj.status = "SUSPENDED"

    # Resolve associated User and update user status
    user = None
    recipient_email = None

    if org_type == "hospital":
        recipient_email = target_obj.official_email or target_obj.email
        membership = db.query(OrganizationMembership).filter(OrganizationMembership.organization_id == org_id, OrganizationMembership.role == "admin").first()
        if membership:
            user = db.query(UserModel).filter(UserModel.id == membership.user_id).first()
    elif org_type == "pharmacy":
        recipient_email = target_obj.official_email
        user = db.query(UserModel).filter(UserModel.id == target_obj.user_id).first()
    elif org_type == "government":
        recipient_email = target_obj.official_email
        user = db.query(UserModel).filter(UserModel.id == target_obj.user_id).first()
    elif org_type == "doctor":
        recipient_email = target_obj.email
        user = db.query(UserModel).filter(UserModel.id == target_obj.user_id).first()
    elif org_type in ("lab", "laboratory"):
        tech = db.query(LabTechnician).filter(LabTechnician.laboratory_id == org_id).first()
        if tech:
            recipient_email = tech.email
            user = db.query(UserModel).filter(UserModel.id == tech.user_id).first()
    elif org_type == "branch":
        recipient_email = target_obj.email
        membership = db.query(OrganizationMembership).filter(OrganizationMembership.organization_id == target_obj.organization_id, OrganizationMembership.role == "admin").first()
        if membership:
            user = db.query(UserModel).filter(UserModel.id == membership.user_id).first()

    if user:
        user.verification_status = new_status

    # Record Verification History for hospitals
    if org_type == "hospital":
        from org_models import HospitalVerificationHistory
        history = HospitalVerificationHistory(
            organization_id=org_id,
            from_status=old_status,
            to_status=new_status,
            admin_notes=reason or f"Action {action} performed by super admin",
            updated_by_admin_id=getattr(current_admin, 'id', None)
        )
        db.add(history)

    db.commit()

    # Log security audit event and send emails post-commit
    if user or recipient_email:
        email_addr = recipient_email or (user.email if user else "")
        u_id = user.id if user else None
        
        # 1. Audit log
        log_security_event(db, u_id, email_addr, f"SUPER_ADMIN_{action}", "SUCCESS", f"Performed {action} on {org_type} #{org_id}. Reason: {reason or 'N/A'}")

        # 2. Email Delivery and Account Creation
        if action == "APPROVE" and email_addr:
            if org_type == "branch":
                import secrets as _sec
                from datetime import datetime as _dt, timedelta as _td, timezone as _tz
                from models import EmailVerificationToken, User as UserModel
                from org_models import OrganizationMembership
                from security import hash_password
                
                # 1. Create/Reconcile Branch Admin User
                branch_admin_email = target_obj.admin_email
                branch_admin_name = target_obj.admin_name
                branch_admin_mobile = getattr(target_obj, 'admin_mobile', '')
                
                branch_user = db.query(UserModel).filter(UserModel.email == branch_admin_email).first()
                if not branch_user:
                    from security import hash_password
                    branch_user = UserModel(
                        email=branch_admin_email,
                        phone_number=branch_admin_mobile,
                        role="BRANCH_ADMIN",
                        password=hash_password(_sec.token_urlsafe(16)), # Temp password
                        verification_status="PENDING_EMAIL_VERIFICATION",
                        vritan_id=f"VR-BA-{_sec.token_hex(4).upper()}"
                    )
                    db.add(branch_user)
                    db.commit()
                    db.refresh(branch_user)
                    
                # 2. Create OrganizationMembership
                membership = db.query(OrganizationMembership).filter(
                    OrganizationMembership.user_id == branch_user.id,
                    OrganizationMembership.organization_id == target_obj.organization_id,
                    OrganizationMembership.branch_id == target_obj.id
                ).first()
                
                if not membership:
                    membership = OrganizationMembership(
                        user_id=branch_user.id,
                        organization_id=target_obj.organization_id,
                        branch_id=target_obj.id,
                        role="BRANCH_ADMIN",
                        status="ACTIVE"
                    )
                    db.add(membership)
                    db.commit()
                    
                # 3. Generate Password Setup Token
                setup_token = _sec.token_urlsafe(48)
                expires_at = _dt.now(_tz.utc).replace(tzinfo=None) + _td(hours=24)
                token_rec = EmailVerificationToken(
                    token=setup_token,
                    user_id=branch_user.id,
                    email=branch_admin_email,
                    expires_at=expires_at,
                    is_used=False,
                    token_type="PASSWORD_SETUP"
                )
                db.add(token_rec)
                db.commit()
                
                frontend_base = os.getenv("FRONTEND_URL", "http://localhost:5173")
                setup_link = f"{frontend_base}/setup-password?token={setup_token}"
                
                _org_name = getattr(target_obj.organization, 'name', 'Organization') if target_obj.organization else 'Organization'
                _vritan_id = getattr(target_obj, 'vritan_id', '') or ''
                
                # Send email to Branch Admin
                from services.email_service import send_hospital_approval_email
                send_hospital_approval_email(
                    to_email=branch_admin_email,
                    org_name=target_obj.name,
                    admin_name=branch_admin_name,
                    vritan_id=_vritan_id,
                    setup_link=setup_link
                )
                
                # Send email to Main Admin (recipient_email)
                send_hospital_approval_email(
                    to_email=recipient_email,
                    org_name=target_obj.name,
                    admin_name="Main Admin",
                    vritan_id=_vritan_id,
                    setup_link=f"{frontend_base}/login" # Main admin just logs in
                )
                
                log_security_event(db, u_id, email_addr, "BRANCH_APPROVAL_EMAILS_SENT", "SUCCESS", f"Sent approval emails for branch {_vritan_id}")
                
            else:
                # Generate password setup token (24-hour expiry) using EmailVerificationToken table
                import secrets as _sec
                from datetime import datetime as _dt, timedelta as _td, timezone as _tz
                from models import EmailVerificationToken
                setup_token = _sec.token_urlsafe(48)
                # Look up the user linked to this org to get user_id
                _user_for_token = user  # already resolved above
                expires_at = _dt.now(_tz.utc).replace(tzinfo=None) + _td(hours=24)
                token_rec = EmailVerificationToken(
                    token=setup_token,
                    user_id=_user_for_token.id if _user_for_token else 0,
                    email=email_addr,
                    expires_at=expires_at,
                    is_used=False,
                    token_type="PASSWORD_SETUP"
                )
                db.add(token_rec)
                db.commit()
                # Build setup link (frontend URL)
                frontend_base = os.getenv("FRONTEND_URL", "http://localhost:5173")
                setup_link = f"{frontend_base}/setup-password?token={setup_token}"
                # Resolve admin name
                _admin_name = getattr(target_obj, 'representative_name', None) or "Administrator"
                _org_name = getattr(target_obj, 'name', None) or getattr(target_obj, 'agency_name', None) or org_type.title()
                _vritan_id = getattr(target_obj, 'vritan_id', '') or ''
                # Send branded approval email
                from services.email_service import send_hospital_approval_email
                send_hospital_approval_email(
                    to_email=email_addr,
                    org_name=_org_name,
                    admin_name=_admin_name,
                    vritan_id=_vritan_id,
                    setup_link=setup_link
                )
                log_security_event(db, u_id, email_addr, "APPROVAL_EMAIL_SENT", "SUCCESS", f"Branded approval email with setup link sent. vritan_id={_vritan_id}")
                print(f"[ADMIN_APPROVE] Approval email sent to {email_addr}. Setup link generated.")
        elif action == "REJECT" and email_addr:
            send_rejection_email(email_addr, reason or "Invalid or incomplete registration documents.")
            log_security_event(db, u_id, email_addr, "REJECTION_EMAIL_SENT", "SUCCESS")

    return {
        "message": f"Organization {action} performed successfully",
        "org_type": org_type,
        "vritan_id": getattr(target_obj, 'vritan_id', None),
        "status": getattr(target_obj, 'verification_status', None)
    }


@router.get("/audit-logs")
def admin_audit_logs(
    current_admin: Admin = Depends(require_current_admin),
    db: Session = Depends(get_db),
):
    """Fetch system audit logs for administrative verification tracking."""
    from org_models import AuditLog
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "event_id": l.event_id,
            "event_type": l.event_type,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "action": l.action,
            "ip_address": l.ip_address,
            "status": l.status,
            "created_at": str(l.created_at) if hasattr(l, 'created_at') else None
        } for l in logs
    ]


@router.get("/verification-document/{entity_type}/{entity_id}")
def admin_get_verification_document(
    entity_type: str,
    entity_id: int,
    current_admin: Admin = Depends(require_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieve secure credentials/certificates uploaded by doctor or organization."""
    from fastapi.responses import FileResponse
    from pathlib import Path
    
    file_path = None
    if entity_type == "doctor":
        doc = db.query(Doctor).filter(Doctor.user_id == entity_id).first()
        if doc and doc.verification_document_url:
            file_path = doc.verification_document_url
    
    if not file_path:
        raise HTTPException(status_code=404, detail="Verification document path not found")
        
    # Standard uploads storage directory resolver
    upload_root = Path(__file__).resolve().parents[1]
    full_path = upload_root / file_path.lstrip("/")
    
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="Verification document file does not exist on disk")
        
    return FileResponse(path=str(full_path))
