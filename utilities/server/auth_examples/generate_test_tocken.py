import jwt
from datetime import datetime, timedelta

SECRET = "my-super-secret-key-at-least-32-chars"
payload = {
    "sub": "test-user",
    "name": "Test User",
    "iat": datetime.utcnow(),
    "exp": datetime.utcnow() + timedelta(hours=1),
}
token = jwt.encode(payload, SECRET, algorithm="HS256")
print(token)
