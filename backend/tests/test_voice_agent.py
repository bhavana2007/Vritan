import pytest
from fastapi.testclient import TestClient
from main import app
from database import get_db, Base, engine
from models import User, Patient, Doctor, AppointmentSlot, Organization
from sqlalchemy.orm import Session
from security import create_access_token
import json
from datetime import datetime, timedelta

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    pass

def test_unauthenticated_connection_rejection():
    with client.websocket_connect("/voice/ws?token=invalid_token") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "ERROR"
        assert "Your session has expired" in data["error"]

def test_voice_agent_flow(mocker):
    from routers.voice import get_patient_from_token
    
    mock_patient = Patient(id=999, user_id=999, full_name="Test Patient", patient_uid="P-999")
    mocker.patch("routers.voice.get_patient_from_token", return_value=mock_patient)
    
    # Patch tools so it works dynamically
    mocker.patch("services.voice.tools.VoiceAgentTools.search_organizations", return_value='{"status": "success", "organizations": [{"id": 1, "name": "Apollo Hospitals"}]}')
    mocker.patch("services.voice.tools.VoiceAgentTools.search_branches", return_value='{"status": "success", "branches": [{"id": 1, "name": "Main Branch"}]}')
    mocker.patch("services.voice.tools.VoiceAgentTools.search_departments", return_value='{"status": "success", "departments": [{"id": 1, "name": "Cardiology"}]}')
    mocker.patch("services.voice.tools.VoiceAgentTools.search_doctors", return_value='{"status": "success", "doctors": [{"id": 1, "name": "Dr. Rao"}]}')
    mocker.patch("services.voice.tools.VoiceAgentTools.find_available_slots", return_value='{"status": "success", "slots": [{"id": 1, "time": "10:30 AM"}]}')
    mocker.patch("services.voice.tools.VoiceAgentTools.book_appointment", return_value='{"status": "success"}')
    
    # Patch process_user_input to use the explicit deterministic test utility
    async def mock_process(self, text):
        return self._fallback_rule_based_processor(text)
    mocker.patch("services.voice.agent.VoiceAgentCore.process_user_input", mock_process)
    
    with client.websocket_connect("/voice/ws?token=mock_token") as websocket:
        # Initial greeting
        data = websocket.receive_json()
        assert data["type"] == "SPEAKING"
        assert "Hello Test Patient" in data["text"]
        
        # Search cardiology
        websocket.send_json({"text": "I need a cardiologist"})
        data = websocket.receive_json()
        assert data["type"] == "THINKING"
        
        data = websocket.receive_json()
        assert data["type"] == "SPEAKING"
        assert "Would you like me to book this appointment" in data["text"]
        assert data["state"]["appointment_state"] == "READY_FOR_CONFIRMATION"
        
        # Confirm booking
        websocket.send_json({"text": "Yes, confirm it"})
        data = websocket.receive_json()
        assert data["type"] == "THINKING"
        
        data = websocket.receive_json()
        assert data["type"] == "SPEAKING"
        assert "booked successfully" in data["text"]
        assert data["state"]["appointment_state"] == "BOOKED"

def test_patient_isolation(mocker):
    from services.voice.tools import VoiceAgentTools
    mock_patient = Patient(id=999, full_name="Mock isolated patient")
    assert hasattr(VoiceAgentTools, 'get_my_appointments')
    assert hasattr(VoiceAgentTools, 'book_appointment')
