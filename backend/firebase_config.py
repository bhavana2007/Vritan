import os
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin
def initialize_firebase():
    if not firebase_admin._apps:
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized successfully.")
        else:
            print("==========================================================================")
            print("WARNING: FIREBASE_SERVICE_ACCOUNT_PATH is missing or invalid in .env")
            print("Firebase authentication for patients will NOT work.")
            print("To fix this:")
            print("1. Download your service account JSON from Firebase Console.")
            print("2. Place it securely in your project (e.g., backend/firebase-adminsdk.json)")
            print("3. Add FIREBASE_SERVICE_ACCOUNT_PATH=firebase-adminsdk.json to your .env")
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
