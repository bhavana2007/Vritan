# MediLocker Refactoring Summary

## Root Cause

The original MediLocker pipeline had several issues:
1. OCR text was displayed in UI (cluttered user experience)
2. Doctor/Hospital information was not detected properly
3. "after food" and "before" were incorrectly treated as medicines
4. Medicine extraction used weak regex patterns
5. Gemini AI was underutilized despite understanding prescriptions better than regex
6. Doctor registration lacked authenticity verification
7. No email notifications for important events
8. Patient authentication used terminal OTP instead of Firebase Phone Auth

## Files Modified

### Backend Services

**backend/services/gemini_service.py**
- Updated `structure_medical_text()` prompt to be primary structurer
- Added explicit instructions to ignore non-medicine tokens (after food, before, advice, date, reg no, phone, rx)
- Added separate fields for doctor_name and hospital extraction
- Added instructions field for medicine usage instructions
- Returns structured JSON with confidence scoring

**backend/services/medical_parser.py**
- Enhanced `cleanup_ocr_text()` to remove clinic/hospital metadata lines
- Added patterns to remove: Clinic, Centre, Road, Phone, Doctor, Reg, Date, Advice, Rx, MD, Hospital, Ph
- Removed short tokens (<3 chars)
- Rewrote `extract_medicines()` with strict medicine pattern matching
- Added keyword filtering to exclude non-medicine lines

**backend/services/condition_mapper.py**
- Expanded medicine-to-condition mapping with comprehensive drug categories
- Added Diabetes, Pain/Fever, Antibiotics, Allergy, Gastric, Thyroid, Cardiovascular, Supplements
- Updated `map_medicines_to_conditions()` to return structured dict with confidence scoring
- Confidence based on multiple medicine matches pointing to same condition

**backend/services/email_service.py** (NEW)
- Created email service with SMTP integration
- Functions:
  - `send_doctor_verification_request_to_admin()` - Notifies admin of new doctor registration
  - `send_doctor_approval_email()` - Notifies doctor of approval
  - `send_doctor_rejection_email()` - Notifies doctor of rejection
- Background task compatible

### Backend Models

**backend/models.py**
- Added to Doctor model:
  - `phone` (String, unique, indexed)
  - `medical_license_number` (String, unique, indexed)
  - `years_of_experience` (Integer, nullable)
  - `verification_document_url` (String, nullable)

### Backend Schemas

**backend/schemas.py**
- Updated `UserRegister` schema:
  - Added `phone` (required for doctors)
  - Added `specialization` (optional)
  - Added `medical_license_number` (required for doctors)
  - Added `years_of_experience` (optional)
  - Added validation for doctor-specific fields
- Updated `DoctorProfile` schema:
  - Added `phone`
  - Added `medical_license_number`
  - Added `years_of_experience`
  - Added `verification_document_url`
- Updated `AdminDoctorPublic` schema:
  - Added `phone`
  - Added `medical_license_number`
  - Added `years_of_experience`
  - Added `verification_document_url`

### Backend Routers

**backend/routers/auth.py**
- Removed imports for `MedicalParser` and `ConditionMapper`
- Added import for `Admin` model
- Added imports for email service functions
- Updated upload endpoint:
  - Removed regex-based extraction pipeline
  - Now uses Gemini as primary structurer only
  - Simplified to: OCR → Gemini → Structured JSON
  - Stores doctor_or_hospital in ai_structured_data
- Updated doctor registration endpoint:
  - Added uniqueness checks for email, phone, and medical_license_number
  - Stores new doctor fields (phone, specialization, medical_license_number, years_of_experience)
  - Sends email notification to admin on registration
- Added `_require_admin()` helper function
- Added admin endpoints:
  - `GET /admin/doctors/pending` - List pending doctor verifications
  - `POST /admin/doctors/{doctor_user_id}/approve` - Approve doctor
  - `POST /admin/doctors/{doctor_user_id}/reject` - Reject doctor
- Added doctor endpoint:
  - `POST /doctor/upload-verification-document` - Upload verification document

### Frontend Components

**frontend/src/components/MedicalRecordCard.jsx**
- Removed OCR text display section
- Removed Advice section (instructions now part of medicines)
- Updated Medicines section:
  - Renamed label from "Medicines, Dosage, Duration" to "Medicines"
  - Added conditional display for dosage, duration, and instructions
  - Instructions field now shows medicine usage instructions
- Kept Doctor/Hospital, Possible Related Conditions, Patient Notes sections
- Removed technical AI fields from display

## Database Schema Changes

