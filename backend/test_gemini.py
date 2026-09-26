import asyncio
import os
import logging
import sys

logging.basicConfig(level=logging.INFO)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from models import Patient
from services.voice.agent import VoiceAgentCore

async def main():
    db = SessionLocal()
    p = db.query(Patient).first()
    if not p:
        print("No patient found!")
        return
        
    agent = VoiceAgentCore(db, p)
    print("Testing Gemini...")
    res = await agent.process_user_input("Respond with exactly: VRITAN VOICE ONLINE")
    print(f"Response: {res}")

if __name__ == "__main__":
    asyncio.run(main())
