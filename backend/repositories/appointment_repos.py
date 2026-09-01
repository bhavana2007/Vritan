from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

from repositories.base import BaseRepository
from appointment_models import (
    DoctorProfile, AppointmentSlot, 
    Appointment, MedicalTimelineEvent, AIAnalysisCache, 
    AppointmentSlotLock
)
from org_models import Department

class DepartmentRepository(BaseRepository[Department]):
    def __init__(self):
        super().__init__(Department)

class DoctorRepository(BaseRepository[DoctorProfile]):
    def __init__(self):
        super().__init__(DoctorProfile)

class SlotRepository(BaseRepository[AppointmentSlot]):
    def __init__(self):
        super().__init__(AppointmentSlot)

    def get_available_slots(self, db: Session, doctor_id: int, date: str) -> List[AppointmentSlot]:
        return db.query(AppointmentSlot).filter(
            AppointmentSlot.doctor_id == doctor_id,
            AppointmentSlot.date == date,
            AppointmentSlot.status == "AVAILABLE",
            AppointmentSlot.is_deleted == False
        ).all()

    def lock_slot(self, db: Session, slot_id: int, patient_id: int) -> bool:
        slot = self.get_by_id(db, slot_id)
        if slot and slot.status == "AVAILABLE":
            slot.status = "LOCKED"
            lock = AppointmentSlotLock(
                slot_id=slot.id, 
                patient_id=patient_id,
                expires_at=datetime.utcnow() + timedelta(minutes=5)
            )
            db.add(lock)
            db.add(slot)
            db.commit()
            return True
        return False

class AppointmentRepository(BaseRepository[Appointment]):
    def __init__(self):
        super().__init__(Appointment)

class TimelineRepository(BaseRepository[MedicalTimelineEvent]):
    def __init__(self):
        super().__init__(MedicalTimelineEvent)

class AICacheRepository(BaseRepository[AIAnalysisCache]):
    def __init__(self):
        super().__init__(AIAnalysisCache)

# Singletons for easy access
department_repo = DepartmentRepository()
doctor_repo = DoctorRepository()
slot_repo = SlotRepository()
appointment_repo = AppointmentRepository()
timeline_repo = TimelineRepository()
ai_cache_repo = AICacheRepository()
