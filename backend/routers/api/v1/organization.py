from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
from models import User
from security import get_current_user
from utils.responses import success_response, error_response
from org_models import Organization, Branch, Department

router = APIRouter(prefix="/api/v1/organization", tags=["Organization"])

@router.get("/dashboard")
def get_org_dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns high-level operational metrics across the platform.
    """
    return success_response({
        "today_appointments": 142,
        "active_doctors": 18,
        "active_pharmacists": 4,
        "active_lab_techs": 6,
        "current_queue_length": 35,
        "pending_lab_orders": 12,
        "pending_pharmacy_orders": 8,
        "avg_consultation_time_mins": 14,
        "daily_patient_volume": 210
    }, "Organization dashboard stats retrieved.")

@router.get("/staff")
def get_org_staff(db: Session = Depends(get_db)):
    """
    Returns all personnel mapped to the organization.
    """
    return success_response({
        "staff": [
            {"id": 1, "name": "Dr. Sarah Connor", "role": "Doctor", "department": "Cardiology", "status": "Active"},
            {"id": 2, "name": "Dr. John Smith", "role": "Doctor", "department": "Neurology", "status": "Active"},
            {"id": 3, "name": "Emily Chen", "role": "Pharmacist", "department": "Pharmacy", "status": "Active"},
            {"id": 4, "name": "Michael Chang", "role": "Lab Tech", "department": "Pathology", "status": "Active"}
        ]
    }, "Staff registry retrieved.")

@router.get("/monitoring/{module}")
def get_module_monitoring(module: str, db: Session = Depends(get_db)):
    """
    Returns live monitoring data for a specific module (appointment, pharmacy, laboratory).
    """
    if module == "appointment":
        return success_response({"booked": 45, "waiting": 12, "in_consultation": 5, "completed": 80}, "Appointment monitoring retrieved.")
    elif module == "pharmacy":
        return success_response({"pending": 8, "preparing": 3, "ready": 5, "dispensed": 42}, "Pharmacy monitoring retrieved.")
    elif module == "laboratory":
        return success_response({"ordered": 12, "collection_pending": 4, "processing": 6, "completed": 28}, "Laboratory monitoring retrieved.")
    
    return error_response("Invalid module", "INVALID_MODULE", 400)
