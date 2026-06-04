from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(50))
    password = Column(String(255), nullable=True)

    patient = relationship(
        "Patient",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    doctor = relationship(
        "Doctor",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    patient_uid = Column(String(50), unique=True, index=True)
    full_name = Column(String(100))
    mobile = Column(String(20), unique=True, index=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="patient")
    medical_records = relationship(
        "MedicalRecord",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    access_requests = relationship(
        "AccessRequest",
        back_populates="patient",
        cascade="all, delete-orphan",
    )


class Doctor(Base):
    __tablename__ = "doctors"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    full_name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    hospital = Column(String(100))
    specialization = Column(String(100), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="doctor")
    access_requests = relationship(
        "AccessRequest",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    record_type = Column(String(20), nullable=False)
    file_url = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    cleaned_text = Column(Text, nullable=True)
    detected_medicines = Column(Text, nullable=True)
    probable_conditions = Column(Text, nullable=True)
    ai_structured_data = Column(Text, nullable=True)

    patient = relationship("Patient", back_populates="medical_records")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.user_id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="access_requests")
    doctor = relationship("Doctor", back_populates="access_requests")
