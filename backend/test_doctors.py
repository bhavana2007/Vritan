import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__)))

from database import SessionLocal
from models import User
from routers.organization import list_affiliated_doctors, list_departments, list_invitations
from routers.organization import get_dashboard_analytics # check if branches is there
from org_models import Branch

def test_endpoints():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.role == "hospital_admin").first()
        if not admin_user:
            return
            
        from org_models import OrganizationMembership
        membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == admin_user.id).first()
        org_id = membership.organization.vritan_id or str(membership.organization.id)
        
        print("Testing getDoctors...")
        try:
            print(list_affiliated_doctors(org_id=org_id, current_user=admin_user, db=db))
        except Exception as e:
            print(f"Failed getDoctors: {e}")
            
        print("Testing getDepartments...")
        try:
            print(list_departments(org_id=org_id, current_user=admin_user, db=db))
        except Exception as e:
            print(f"Failed getDepartments: {e}")
            
        print("Testing getInvitations...")
        try:
            print(list_invitations(org_id=org_id, current_user=admin_user, db=db))
        except Exception as e:
            print(f"Failed getInvitations: {e}")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_endpoints()
