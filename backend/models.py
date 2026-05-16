from sqlalchemy import Boolean, Column, Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(50))
    password = Column(String(255))

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

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    patient_uid = Column(String(50), unique=True, index=True)
    full_name = Column(String(100))
    mobile = Column(String(20), unique=True, index=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    date_of_birth = Column(Date, nullable=True)

    user = relationship("User", back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    full_name = Column(String(100))
    email = Column(String(100), unique=True, index=True)
    hospital = Column(String(100))
    specialization = Column(String(100), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="doctor")
