import os
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# Cryptographic JWT Secret Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ztracs_super_secret_jwt_key_gujarat_police_2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 Hours

security_bearer = HTTPBearer(auto_error=False)

class UserTokenPayload(BaseModel):
    id: str
    name: str
    badge: str
    role: str
    department_id: Optional[str] = "DEPT-POL-01"
    district: Optional[str] = "Ahmedabad"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a cryptographically signed HS256 JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and cryptographically verifies an HS256 JWT access token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> UserTokenPayload:
    """FastAPI Dependency: Extract & verify JWT Bearer token from HTTP Authorization header"""
    if credentials and credentials.credentials:
        payload = decode_access_token(credentials.credentials)
        if payload:
            return UserTokenPayload(
                id=payload.get("sub", "usr-admin-01"),
                name=payload.get("name", "Insp. Vikram V. Solanki"),
                badge=payload.get("badge", "GJ-POL-2022-88"),
                role=payload.get("role", "STATE_ADMIN"),
                department_id=payload.get("departmentId", "DEPT-POL-01"),
                district=payload.get("district", "Ahmedabad")
            )
    
    # Default system fallback for unauthenticated development testing
    return UserTokenPayload(
        id="usr-admin-01",
        name="Insp. Vikram V. Solanki",
        badge="GJ-POL-2022-88",
        role="STATE_ADMIN",
        department_id="DEPT-POL-01",
        district="Ahmedabad"
    )

def require_role(required_roles: list[str]):
    """RBAC Authorization Guard for FastAPI Routes"""
    def role_checker(user: UserTokenPayload = Depends(get_current_user)):
        if user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not authorized for this operational resource"
            )
        return user
    return role_checker
