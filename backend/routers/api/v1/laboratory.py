from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from database import get_db
from models import User
from security import get_current_user
from utils.responses import success_response, error_response
from lab_models import LabOrder, LabOrderItem, LabResult, SampleCollection, ResultVerification

router = APIRouter(prefix="/api/v1/laboratory", tags=["Laboratory"])

class LabOrderRequestItem(BaseModel):
    category: str
    test_name: str

class LabOrderRequest(BaseModel):
    appointment_id: int
    patient_id: int
    priority: str = "Routine"
    notes: Optional[str] = None
    items: List[LabOrderRequestItem]

@router.post("/orders")
def create_lab_order(
    request: LabOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new diagnostic order from the Doctor Portal.
    """
    new_order = LabOrder(
        appointment_id=request.appointment_id,
        patient_id=request.patient_id,
        doctor_id=current_user.id,
        priority=request.priority,
        notes=request.notes,
        status="Ordered"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    for item in request.items:
        db.add(LabOrderItem(
            order_id=new_order.id,
            category=item.category,
            test_name=item.test_name,
            status="Ordered"
        ))
    db.commit()
    
    # Event: LAB_ORDER_CREATED would be published here
    return success_response({"order_uid": new_order.order_uid}, "Lab order created successfully.")

class ResultEntry(BaseModel):
    parameter_name: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    flag: Optional[str] = None
    remarks: Optional[str] = None

class ResultSubmissionRequest(BaseModel):
    item_id: int
    results: List[ResultEntry]

@router.post("/orders/{order_uid}/results")
def submit_results(
    order_uid: str,
    request: ResultSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit structured result data for a specific order item.
    """
    # Logic to insert LabResults
    for res in request.results:
        db.add(LabResult(
            item_id=request.item_id,
            parameter_name=res.parameter_name,
            value=res.value,
            unit=res.unit,
            reference_range=res.reference_range,
            flag=res.flag,
            remarks=res.remarks
        ))
    db.commit()
    return success_response(None, "Results submitted successfully.")

@router.put("/orders/{order_uid}/verify")
def verify_results(
    order_uid: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify the final lab results.
    """
    order = db.query(LabOrder).filter(LabOrder.order_uid == order_uid).first()
    if not order:
        return error_response("Order not found", "NOT_FOUND", 404)
        
    order.status = "Verified"
    db.commit()
    
    # Event: LAB_RESULT_VERIFIED would be published here
    return success_response({"order_uid": order_uid}, "Lab order verified.")

@router.get("/queue")
def get_lab_queue(db: Session = Depends(get_db)):
    """
    Returns the active Lab Kanban queue.
    """
    return success_response({"items": []}, "Lab queue retrieved.")
