import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User
from org_models import Organization, OrganizationMembership, StaffRole, Branch, Department, OrganizationEmployeeAssignment
import pytest

client = TestClient(app)

@pytest.fixture(scope="module")
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_org_admin_doctors_api(db):
    """
    Regression test to ensure GET /api/v1/organizations/{org_id}/doctors works
    and returns 200 without throwing 500 unhandled exceptions.
    """
    admin = db.query(User).filter(User.role == "hospital_admin").first()
    if not admin:
        pytest.skip("No hospital_admin user found in DB to test with")
        
    membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == admin.id).first()
    if not membership:
        pytest.skip("Hospital admin user has no organization membership")
        
    org = membership.organization
    org_id = org.vritan_id or str(org.id)
    
    # Mock authentication token
    from security import create_access_token
    token = create_access_token(data={"sub": admin.email, "role": admin.role})
    headers = {"Authorization": f"Bearer {token}"}
    
    # Also test that the other endpoints called in the frontend work
    res_doctors = client.get(f"/api/v1/organizations/{org_id}/doctors", headers=headers)
    assert res_doctors.status_code == 200, f"Doctors endpoint failed: {res_doctors.text}"
    
    res_branches = client.get(f"/api/v1/organizations/{org_id}/branches", headers=headers)
    assert res_branches.status_code == 200, f"Branches endpoint failed: {res_branches.text}"
    
    res_depts = client.get(f"/api/v1/organizations/{org_id}/departments", headers=headers)
    assert res_depts.status_code == 200, f"Departments endpoint failed: {res_depts.text}"
    
    res_invites = client.get(f"/api/v1/organizations/{org_id}/invitations", headers=headers)
    assert res_invites.status_code == 200, f"Invitations endpoint failed: {res_invites.text}"

    # Verify response schema
    data = res_doctors.json()
    assert "success" in data
    assert data["success"] is True
    assert "data" in data
    assert isinstance(data["data"], list)
