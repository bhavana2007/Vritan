import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import get_db, engine
from models import User, Patient, Doctor
from org_models import Organization, Branch, OrganizationMembership
from appointment_models import Appointment, AppointmentSlot
from sqlalchemy.orm import Session

client = TestClient(app)

def test_get_organization_appointments_unauthorized():
    # Attempting to query appointments without auth
    response = client.get("/api/v1/organizations/VR-HOSP-000001/appointments")
    # Should require login
    assert response.status_code == 401 or response.status_code == 403

def test_get_organization_appointments_valid(db_session: Session = next(get_db())):
    # Let's verify route exists in the app routes
    route_paths = [route.path for route in app.routes]
    assert any("/organizations/{org_id}/appointments" in path for path in route_paths)
    print("Route verification passed: Route is registered on FastAPI app.")
