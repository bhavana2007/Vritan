import json
from datetime import datetime
from sqlalchemy.orm import Session
from models import Patient, Prescription, MedicalRecord, PrescriptionMedicine

class ClinicalSnapshotService:
    @staticmethod
    def generate_snapshot(db: Session, patient: Patient) -> dict:
        """
        Dynamically generate a clinical snapshot from a patient's historical records.
        This snapshot is not stored permanently to avoid stale summaries.
        """
        
        prescriptions = (
            db.query(Prescription)
            .filter(Prescription.patient_id == patient.id, Prescription.deleted_at.is_(None))
            .order_by(Prescription.created_at.desc())
            .all()
        )

        records = (
            db.query(MedicalRecord)
            .filter(MedicalRecord.patient_id == patient.id)
            .order_by(MedicalRecord.uploaded_at.desc())
            .all()
        )

        # Compile conditions
        conditions = set()
        for p in prescriptions:
            if p.diagnosis:
                conditions.add(p.diagnosis.strip())
                
        for r in records:
            if r.probable_conditions:
                try:
                    pc = json.loads(r.probable_conditions)
                    if isinstance(pc, list):
                        for c in pc:
                            if isinstance(c, str):
                                conditions.add(c.strip())
                            elif isinstance(c, dict) and "condition" in c:
                                conditions.add(c["condition"].strip())
                except Exception:
                    pass
        known_conditions = sorted(list(conditions))

        # Compile allergies
        allergies = []
        if patient.allergies:
            allergies = [a.strip() for a in patient.allergies.split(",") if a.strip()]

        # Compile current medications
        meds = set()
        for p in prescriptions:
            if p.status == "ACTIVE":
                p_meds = db.query(PrescriptionMedicine).filter(PrescriptionMedicine.prescription_id == p.id).all()
                for pm in p_meds:
                    dosage_str = f" {pm.dosage}" if pm.dosage else ""
                    strength_str = f" {pm.strength}" if hasattr(pm, 'strength') and pm.strength else ""
                    freq_str = f" ({pm.frequency})" if pm.frequency else ""
                    med_name = f"{pm.medicine_name}{strength_str}{dosage_str}{freq_str}".strip()
                    meds.add(med_name)
                    
        for r in records:
            if r.detected_medicines:
                try:
                    dm = json.loads(r.detected_medicines)
                    if isinstance(dm, list):
                        for m in dm:
                            if isinstance(m, dict) and "name" in m:
                                meds.add(m["name"].strip())
                except Exception:
                    pass
        current_medications = sorted(list(meds))

        latest_diagnosis = prescriptions[0].diagnosis if prescriptions else "None recorded"

        # Latest lab report
        latest_lab_report = "None recorded"
        for r in records:
            doc_type = (r.document_type or "").lower()
            rec_type = (r.record_type or "").lower()
            if "report" in doc_type or "lab" in doc_type or "report" in rec_type or "lab" in rec_type or "blood" in doc_type:
                upload_date = r.uploaded_at.strftime('%Y-%m-%d') if r.uploaded_at else "Unknown Date"
                latest_lab_report = f"{r.original_filename} ({upload_date})"
                if r.ai_summary:
                    latest_lab_report += f" - {r.ai_summary}"
                break

        # Recent prescription
        recent_prescription = "None recorded"
        if prescriptions:
            lp = prescriptions[0]
            p_meds = db.query(PrescriptionMedicine).filter(PrescriptionMedicine.prescription_id == lp.id).all()
            med_list = ", ".join([
                f"{pm.medicine_name} ({getattr(pm, 'strength', '') or pm.dosage or ''})" 
                for pm in p_meds
            ])
            create_date = lp.created_at.strftime('%Y-%m-%d') if lp.created_at else "Unknown Date"
            recent_prescription = f"{lp.prescription_id} on {create_date}: {lp.diagnosis} ({med_list})"

        return {
            "known_conditions": known_conditions,
            "known_allergies": allergies,
            "current_medications": current_medications,
            "latest_diagnosis": latest_diagnosis,
            "latest_lab_report": latest_lab_report,
            "recent_prescription": recent_prescription,
        }
