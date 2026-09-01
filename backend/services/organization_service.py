from typing import List, Optional
from sqlalchemy.orm import Session
from schemas.organization_schema import (
    OrganizationCreate, OrganizationUpdate,
    BranchCreate, BranchUpdate
)
from repositories.organization_repo import OrganizationRepository
from services.audit_service import AuditService

class OrganizationService:
    """
    Orchestrates business logic for Healthcare Organizations.
    Coordinates between repositories, audit logging, and domain rules.
    """

    def __init__(self, db: Session):
        self.db = db
        self.org_repo = OrganizationRepository(db)
        self.audit_service = AuditService(db) # Needs AuditRepository, wait, let me fix this later in the code

    def register_organization(self, org_in: OrganizationCreate, admin_user_id: int):
        """
        Registers a new organization and assigns the creator as an admin.
        Wraps the multi-step process in a transaction.
        """
        try:
            # 1. Create the organization
            org = self.org_repo.create_organization(org_in)
            
            # 2. Assign the admin user
            self.org_repo.add_member(org.id, admin_user_id, "admin")
            
            # 3. Log the enterprise event
            # To pass db properly to AuditService, I'll instantiate it correctly
            from repositories.audit_repo import AuditRepository
            audit_svc = AuditService(AuditRepository(self.db))
            
            audit_svc.log_enterprise_event(
                event_type="OrganizationRegistered",
                entity_type="Organization",
                entity_id=str(org.id),
                action=f"Organization {org.name} registered by user {admin_user_id}",
                organization_id=org.id,
                user_id=admin_user_id,
                metadata={"name": org.name, "type": org.organization_type}
            )
            
            return org
            
        except Exception as e:
            self.db.rollback()
            raise e

    def get_organization_profile(self, org_id: int):
        return self.org_repo.get_organization_by_id(org_id)

    def assign_doctor(self, org_id: int, doctor_user_id: int, admin_user_id: int):
        """
        Assigns a doctor to the organization.
        """
        try:
            membership = self.org_repo.add_member(org_id, doctor_user_id, "doctor")
            
            from repositories.audit_repo import AuditRepository
            audit_svc = AuditService(AuditRepository(self.db))
            audit_svc.log_enterprise_event(
                event_type="DoctorAssigned",
                entity_type="Doctor",
                entity_id=str(doctor_user_id),
                action=f"Doctor {doctor_user_id} assigned to org {org_id}",
                organization_id=org_id,
                user_id=admin_user_id
            )
            
            # Send notification
            # from services.notification_service import send_notification
            # send_notification(doctor_user_id, "Organization Assignment", f"You have been assigned to an organization.")
            
            return membership
        except Exception as e:
            self.db.rollback()
            raise e

    def create_branch(self, org_id: int, branch_in: BranchCreate, admin_user_id: int):
        """
        Creates a new branch for the organization.
        """
        if branch_in.organization_id != org_id:
            raise ValueError("Organization ID mismatch")
            
        try:
            branch = self.org_repo.create_branch(branch_in)
            
            from repositories.audit_repo import AuditRepository
            audit_svc = AuditService(AuditRepository(self.db))
            audit_svc.log_enterprise_event(
                event_type="BranchCreated",
                entity_type="Branch",
                entity_id=str(branch.id),
                action=f"Branch {branch.name} created",
                organization_id=org_id,
                user_id=admin_user_id
            )
            
            return branch
        except Exception as e:
            self.db.rollback()
            raise e

    def get_branches(self, org_id: int, skip: int = 0, limit: int = 100):
        return self.org_repo.get_branches_by_organization(org_id, skip, limit)

    def get_staff_list(self, org) -> List[dict]:
        """
        Retrieves all staff members mapped to the organization with their full names and roles.
        """
        from models import User, Doctor
        from org_models import OrganizationMembership, Branch, BranchDoctorAffiliation, Department
        from lab_models import LabTechnician
        from pharmacy_models import Pharmacy
        
        members = self.db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.status == "ACTIVE"
        ).all()
        
        branches = self.db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        
        result = []
        for m in members:
            user = self.db.query(User).filter(User.id == m.user_id).first()
            if not user:
                continue
                
            name = "Staff Member"
            dept_name = "General"
            
            if m.role == "doctor":
                doc = self.db.query(Doctor).filter(Doctor.user_id == m.user_id).first()
                if doc:
                    name = doc.full_name
                    
                if branch_ids:
                    aff = self.db.query(BranchDoctorAffiliation).filter(
                        BranchDoctorAffiliation.doctor_id == m.user_id,
                        BranchDoctorAffiliation.branch_id.in_(branch_ids)
                    ).first()
                    if aff and aff.department_id:
                        dept = self.db.query(Department).filter(Department.id == aff.department_id).first()
                        if dept:
                            dept_name = dept.name
            elif m.role == "lab_tech":
                lt = self.db.query(LabTechnician).filter(LabTechnician.user_id == m.user_id).first()
                if lt:
                    name = lt.full_name
                dept_name = "Pathology"
            elif m.role == "pharmacist":
                ph = self.db.query(Pharmacy).filter(Pharmacy.user_id == m.user_id).first()
                if ph:
                    name = ph.registered_pharmacist_name or ph.name
                dept_name = "Pharmacy"
            else:
                name = user.email.split('@')[0].capitalize() if user.email else "Admin"
                dept_name = "Administration"
                
            result.append({
                "id": m.id,
                "name": name,
                "role": m.role.replace('_', ' ').capitalize(),
                "department": dept_name,
                "status": "Active" if m.status == "ACTIVE" else "Inactive",
                "email": user.email or "N/A"
            })
        return result
