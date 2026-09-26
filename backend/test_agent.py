import os
from dotenv import load_dotenv
load_dotenv()
print("GEMINI_API_KEY:", bool(os.getenv("GEMINI_API_KEY")))
try:
    from google import genai
    print("genai imported")
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    print("Client created")
    
    # Also test sending a message to see if it works
    chat = client.chats.create(model="gemini-3.8-flash")
    resp = chat.send_message("Hello")
    print("Response:", resp.text)
except Exception as e:
    import traceback
    traceback.print_exc()
