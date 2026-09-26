import requests

def test_api():
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzgiLCJyb2xlIjoicGF0aWVudCIsImVtYWlsIjpudWxsLCJtb2JpbGUiOiI5Nzg1NDI4MDQwIiwiaXNfdmVyaWZpZWQiOnRydWUsImV4cCI6MTc4ODAxNjk1OSwiaWF0IjoxNzg3NDEyMTU5fQ.PcQEmS0GpDv5qyQK4EQy4cQu_5qg7SzieL931MZUjT8"
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Patient-Profile-ID": "26"
    }
    
    url = "http://127.0.0.1:8000/patient/dashboard-summary"
    print(f"GET {url}")
    response = requests.get(url, headers=headers)
    
    print("Status Code:", response.status_code)

if __name__ == "__main__":
    test_api()
