# 🏥 VRITAN

> **AI-Powered Intelligent Healthcare Collaboration Platform**

VRITAN is an AI-powered healthcare platform designed to connect patients, doctors, pharmacies, laboratories, and healthcare organizations through a unified digital ecosystem.

The platform enables secure healthcare record management, intelligent medical document processing, appointments, prescriptions, laboratory workflows, and controlled patient-doctor collaboration.

---

## 🌍 Problem Statement

Healthcare information is often fragmented across physical prescriptions, medical reports, hospitals, pharmacies, and different healthcare providers.

Patients may lose important medical documents, while doctors and healthcare professionals spend significant time collecting and reviewing scattered information.

This fragmentation can lead to:

- Difficulty maintaining a complete medical history
- Loss of prescriptions and medical reports
- Repeated medical tests
- Inefficient doctor-patient communication
- Difficulty accessing healthcare information across organizations
- Manual processing of unstructured medical documents

---

## 💡 Our Solution

VRITAN provides a unified digital healthcare ecosystem where patients and healthcare professionals can securely manage and collaborate on healthcare information.

The platform combines:

- 🤖 AI-powered medical document understanding
- 📄 Digital healthcare record management
- 👨‍⚕️ Doctor-patient collaboration
- 🏥 Healthcare organization management
- 📅 Appointment management
- 💊 Prescription management
- 🧪 Laboratory workflows
- 🔐 Consent-based access control
- 📱 QR/OTP-based secure access
- 🔔 Notification services
- 🔗 Healthcare interoperability

---

# ✨ Key Features

## 👤 Patient Portal

Patients can:

- Register and securely authenticate
- Maintain their digital healthcare profile
- Upload medical documents
- Store prescriptions and reports
- View their medical history
- View their medical timeline
- Book appointments
- Manage appointments
- Share records securely with doctors
- Provide or revoke consent for healthcare access
- Access healthcare information through secure mechanisms

## 👨‍⚕️ Doctor Portal

Doctors can:

- Securely authenticate
- Search for patients
- View authorized patient profiles
- Access patient medical timelines
- Review medical records
- View previous prescriptions and reports
- Create prescriptions
- Save prescription drafts
- Edit prescriptions
- Finalize prescriptions
- View prescription history
- Manage consultations
- Access patient information based on consent

## 🏥 Healthcare Organization Portal

Healthcare organizations can manage:

- Hospitals
- Branches
- Departments
- Doctors
- Doctor availability
- Appointments
- Healthcare operations
- Organization-level workflows

## 💊 Pharmacy Portal

The pharmacy module supports healthcare workflows related to:

- Prescription processing
- Medication-related information
- Prescription verification
- Pharmacy operations

## 🧪 Laboratory Portal

The laboratory module supports:

- Laboratory workflows
- Patient-related laboratory information
- Medical report management
- Integration with the patient's healthcare record

---

# 🤖 AI-Powered Medical Document Understanding

One of the core capabilities of VRITAN is its AI-powered medical document processing pipeline.

```text
Medical Document
       │
       ▼
Image Processing
       │
       ▼
OCR Text Extraction
       │
       ▼
OCR Cleaning
       │
       ▼
Document Classification
       │
       ▼
Specialized AI Processing
       │
       ▼
Structured Medical Information
       │
       ▼
Validation
       │
       ▼
Confidence Score
       │
       ▼
Healthcare Record
```

### AI Capabilities

- OCR-based text extraction
- Medical document classification
- Specialized document processing
- AI-powered information extraction
- OCR error cleaning
- Structured medical data generation
- Confidence scoring
- Quality validation
- Multilingual document processing
- Empty and invalid record prevention

---

# 📅 Appointment Management

VRITAN includes an intelligent appointment management system connecting patients, doctors, and healthcare organizations.

## Appointment Flow

```text
Hospital
   ↓
Branch
   ↓
Department
   ↓
Doctor
   ↓
Available Slot
   ↓
Review
   ↓
Confirmation
```

### Key Capabilities

- Hospital selection
- Branch selection
- Department selection
- Doctor selection
- Doctor availability
- Appointment slot management
- Temporary slot locking
- Appointment confirmation
- Notification integration

The platform uses a **5-minute temporary slot locking mechanism** to reduce conflicts during appointment booking.

---

# 🔐 Security & Consent

Healthcare data requires strict access control.

VRITAN incorporates:

- 🔑 Authentication
- 👥 Role-Based Access Control (RBAC)
- 🔐 OTP-based verification
- 📱 QR-based access
- 🤝 Consent-based patient record sharing
- 🛡️ API-level validation
- 🔒 Protected medical document storage

## Supported Roles

- `PATIENT`
- `DOCTOR`
- `PHARMACIST`
- `LAB_TECHNICIAN`
- `HOSPITAL_ADMIN`
- `SUPER_ADMIN`
- `GOVERNMENT_ANALYST`

---

# 🏗️ Enterprise Architecture

