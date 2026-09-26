import os
import sys
import time
import traceback
from pathlib import Path

# Add backend to python path
backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Helper to generate new unique data
def make_payload(suffix, name_suffix="", email_suffix="", mobile_suffix=""):
    return {
        "hospital_name": f"Test Hospital Inc {suffix} {name_suffix}".strip(),
        "legal_name": f"Test Hospital Legal {suffix} {name_suffix}".strip(),
        "hospital_type": "HOSPITAL",
        "registration_number": f"REG-{suffix}",
        "gst_number": f"GST{suffix}",
        "nabh_status": "Non-NABH",
        "nabl_status": "Non-NABL",
        "year_established": 2020,
        "website": "http://test-hospital.com",
        "country": "India",
        "state": "StateName",
        "district": "DistrictName",
        "city": "CityName",
        "mandal": "MandalName",
        "pin_code": "500001",
        "address": "123 Test Street",
        "latitude": "17.3850",
        "longitude": "78.4867",
        "representative_name": "Admin Name",
        "representative_designation": "Director",
        "representative_email": f"admin_hosp_{suffix}_{email_suffix}@example.com".replace("__", "_"),
        "representative_mobile": f"987{suffix[-7:]}" if not mobile_suffix else mobile_suffix,
        "password": "SecurePassword123"
    }

try:
    suffix = str(int(time.time()))
    print(f"--- RUNNING TEST 1: Unique Phone & Email (Should Succeed with 200) ---")
    payload1 = make_payload(suffix, name_suffix="1", email_suffix="1", mobile_suffix="")
    phone_used = payload1["representative_mobile"]
    email_used = payload1["representative_email"]
    res1 = client.post("/register-hospital", json=payload1)
    print("Response 1 Status Code:", res1.status_code)
    print("Response 1 JSON:", res1.json())
    assert res1.status_code == 200, "Test 1 Failed: Expected status 200"

    print(f"\n--- RUNNING TEST 2: Duplicate Email, Unique Phone (Should Fail with 400) ---")
    payload2 = make_payload(suffix, name_suffix="2", email_suffix="1", mobile_suffix="9000000000") # Duplicate email from Test 1, unique phone
    res2 = client.post("/register-hospital", json=payload2)
    print("Response 2 Status Code:", res2.status_code)
    print("Response 2 JSON:", res2.json())
    assert res2.status_code == 400, "Test 2 Failed: Expected status 400"
    assert "email" in res2.json()["detail"].lower(), "Test 2 Failed: Expected email warning in detail"

    print(f"\n--- RUNNING TEST 3: Duplicate Phone, Unique Email (Should Fail with 400) ---")
    payload3 = make_payload(suffix, name_suffix="3", email_suffix="3", mobile_suffix=phone_used) # Duplicate phone from Test 1, unique email
    res3 = client.post("/register-hospital", json=payload3)
    print("Response 3 Status Code:", res3.status_code)
    print("Response 3 JSON:", res3.json())
    assert res3.status_code == 400, "Test 3 Failed: Expected status 400"
    assert "phone" in res3.json()["detail"].lower(), "Test 3 Failed: Expected phone warning in detail"

    print("\n==============================================")
    print("ALL THREE TEST CASES VERIFIED SUCCESSFULLY!")
    print("==============================================")

except AssertionError as ae:
    print(f"ASSERTION FAILED: {ae}")
except Exception as e:
    print("Exception occurred during execution:")
    traceback.print_exc()
