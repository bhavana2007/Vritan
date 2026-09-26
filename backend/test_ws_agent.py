import asyncio
import websockets
import json

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzgiLCJyb2xlIjoicGF0aWVudCIsImVtYWlsIjpudWxsLCJtb2JpbGUiOiI5Nzg1NDI4MDQwIiwiaXNfdmVyaWZpZWQiOnRydWUsImV4cCI6MTc5MTAwNzgzMiwiaWF0IjoxNzkwNDAzMDMyfQ.1H2V4pNAs8EAH5i2eqRGwNXwyp8YGdOGXD2xMHvhHaM"
URI = f"ws://127.0.0.1:8000/voice/ws?token={TOKEN}"

async def test_agent():
    print("Connecting to WebSocket...")
    try:
        async with websockets.connect(URI) as ws:
            print("Connected! Waiting for initial greeting...")
            greeting = await ws.recv()
            print(f"< {greeting}")
            
            requests = [
                "Hello",
                "What are my upcoming appointments?",
                "Find my appointments.",
                "What is paracetamol used for?"
            ]
            
            for req in requests:
                print(f"\n> Sending: {req}")
                await ws.send(json.dumps({"text": req}))
                
                # Wait for thinking
                thinking = await ws.recv()
                print(f"< {thinking}")
                
                # Wait for speaking
                speaking = await ws.recv()
                print(f"< {speaking}")
                
                # Sleep a bit to simulate real conversation timing
                await asyncio.sleep(2)
                
            print("\nAll tests passed successfully.")
            
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_agent())
