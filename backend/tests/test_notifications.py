import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import Base, get_db
from models import Notification
from routers.notifications import _get_current_user_id
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine
)

@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        yield db_session
    
    def override_get_current_user_id():
        return 42

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[_get_current_user_id] = override_get_current_user_id
    yield TestClient(app)
    app.dependency_overrides.clear()

from models import User

def test_get_unread_notifications(client, db_session):
    # Insert mock user with ID 42 to satisfy foreign key constraint
    user = User(id=42, role="patient", phone_number="1234567890")
    db_session.add(user)
    db_session.commit()

    notif1 = Notification(
        user_id=42,
        title="Unread 1",
        message="Message 1",
        is_read=False,
        type="alert",
        category="System"
    )
    notif2 = Notification(
        user_id=42,
        title="Read 1",
        message="Message 2",
        is_read=True,
        type="prescription",
        category="Appointment"
    )
    db_session.add(notif1)
    db_session.add(notif2)
    db_session.commit()

    response = client.get("/notifications/unread")
    assert response.status_code == 200
    res_data = response.json()
    assert "data" in res_data
    assert res_data["data"]["count"] == 1
    assert len(res_data["data"]["latest"]) == 1
    assert res_data["data"]["latest"][0]["title"] == "Unread 1"
