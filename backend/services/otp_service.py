# backend/services/otp_service.py

import random
import hashlib
import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import User, EmailVerificationToken, VerificationState
from org_models import AuditLog
from services.email_service import send_otp_email


def log_security_event(db: Session, user_id: int | None, email: str, event_type: str, result_status: str, details: str = ""):
    """Print structured security audit log to console and persist in AuditLog table."""
    timestamp = datetime.datetime.utcnow().isoformat()
    role = "unknown"
    if user_id:
        u = db.query(User).filter(User.id == user_id).first()
        if u:
            role = u.role
            
    # Format exactly as requested: timestamp - user - role - event - result
    print(f"[SECURITY_AUDIT] {timestamp} | User: {email} (ID: {user_id}) | Role: {role} | Event: {event_type} | Result: {result_status} | Details: {details}")

    try:
        log_entry = AuditLog(
            user_id=user_id,
            event_type=event_type,
            entity_type="USER",
            entity_id=str(user_id or email),
            action=f"Event: {event_type}. Result: {result_status}. Details: {details}",
            status=result_status
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        print(f"Failed to save security audit log: {e}")


def generate_verification_otp(db: Session, user_id: int, email: str) -> str:
    """Generate, persist, and send a 6-digit verification OTP."""
    email_lower = email.strip().lower()
    
    # 1. Invalidate any existing active OTP tokens for this email
    active_tokens = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.email == email_lower,
        EmailVerificationToken.token_type == "OTP",
        EmailVerificationToken.is_used == False
    ).all()
    for t in active_tokens:
        t.is_used = True
    db.commit()

    # 2. Generate a random 6-digit OTP code
    otp = f"{random.randint(100000, 999999)}"
    hashed_otp = hashlib.sha256(otp.encode()).hexdigest()

    # 3. Persist OTP in database (10-minute TTL)
    token_obj = EmailVerificationToken(
        token=hashed_otp,
        user_id=user_id,
        email=email_lower,
        token_type="OTP",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
        is_used=False,
        attempt_count=0
    )
    db.add(token_obj)
    db.commit()

    # Log generation event (audit log)
    log_security_event(db, user_id, email_lower, "OTP_GENERATED", "SUCCESS")

    # 4. Decouple email dispatch from registration/database transaction
    sent = send_otp_email(email_lower, otp)
    if sent:
        log_security_event(db, user_id, email_lower, "OTP_EMAIL_SENT", "SUCCESS")
    else:
        log_security_event(db, user_id, email_lower, "OTP_EMAIL_SENT", "FAILED")

    return otp


