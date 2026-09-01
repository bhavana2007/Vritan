from sqlalchemy.orm import Session
from typing import List, Optional
from models import Organization, Branch, Department, OrganizationMembership, OrganizationSettings
from schemas.organization_schema import (
    OrganizationCreate, OrganizationUpdate, 
    BranchCreate, BranchUpdate,
    DepartmentCreate
)

class OrganizationRepository:
    """
    Repository for managing Healthcare Organizations and related multi-tenant entities.
    Handles data persistence and applies multi-tenant scoping where applicable.
    """

    def __init__(self, db: Session):
        """
        Initializes the repository with a database session.
        
        Args:
            db (Session): The SQLAlchemy database session.
        """
        self.db = db

    def get_organization_by_id(self, org_id: int) -> Optional[Organization]:
        """
        Retrieves a single organization by its primary key ID.
        
        Args:
            org_id (int): The primary key ID of the organization.
            
        Returns:
            Optional[Organization]: The organization if found, else None.
        """
        return self.db.query(Organization).filter(Organization.id == org_id).first()
        
    def get_organization_by_uid(self, org_uid: str) -> Optional[Organization]:
        """
        Retrieves a single organization by its unique UID.
        
        Args:
            org_uid (str): The unique string identifier of the organization.
            
        Returns:
            Optional[Organization]: The organization if found, else None.
        """
        return self.db.query(Organization).filter(Organization.organization_uid == org_uid).first()

    def get_all_organizations(self, skip: int = 0, limit: int = 100) -> List[Organization]:
        """
        Retrieves a list of organizations with pagination.
        
        Args:
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to return.
            
        Returns:
            List[Organization]: A list of organizations.
        """
        return self.db.query(Organization).offset(skip).limit(limit).all()

    def create_organization(self, org_in: OrganizationCreate) -> Organization:
        """
        Creates a new organization.
        
        Args:
            org_in (OrganizationCreate): The data required to create an organization.
            
        Returns:
            Organization: The newly created organization instance.
        """
        db_org = Organization(**org_in.model_dump())
        self.db.add(db_org)
        self.db.commit()
        self.db.refresh(db_org)
        return db_org

    def update_organization(self, org_id: int, org_in: OrganizationUpdate) -> Optional[Organization]:
        """
        Updates an existing organization.
        
        Args:
            org_id (int): The ID of the organization to update.
            org_in (OrganizationUpdate): The updated data.
            
        Returns:
            Optional[Organization]: The updated organization, or None if not found.
        """
        db_org = self.get_organization_by_id(org_id)
        if not db_org:
            return None
            
        update_data = org_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_org, key, value)
            
        self.db.commit()
        self.db.refresh(db_org)
        return db_org

    def delete_organization(self, org_id: int) -> bool:
        """
        Deletes an organization (soft delete can be implemented later via is_active).
        
        Args:
            org_id (int): The ID of the organization to delete.
            
        Returns:
            bool: True if deleted successfully, False if not found.
        """
        db_org = self.get_organization_by_id(org_id)
        if not db_org:
            return False
            
        self.db.delete(db_org)
        self.db.commit()
        return True

    # ---------------------------------------------------------
    # Branch Management (Multi-tenant scoped)
    # ---------------------------------------------------------

    def get_branches_by_organization(self, org_id: int, skip: int = 0, limit: int = 100) -> List[Branch]:
        """
        Retrieves all branches belonging to a specific organization.
        
        Args:
            org_id (int): The ID of the organization.
            skip (int): Number of records to skip.
            limit (int): Maximum number of records to return.
            
        Returns:
            List[Branch]: List of branches for the organization.
        """
        return self.db.query(Branch).filter(Branch.organization_id == org_id).offset(skip).limit(limit).all()

    def get_branch_by_id(self, org_id: int, branch_id: int) -> Optional[Branch]:
        """
        Retrieves a branch by ID, ensuring it belongs to the specified organization.
        
        Args:
            org_id (int): The organization ID for security scoping.
            branch_id (int): The branch ID.
            
        Returns:
            Optional[Branch]: The branch if found and accessible, else None.
        """
        return self.db.query(Branch).filter(
            Branch.id == branch_id,
            Branch.organization_id == org_id
        ).first()

    def create_branch(self, branch_in: BranchCreate) -> Branch:
        """
        Creates a new branch for an organization.
        
        Args:
            branch_in (BranchCreate): The data required to create a branch.
            
        Returns:
            Branch: The newly created branch.
        """
        db_branch = Branch(**branch_in.model_dump())
        self.db.add(db_branch)
        self.db.commit()
        self.db.refresh(db_branch)
        return db_branch

    # ---------------------------------------------------------
    # Membership Management
    # ---------------------------------------------------------

    def add_member(self, org_id: int, user_id: int, role: str) -> OrganizationMembership:
        """
        Adds a user to an organization with a specific role.
        
        Args:
            org_id (int): The organization ID.
            user_id (int): The user ID (e.g. Doctor, Admin).
            role (str): The role string.
            
        Returns:
            OrganizationMembership: The membership record.
        """
        membership = OrganizationMembership(organization_id=org_id, user_id=user_id, role=role)
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def get_members_by_organization(self, org_id: int, role: Optional[str] = None) -> List[OrganizationMembership]:
        """
        Retrieves members of an organization, optionally filtered by role.
        
        Args:
            org_id (int): The organization ID.
            role (Optional[str]): Role filter (e.g. 'doctor').
            
        Returns:
            List[OrganizationMembership]: A list of organization members.
        """
        query = self.db.query(OrganizationMembership).filter(OrganizationMembership.organization_id == org_id)
        if role:
            query = query.filter(OrganizationMembership.role == role)
        return query.all()

    def remove_member(self, org_id: int, user_id: int) -> bool:
        """
        Removes a member from an organization.
        
        Args:
            org_id (int): The organization ID.
            user_id (int): The user ID to remove.
            
        Returns:
            bool: True if removed successfully, False if not found.
        """
        membership = self.db.query(OrganizationMembership).filter(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user_id
        ).first()
        
        if not membership:
            return False
            
        self.db.delete(membership)
        self.db.commit()
        return True
