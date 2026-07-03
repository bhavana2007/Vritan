# backend/services/email_service.py

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "medilockeradmin@gmail.com")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)


def _log_email_config():
    """Log email configuration status (without exposing passwords)."""
    print("EMAIL STARTED - Checking configuration...")
    print(f"SMTP_SERVER: {SMTP_SERVER}")
    print(f"SMTP_PORT: {SMTP_PORT}")
    print(f"SMTP_USERNAME: {'SET' if SMTP_USERNAME else 'MISSING'}")
    print(f"SMTP_PASSWORD: {'SET' if SMTP_PASSWORD else 'MISSING'}")
    print(f"ADMIN_EMAIL: {ADMIN_EMAIL}")
    print(f"FROM_EMAIL: {FROM_EMAIL}")


def _send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using SMTP."""
    _log_email_config()
    
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print("EMAIL FAILED - SMTP_USERNAME or SMTP_PASSWORD missing")
        print("Please set SMTP_USERNAME and SMTP_PASSWORD in your .env file")
        return False
    
    print(f"EMAIL PREPARED - Sending to {to_email}")
    print(f"Subject: {subject}")
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email
        
        html_part = MIMEText(html_content, "html")
        msg.attach(html_part)
        
        print(f"EMAIL SENDING - Connecting to {SMTP_SERVER}:{SMTP_PORT}")
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            print("EMAIL SENDING - Starting TLS")
            server.starttls()
            print("EMAIL SENDING - Logging in")
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            print("EMAIL SENDING - Sending message")
            server.send_message(msg)
        
        print(f"EMAIL SENT - Successfully sent to {to_email}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"EMAIL FAILED - SMTP Authentication Error: {e}")
        print("Please check your SMTP_USERNAME and SMTP_PASSWORD")
        return False
    except smtplib.SMTPException as e:
        print(f"EMAIL FAILED - SMTP Error: {e}")
        return False
    except Exception as e:
        print(f"EMAIL FAILED - Unexpected error: {e}")
        return False


def send_doctor_verification_request_to_admin(
    doctor_name: str,
    doctor_email: str,
    doctor_phone: str,
    medical_license_number: str,
    hospital: str,
    specialization: Optional[str] = None,
    years_of_experience: Optional[int] = None,
) -> bool:
    """Send email to admin about new doctor verification request."""
    
    subject = "Doctor Verification Request - MediLocker"
    
    html_content = f"""
    <html>
    <body>
        <h2>New Doctor Registration Verification Request</h2>
        <p>A new doctor has registered and requires verification:</p>
        
        <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
            <tr>
                <td><strong>Doctor Name:</strong></td>
                <td>{doctor_name}</td>
            </tr>
            <tr>
                <td><strong>Email:</strong></td>
                <td>{doctor_email}</td>
            </tr>
            <tr>
                <td><strong>Phone:</strong></td>
                <td>{doctor_phone}</td>
            </tr>
            <tr>
                <td><strong>Medical License Number:</strong></td>
                <td>{medical_license_number}</td>
            </tr>
            <tr>
                <td><strong>Hospital:</strong></td>
                <td>{hospital}</td>
            </tr>
            <tr>
                <td><strong>Specialization:</strong></td>
                <td>{specialization or 'Not specified'}</td>
            </tr>
            <tr>
                <td><strong>Years of Experience:</strong></td>
                <td>{years_of_experience or 'Not specified'}</td>
            </tr>
        </table>
        
        <p>Please review the verification document and approve or reject this request through the admin panel.</p>
        
        <hr>
        <p style="color: gray; font-size: 12px;">This is an automated email from MediLocker.</p>
    </body>
    </html>
    """
    
    return _send_email(ADMIN_EMAIL, subject, html_content)


def send_doctor_approval_email(
    doctor_email: str,
    doctor_name: str,
) -> bool:
    """Send approval email to doctor."""
    
    subject = "Your MediLocker Account Has Been Approved"
    
    html_content = f"""
    <html>
    <body>
        <h2>Congratulations, {doctor_name}!</h2>
        <p>Your MediLocker doctor account has been approved.</p>
        
        <p>You can now:</p>
        <ul>
            <li>Search for patients using their Patient ID</li>
            <li>Request access to patient medical records</li>
            <li>View and analyze prescription data</li>
        </ul>
        
        <p>Please log in to your account to get started.</p>
        
        <hr>
        <p style="color: gray; font-size: 12px;">This is an automated email from MediLocker.</p>
    </body>
    </html>
    """
    
    return _send_email(doctor_email, subject, html_content)


def send_doctor_rejection_email(
    doctor_email: str,
    doctor_name: str,
) -> bool:
    """Send rejection email to doctor."""
    
    subject = "Your MediLocker Account Registration Status"
    
    html_content = f"""
    <html>
    <body>
        <h2>Registration Update</h2>
        <p>Dear {doctor_name},</p>
        
        <p>We regret to inform you that your MediLocker doctor account registration has been rejected.</p>
        
        <p>If you believe this is an error or would like to submit additional verification documents, please contact our support team.</p>
        
        <hr>
        <p style="color: gray; font-size: 12px;">This is an automated email from MediLocker.</p>
    </body>
    </html>
    """
    
    return _send_email(doctor_email, subject, html_content)
