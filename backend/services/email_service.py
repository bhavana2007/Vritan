# backend/services/email_service.py

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SMTP_SERVER = os.getenv("SMTP_HOST", os.getenv("SMTP_SERVER", "smtp.gmail.com"))
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_EMAIL", os.getenv("SMTP_USERNAME", "medilockeradmin@gmail.com"))
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "zmnrdqaxseqcjifm")
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
        
        timeout_seconds = 15
        print(f"EMAIL SENDING - Connecting to server '{SMTP_SERVER}' on port {SMTP_PORT} (timeout={timeout_seconds}s)")
        
        # Explicit smtplib.SMTP initialization with socket timeout
        server = smtplib.SMTP(host=SMTP_SERVER, port=int(SMTP_PORT), timeout=timeout_seconds)
        
        try:
            print("EMAIL SENDING - Connection established, sending EHLO")
            ehlo_resp = server.ehlo()
            print(f"EMAIL SENDING - EHLO response: {ehlo_resp}")
            
            print("EMAIL SENDING - Starting TLS / STARTTLS")
            starttls_resp = server.starttls()
            print(f"EMAIL SENDING - STARTTLS response: {starttls_resp}")
            
            print("EMAIL SENDING - Sending EHLO post-TLS")
            ehlo_post_resp = server.ehlo()
            print(f"EMAIL SENDING - Post-TLS EHLO response: {ehlo_post_resp}")
            
            print(f"EMAIL SENDING - Authenticating as user '{SMTP_USERNAME}'")
            login_resp = server.login(SMTP_USERNAME, SMTP_PASSWORD)
            print(f"EMAIL SENDING - LOGIN response: {login_resp}")
            
            print("EMAIL SENDING - Dispatching message body via send_message")
            send_resp = server.send_message(msg)
            print(f"EMAIL SENDING - Send message response: {send_resp}")
            
            print(f"EMAIL SENT - Successfully sent to {to_email}")
            return True
        finally:
            try:
                print("EMAIL SENDING - Terminating SMTP connection session")
                server.quit()
            except Exception as quit_err:
                print(f"EMAIL WARNING - Error during SMTP server quit execution: {quit_err}")
                
    except smtplib.SMTPAuthenticationError as e:
        print(f"EMAIL FAILED - SMTP Authentication Error: {e}")
        print("Please check your SMTP_USERNAME and SMTP_PASSWORD")
        return False
    except smtplib.SMTPException as e:
        print(f"EMAIL FAILED - SMTP Error: {e}")
        return False
    except Exception as e:
        print(f"EMAIL FAILED - Connection unexpected error: {e}")
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
    
    subject = "Doctor Verification Request - Vritan"
    
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
        <p style="color: gray; font-size: 12px;">This is an automated email from Vritan.</p>
    </body>
    </html>
    """
    
    return _send_email(ADMIN_EMAIL, subject, html_content)


def send_doctor_approval_email(
    doctor_email: str,
    doctor_name: str,
) -> bool:
    """Send approval email to doctor."""
    
    subject = "Your Vritan Account Has Been Approved"
    
    html_content = f"""
    <html>
    <body>
        <h2>Congratulations, {doctor_name}!</h2>
        <p>Your Vritan doctor account has been approved.</p>
        
        <p>You can now:</p>
        <ul>
            <li>Search for patients using their Patient ID</li>
            <li>Request access to patient medical records</li>
            <li>View and analyze prescription data</li>
        </ul>
        
        <p>Please log in to your account to get started.</p>
        
        <hr>
        <p style="color: gray; font-size: 12px;">This is an automated email from Vritan.</p>
    </body>
    </html>
    """
    
    return _send_email(doctor_email, subject, html_content)


def send_doctor_rejection_email(
    doctor_email: str,
    doctor_name: str,
) -> bool:
    """Send rejection email to doctor."""
    
    subject = "Your Vritan Account Registration Status"
    
    html_content = f"""
    <html>
    <body>
        <h2>Registration Update</h2>
        <p>Dear {doctor_name},</p>
        
        <p>We regret to inform you that your Vritan doctor account registration has been rejected.</p>
        
        <p>If you believe this is an error or would like to submit additional verification documents, please contact our support team.</p>
        
        <hr>
        <p style="color: gray; font-size: 12px;">This is an automated email from Vritan.</p>
    </body>
    </html>
    """
    
    return _send_email(doctor_email, subject, html_content)


def send_prescription_notification_email(
    patient_email: str,
    patient_name: str,
    doctor_name: str,
    diagnosis: str,
    prescription_id: str,
) -> bool:
    """Send email to patient about a new digital prescription."""
    subject = "New Prescription Created - Vritan"
    
    html_content = f"""
    <html>
    <body>
        <h2>New Prescription Created</h2>
        <p>Dear {patient_name},</p>
        <p>Dr. {doctor_name} has created a new digital prescription for you on Vritan.</p>
        <p><strong>Prescription ID:</strong> {prescription_id}</p>
        <p><strong>Diagnosis:</strong> {diagnosis}</p>
        <p>You can view the full details and download/print this prescription by logging into your Vritan Patient Portal.</p>
        <hr>
        <p style="color: gray; font-size: 12px;">This is an automated email from Vritan.</p>
    </body>
    </html>
    """
    
    return _send_email(patient_email, subject, html_content)


def send_otp_email(to_email: str, otp: str) -> bool:
    """Send the 6-digit verification code to the stakeholder's email."""
    subject = "Your Vritan verification code"
    # Plain text representation of the required email format:
    # Your Vritan verification code
    # XXXXXX
    # Expires in 10 minutes.
    
    html_content = f"""
    <html>
    <body style="font-family: sans-serif; padding: 20px; color: #333;">
        <p>Your Vritan verification code</p>
        <p style="font-size: 24px; font-weight: bold; font-family: monospace; letter-spacing: 2px; color: #059669; margin: 15px 0;">{otp}</p>
        <p>Expires in 10 minutes.</p>
    </body>
    </html>
    """
    return _send_email(to_email, subject, html_content)


