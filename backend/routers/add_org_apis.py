import os

org_file = r"d:\Vritan\backend\routers\organization.py"
content = """
# ----------------------------------------------------------------------
# NEW ORGANIZATION PORTAL ENDPOINTS (Patients, Labs, Pharmacy, Records)
# ----------------------------------------------------------------------

@router.get("/{org_id}/patients", summary="Get Organization Patients")
def get_organization_patients(
    org_id: str,
    search: Optional[str] = Query(None),
    branch_id: Optional[int] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from appointment_models import Appointment
    from models import Patient
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id, Branch.organization_id == org.id).first()
        if not branch:
            raise HTTPException(status_code=403, detail="Branch does not belong to this organization")
        branch_ids = [branch_id]
    else:
        branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        
    if not branch_ids:
        return success_response(data={"patients": [], "total": 0}, message="No patients found")
        
    query = db.query(Patient).join(Appointment, Appointment.patient_id == Patient.id).filter(
        Appointment.branch_id.in_(branch_ids)
    )
    
    if search:
        search_term = f"%{search}%"
        from sqlalchemy import or_
        query = query.filter(or_(
            Patient.full_name.ilike(search_term),
            Patient.patient_uid.ilike(search_term),
            Patient.mobile.ilike(search_term),
            Patient.email.ilike(search_term)
        ))
        
    query = query.distinct()
    total = query.count()
    patients = query.offset(offset).limit(limit).all()
    
    result = []
    for p in patients:
        latest_apt = db.query(Appointment).filter(
            Appointment.patient_id == p.id,
            Appointment.branch_id.in_(branch_ids)
        ).order_by(Appointment.id.desc()).first()
        
        branch_name = "N/A"
        apt_date = "N/A"
        apt_status = "N/A"
        
        if latest_apt:
            if latest_apt.branch:
                branch_name = latest_apt.branch.name
            apt_status = latest_apt.status
            from appointment_models import AppointmentSlot
            slot = db.query(AppointmentSlot).filter(AppointmentSlot.id == latest_apt.slot_id).first()
            if slot:
                apt_date = str(slot.date)
                
        result.append({
            "id": p.id,
            "patient_uid": p.patient_uid,
            "full_name": p.full_name,
            "mobile": p.mobile,
            "email": p.email,
            "gender": p.gender,
            "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
            "branch_name": branch_name,
            "latest_appointment_date": apt_date,
            "status": apt_status
        })
        
    return success_response(data={"patients": result, "total": total}, message="Patients retrieved successfully")


@router.get("/{org_id}/laboratories", summary="Get Organization Laboratories")
def get_organization_laboratories(
    org_id: str,
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from org_models import OrganizationLab
    from models import Laboratory
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    query = db.query(Laboratory).join(OrganizationLab, OrganizationLab.laboratory_id == Laboratory.id).filter(
        OrganizationLab.organization_id == org.id
    )
    
    total = query.count()
    labs = query.offset(offset).limit(limit).all()
    
    result = []
    for lab in labs:
        result.append({
            "id": lab.id,
            "name": lab.name,
            "email": lab.email,
            "phone": lab.phone,
            "license_number": lab.license_number if hasattr(lab, 'license_number') else getattr(lab, 'registration_number', 'N/A'),
            "status": lab.status if hasattr(lab, 'status') else 'ACTIVE'
        })
        
    return success_response(data={"laboratories": result, "total": total}, message="Laboratories retrieved successfully")


@router.get("/{org_id}/pharmacies", summary="Get Organization Pharmacies")
def get_organization_pharmacies(
    org_id: str,
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from org_models import OrganizationPharmacy
    from pharmacy_models import Pharmacy
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    query = db.query(Pharmacy).join(OrganizationPharmacy, OrganizationPharmacy.pharmacy_id == Pharmacy.id).filter(
        OrganizationPharmacy.organization_id == org.id
    )
    
    total = query.count()
    pharmacies = query.offset(offset).limit(limit).all()
    
    result = []
    for pharm in pharmacies:
        result.append({
            "id": pharm.id,
            "name": pharm.name,
            "email": pharm.email,
            "phone": pharm.phone,
            "license_number": pharm.license_number if hasattr(pharm, 'license_number') else 'N/A',
            "status": pharm.status if hasattr(pharm, 'status') else 'ACTIVE'
        })
        
    return success_response(data={"pharmacies": result, "total": total}, message="Pharmacies retrieved successfully")


@router.get("/{org_id}/medical-records", summary="Get Organization Medical Records")
def get_organization_medical_records(
    org_id: str,
    search: Optional[str] = Query(None),
    branch_id: Optional[int] = Query(None),
    record_type: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import MedicalRecord, Patient
    from appointment_models import Appointment
    from sqlalchemy import or_
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id, Branch.organization_id == org.id).first()
        if not branch:
            raise HTTPException(status_code=403, detail="Branch does not belong to this organization")
        branch_ids = [branch_id]
    else:
        branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
        branch_ids = [b.id for b in branches]
        
    if not branch_ids:
        return success_response(data={"records": [], "total": 0}, message="No records found")
        
    patients_query = db.query(Patient.id).join(Appointment, Appointment.patient_id == Patient.id).filter(
        Appointment.branch_id.in_(branch_ids)
    )
    
    query = db.query(MedicalRecord).filter(MedicalRecord.patient_id.in_(patients_query))
    
    if record_type:
        query = query.filter(MedicalRecord.record_type == record_type)
        
    if search:
        search_term = f"%{search}%"
        query = query.join(Patient, Patient.id == MedicalRecord.patient_id).filter(
            or_(
                Patient.full_name.ilike(search_term),
                Patient.patient_uid.ilike(search_term),
                MedicalRecord.notes.ilike(search_term)
            )
        )
        
    query = query.order_by(MedicalRecord.uploaded_at.desc())
    total = query.count()
    records = query.offset(offset).limit(limit).all()
    
    result = []
    for rec in records:
        patient = db.query(Patient).filter(Patient.id == rec.patient_id).first()
        uploader = db.query(User).filter(User.id == rec.uploaded_by).first()
        
        uploader_name = "Unknown"
        if uploader:
            doc = db.query(Doctor).filter(Doctor.user_id == uploader.id).first()
            if doc:
                uploader_name = f"Dr. {doc.full_name}"
            else:
                uploader_name = uploader.email
                
        branch_name = "N/A"
        latest_apt = db.query(Appointment).filter(
            Appointment.patient_id == rec.patient_id,
            Appointment.branch_id.in_(branch_ids)
        ).order_by(Appointment.id.desc()).first()
        
        if latest_apt and latest_apt.branch:
            branch_name = latest_apt.branch.name
            
        result.append({
            "id": rec.id,
            "patient_name": patient.full_name if patient else "Unknown",
            "patient_uid": patient.patient_uid if patient else "Unknown",
            "record_type": rec.record_type,
            "uploaded_at": rec.uploaded_at.isoformat() if rec.uploaded_at else None,
            "uploaded_by_name": uploader_name,
            "branch_name": branch_name,
            "notes": rec.notes,
            "view_url": f"/api/v1/organizations/{org_id}/medical-records/{rec.id}/view"
        })
        
    return success_response(data={"records": result, "total": total}, message="Medical records retrieved successfully")


@router.get("/{org_id}/medical-records/{record_id}/view", summary="View Secure Medical Record")
def view_medical_record(
    org_id: str,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import MedicalRecord, Patient
    from appointment_models import Appointment
    from fastapi.responses import FileResponse
    import os
    
    org = resolve_org(org_id, db)
    verify_member_access(org, current_user, db)
    
    record = db.query(MedicalRecord).filter(MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found")
        
    branches = db.query(Branch).filter(Branch.organization_id == org.id).all()
    branch_ids = [b.id for b in branches]
    
    apt = db.query(Appointment).filter(
        Appointment.patient_id == record.patient_id,
        Appointment.branch_id.in_(branch_ids)
    ).first()
    
    if not apt:
        raise HTTPException(status_code=403, detail="Record does not belong to a patient of this organization")
        
    file_path = record.file_url
    if file_path.startswith('/'):
        file_path = file_path[1:]
        
    if not os.path.exists(file_path):
        fallback_path = os.path.join("uploads", os.path.basename(file_path))
        if os.path.exists(fallback_path):
            file_path = fallback_path
        else:
            raise HTTPException(status_code=404, detail="File not found on server")
            
    return FileResponse(file_path, filename=record.original_filename)
"""

with open(org_file, "a") as f:
    f.write(content)

print("Appended APIs")