### Doctors Table
```sql
ALTER TABLE doctors ADD COLUMN phone VARCHAR(20) UNIQUE;
ALTER TABLE doctors ADD COLUMN medical_license_number VARCHAR(100) UNIQUE;
ALTER TABLE doctors ADD COLUMN years_of_experience INT;
ALTER TABLE doctors ADD COLUMN verification_document_url VARCHAR(255);
```

### Verification Documents Directory
Create directory: `backend/uploads/verification_documents/`

## Setup Steps

### 1. Environment Variables
Add to `backend/.env`:
```env
# Email Service Configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAIL=medilockeradmin@gmail.com
FROM_EMAIL=your-email@gmail.com
```

### 2. Database Migration
Run the following SQL commands to update the database schema:
```sql
-- Add new columns to doctors table
ALTER TABLE doctors 
ADD COLUMN phone VARCHAR(20) UNIQUE AFTER email,
ADD COLUMN medical_license_number VARCHAR(100) UNIQUE AFTER hospital,
ADD COLUMN years_of_experience INT AFTER medical_license_number,
ADD COLUMN verification_document_url VARCHAR(255) AFTER years_of_experience;

-- Create indexes for new unique columns
CREATE INDEX idx_doctors_phone ON doctors(phone);
CREATE INDEX idx_doctors_medical_license_number ON doctors(medical_license_number);
```

### 3. Create Verification Documents Directory
```bash
mkdir -p backend/uploads/verification_documents
```

### 4. Email Service Setup
For Gmail:
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account Settings → Security → App Passwords
   - Generate a new app password for "Mail"
   - Use this password as SMTP_PASSWORD
3. Update .env with your email credentials

### 5. Restart Backend
```bash
cd backend
python -m uvicorn main:app --reload
```

## Before vs After Output

### Before
```
Medicines:
Life Line
Ph
Reg
Advice
Date

Possible Related Conditions:
Unknown
```

### After
```
Doctor/Hospital:
Dr R Mehta - Life Line Clinic

Medicines:
Metformin
Dosage: 500
Duration: 7 days
Instructions: after food

Glibenclamide
Dosage: 5mg
Duration: 7 days
Instructions: before breakfast

Possible Related Conditions:
Type 2 Diabetes

Confidence: 85%
```

## API Changes

### New Endpoints

**Doctor Verification Document Upload**
- `POST /doctor/upload-verification-document`
- Auth: Doctor JWT required
- Body: multipart/form-data with file
- Response: document_url

**Admin Endpoints**
- `GET /admin/doctors/pending`
  - Auth: Admin JWT required
  - Response: List of pending doctor verifications
- `POST /admin/doctors/{doctor_user_id}/approve`
  - Auth: Admin JWT required
  - Response: Success message
  - Sends approval email to doctor
- `POST /admin/doctors/{doctor_user_id}/reject`
  - Auth: Admin JWT required
  - Response: Success message
  - Sends rejection email to doctor

### Modified Endpoints

**Doctor Registration**
- `POST /register`
- Added required fields for doctors: phone, medical_license_number
- Added optional fields: specialization, years_of_experience
- Added uniqueness validation for email, phone, medical_license_number
- Sends email notification to admin on registration

**Medical Record Upload**
- `POST /records/upload`
- Removed regex-based extraction
- Now uses Gemini as primary structurer
- Improved doctor/hospital detection
- Better medicine extraction (no false positives like "after food")

## Pending Tasks

### PART 6: Firebase Phone Auth for Patients
- Replace terminal OTP with Firebase Phone Authentication
- Update patient registration flow
- Update patient login flow
- Remove patient_otp_store from backend
- Frontend changes required

### PART 7: Logging
- Add logging for AI structured data events
- Add logging for email sent events
- Add logging for doctor verification events
- Add logging for OTP verification events
- Ensure no secrets are logged

## Testing Checklist

- [ ] Test doctor registration with new fields
- [ ] Test uniqueness validation (email, phone, license)
- [ ] Test verification document upload
- [ ] Test admin approval workflow
- [ ] Test admin rejection workflow
- [ ] Test email notifications (registration, approval, rejection)
- [ ] Test prescription upload with Gemini structuring
- [ ] Verify "after food" and "before" are not treated as medicines
- [ ] Verify doctor/hospital detection works correctly
- [ ] Verify UI no longer shows OCR text
- [ ] Verify medicines show instructions field

## Rollback Plan

If issues arise:
1. Revert `backend/services/gemini_service.py` to previous version
2. Revert `backend/routers/auth.py` to previous version
3. Remove new database columns (or use database migration rollback)
4. Disable email service by removing SMTP credentials from .env
5. Revert frontend MedicalRecordCard.jsx changes
