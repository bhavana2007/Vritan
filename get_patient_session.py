import requests
import json

base_url = "http://localhost:8000"

login_payload = {
    "mobile": "9876599999",
    "firebase_id_token": "mock_token_9876599999"
}

r_login = requests.post(f"{base_url}/login/patient-firebase", json=login_payload)
if r_login.status_code == 200:
    data = r_login.json()
    token = data["access_token"]
    user = data["user"]
    default_profile_id = user["profiles"][0]["id"] if user.get("profiles") else ""
    
    js_content = f"""
    localStorage.setItem('medilocker_token', {json.dumps(token)});
    localStorage.setItem('medilocker_user', {json.dumps(json.dumps(user))});
    localStorage.setItem('vritan_active_profile_id', {json.dumps(str(default_profile_id))});
    console.log('Session injected successfully');
    """
    
    with open("set_session.js", "w", encoding="utf-8") as f:
        f.write(js_content)
    print("set_session.js generated successfully!")
else:
    print("Login failed:", r_login.status_code, r_login.text)