```text
                         ┌─────────────────────┐
                         │      VRITAN AI      │
                         │    Intelligence     │
                         └──────────┬──────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       │                            │                            │
       ▼                            ▼                            ▼
┌─────────────┐              ┌─────────────┐              ┌─────────────┐
│   Patient   │              │   Doctor    │              │  Healthcare │
│   Portal    │              │   Portal    │              │ Organization│
└──────┬──────┘              └──────┬──────┘              └──────┬──────┘
       │                            │                            │
       └────────────────────────────┼────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   API / Services    │
                         │       Layer         │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌────────────┐        ┌────────────┐       ┌─────────────┐
       │ Appointment│        │   Consent  │       │ Notification│
       │   Engine   │        │   Layer    │       │   Engine    │
       └────────────┘        └────────────┘       └─────────────┘
                                    │
                                    ▼
                             ┌────────────┐
                             │ AI Engine  │
                             │ OCR + LLM  │
                             └─────┬──────┘
                                   │
                                   ▼
                             ┌────────────┐
                             │ Healthcare │
                             │  Database  │
                             └────────────┘
```

---

# 🛠️ Technology Stack

### Frontend

- React
- Vite
- Tailwind CSS
- React Router
- Axios

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- Uvicorn

### Database

- MySQL

### Authentication & Storage

- Firebase Authentication
- Firebase Storage

### AI & Document Processing

- OCR
- Google Gemini
- AI Document Classification
- Medical Information Extraction
- Confidence Scoring
- Quality Validation

---

# 📂 Project Structure

```text
VRITAN/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── ...
│
├── backend/
│   ├── routers/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── repositories/
│   ├── database/
│   └── ...
│
├── README.md
└── ...
```

---

# 🔄 Healthcare Record Workflow

```text
Patient
   │
   ▼
Upload Medical Document
   │
   ▼
OCR Processing
   │
   ▼
AI Document Understanding
   │
   ▼
Structured Medical Information
   │
   ▼
Validation & Confidence Score
   │
   ▼
Secure Healthcare Record
   │
   ▼
Patient Medical Timeline
   │
   ▼
Consent-Based Doctor Access
```

# 🔄 Appointment Workflow

```text
Patient
   │
   ▼
Select Hospital
   │
   ▼
Select Branch
   │
   ▼
Select Department
   │
   ▼
Select Doctor
   │
   ▼
Select Available Slot
   │
   ▼
Temporary Slot Lock
   │
   ▼
Review Appointment
   │
   ▼
Confirm Appointment
   │
   ▼
Notification
```

---

# 🚀 Getting Started

## Prerequisites

Make sure you have:

- Python 3.11+
- Node.js
- npm
- MySQL
- Git

## 1️⃣ Clone the Repository

```bash
git clone <YOUR_VRITAN_REPOSITORY_URL>
cd VRITAN
```

## 2️⃣ Backend Setup

```bash
cd backend
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Start the backend

```bash
uvicorn main:app --reload
```

The API will run at:

```text
http://127.0.0.1:8000
```

## 3️⃣ Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

---

# 🔑 Environment Variables

Create a `.env` file containing the required configuration:

```env
DATABASE_URL=your_database_url
GEMINI_API_KEY=your_gemini_api_key
OCR_API_KEY=your_ocr_api_key
FIREBASE_CONFIG=your_firebase_configuration
```

> ⚠️ **Never commit API keys, credentials, or other sensitive information to GitHub.**

---

# 🎯 Future Enhancements

- 🔗 ABDM integration
- 📱 Mobile application
- 🌐 Multilingual healthcare interface
- 🤖 Advanced AI healthcare insights
- 📊 Healthcare analytics
- 🔔 Real-time notifications
- 🏥 Advanced hospital management
- 💊 Enhanced pharmacy workflows
- 🧪 Advanced laboratory integration
- 🔐 Advanced consent management
- ☁️ Scalable cloud infrastructure

---

# 📌 Project Highlights

- 🤖 AI-powered healthcare platform
- 📄 Intelligent medical document processing
- 🧠 AI-based document classification
- 🔎 Searchable healthcare records
- 👨‍⚕️ Doctor-patient collaboration
- 📅 Intelligent appointment management
- 💊 Prescription management
- 🧪 Laboratory workflows
- 🔐 Consent-based access control
- 📱 QR/OTP-based secure access
- 🔔 Notification architecture
- 🌐 Multilingual document processing
- 🏥 Multi-portal healthcare ecosystem

---

# 👥 Team

VRITAN is developed as a collaborative project with responsibilities across:

- Frontend Development
- Backend Development
- Database Management
- AI/OCR Integration

---

# ⚠️ Disclaimer

VRITAN is a software project developed for educational, research, and demonstration purposes.

It is not intended to replace professional medical advice, diagnosis, or treatment.

---

# ⭐ Support

If you find VRITAN interesting, consider giving the repository a ⭐ on GitHub!