def send_approval_email(to_email: str) -> bool:
    """Send approval email when stakeholder registration is approved."""
    subject = "Your Vritan Account Has Been Approved"
    html_content = """
    <html>
    <body style="font-family: sans-serif; padding: 20px; color: #333;">
        <p>Congratulations!</p>
        <p>Your organization has been approved.</p>
        <p>You can now log in to Vritan.</p>
        <p><a href="http://localhost:5173/login" style="display: inline-block; padding: 10px 20px; background-color: #059669; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">Login</a></p>
    </body>
    </html>
    """
    return _send_email(to_email, subject, html_content)


def send_rejection_email(to_email: str, reason: str) -> bool:
    """Send rejection email when stakeholder registration is rejected."""
    subject = "Your Vritan Account Registration Status"
    html_content = f"""
    <html>
    <body style="font-family: sans-serif; padding: 20px; color: #333;">
        <p>Your registration has been rejected.</p>
        <p><strong>Reason:</strong></p>
        <p style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 10px; border-radius: 6px; color: #991b1b;">{reason}</p>
        <p>Contact Support</p>
    </body>
    </html>
    """
    return _send_email(to_email, subject, html_content)


def send_hospital_approval_email(
    to_email: str,
    org_name: str,
    admin_name: str,
    vritan_id: str,
    setup_link: str,
) -> bool:
    """Send branded approval email to hospital admin with Vritan ID and password setup link."""
    subject = f"🎉 Congratulations! {org_name} has been approved on Vritan"
    year = __import__('datetime').datetime.now().year

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Vritan</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:40px 48px;text-align:center;">
            <div style="font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">🏥 Vritan</div>
            <div style="font-size:13px;color:#a7f3d0;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Healthcare Network</div>
          </td>
        </tr>

        <!-- Congratulations Banner -->
        <tr>
          <td style="background:#ecfdf5;padding:32px 48px;text-align:center;border-bottom:1px solid #d1fae5;">
            <div style="font-size:40px;margin-bottom:12px;">🎉</div>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#065f46;">Application Approved!</h1>
            <p style="margin:8px 0 0;font-size:15px;color:#047857;font-weight:600;">{org_name} is now part of the Vritan Healthcare Network</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 48px;">
            <p style="font-size:15px;margin:0 0 20px;">Dear <strong>{admin_name}</strong>,</p>
            <p style="font-size:15px;margin:0 0 24px;line-height:1.6;">We are delighted to inform you that your organization's registration has been verified and approved by the Vritan Super Administration team. Welcome to India's unified healthcare data network.</p>

            <!-- Credential Card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:0 0 28px;">
              <tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px;">Organization</div>
                <div style="font-size:16px;font-weight:700;color:#0f172a;">{org_name}</div>
              </td></tr>
              <tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px;">Administrator</div>
                <div style="font-size:16px;font-weight:700;color:#0f172a;">{admin_name}</div>
              </td></tr>
              <tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px;">Login Email</div>
                <div style="font-size:16px;font-weight:700;color:#0f172a;">{to_email}</div>
              </td></tr>
              <tr><td style="padding:20px 24px;background:#ecfdf5;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#047857;margin-bottom:4px;">Your Vritan ID</div>
                <div style="font-size:22px;font-weight:900;color:#065f46;font-family:monospace;letter-spacing:1px;">{vritan_id}</div>
                <div style="font-size:12px;color:#059669;margin-top:4px;">Keep this ID safe — it is your unique identifier on the Vritan platform.</div>
              </td></tr>
            </table>

            <!-- CTA Button -->
            <div style="text-align:center;margin:0 0 28px;">
              <a href="{setup_link}" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;letter-spacing:0.3px;">🔐 Set Your Password &amp; Get Started</a>
            </div>
            <p style="font-size:13px;color:#64748b;text-align:center;margin:0 0 28px;">This setup link is valid for <strong>24 hours</strong>. If it expires, contact <a href="mailto:support@vritan.in" style="color:#059669;">support@vritan.in</a>.</p>

            <!-- Security Notice -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:0 0 28px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:6px;">🔒 Security Recommendations</div>
                <ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#78350f;line-height:1.7;">
                  <li>Choose a strong password (min. 8 characters, mixed case, numbers &amp; symbols)</li>
                  <li>Do not share your credentials with anyone</li>
                  <li>Always log out when using shared devices</li>
                  <li>Contact support immediately if you suspect unauthorized access</li>
                </ul>
              </td></tr>
            </table>

            <!-- What's Next -->
            <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:12px;">What happens next?</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="padding:8px 12px;background:#f0fdf4;border-radius:8px;margin-bottom:8px;font-size:13px;color:#065f46;" valign="top">
                  <span style="font-weight:700;">1.</span> Click the button above to set your password.<br/>
                  <span style="font-weight:700;">2.</span> Log in at <a href="https://vritan.in/login" style="color:#059669;">vritan.in/login</a> using your email and new password.<br/>
                  <span style="font-weight:700;">3.</span> Complete your organization profile and start managing your healthcare network.
                </td>
              </tr>
            </table>

            <p style="font-size:14px;margin:0;">Congratulations once again. We look forward to building a healthier India together.</p>
            <p style="font-size:14px;margin:16px 0 0;">Warm regards,<br/><strong>The Vritan Team</strong></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Vritan Healthcare Network &bull; Hyderabad, India</p>
            <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">&copy; {year} Vritan. All rights reserved. &bull; <a href="mailto:support@vritan.in" style="color:#059669;text-decoration:none;">support@vritan.in</a></p>
            <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">This is an automated notification. Do not reply to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return _send_email(to_email, subject, html_content)


