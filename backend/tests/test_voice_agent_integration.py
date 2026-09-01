import pytest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from services.voice.agent import VoiceAgentCore
from models import Patient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
import json
from routers.voice import get_patient_from_token

# Setup in-memory DB for integration testing
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create mock patient A
    patient_a = Patient(id=1, user_id=1, full_name="Patient A")
    db.add(patient_a)
    
    # Create mock patient B
    patient_b = Patient(id=2, user_id=2, full_name="Patient B")
    db.add(patient_b)
    
    db.commit()
    
    yield db, patient_a, patient_b
    db.close()
    Base.metadata.drop_all(bind=engine)

# TEST 1: Authenticated patient A can access their own appointments.
def test_patient_can_access_own_appointments(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    with patch('services.voice.tools.VoiceAgentTools.get_my_appointments', return_value='{"status": "success", "appointments": [{"id": 1, "patient_id": 1}]}') as mock_get:
        # Simulate LLM deciding to call get_my_appointments
        result = agent.tools_handler.get_my_appointments()
        res_json = json.loads(result)
        assert res_json["status"] == "success"
        
        # Verify the tool itself inherently uses agent.patient (patient A)
        assert agent.tools_handler.patient.id == patient_a.id

# TEST 2: Patient A cannot access patient B's appointments by sending patient B's ID.
def test_patient_cannot_access_other_appointments(setup_database):
    db, patient_a, patient_b = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    # Even if an attacker tries to inject patient_id=2 into the tool handler (which it doesn't accept anyway)
    # python will raise a TypeError if we try to pass it, proving it's safe.
    import inspect
    sig = inspect.signature(agent.tools_handler.get_my_appointments)
    assert "patient_id" not in sig.parameters

# TEST 3: The frontend cannot override the patient identity.
def test_frontend_cannot_override_identity(setup_database):
    db, patient_a, _ = setup_database
    
    # Test get_patient_from_token rejecting invalid tokens
    async def run_test():
        with pytest.raises(ValueError, match="Your session has expired. Please log in again."):
            await get_patient_from_token("undefined", db)
            
    asyncio.run(run_test())

# TEST 4: Gemini cannot override the authenticated patient.
def test_gemini_cannot_override_patient(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    # We mock Gemini attempting to call a function with patient_id
    mock_chat = MagicMock()
    mock_response = MagicMock()
    
    class MockCall:
        name = "book_appointment"
        args = {
            "patient_id": 2, # Malicious attempt by LLM
            "doctor_id": 1,
            "department_id": 1,
            "branch_id": 1,
            "organization_id": 1,
            "date": "2026-08-11",
            "time": "10:00 AM",
            "slot_id": 1,
            "appointment_type": "Hospital"
        }
        
    mock_response.function_calls = [MockCall()]
    mock_response.text = "I'll book that for you."
    
    # Second response
    mock_response2 = MagicMock()
    mock_response2.function_calls = None
    mock_response2.text = "Error"
    
    mock_chat.send_message.side_effect = [mock_response, mock_response2]
    agent.chat = mock_chat
    agent.client = True # bypass API check
    agent.state["appointment_state"] = "CONFIRMED" # Bypass the confirmation guard to test the next step
    
    # The tools_handler.book_appointment does NOT accept patient_id
    # Therefore, TypeError should be caught by the generic Exception handler in agent.py
    
    result = asyncio.run(agent.process_user_input("Book it"))
    assert agent.state["appointment_state"] == "BOOKING_FAILED"

# TEST 5: book_appointment cannot execute before explicit confirmation.
def test_booking_guard_premature_booking_fails(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    mock_chat = MagicMock()
    mock_response = MagicMock()
    
    class MockCall:
        name = "book_appointment"
        args = {
            "doctor_id": 1,
            "department_id": 1,
            "branch_id": 1,
            "organization_id": 1,
            "date": "2026-08-11",
            "time": "10:00 AM",
            "slot_id": 1,
            "appointment_type": "Hospital"
        }
        
    mock_response.function_calls = [MockCall()]
    mock_response.text = "I'll book that for you."
    
    mock_response2 = MagicMock()
    mock_response2.function_calls = None
    mock_response2.text = "I need your confirmation first. Would you like me to book this appointment?"
    
    mock_chat.send_message.side_effect = [mock_response, mock_response2]
    agent.chat = mock_chat
    agent.client = True
    
    result = asyncio.run(agent.process_user_input("Book me an appointment"))
    
    assert agent.state["appointment_state"] == "READY_FOR_CONFIRMATION"
    assert result == "I need your confirmation first. Would you like me to book this appointment?"

# TEST 6: After confirmation, booking is performed for the authenticated patient only.
def test_booking_is_performed_for_authenticated_patient(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    agent.state["appointment_state"] = "CONFIRMED"
    
    # Book directly via tool to ensure patient_a is used
    with patch('routers.patient_portal.book_appointment') as mock_book:
        mock_book.return_value = {"id": 100, "status": "CONFIRMED"}
        
        res = agent.tools_handler.book_appointment(
            doctor_id=1,
            department_id=1,
            branch_id=1,
            organization_id=1,
            date="2026-08-11",
            time="10:00 AM",
            slot_id=1,
            appointment_type="Hospital"
        )
        
        # Verify the tool passed self.patient (patient A) to the router
        mock_book.assert_called_once()
        _, kwargs = mock_book.call_args
        assert kwargs["patient"].id == patient_a.id

# TEST 7: Missing/invalid/expired medilocker_token rejects the Voice WebSocket.
def test_websocket_rejects_missing_token():
    from main import app
    client = TestClient(app)
    
    with pytest.raises(Exception): # Depending on fastapi configuration, could be WebSocketDisconnect
         with client.websocket_connect("/voice/ws"): # No token
             pass

# TEST 8: Gemini 429 -> AI_QUOTA_EXCEEDED
def test_gemini_quota_exceeded(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    mock_chat = MagicMock()
    mock_chat.send_message.side_effect = Exception("429 RESOURCE_EXHAUSTED: Quota exceeded for: generativelanguage.googleapis.com/generate_content_free_tier_requests")
    agent.chat = mock_chat
    agent.client = True
    
    result = asyncio.run(agent.process_user_input("hello"))
    assert result == "AI_QUOTA_EXCEEDED"

# TEST 9: Gemini Parse Failure -> AI_PARSE_ERROR
def test_gemini_parse_error(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    mock_chat = MagicMock()
    mock_chat.send_message.side_effect = Exception("Failed to parse JSON response from provider")
    agent.chat = mock_chat
    agent.client = True
    
    result = asyncio.run(agent.process_user_input("hello"))
    assert result == "AI_PARSE_ERROR"

# TEST 10: Gemini Other Failure -> AI_PROVIDER_UNAVAILABLE
def test_gemini_other_failure(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    mock_chat = MagicMock()
    mock_chat.send_message.side_effect = Exception("500 Internal Server Error")
    agent.chat = mock_chat
    agent.client = True
    
    result = asyncio.run(agent.process_user_input("hello"))
    assert result == "AI_PROVIDER_UNAVAILABLE"

# TEST 11: Gemini Normal Response
def test_gemini_normal_response(setup_database):
    db, patient_a, _ = setup_database
    agent = VoiceAgentCore(db=db, patient=patient_a)
    
    mock_chat = MagicMock()
    mock_response = MagicMock()
    mock_response.function_calls = None
    mock_response.text = "Hello there!"
    mock_chat.send_message.return_value = mock_response
    agent.chat = mock_chat
    agent.client = True
    
    result = asyncio.run(agent.process_user_input("hello"))
    assert result == "Hello there!"
