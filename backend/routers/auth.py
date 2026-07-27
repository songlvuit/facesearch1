"""Simple admin auth — password check, JWT token."""
import os, time, hmac, hashlib, base64, json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)

SECRET  = os.environ.get("ADMIN_SECRET", "change-me-in-env")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
TOKEN_TTL = 86400 * 7   # 7 ngày


def _sign(payload: dict) -> str:
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig  = hmac.new(SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}.{sig}"


def _verify(token: str) -> dict:
    try:
        data, sig = token.rsplit(".", 1)
        expected = hmac.new(SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError
        payload = json.loads(base64.urlsafe_b64decode(data))
        if payload["exp"] < time.time():
            raise ValueError("expired")
        return payload
    except Exception:
        raise HTTPException(401, "Invalid or expired token")


def require_admin(creds: HTTPAuthorizationCredentials = Depends(_bearer)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    return _verify(creds.credentials)


class LoginBody(BaseModel):
    password: str


@router.post("/login")
def login(body: LoginBody):
    if not hmac.compare_digest(body.password, PASSWORD):
        raise HTTPException(401, "Sai mật khẩu")
    token = _sign({"role": "admin", "exp": time.time() + TOKEN_TTL})
    return {"token": token}


@router.get("/me")
def me(admin=Depends(require_admin)):
    return {"role": admin["role"]}
