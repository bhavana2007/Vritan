from sqlalchemy import Boolean, Column, Integer, String

from database import Base


class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    role = Column(String(50))

    name = Column(String(100))

    # Nullable: patients primarily use mobile; doctors use email
    email = Column(String(100), unique=True, nullable=True)

    # Nullable: doctors omit; patients use for login (normalized digits)
    mobile = Column(String(20), unique=True, nullable=True, index=True)

    password = Column(String(255))

    hospital = Column(String(100))

    # False until staff verifies the doctor row; meaningless for patient (stored True).
    is_verified = Column(Boolean, default=False, nullable=False)
