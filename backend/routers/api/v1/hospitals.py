from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from database import get_db
from models import User
from security import get_current_user
from org_models import Organization, Branch, Department
from utils.responses import success_response, error_response

router = APIRouter(prefix="/api/v1/hospitals", tags=["Hospitals"])

@router.get("/search")
@router.get("")
def search_hospitals(
    q: Optional[str] = Query(None, description="General search query"),
    search: Optional[str] = Query(None, description="General search query (alias)"),
    name: Optional[str] = Query(None, description="Search by hospital name"),
    city: Optional[str] = Query(None, description="Filter by city"),
    organization_type: Optional[str] = Query(None, description="Government or Private"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Search and filter hospitals using the canonical Organization table.
    Supports both q and search query parameters, and endpoints GET / and GET /search.
    """
    query_term = q or search
    
    query_obj = db.query(Organization).filter(
        Organization.is_deleted == False,
        Organization.status == "ACTIVE",
        Organization.verification_status.in_(["VERIFIED", "APPROVED"])
    )
    
    if query_term:
        term = f"%{query_term.strip()}%"
        query_obj = query_obj.filter(
            or_(
                Organization.name.ilike(term),
                Organization.vritan_id.ilike(term),
                Organization.city.ilike(term),
                Organization.state.ilike(term)
            )
        )
        
    if name:
        query_obj = query_obj.filter(Organization.name.ilike(f"%{name.strip()}%"))
        
    if city:
        query_obj = query_obj.filter(Organization.city.ilike(f"%{city.strip()}%"))
        
    if organization_type:
        query_obj = query_obj.filter(Organization.organization_type == organization_type)
        
    organizations = query_obj.all()
    
    results = []
    for org in organizations:
        # Fetch branches under organization
        branches = db.query(Branch).filter(
            Branch.organization_id == org.id,
            Branch.is_deleted == False,
            Branch.status == "ACTIVE"
        ).all()
        
        # Fetch departments
        branch_ids = [b.id for b in branches]
        departments = []
        if branch_ids:
            depts = db.query(Department).filter(
                Department.branch_id.in_(branch_ids),
                Department.is_deleted == False,
                Department.is_active == True
            ).all()
            departments = [d.name for d in depts if d.name]
            
        results.append({
            "hospital_uid": org.organization_uid,
            "vritan_id": org.vritan_id,
            "name": org.name,
            "city": org.city or "",
            "state": org.state or "",
            "organization_type": org.organization_type,
            "departments": list(set(departments)),
            "branches": [
                {
                    "branch_uid": b.branch_uid,
                    "name": b.name,
                    "city": org.city or "",
                    "address": b.address or ""
                } for b in branches
            ]
        })
        
    # Pagination
    paginated = results[skip : skip + limit]
    
    return success_response({
        "total": len(results),
        "skip": skip,
        "limit": limit,
        "items": paginated
    }, "Hospitals retrieved successfully.")

@router.get("/{hospital_uid}")
def get_hospital(
    hospital_uid: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve a specific organization/hospital by UID or Vritan ID.
    """
    org = db.query(Organization).filter(
        or_(
            Organization.organization_uid == hospital_uid,
            Organization.vritan_id == hospital_uid
        ),
        Organization.is_deleted == False
    ).first()
    
    if not org:
        return error_response("Hospital not found", "HOSPITAL_NOT_FOUND", 404)
        
    return success_response({
        "hospital_uid": org.organization_uid,
        "vritan_id": org.vritan_id,
        "name": org.name,
        "organization_type": org.organization_type,
        "city": org.city or "",
        "state": org.state or ""
    })
