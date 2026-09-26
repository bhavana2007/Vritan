import requests
import uuid

BASE_URL = "http://localhost:8000/api/v1"
HEADERS = {"Authorization": "Bearer test"}

# Lock a slot
lock_res = requests.post(
    f"{BASE_URL}/appointments/slots/lock",
    json={
        "doctor_id": 294,
        "date": "2026-09-01",
        "start_time": "14:00"
    },
    headers=HEADERS
)

print("Lock Response:", lock_res.status_code, lock_res.text)

if lock_res.status_code == 200:
    slot_id = lock_res.json().get("slot_id")
    # Book it
    book_res = requests.post(
        f"{BASE_URL}/appointments/book",
        json={
            "doctor_id": 294,
            "date": "2026-09-01",
            "time": "14:00",
            "slot_id": str(slot_id)
        },
        headers=HEADERS
    )
    print("Book Response:", book_res.status_code, book_res.text)
