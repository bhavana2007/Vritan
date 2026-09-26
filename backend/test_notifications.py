import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
import routers.auth
routers.auth.verify_firebase_token = lambda x: {'uid': 'firebase_uid_upload_test', 'phone_number': '+919876543211'}
login_resp = client.post('/login/patient-firebase', json={'firebase_id_token': '123', 'mobile': '9876543211'})
access_token = login_resp.json()['access_token']
response = client.get('/notifications/unread', headers={'Authorization': 'Bearer ' + access_token})
print(response.status_code, response.json())
