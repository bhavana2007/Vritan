import os
import json
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin
def initialize_firebase():
    if not firebase_admin._apps:
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        
        try:
            if service_account_json:
                cred_dict = json.loads(service_account_json)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin initialized successfully from JSON environment variable.")
            elif service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin initialized successfully from file path.")
            else:
                print("==========================================================================")
                print("WARNING: Firebase credentials missing in environment.")
                print("Firebase authentication for patients will NOT work.")
                print("To fix this for Render (Production):")
                print("1. Open your downloaded service account JSON file.")
                print("2. Copy its entire content.")
                print("3. In Render Dashboard, add a new Environment Variable named:")
                print("   FIREBASE_SERVICE_ACCOUNT_JSON")
                print("4. Paste the JSON content as the value.")
                print("==========================================================================")
        except Exception as e:
            print("==========================================================================")
            print(f"ERROR initializing Firebase: {e}")
            print("==========================================================================")

# Call this during startup
initialize_firebase()

def verify_firebase_token(id_token: str):
    """
    Verifies a Firebase ID token.
    Supports mock tokens (mock_token_<phone>) for development and testing.
    """
    if id_token and id_token.startswith("mock_"):
        parts = id_token.split("_")
        phone = parts[-1] if len(parts) > 1 and parts[-1].isdigit() else "9876543210"
        # Format phone with country code if missing
        if not phone.startswith("+"):
            phone = f"+91{phone}"
        return {
            "uid": id_token,
            "phone_number": phone,
            "firebase": {"sign_in_provider": "phone"}
        }

    if not firebase_admin._apps:
        raise RuntimeError("Firebase Admin SDK is not initialized on the backend. Please configure FIREBASE_SERVICE_ACCOUNT_PATH in your .env file.")

    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        raise ValueError(f"Invalid Firebase ID token: {e}")
