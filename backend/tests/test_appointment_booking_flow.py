from datetime import date, timedelta
import os
from pathlib import Path
import sys
import uuid

import pytest
from fastapi import HTTPException, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("APP_ENV", "test")
venv_site_packages = Path(__file__).resolve().parents[1] / "venv" / "Lib" / "site-packages"
if venv_site_packages.exists():
    sys.path.append(str(venv_site_packages))

from database import Base
from models import (
    Appointment,
    AppointmentSlot,
    AppointmentSlotLock,
    Doctor,
    DoctorAvailability,
    Patient,
    User,
)
from org_models import Branch, Department, Organization
from routers import appointments as appointments_router
from routers.appointments import (
    BookAppointmentPayload,
    LockSlotPayload,
    book_appointment,
    get_available_slots,
    get_booking_status,
    lock_slot,
)


@pytest.fixture()
def booking_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def seed_booking_graph(db):
    booking_date = date.today() + timedelta(days=7)
    unique = uuid.uuid4().hex[:8]

    patient_user = User(role="patient", phone_number=f"90000{unique[:5]}")
    second_user = User(role="patient", phone_number=f"91111{unique[:5]}")
    doctor_user = User(role="doctor", email=f"doctor-{unique}@example.com")
    db.add_all([patient_user, second_user, doctor_user])
    db.flush()

    patient = Patient(
        user_id=patient_user.id,
        patient_uid=f"PAT-{unique}",
        full_name="Booking Patient",
        mobile=f"80000{unique[:5]}",
    )
    second_patient = Patient(
        user_id=second_user.id,
        patient_uid=f"PAT2-{unique}",
        full_name="Second Patient",
        mobile=f"81111{unique[:5]}",
    )
    doctor = Doctor(
        user_id=doctor_user.id,
        full_name="Dr. Booking Flow",
        email=f"dr-booking-{unique}@example.com",
        phone=f"70000{unique[:5]}",
        medical_license_number=f"LIC-{unique}",
        verification_status="APPROVED",
    )
    org = Organization(name=f"Vritan Test Hospital {unique}", status="ACTIVE")
    db.add_all([patient, second_patient, doctor, org])
    db.flush()

    branch = Branch(organization_id=org.id, name="Main Branch", status="ACTIVE")
    db.add(branch)
    db.flush()

    department = Department(branch_id=branch.id, name="Cardiology", is_active=True)
    availability = DoctorAvailability(
        doctor_id=doctor_user.id,
        branch_id=branch.id,
        day_of_week=booking_date.weekday(),
        start_time="10:00",
        end_time="10:30",
        slot_duration_minutes=30,
    )
    db.add_all([department, availability])
    db.commit()

    return {
        "patient_user": patient_user,
        "second_user": second_user,
        "doctor_id": doctor_user.id,
        "branch_id": branch.id,
        "department_id": department.id,
        "date": booking_date.isoformat(),
        "date_obj": booking_date,
        "time": "10:00 AM",
    }


def lock_seeded_slot(db, seeded):
    response = lock_slot(
        LockSlotPayload(
            doctor_id=seeded["doctor_id"],
            branch_id=seeded["branch_id"],
            date=seeded["date_obj"],
            start_time=seeded["time"],
        ),
        db,
        seeded["patient_user"],
    )
    return response["slot_id"]


def booking_payload(seeded, slot_id):
    return BookAppointmentPayload(
        doctor_id=seeded["doctor_id"],
        branch_id=seeded["branch_id"],
        department_id=seeded["department_id"],
        date=seeded["date"],
        time=seeded["time"],
        slot_id=slot_id,
        appointment_type="Hospital",
    )


def test_successful_booking_returns_confirmed_details_and_consumes_slot(booking_db):
    db = booking_db
    seeded = seed_booking_graph(db)
    slot_id = lock_seeded_slot(db, seeded)

    response = book_appointment(booking_payload(seeded, slot_id), Response(), db, seeded["patient_user"])

    data = response
    assert data["appointment_uid"].startswith("APT-")
    assert data["doctor_name"] == "Dr. Booking Flow"
    assert data["date"] == seeded["date"]
    assert data["start_time"] == "10:00"
    assert data["status"] == "Confirmed"

    assert db.query(Appointment).count() == 1
    assert db.query(AppointmentSlot).filter(AppointmentSlot.id == slot_id).one().status == "BOOKED"
    assert db.query(AppointmentSlotLock).filter(AppointmentSlotLock.slot_id == slot_id).count() == 0


def test_booked_slot_is_unavailable_after_successful_booking(booking_db):
    db = booking_db
    seeded = seed_booking_graph(db)
    slot_id = lock_seeded_slot(db, seeded)
    book_appointment(booking_payload(seeded, slot_id), Response(), db, seeded["patient_user"])

    slots = get_available_slots(
        seeded["doctor_id"],
        seeded["date_obj"],
        db,
        seeded["patient_user"],
    )

    slot = next(item for item in slots if item["start_time"] == "10:00")
    assert slot["available"] is False


def test_failed_booking_before_commit_rolls_back_and_releases_slot_lock(booking_db, monkeypatch):
    db = booking_db
    seeded = seed_booking_graph(db)
    slot_id = lock_seeded_slot(db, seeded)

    def fail_response_build(*args, **kwargs):
        raise RuntimeError("simulated response build failure")

    monkeypatch.setattr(appointments_router, "_build_appointment_response", fail_response_build)
    with pytest.raises(HTTPException) as exc_info:
        book_appointment(booking_payload(seeded, slot_id), Response(), db, seeded["patient_user"])

    assert exc_info.value.status_code == 500
    assert db.query(Appointment).count() == 0
    assert db.query(AppointmentSlot).filter(AppointmentSlot.id == slot_id).one().status == "AVAILABLE"
    assert db.query(AppointmentSlotLock).filter(AppointmentSlotLock.slot_id == slot_id).count() == 0


def test_retry_after_ambiguous_failure_is_idempotent(booking_db):
    db = booking_db
    seeded = seed_booking_graph(db)
    slot_id = lock_seeded_slot(db, seeded)
    payload = booking_payload(seeded, slot_id)

    first = book_appointment(payload, Response(), db, seeded["patient_user"])
    retry_response = Response()
    retry = book_appointment(payload, retry_response, db, seeded["patient_user"])

    assert retry_response.status_code == 200
    assert retry["id"] == first["id"]

    assert db.query(Appointment).count() == 1


def test_booking_status_recovers_committed_appointment(booking_db):
    db = booking_db
    seeded = seed_booking_graph(db)
    slot_id = lock_seeded_slot(db, seeded)
    booked = book_appointment(booking_payload(seeded, slot_id), Response(), db, seeded["patient_user"])

    status_data = get_booking_status(
        seeded["doctor_id"],
        seeded["date"],
        seeded["time"],
        str(slot_id),
        db,
        seeded["patient_user"],
    )

    assert status_data["found"] is True
    assert status_data["appointment"]["id"] == booked["id"]


def test_already_booked_slot_cannot_be_booked_by_another_patient(booking_db):
    db = booking_db
    seeded = seed_booking_graph(db)
    slot_id = lock_seeded_slot(db, seeded)
    payload = booking_payload(seeded, slot_id)

    book_appointment(payload, Response(), db, seeded["patient_user"])
    with pytest.raises(HTTPException) as exc_info:
        book_appointment(payload, Response(), db, seeded["second_user"])

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Slot is already booked."

    assert db.query(Appointment).count() == 1