def verify_verification_otp(db: Session, email: str, otp: str) -> dict:
    """Verify the submitted OTP, handle attempt limit, expiry, and transition status to PENDING_ADMIN_APPROVAL."""
    email_lower = email.strip().lower()
    otp_clean = otp.strip()

    # 1. Fetch active OTP record
    token_obj = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.email == email_lower,
        EmailVerificationToken.token_type == "OTP",
        EmailVerificationToken.is_used == False
    ).order_by(EmailVerificationToken.created_at.desc()).first()

    if not token_obj:
        log_security_event(db, None, email_lower, "OTP_VERIFICATION_FAILED", "FAILED", "No active OTP found")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active verification OTP request found."
        )

    # 2. Increment attempt count
    token_obj.attempt_count += 1
    db.commit()

    # 3. Check attempts limit (maximum 5 attempts)
    if token_obj.attempt_count > 5:
        token_obj.is_used = True
        db.commit()
        log_security_event(db, token_obj.user_id, email_lower, "OTP_VERIFICATION_FAILED", "FAILED", "Max attempts exceeded")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    # 4. Enforce expiry (10 minutes)
    if token_obj.expires_at < datetime.datetime.utcnow():
        token_obj.is_used = True
        db.commit()
        log_security_event(db, token_obj.user_id, email_lower, "OTP_VERIFICATION_FAILED", "FAILED", "OTP expired")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new OTP."
        )

    # 5. Compare hashes
    hashed_input = hashlib.sha256(otp_clean.encode()).hexdigest()
    if token_obj.token != hashed_input:
        log_security_event(db, token_obj.user_id, email_lower, "OTP_VERIFICATION_FAILED", "FAILED", f"Incorrect OTP (Attempt {token_obj.attempt_count}/5)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect verification code. Attempts: {token_obj.attempt_count}/5."
        )

    # 6. Correct OTP - invalidate token
    token_obj.is_used = True
    db.commit()

    # 7. Update verification statuses in a single database transaction
    # Search across all relevant entities that match the verified email and are pending verification
    target_status = VerificationState.PENDING_ADMIN_APPROVAL.value
    entities_updated = False
    
    # User model
    user = db.query(User).filter(
        User.email == email_lower, 
        User.verification_status == VerificationState.PENDING_EMAIL_VERIFICATION.value
    ).first()
    if user:
        user.verification_status = target_status
        entities_updated = True

    # Doctor model
    from models import Doctor, GovernmentAuthority, Laboratory
    doctor = db.query(Doctor).filter(
        Doctor.email == email_lower,
        Doctor.verification_status == VerificationState.PENDING_EMAIL_VERIFICATION.value
    ).first()
    if doctor:
        doctor.verification_status = target_status
        entities_updated = True
        
    # Government Authority
    gov = db.query(GovernmentAuthority).filter(
        GovernmentAuthority.official_email == email_lower,
        GovernmentAuthority.verification_status == VerificationState.PENDING_EMAIL_VERIFICATION.value
    ).first()
    if gov:
        gov.verification_status = target_status
        entities_updated = True
        
    # Organization model
    from org_models import Organization, Branch
    org = db.query(Organization).filter(
        Organization.email == email_lower,
        Organization.verification_status == VerificationState.PENDING_EMAIL_VERIFICATION.value
    ).first()
    if org:
        org.verification_status = target_status
        entities_updated = True
        
    # Branch model
    branch = db.query(Branch).filter(
        Branch.email == email_lower,
        Branch.verification_status == VerificationState.PENDING_EMAIL_VERIFICATION.value
    ).first()
    if branch:
        branch.verification_status = target_status
        entities_updated = True
        
    # Pharmacy and Laboratory do not have an official_email field that matches this schema reliably yet, 
    # skipping them to prevent attribute errors.

    if not entities_updated:
        # Fallback for backward compatibility or cases where email is verified but not PENDING_EMAIL_VERIFICATION
        fallback_user = db.query(User).filter(User.id == token_obj.user_id).first()
        if fallback_user and fallback_user.verification_status == VerificationState.PENDING_EMAIL_VERIFICATION.value:
            fallback_user.verification_status = target_status

    db.commit()
    log_security_event(db, token_obj.user_id, email_lower, "OTP_VERIFIED", "SUCCESS", "Matching entities moved to PENDING_ADMIN_APPROVAL")

    return {
        "message": "Email verified successfully.",
        "status": VerificationState.PENDING_ADMIN_APPROVAL.value
    }


def resend_verification_otp(db: Session, email: str) -> dict:
    """Enforce rate limits, generate a new OTP and send it."""
    email_clean = email.strip().lower()

    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found for this email address."
        )

    # 1. Enforce rate limit (Max 3 resends per hour)
    one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    resend_count = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.email == email_clean,
        EmailVerificationToken.token_type == "OTP",
        EmailVerificationToken.created_at >= one_hour_ago
    ).count()

    if resend_count >= 4:
        log_security_event(db, user.id, email_clean, "OTP_RESEND_FAILED", "FAILED", "Rate limit exceeded (3/hour)")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Resend limit exceeded. Maximum 3 resend requests per hour allowed."
        )

    # 2. Invalidate previous OTPs
    active_tokens = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.email == email_clean,
        EmailVerificationToken.token_type == "OTP",
        EmailVerificationToken.is_used == False
    ).all()
    for t in active_tokens:
        t.is_used = True
    db.commit()

    # 3. Generate a new OTP and send
    otp = f"{random.randint(100000, 999999)}"
    hashed_otp = hashlib.sha256(otp.encode()).hexdigest()

    token_obj = EmailVerificationToken(
        token=hashed_otp,
        user_id=user.id,
        email=email_clean,
        token_type="OTP",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=10),
        is_used=False,
        attempt_count=0
    )
    db.add(token_obj)
    db.commit()

    log_security_event(db, user.id, email_clean, "OTP_RESENT", "SUCCESS")

    sent = send_otp_email(email_clean, otp)
    if sent:
        log_security_event(db, user.id, email_clean, "OTP_RESEND_EMAIL_SENT", "SUCCESS")
    else:
        log_security_event(db, user.id, email_clean, "OTP_RESEND_EMAIL_SENT", "FAILED")

    return {"message": "A new OTP code has been sent to your email."}
