from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db
from models import User
from security import get_current_user
from repositories.organization_repo import OrganizationRepository
from utils.exceptions import UnauthorizedOrganizationAccess, OrganizationNotFound

def get_org_repo(db: Session = Depends(get_db)) -> OrganizationRepository:
    return OrganizationRepository(db)

def require_org_admin(org_id: int, current_user: User = Depends(get_current_user), org_repo: OrganizationRepository = Depends(get_org_repo)):
    """
    Validates that the current user is an admin of the specified organization.
    """
    memberships = org_repo.get_members_by_organization(org_id)
    if not any(m.user_id == current_user.id and m.role == "admin" for m in memberships):
        raise UnauthorizedOrganizationAccess()
    return current_user

def require_org_member(org_id: int, current_user: User = Depends(get_current_user), org_repo: OrganizationRepository = Depends(get_org_repo)):
    """
    Validates that the current user is ANY active member of the specified organization.
    """
    memberships = org_repo.get_members_by_organization(org_id)
    if not any(m.user_id == current_user.id for m in memberships):
        raise UnauthorizedOrganizationAccess()
    return current_user

from fastapi import HTTPException
from org_models import Branch

def require_branch_admin(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Validates that the current user is a branch_admin for the specific branch and the branch is ACTIVE.
    """
    if current_user.role != "branch_admin":
        raise UnauthorizedOrganizationAccess(detail="Must be a branch admin.")
        
    from org_models import OrganizationMembership
    mem = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == current_user.id,
        OrganizationMembership.branch_id == branch_id,
        OrganizationMembership.role == "branch_admin"
    ).first()
    
    if not mem:
        raise UnauthorizedOrganizationAccess(detail="Access denied to this branch.")
        
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch or not branch.is_active:
        raise HTTPException(status_code=403, detail="This branch is currently inactive. Please contact your Hospital Administrator.")
        
    return current_user

