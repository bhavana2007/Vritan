import asyncio
import os
import logging
import sys
import json

logging.basicConfig(level=logging.INFO)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from models import Patient
from services.voice.tools import VoiceAgentTools

def main():
    db = SessionLocal()
    p = db.query(Patient).first()
    if not p:
        print("No patient found!")
        return
        
    tools = VoiceAgentTools(db, p)
    
    print("\n--- Testing get_patient_profile ---")
    print(tools.get_patient_profile())

    print("\n--- Testing search_organizations ---")
    orgs_res = json.loads(tools.search_organizations())
    print(orgs_res)
    
    if orgs_res.get("organizations"):
        org_id = orgs_res["organizations"][0]["id"]
        
        print(f"\n--- Testing search_branches for org {org_id} ---")
        branches_res = json.loads(tools.search_branches(org_id))
        print(branches_res)
        
        if branches_res.get("branches"):
            branch_id = branches_res["branches"][0]["id"]
            
            print(f"\n--- Testing search_departments for branch {branch_id} ---")
            depts_res = json.loads(tools.search_departments(branch_id))
            print(depts_res)
            
            if depts_res.get("departments"):
                dept_id = depts_res["departments"][0]["id"]
                
                print(f"\n--- Testing search_doctors for dept {dept_id} ---")
                docs_res = json.loads(tools.search_doctors(dept_id))
                print(docs_res)
                
                if docs_res.get("doctors"):
                    doc_id = docs_res["doctors"][0]["id"]
                    
                    print(f"\n--- Testing find_available_slots for doc {doc_id} ---")
                    # Use tomorrow's date
                    from datetime import datetime, timedelta
                    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
                    slots_res = json.loads(tools.find_available_slots(doc_id, tomorrow))
                    print(slots_res)
                    
                    if slots_res.get("slots"):
                        slot = slots_res["slots"][0]
                        print("\n--- Testing book_appointment ---")
                        book_res = json.loads(tools.book_appointment(
                            doctor_id=doc_id,
                            department_id=dept_id,
                            branch_id=branch_id,
                            organization_id=org_id,
                            date=tomorrow,
                            time=slot["time"],
                            slot_id=slot["id"],
                            appointment_type="Hospital"
                        ))
                        print(book_res)
                        
                        print("\n--- Testing get_my_appointments ---")
                        print(tools.get_my_appointments())

if __name__ == "__main__":
    main()
