import requests
res=requests.post('http://127.0.0.1:8000/login', json={'identifier':'bhavana@example.com','password':'securepassword'})
print('Login:', res.status_code, res.text[:200])
token = res.json().get('access_token')
if token:
  headers={'Authorization': f'Bearer {token}'}
  r1=requests.get('http://127.0.0.1:8000/patient/appointments/organizations', headers=headers)
  print('Orgs:', r1.status_code, len(r1.text))
  r2=requests.get('http://127.0.0.1:8000/patient/appointments', headers=headers)
  print('Apts:', r2.status_code, len(r2.text))
