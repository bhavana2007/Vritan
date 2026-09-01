from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from models import Patient, Doctor
from org_models import OrganizationMembership, Branch, Department, BranchDoctorAffiliation
from appointment_models import Appointment, AppointmentSlot
from lab_models import LabOrder
from pharmacy_models import PharmacyOrder

class OrganizationAnalyticsService:
    """
    Interface for Organization Analytics.
    Aggregates data across the multi-tenant architecture for dashboards.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_metrics(self, org_id: int) -> Dict[str, Any]:
        """
        Retrieves aggregate statistics for the organization dashboard (Legacy support).
        """
        return {}

    def get_live_metrics(self, org, branch_id: int = None, start_date: str = None, end_date: str = None) -> Dict[str, Any]:
        """
        Retrieves live metrics for the Organization Admin Dashboard using production DB.
        """
        db = self.db
        
        # 1. Branches, Departments, Doctors
        if branch_id:
            branches = db.query(Branch).filter(Branch.organization_id == org.id, Branch.id == branch_id).all()
        else:
            branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        branches_count = len(branches)
        
        dept_count = db.query(Department).filter(Department.branch_id.in_(branch_ids)).count() if branch_ids else 0
        doc_count = db.query(BranchDoctorAffiliation).filter(BranchDoctorAffiliation.branch_id.in_(branch_ids)).count() if branch_ids else 0
        
        # Base query for appointments within the date range
        apt_base_query = db.query(Appointment).join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id).filter(
            Appointment.branch_id.in_(branch_ids) if branch_ids else False
        )
        if start_date:
            apt_base_query = apt_base_query.filter(AppointmentSlot.date >= start_date)
        if end_date:
            apt_base_query = apt_base_query.filter(AppointmentSlot.date <= end_date)
        
        # 2. Today's Appointments
        today = date.today()
        today_appointments = 0
        if branch_ids:
            today_appointments = db.query(Appointment).join(
                AppointmentSlot, Appointment.slot_id == AppointmentSlot.id
            ).filter(
                Appointment.branch_id.in_(branch_ids),
                AppointmentSlot.date == today
            ).count()
            
        # 3. Active Patients (unique patient IDs having appointments in this organization)
        active_patients = 0
        if branch_ids:
            active_patients = apt_base_query.with_entities(func.count(func.distinct(Appointment.patient_id))).scalar() or 0
            
        # 4. Pending Doctor Verifications
        pending_verifications = db.query(Doctor).filter(
            Doctor.hospital_vritan_id == org.vritan_id,
            Doctor.is_verified == False
        ).count()
        
        # 5. AI Medical Documents Processed
        # Count all MedicalRecords associated with patients who have appointments at this organization
        ai_documents_processed = 0
        if branch_ids:
            from models import MedicalRecord
            # Find affiliated doctor user ids
            affiliations = db.query(BranchDoctorAffiliation).filter(
                BranchDoctorAffiliation.branch_id.in_(branch_ids)
            ).all()
            doc_user_ids = [aff.doctor_id for aff in affiliations]
            if doc_user_ids:
                ai_query = db.query(MedicalRecord).filter(
                    MedicalRecord.uploaded_by.in_(doc_user_ids),
                    MedicalRecord.ai_structured_data.isnot(None)
                )
                if start_date:
                    ai_query = ai_query.filter(func.date(MedicalRecord.uploaded_at) >= start_date)
                if end_date:
                    ai_query = ai_query.filter(func.date(MedicalRecord.uploaded_at) <= end_date)
                ai_documents_processed = ai_query.count()
                
        # 6. Appointment Trends (Last 7 days count grouped by day)
        appointment_trends = []
        for i in range(6, -1, -1):
            day_date = today - timedelta(days=i)
            day_str = day_date.strftime("%a")
            count = 0
            if branch_ids:
                count = db.query(Appointment).join(
                    AppointmentSlot, Appointment.slot_id == AppointmentSlot.id
                ).filter(
                    Appointment.branch_id.in_(branch_ids),
                    AppointmentSlot.date == day_date
                ).count()
            appointment_trends.append({"day": day_str, "appointments": count})
            
        # 7. Department Workload Prediction
        department_workload = []
        if branch_ids:
            depts = db.query(Department).filter(Department.branch_id.in_(branch_ids)).all()
            for dept in depts:
                patients_count = db.query(Appointment).join(
                    AppointmentSlot, Appointment.slot_id == AppointmentSlot.id
                ).filter(
                    Appointment.department_id == dept.id,
                    AppointmentSlot.date == today,
                    Appointment.status.in_(["Requested", "Confirmed", "Waiting", "Consultation Started"])
                ).count()
                department_workload.append({"department": dept.name, "patients": patients_count})
        
        if not department_workload:
            department_workload = [
                {"department": "Cardiology", "patients": 0},
                {"department": "Neurology", "patients": 0},
                {"department": "Gynecology", "patients": 0},
                {"department": "Orthopedics", "patients": 0},
                {"department": "Pediatrics", "patients": 0}
            ]
            
        doctor_activity = [
            {"status": "Active", "count": doc_count},
            {"status": "On Leave", "count": 0},
            {"status": "Off Duty", "count": 1}
        ]
        
        # New Status Counts
        total_appointments = apt_base_query.count()
        completed_appointments = apt_base_query.filter(Appointment.status == "Completed").count()
        cancelled_appointments = apt_base_query.filter(Appointment.status == "Cancelled").count()
        upcoming_appointments = apt_base_query.filter(AppointmentSlot.date >= today, Appointment.status.in_(["Requested", "Confirmed"])).count()
        
        # Pharmacy and Labs
        from org_models import OrganizationLab, OrganizationPharmacy
        total_laboratories = db.query(OrganizationLab).filter(OrganizationLab.organization_id == org.id).count()
        total_pharmacies = db.query(OrganizationPharmacy).filter(OrganizationPharmacy.organization_id == org.id).count()
        
        return {
            "summary": {
                "doctors": doc_count,
                "departments": dept_count,
                "branches": branches_count,
                "today_appointments": today_appointments,
                "total_appointments": total_appointments,
                "completed_appointments": completed_appointments,
                "cancelled_appointments": cancelled_appointments,
                "upcoming_appointments": upcoming_appointments,
                "active_patients": active_patients,
                "pending_verifications": pending_verifications,
                "ai_documents_processed": ai_documents_processed,
                "laboratories": total_laboratories,
                "pharmacies": total_pharmacies
            },
            "charts": {
                "appointment_trends": appointment_trends,
                "department_workload": department_workload,
                "doctor_activity": doctor_activity
            }
        }

    def get_monitoring_data(self, org, module: str) -> Dict[str, int]:
        """
        Retrieves real-time counts for the Clinical Monitoring Hub.
        """
        db = self.db
        branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        
        if not branch_ids:
            return {}
            
        apts = db.query(Appointment).filter(Appointment.branch_id.in_(branch_ids)).all()
        apt_ids = [a.id for a in apts]
        
        if module == "appointment":
            booked = sum(1 for a in apts if a.status in ["Confirmed"])
            waiting = sum(1 for a in apts if a.status in ["Requested", "Waiting", "Checked-In"])
            in_consultation = sum(1 for a in apts if a.status in ["Consultation Started"])
            completed = sum(1 for a in apts if a.status in ["Completed"])
            return {
                "booked": booked,
                "waiting": waiting,
                "in_consultation": in_consultation,
                "completed": completed
            }
        elif module == "pharmacy":
            if not apt_ids:
                return {"pending": 0, "preparing": 0, "ready": 0, "dispensed": 0}
            orders = db.query(PharmacyOrder).filter(PharmacyOrder.appointment_id.in_(apt_ids)).all()
            pending = sum(1 for o in orders if o.status in ["Pending", "Verified"])
            preparing = sum(1 for o in orders if o.status in ["Preparing"])
            ready = sum(1 for o in orders if o.status in ["Ready"])
            dispensed = sum(1 for o in orders if o.status in ["Dispensed"])
            return {
                "pending": pending,
                "preparing": preparing,
                "ready": ready,
                "dispensed": dispensed
            }
        elif module == "laboratory":
            if not apt_ids:
                return {"ordered": 0, "collection_pending": 0, "processing": 0, "completed": 0}
            orders = db.query(LabOrder).filter(LabOrder.appointment_id.in_(apt_ids)).all()
            ordered = sum(1 for o in orders if o.status in ["Ordered"])
            collection_pending = sum(1 for o in orders if o.status in ["Collection"])
            processing = sum(1 for o in orders if o.status in ["Processing", "Verification"])
            completed = sum(1 for o in orders if o.status in ["Completed"])
            return {
                "ordered": ordered,
                "collection_pending": collection_pending,
                "processing": processing,
                "completed": completed
            }
        return {}
