import asyncio
import websockets
import json
from datetime import datetime, timedelta

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzgiLCJyb2xlIjoicGF0aWVudCIsImVtYWlsIjpudWxsLCJtb2JpbGUiOiI5Nzg1NDI4MDQwIiwiaXNfdmVyaWZpZWQiOnRydWUsImV4cCI6MTc5MTAwNzgzMiwiaWF0IjoxNzkwNDAzMDMyfQ.1H2V4pNAs8EAH5i2eqRGwNXwyp8YGdOGXD2xMHvhHaM"
URI = f"ws://127.0.0.1:8000/voice/ws?token={TOKEN}"

async def send_msg(ws, text):
    print(f"\n> Patient: {text}")
    await ws.send(json.dumps({"text": text}))
    
    # Process all incoming messages until we get a SPEAKING message
    # Some messages might be THINKING
    while True:
        msg_str = await ws.recv()
        msg = json.loads(msg_str)
        if msg.get("type") == "THINKING":
            print(f"< [Agent is thinking...]")
        elif msg.get("type") == "SPEAKING":
            print(f"< Agent: {msg.get('text')}")
            if msg.get('text') == "AI_PROVIDER_UNAVAILABLE":
                raise Exception("AI_PROVIDER_UNAVAILABLE")
            return msg.get("text")
        elif msg.get("type") == "ERROR":
            print(f"<! ERROR: {msg.get('error')}")
            return None
        else:
            print(f"< {msg}")

async def test_agent():
    print("Connecting to WebSocket...")
    try:
        async with websockets.connect(URI) as ws:
            print("Connected! Waiting for initial greeting...")
            greeting = await ws.recv()
            print(f"< Agent: {json.loads(greeting).get('text')}")
            
            # Step 1: Patient complaint
            await send_msg(ws, "I have a fever and body ache.")
            
            # Wait a little for realism
            await asyncio.sleep(2)
            
            # Step 2: Patient agrees to book
            await send_msg(ws, "Yes, please find a hospital.")
            
            await asyncio.sleep(2)
            
            # Step 3: Patient asks for tomorrow
            await send_msg(ws, "Tomorrow please.")
            
            await asyncio.sleep(2)
            
            # Step 4: Patient picks the first slot and confirms
            await send_msg(ws, "Yes, that sounds good. Book it.")
            
            await asyncio.sleep(2)
            
            print("\nConversation finished.")
            
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    for i in range(10):
        try:
            asyncio.run(test_agent())
            break
        except Exception as e:
            if str(e) == "AI_PROVIDER_UNAVAILABLE":
                print("\nRetrying due to 503 from Gemini...\n")
                import time
                time.sleep(2)
            else:
                break
