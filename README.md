# VRITAN Medical Application

VRITAN is a healthcare application providing a patient portal, doctor dashboard, and an integrated AI voice assistant.

## VRITAN Voice Assistant

The VRITAN Voice Assistant has been upgraded to provide a seamless hands-free conversational experience, similar to Google Assistant or Alexa. 

### Features

- **Wake-Word Activation**: You can activate the assistant hands-free by simply saying `"Hello Vritan"` or `"Hey Vritan"` when the application is open.
- **Microphone Permissions**: The app gracefully requests and handles microphone permissions. If denied, a clear message is displayed without intrusive continuous popups.
- **Continuous Speech Recognition**: Using the Web Speech API, the assistant stays active in a low-power `WAKE_LISTENING` state while the microphone is enabled.
- **Text Conversation UI**: Every interaction is transcribed. User speech appears as a chat bubble, and AI responses are displayed immediately as text before the speech synthesis begins. This guarantees responses are readable even if TTS fails.
- **High-Quality Female Voice**: The assistant uses browser-native `speechSynthesis` to automatically select an available English female voice (e.g., Zira, Samantha, Google US English). If a female voice is unavailable, it gracefully falls back to the default English voice.
- **Hands-free Interaction**: The assistant automatically returns to the `WAKE_LISTENING` state after it finishes speaking, allowing for follow-up requests without requiring manual clicks.
- **Barge-In / Interruption**: If the assistant is speaking and you start a new query, the current text-to-speech output is immediately stopped and the system starts processing the new request.
- **Authentication Integration**: The voice assistant securely uses the authenticated patient's profile and greets them by name.

### Privacy & Healthcare Safety

Because VRITAN operates in the healthcare domain, privacy is paramount:
- **No Raw Audio Stored**: Voice audio is converted to text via the browser's speech recognition engine on the client side. The raw audio recordings are immediately discarded and never sent to or permanently stored on our servers.
- **Medical Cautions**: The AI is instructed to help navigate appointments and collect intents, but it does NOT provide definitive medical diagnoses.
- **Wake Word Limitation**: This is a web application. The wake-word feature relies on the browser's Web Speech API and requires the browser tab to remain active. Browsers may suspend continuous speech recognition if the application is pushed to the background for an extended time. If a dedicated wake-word engine is desired in the future (e.g. Porcupine), it can be integrated with commercial licensing to provide a native-like background listening experience.

### Architecture

The frontend component (`VoiceAssistant.jsx`) manages an explicit state machine:
`WAKE_LISTENING` ➔ `LISTENING` ➔ `THINKING` ➔ `SPEAKING` ➔ `WAKE_LISTENING`

When the wake word is detected, the frontend sends the user's transcript to the backend via a WebSocket connection (`/voice/ws`). The AI processes the request and streams back the response text, which is immediately rendered to the screen and spoken using the `window.speechSynthesis` API.

### Development

To run the application locally:
```bash
# Terminal 1 (Backend)
cd backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
python main.py

# Terminal 2 (Frontend)
cd frontend
npm install
npm run dev
```

### Security

Security is critical to the operation of VRITAN:
- **Firebase Credentials**: Firebase service account credentials must be injected via the `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` environment variables. The repository does not store any active `serviceAccountKey.json`. A secure template (`serviceAccountKey.example.json`) is provided in the repository.
- **Environment Secrets**: All sensitive keys, including database URLs, secret tokens, and API credentials, are managed via `.env` files and must never be committed to source control.
- **Upload Security**: File uploads (such as prescriptions and medical records) are strictly validated for safe extensions (e.g., pdf, jpg, png), enforcing secure, direct path resolution to prevent directory traversal attacks.
- **Authentication**: JWT-based Bearer token authentication ensures secure transmission of identity for patients, doctors, and admins. Firebase Auth manages SMS OTP based identity mapping for patients.
- **User Isolation**: Backend endpoints strictly enforce Role-Based Access Control (RBAC). For example, a patient can only view, download, or create QR codes for their own prescriptions and medical records.