def send_member_invitation_email(
    to_email: str,
    org_name: str,
    org_vritan_id: str,
    branch_name: str,
    department_name: str,
    designation: str,
    role: str,
    invite_link: str,
) -> bool:
    """Send branded email to invited staff member with details of organization and registration link."""
    role_title = str(role or "").replace("_", " ").title()
    subject = f"🏥 Invitation to join {org_name} on Vritan as a {role_title}"
    year = __import__('datetime').datetime.now().year

    dept_html = ""
    if department_name:
        dept_html = f"""
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;">
                  <strong style="color:#64748b;display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Department</strong>
                  <span style="color:#0f172a;font-weight:700;">{department_name}</span>
                </td>
              </tr>
        """

    designation_html = ""
    if designation:
        designation_html = f"""
              <tr>
                <td style="padding:16px 20px;font-size:14px;">
                  <strong style="color:#64748b;display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Designation</strong>
                  <span style="color:#0f172a;font-weight:700;">{designation}</span>
                </td>
              </tr>
        """

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vritan Organization Invitation</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:36px 48px;text-align:center;">
            <div style="font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">🏥 Vritan</div>
            <div style="font-size:12px;color:#a7f3d0;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Healthcare Collaboration Platform</div>
          </td>
        </tr>

        <!-- Greeting Banner -->
        <tr>
          <td style="padding:40px 48px 20px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0f172a;">Join {org_name}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
              You have been invited to join the Vritan platform as a **{role_title}** under <strong>{org_name}</strong>. Here are the details of the invitation:
            </p>
          </td>
        </tr>

        <!-- Org Details Card -->
        <tr>
          <td style="padding:0 48px 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;">
                  <strong style="color:#64748b;display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Hospital / Organization</strong>
                  <span style="color:#0f172a;font-weight:700;">{org_name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;">
                  <strong style="color:#64748b;display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Vritan ID</strong>
                  <span style="color:#0f172a;font-weight:700;font-family:monospace;">{org_vritan_id}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-size:14px;">
                  <strong style="color:#64748b;display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">Assigned Branch</strong>
                  <span style="color:#0f172a;font-weight:700;">{branch_name}</span>
                </td>
              </tr>
              {dept_html}
              {designation_html}
            </table>
          </td>
        </tr>

        <!-- Action Button -->
        <tr>
          <td style="padding:0 48px 30px;text-align:center;">
            <a href="{invite_link}" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;box-shadow:0 4px 12px rgba(5,150,105,0.2);">🏥 Accept &amp; Create Vritan Account</a>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">This invitation link will expire in <strong>7 days</strong>.</p>
          </td>
        </tr>

        <!-- Info Notice -->
        <tr>
          <td style="padding:0 48px 40px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;font-size:13px;color:#1e3a8a;line-height:1.5;">
              ℹ️ **Note:** Completing registration through this secure link will automatically associate your account with <strong>{org_name}</strong> and bypass extra email verification steps.
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Vritan Healthcare Platform &bull; Hyderabad, India</p>
            <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">&copy; {year} Vritan. All rights reserved. &bull; <a href="mailto:support@vritan.in" style="color:#059669;text-decoration:none;">support@vritan.in</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return _send_email(to_email, subject, html_content)


def send_member_affiliation_notification_email(
    to_email: str,
    member_name: str,
    org_name: str,
    role: str,
) -> bool:
    """Send branded email to staff member notifying them about instant affiliation."""
    role_title = str(role or "").replace("_", " ").title()
    subject = f"🏥 You have been affiliated with {org_name} on Vritan as a {role_title}"
    year = __import__('datetime').datetime.now().year

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vritan Affiliation Notification</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:36px 48px;text-align:center;">
            <div style="font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">🏥 Vritan</div>
            <div style="font-size:12px;color:#a7f3d0;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Healthcare Collaboration Platform</div>
          </td>
        </tr>

        <!-- Greeting Banner -->
        <tr>
          <td style="padding:40px 48px 20px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0f172a;">Welcome, {member_name},</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
              You have been successfully affiliated with <strong>{org_name}</strong> as a **{role_title}**.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
              Log in to Vritan to access your organization dashboard and start collaborating.
            </p>
          </td>
        </tr>

        <!-- Action Button -->
        <tr>
          <td style="padding:0 48px 40px;text-align:center;">
            <a href="http://localhost:5173/sign-in" style="display:inline-block;background:linear-gradient(135deg,#059669,#047857);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:10px;box-shadow:0 4px 12px rgba(5,150,105,0.2);">🔓 Login to Vritan Dashboard</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Vritan Healthcare Platform &bull; Hyderabad, India</p>
            <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">&copy; {year} Vritan. All rights reserved. &bull; <a href="mailto:support@vritan.in" style="color:#059669;text-decoration:none;">support@vritan.in</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return _send_email(to_email, subject, html_content)
