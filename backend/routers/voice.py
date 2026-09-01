import logging
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from security import get_current_user
from dependencies.patient_profile import get_active_patient
from services.voice.agent import VoiceAgentCore
from models import Patient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voice Agent"])

# We need a way to authenticate the WebSocket since it cannot easily send headers.
# We will accept a `token` query parameter and manually call `get_current_user` logic if needed,
# or we can rely on standard token dependency if the frontend can pass it.
# Actually, the standard way in FastAPI for WebSockets is query params or headers if the client supports it.

async def get_patient_from_token(token: str, db: Session) -> Patient:
    from security import decode_access_token
    from models import User
    
    if not token or token == "undefined" or token == "null":
        logger.warning("AUTH_FAILED: TOKEN_MISSING")
        raise ValueError("Your session has expired. Please log in again.")

    try:
        payload = decode_access_token(token)
    except Exception as e:
        logger.warning(f"AUTH_FAILED: TOKEN_EXPIRED or INVALID ({e})")
        raise ValueError("Your session has expired. Please log in again.")
        
    if not payload:
        logger.warning("AUTH_FAILED: TOKEN_INVALID")
        raise ValueError("Your session has expired. Please log in again.")
        
    user_id = payload.get("sub")
    if not user_id:
        logger.warning("AUTH_FAILED: TOKEN_INVALID_SUB")
        raise ValueError("Your session has expired. Please log in again.")
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or user.role != "patient":
        logger.warning("AUTH_FAILED: NOT_A_PATIENT")
        raise ValueError("Access denied. Only patients can use this service.")
        
    # Assume primary patient profile for simplicity
    patient = db.query(Patient).filter(Patient.user_id == user.id, Patient.is_primary == True).first()
    if not patient:
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        
    if not patient:
         logger.warning(f"AUTH_FAILED: PATIENT_NOT_FOUND for user {user.id}")
         raise ValueError("Patient profile not found. Please contact support.")
         
    return patient

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...), db: Session = Depends(get_db)):
    await websocket.accept()
    
    try:
        patient = await get_patient_from_token(token, db)
    except ValueError as ve:
        # Expected authentication error
        await websocket.send_json({"error": str(ve), "type": "ERROR"})
        await websocket.close(code=1008)
        return
    except Exception as e:
        logger.error(f"WEBSOCKET_ERROR: Unexpected error during auth: {e}")
        await websocket.send_json({"error": "An internal error occurred.", "type": "ERROR"})
        await websocket.close(code=1008)
        return

    logger.info(f"VOICE_SESSION_STARTED: Patient ID={patient.id}")
    
    agent = VoiceAgentCore(db, patient)
    
    try:
        # Send initial greeting
        initial_greeting = await agent.process_user_input("")
        await websocket.send_json({"text": initial_greeting, "type": "SPEAKING", "state": agent.state})
        
        while True:
            # We expect JSON messages containing the transcribed text from the browser's SpeechRecognition API.
            # In a full PSTN integration, we would receive raw audio bytes here,
            # run them through a backend STT provider, and then process.
            # For this V1, the browser sends the recognized text to keep latency low.
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                user_text = message.get("text", "")
            except json.JSONDecodeError:
                continue
                
            if user_text:
                await websocket.send_json({"type": "THINKING"})
                
                response_text = await agent.process_user_input(user_text)
                
                await websocket.send_json({
                    "text": response_text, 
                    "type": "SPEAKING",
                    "state": agent.state
                })
                
    except WebSocketDisconnect:
        logger.info(f"VOICE_SESSION_ENDED: Patient ID={patient.id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
             await websocket.send_json({"error": "An internal error occurred.", "type": "ERROR"})
             await websocket.close(code=1011)
        except:
             pass
