import pytest
import asyncio
from unittest.mock import MagicMock, patch
import json
from google.genai import types

from services.voice.agent import VoiceAgentCore
from models import Patient

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def mock_patient():
    p = MagicMock(spec=Patient)
    p.full_name = "Test Patient"
    p.id = 1
    p.user_id = 100
    return p

class MockChat:
    def __init__(self):
        self._history = []
        self.send_message_mock = MagicMock()
        
    def send_message(self, text_or_parts):
        return self.send_message_mock(text_or_parts)
        
    def get_history(self):
        return self._history

@pytest.fixture
def voice_agent(mock_db, mock_patient):
    # Mock environment variable to prevent real genai initialization
    with patch("os.getenv", return_value="fake_key"):
        with patch("google.genai.Client") as MockClient:
            agent = VoiceAgentCore(mock_db, mock_patient)
            
            # Replace the chat object with our MockChat
            agent.chat = MockChat()
            agent.client = MagicMock()
            
            # Mock tools_handler to avoid real DB hits in basic tests
            agent.tools_handler = MagicMock()
            return agent

def test_macro_tool_used_and_deterministic_response(voice_agent):
    # Setup mock to return a function call for find_doctor_appointment
    mock_response = MagicMock()
    mock_fc = MagicMock()
    mock_fc.name = "find_doctor_appointment"
    mock_fc.args = {"specialty": "cardiologist", "date": "2026-08-11"}
    mock_response.function_calls = [mock_fc]
    
    voice_agent.chat.send_message_mock.return_value = mock_response
    
    # Setup tools handler to return success
    voice_agent.tools_handler.find_doctor_appointment.return_value = json.dumps({
        "success": True,
        "doctor": "Smith",
        "doctor_id": 10,
        "organization": "Apollo",
        "organization_id": 1,
        "branch_id": 2,
        "department_id": 3,
        "date": "2026-08-11",
        "time": "10:00 AM",
        "slot_id": 5,
        "appointment_type": "Hospital"
    })
    
    response_text = asyncio.run(voice_agent.process_user_input("I need a cardiologist tomorrow"))
    
    # Assertions
    assert "I found Dr. Smith at Apollo on 2026-08-11 at 10:00 AM" in response_text
    assert voice_agent.state["appointment_state"] == "READY_FOR_CONFIRMATION"
    assert voice_agent.state["doctor"] == 10
    
    # Ensure Gemini was only called ONCE
    assert voice_agent.gemini_request_count == 1
    voice_agent.chat.send_message_mock.assert_called_once()
    
    # Ensure history was manipulated
    assert len(voice_agent.chat.get_history()) == 2
    assert voice_agent.chat.get_history()[0].role == "user" # The function response
    assert voice_agent.chat.get_history()[1].role == "model" # The deterministic text

def test_booking_without_confirmation_blocked(voice_agent):
    # Agent tries to book without being confirmed
    voice_agent.state["appointment_state"] = "IDLE"
    
    mock_response = MagicMock()
    mock_fc = MagicMock()
    mock_fc.name = "book_appointment"
    mock_fc.args = {"doctor_id": 10, "date": "2026-08-11", "time": "10:00 AM", "slot_id": 5, "appointment_type": "Hospital"}
    mock_response.function_calls = [mock_fc]
    
    voice_agent.chat.send_message_mock.return_value = mock_response
    
    response_text = asyncio.run(voice_agent.process_user_input("Book it"))
    
    # Must block
    assert "I need your confirmation" in response_text
    assert voice_agent.state["appointment_state"] == "READY_FOR_CONFIRMATION"
    voice_agent.tools_handler.book_appointment.assert_not_called()

def test_yes_confirm_allows_booking(voice_agent):
    # Agent is ready for confirmation
    voice_agent.state["appointment_state"] = "READY_FOR_CONFIRMATION"
    
    # Setup mock to return a function call for book_appointment
    mock_response = MagicMock()
    mock_fc = MagicMock()
    mock_fc.name = "book_appointment"
    mock_fc.args = {"doctor_id": 10, "date": "2026-08-11", "time": "10:00 AM", "slot_id": 5, "appointment_type": "Hospital"}
    mock_response.function_calls = [mock_fc]
    
    # When user says "yes, confirm", it should trigger a book_appointment from LLM
    voice_agent.chat.send_message_mock.return_value = mock_response
    
    # Setup tools handler to return success
    voice_agent.tools_handler.book_appointment.return_value = json.dumps({
        "status": "success",
        "appointment": {"scheduled_date": "2026-08-11", "scheduled_time": "10:00 AM"}
    })
    
    response_text = asyncio.run(voice_agent.process_user_input("Yes, confirm"))
    
    # Assertions
    assert "Your appointment has been booked successfully" in response_text
    assert voice_agent.state["appointment_state"] == "BOOKED"
    voice_agent.tools_handler.book_appointment.assert_called_once()
    assert voice_agent.gemini_request_count == 1

def test_macro_tool_no_availability(voice_agent):
    mock_response = MagicMock()
    mock_fc = MagicMock()
    mock_fc.name = "find_doctor_appointment"
    mock_fc.args = {"specialty": "cardiologist", "date": "2026-08-11"}
    mock_response.function_calls = [mock_fc]
    
    voice_agent.chat.send_message_mock.return_value = mock_response
    
    # Setup tools handler to return failure
    voice_agent.tools_handler.find_doctor_appointment.return_value = json.dumps({
        "success": False,
        "reason": "NO_AVAILABLE_SLOT"
    })
    
    response_text = asyncio.run(voice_agent.process_user_input("I need a cardiologist"))
    
    assert "I couldn't find an available appointment" in response_text
    assert voice_agent.gemini_request_count == 1
    
def test_macro_tool_db_logic():
    # This tests the DB logic inside find_doctor_appointment
    from services.voice.tools import VoiceAgentTools
    
    mock_db = MagicMock()
    mock_patient = MagicMock(spec=Patient)
    tools = VoiceAgentTools(mock_db, mock_patient)
    
    # Ensure patient identity is secure and cannot be overridden by Gemini args
    # The tool signature does NOT accept patient_id
    import inspect
    sig = inspect.signature(tools.find_doctor_appointment)
    assert "patient_id" not in sig.parameters
    assert "user_id" not in sig.parameters
