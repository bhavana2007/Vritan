import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Dict, Any, List
from datetime import datetime
import json

from models import Patient, Appointment, Doctor, Organization, Branch, Department, AppointmentSlot
from appointment_models import DoctorProfile

logger = logging.getLogger(__name__)

class VoiceAgentTools:
    def __init__(self, db: Session, patient: Patient):
        self.db = db
        self.patient = patient

    def get_tool_definitions(self):
        return [
            {
                "name": "find_doctor_appointment",
                "description": "Finds an available doctor appointment for a specific specialty and date. Returns the best available slot.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "specialty": {"type": "string", "description": "The medical specialty (e.g. cardiologist, dentist, general physician)"},
                        "date": {"type": "string", "description": "The date to check in YYYY-MM-DD format"},
                        "city": {"type": "string", "description": "Optional city to filter by"}
                    },
                    "required": ["specialty", "date"]
                }
            },
            {
                "name": "book_appointment",
                "description": "CRITICAL: Books an appointment. ONLY CALL THIS AFTER EXPLICIT CONFIRMATION FROM THE PATIENT.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "doctor_id": {"type": "integer"},
                        "department_id": {"type": "integer"},
                        "branch_id": {"type": "integer"},
                        "organization_id": {"type": "integer"},
                        "date": {"type": "string", "description": "YYYY-MM-DD"},
                        "time": {"type": "string"},
                        "slot_id": {"type": "integer"},
                        "appointment_type": {"type": "string", "description": "E.g. 'Hospital', 'Independent Clinic'"}
                    },
                    "required": ["doctor_id", "date", "time", "slot_id", "appointment_type"]
                }
            },
            {
                "name": "get_my_appointments",
                "description": "Retrieves the patient's upcoming appointments.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "get_patient_profile",
                "description": "Retrieves basic profile information for the authenticated patient.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        ]

    def search_organizations(self, name: str = None, city: str = None) -> str:
        logger.info(f"VOICE_ORGANIZATION_SEARCH: name={name}, city={city}")
        try:
            query = self.db.query(Organization).filter(
                Organization.is_deleted == False,
                Organization.status == "ACTIVE",
                Organization.verification_status.in_(["VERIFIED", "APPROVED"])
            )
            if name:
                query = query.filter(Organization.name.ilike(f"%{name.strip()}%"))
            if city:
                query = query.filter(Organization.city.ilike(f"%{city.strip()}%"))
            
            orgs = query.limit(10).all()
            results = [{"id": o.id, "name": o.name, "city": o.city} for o in orgs]
            return json.dumps({"status": "success", "organizations": results})
        except Exception as e:
            logger.error(f"Error in search_organizations: {e}")
            return json.dumps({"status": "error", "message": "Failed to search organizations."})

    def search_branches(self, organization_id: int) -> str:
        try:
            branches = self.db.query(Branch).filter(
                Branch.organization_id == organization_id,
                Branch.status == "ACTIVE"
            ).all()
            results = [{"id": b.id, "name": b.name, "address": b.address} for b in branches]
            return json.dumps({"status": "success", "branches": results})
        except Exception as e:
            logger.error(f"Error in search_branches: {e}")
            return json.dumps({"status": "error", "message": "Failed to search branches."})

    def search_departments(self, branch_id: int) -> str:
        try:
            depts = self.db.query(Department).filter(
                Department.branch_id == branch_id,
                Department.is_active == True
            ).all()
            results = [{"id": d.id, "name": d.name} for d in depts]
            return json.dumps({"status": "success", "departments": results})
        except Exception as e:
            logger.error(f"Error in search_departments: {e}")
            return json.dumps({"status": "error", "message": "Failed to search departments."})

    def search_doctors(self, department_id: int) -> str:
        logger.info(f"VOICE_DOCTOR_SEARCH: department_id={department_id}")
        try:
            from org_models import BranchDoctorAffiliation
            affiliations = self.db.query(BranchDoctorAffiliation).filter(
                BranchDoctorAffiliation.department_id == department_id,
                BranchDoctorAffiliation.status == "ACTIVE"
            ).all()
            doctor_ids = [aff.doctor_id for aff in affiliations]
            doctors = self.db.query(Doctor).filter(Doctor.user_id.in_(doctor_ids)).all()
            results = [{"id": d.user_id, "name": d.full_name, "specialization": d.specialization} for d in doctors]
            return json.dumps({"status": "success", "doctors": results})
        except Exception as e:
            logger.error(f"Error in search_doctors: {e}")
            return json.dumps({"status": "error", "message": "Failed to search doctors."})

    def find_available_slots(self, doctor_id: int, date: str) -> str:
        logger.info(f"VOICE_SLOT_SEARCH: doctor_id={doctor_id}, date={date}")
        try:
            # We reuse the logic from patient_portal by just importing it if possible, 
            # or recreating the slot fetch logic. Since it's complex, let's call the router function directly.
            from routers.patient_portal import get_slots
            from models import User
            # We need a mock current_user since patient_portal expects one
            dummy_user = User(id=self.patient.user_id, role="patient")
            slots = get_slots(doctor_id=doctor_id, date=date, db=self.db, current_user=dummy_user)
            available = [s for s in slots if s.get("available")]
            return json.dumps({"status": "success", "slots": available})
        except Exception as e:
            logger.error(f"Error in find_available_slots: {e}")
            return json.dumps({"status": "error", "message": "Failed to find slots."})

    def book_appointment(self, doctor_id: int, date: str, time: str, slot_id: int, appointment_type: str, department_id: int = None, branch_id: int = None, organization_id: int = None) -> str:
        logger.info("VOICE_APPOINTMENT_BOOKED (attempt)")
        try:
            from routers.patient_portal import book_appointment, BookAppointmentRequest
            req = BookAppointmentRequest(
                doctor_id=doctor_id,
                department_id=department_id,
                branch_id=branch_id,
                organization_id=organization_id,
                date=date,
                time=time,
                slot_id=slot_id,
                appointment_type=appointment_type
            )
            result = book_appointment(req=req, db=self.db, patient=self.patient)
            logger.info("VOICE_APPOINTMENT_BOOKED (success)")
            return json.dumps({"status": "success", "appointment": result})
        except Exception as e:
            logger.error(f"VOICE_APPOINTMENT_BOOKING_FAILED: {e}")
            return json.dumps({"status": "error", "message": "Booking failed. Please check slot availability."})

    def find_doctor_appointment(self, specialty: str, date: str, city: str = None) -> str:
        logger.info(f"VOICE_MACRO_SEARCH: specialty={specialty}, date={date}, city={city}")
        try:
            query = self.db.query(Organization).filter(
                Organization.is_deleted == False,
                Organization.status == "ACTIVE",
                Organization.verification_status.in_(["VERIFIED", "APPROVED"])
            )
            if city:
                query = query.filter(Organization.city.ilike(f"%{city.strip()}%"))
            orgs = query.all()
            if not orgs:
                return json.dumps({"success": False, "reason": "NO_AVAILABLE_SLOT", "message": "No organizations found."})
            
            org_ids = [o.id for o in orgs]
            
            branches = self.db.query(Branch).filter(
                Branch.organization_id.in_(org_ids),
                Branch.status == "ACTIVE"
            ).all()
            if not branches:
                return json.dumps({"success": False, "reason": "NO_AVAILABLE_SLOT", "message": "No branches found."})
            branch_ids = [b.id for b in branches]
            
            depts = self.db.query(Department).filter(
                Department.branch_id.in_(branch_ids),
                Department.is_active == True,
                Department.name.ilike(f"%{specialty.strip()}%")
            ).all()
            if not depts:
                return json.dumps({"success": False, "reason": "NO_AVAILABLE_SLOT", "message": f"No {specialty} departments found."})
            dept_ids = [d.id for d in depts]
            
            from org_models import BranchDoctorAffiliation
            affiliations = self.db.query(BranchDoctorAffiliation).filter(
                BranchDoctorAffiliation.department_id.in_(dept_ids),
                BranchDoctorAffiliation.status == "ACTIVE"
            ).all()
            if not affiliations:
                return json.dumps({"success": False, "reason": "NO_AVAILABLE_SLOT", "message": "No doctors found."})
            
            doc_affil_map = {aff.doctor_id: aff for aff in affiliations}
            doctor_ids = list(doc_affil_map.keys())
            doctors = self.db.query(Doctor).filter(Doctor.user_id.in_(doctor_ids)).all()
            
            from routers.patient_portal import get_slots
            from models import User
            dummy_user = User(id=self.patient.user_id, role="patient")
            
            available_slots = []
            for doc in doctors:
                slots = get_slots(doctor_id=doc.user_id, date=date, db=self.db, current_user=dummy_user)
                for s in slots:
                    if s.get("available"):
                        aff = doc_affil_map[doc.user_id]
                        dept = next((d for d in depts if d.id == aff.department_id), None)
                        branch = next((b for b in branches if b.id == aff.branch_id), None)
                        org = next((o for o in orgs if o.id == branch.organization_id), None) if branch else None
                        
                        available_slots.append({
                            "doctor_id": doc.user_id,
                            "doctor_name": doc.full_name,
                            "organization_id": org.id if org else None,
                            "organization_name": org.name if org else None,
                            "branch_id": branch.id if branch else None,
                            "department_id": dept.id if dept else None,
                            "date": date,
                            "time": s["time"],
                            "slot_id": s["id"],
                            "appointment_type": "Hospital"
                        })
            
            if not available_slots:
                return json.dumps({"success": False, "reason": "NO_AVAILABLE_SLOT"})
            
            def sort_key(slot):
                try:
                    t = datetime.strptime(slot["time"], "%I:%M %p").time()
                except:
                    t = datetime.strptime("11:59 PM", "%I:%M %p").time()
                return (t, slot["doctor_id"])
                
            available_slots.sort(key=sort_key)
            best_slot = available_slots[0]
            
            return json.dumps({
                "success": True,
                "doctor": best_slot["doctor_name"],
                "doctor_id": best_slot["doctor_id"],
                "organization": best_slot["organization_name"],
                "organization_id": best_slot["organization_id"],
                "branch_id": best_slot["branch_id"],
                "department_id": best_slot["department_id"],
                "date": best_slot["date"],
                "time": best_slot["time"],
                "slot_id": best_slot["slot_id"],
                "appointment_type": best_slot["appointment_type"]
            })
            
        except Exception as e:
            logger.error(f"Error in find_doctor_appointment: {e}")
            return json.dumps({"success": False, "reason": "ERROR", "message": str(e)})

    def get_my_appointments(self) -> str:
        try:
            appointments = self.db.query(Appointment).filter(Appointment.patient_id == self.patient.id).all()
            results = [{"id": a.appointment_id, "date": str(a.scheduled_date), "time": str(a.scheduled_time), "status": a.status} for a in appointments]
            return json.dumps({"status": "success", "appointments": results})
        except Exception as e:
            logger.error(f"Error in get_my_appointments: {e}")
            return json.dumps({"status": "error", "message": "Failed to retrieve appointments."})

    def get_patient_profile(self) -> str:
        try:
            return json.dumps({
                "status": "success",
                "profile": {
                    "name": self.patient.full_name,
                    "gender": self.patient.gender,
                    "blood_group": self.patient.blood_group
                }
            })
        except Exception as e:
            logger.error(f"Error in get_patient_profile: {e}")
            return json.dumps({"status": "error", "message": "Failed to retrieve profile."})
