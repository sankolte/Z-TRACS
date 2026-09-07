from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.schemas.api_response import ApiResponse
from app.core.security import get_current_user, UserTokenPayload, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str = "STATE_ADMIN"

@router.post("/login")
async def login(credentials: LoginRequest):
    # Simulated User Payload
    user_payload = {
        "sub": "usr-admin-01",
        "name": "Insp. Vikram V. Solanki",
        "badge": "GJ-POL-2022-88",
        "role": credentials.role,
        "departmentId": "DEPT-POL-01",
        "district": "Ahmedabad"
    }

    # Generate real signed HS256 JWT access token
    access_token = create_access_token(
        data=user_payload,
        expires_delta=timedelta(days=1)
    )

    return ApiResponse.ok({
        "accessToken": access_token,
        "tokenType": "Bearer",
        "expiresIn": 86400,
        "user": {
            "id": user_payload["sub"],
            "name": user_payload["name"],
            "badge": user_payload["badge"],
            "role": user_payload["role"],
            "departmentId": user_payload["departmentId"],
            "district": user_payload["district"]
        }
    })

@router.get("/me")
async def get_me(user: UserTokenPayload = Depends(get_current_user)):
    return ApiResponse.ok(user)
