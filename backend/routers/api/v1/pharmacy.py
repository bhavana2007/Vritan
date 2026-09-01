from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
from models import User
from security import get_current_user
from utils.responses import success_response, error_response
from pharmacy_models import PharmacyOrder, PharmacyOrderItem

router = APIRouter(prefix="/api/v1/pharmacy", tags=["Pharmacy"])

class ManualPrescriptionItem(BaseModel):
    medicine_name: str
    strength: Optional[str] = None
    dosage: str
    frequency: str
    duration_days: int
    quantity_prescribed: int
    instructions: Optional[str] = None

class ManualPrescriptionRequest(BaseModel):
    external_patient_name: str
    external_doctor_name: str
    external_hospital_name: str
    notes: Optional[str] = None
    items: List[ManualPrescriptionItem]

@router.post("/orders/manual")
def create_manual_prescription(
    request: ManualPrescriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates an external prescription manually entered by the pharmacist.
    """
    # Requires pharmacist role in real impl
    new_order = PharmacyOrder(
        source="External",
        external_patient_name=request.external_patient_name,
        external_doctor_name=request.external_doctor_name,
        external_hospital_name=request.external_hospital_name,
        notes=request.notes,
        status="Pending"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    for item in request.items:
        db.add(PharmacyOrderItem(
            order_id=new_order.id,
            medicine_name=item.medicine_name,
            strength=item.strength,
            dosage=item.dosage,
            frequency=item.frequency,
            duration_days=item.duration_days,
            quantity_prescribed=item.quantity_prescribed,
            instructions=item.instructions
        ))
    db.commit()
    
    return success_response({"order_uid": new_order.order_uid}, "External prescription created successfully.")

@router.put("/orders/{order_uid}/verify")
def verify_order(
    order_uid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifies a pending order before preparation.
    """
    order = db.query(PharmacyOrder).filter(PharmacyOrder.order_uid == order_uid).first()
    if not order:
        return error_response("Order not found", "ORDER_NOT_FOUND", 404)
        
    if order.status != "Pending":
        return error_response("Only pending orders can be verified", "INVALID_TRANSITION", 400)
        
    order.status = "Verified"
    db.commit()
    return success_response({"order_uid": order_uid, "status": "Verified"}, "Order verified.")

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns counts for dashboard cards.
    """
    return success_response({
        "pending": 5,
        "preparing": 2,
        "ready": 3,
        "dispensed_today": 12
    }, "Dashboard stats retrieved.")

@router.get("/queue")
def get_pharmacy_queue(db: Session = Depends(get_db)):
    """
    Returns the active Kanban queue.
    """
    return success_response({"items": []}, "Queue retrieved.")
