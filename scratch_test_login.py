import urllib.request
import json

url = 'https://script.google.com/macros/s/AKfycbz-qCE-vbTmE-iMA9ww8fkO5QlyT-HCAxuknR49J32F9FbuZONib6onedG8Z7hx-R0Y/exec'
payload = {
    'action': 'login',
    'identifier': 'test@test.com',
    'password': 'password123'
}

req = urllib.request.Request(
    url, 
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'text/plain'}
)

try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Body:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Exception:", str(e))
