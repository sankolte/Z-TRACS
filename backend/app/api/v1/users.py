from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from pydantic import BaseModel
import secrets
from app.schemas.api_response import ApiResponse
from app.core.security import get_current_user, UserTokenPayload, hash_password
from app.db.user_db import (
    list_users,
    create_user,
    get_user_by_id,
    update_user_status,
    log_audit_event
)

router = APIRouter(prefix="/users", tags=["Hierarchical User Administration & Access Control"])

class UserCreatePayload(BaseModel):
    badge_id: str
    name: str
    email: str
    mobile: Optional[str] = None
    role: str = "CONTROL_ROOM_OPERATOR"
    department_id: Optional[str] = "DEPT-POL-01"
    department_name: Optional[str] = "Gujarat Police"
    district: Optional[str] = "Ahmedabad"
    clearance_level: Optional[int] = None
    status: Optional[str] = "ACTIVE"
    passphrase: Optional[str] = None
    reset_pin: Optional[str] = "1234"
    allowed_modules: Optional[List[str]] = None

class UserStatusPayload(BaseModel):
    status: str # 'ACTIVE' | 'SUSPENDED'

@router.get("")
async def get_users(
    district: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    current_user: UserTokenPayload = Depends(get_current_user)
):
    """
    Hierarchical user directory:
    - State Admin (Level 5): Views statewide roster across all 33 districts.
    - District Admin (Level 4): Strictly locked to their assigned district.
    - Operators & Field Officers: Access denied.
    """
    caller_role = current_user.role
    caller_district = current_user.district

    # Enforce Role Authorization
    if caller_role not in ["STATE_ADMIN", "DISTRICT_ADMIN", "STATE_AUDITOR", "DEPARTMENT_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to State Administrators, District Collectors & SPs only."
        )

    # Enforce District Boundary for District Admin
    effective_district = district
    if caller_role == "DISTRICT_ADMIN":
        effective_district = caller_district

    users = await list_users(
        district_filter=effective_district,
        role_filter=role,
        status_filter=status_filter,
        search_query=search
    )

    return ApiResponse.ok({
        "users": users,
        "total": len(users),
        "scope": "STATEWIDE" if caller_role == "STATE_ADMIN" else f"DISTRICT_LOCKED ({caller_district})"
    })

@router.post("")
async def provision_user(
    payload: UserCreatePayload,
    request: Request,
    current_user: UserTokenPayload = Depends(get_current_user)
):
    """
    Hierarchical User Provisioning:
    - State Admin (Level 5): Can provision District Admins (L4), Field Operators (L3) across all districts.
    - District Admin (Level 4): Can ONLY provision Level 3 Field Operators/Inspectors within their assigned district.
    """
    caller_role = current_user.role
    caller_district = current_user.district

    if caller_role not in ["STATE_ADMIN", "DISTRICT_ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative provisioning privileges."
        )

    # Hierarchical Constraints for District Admin (Level 4)
    if caller_role == "DISTRICT_ADMIN":
        if payload.role in ["STATE_ADMIN", "STATE_AUDITOR"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="District Administrators cannot provision State-level administrative accounts."
            )
        if payload.district and payload.district != caller_district and payload.district != "Statewide (All)":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Jurisdiction violation: You are assigned to '{caller_district}' and cannot provision accounts for '{payload.district}'."
            )
        # Force district to caller's district
        payload.district = caller_district

    # Determine Clearance Level
    clearance_map = {
        "STATE_ADMIN": 5,
        "DISTRICT_ADMIN": 4,
        "DEPARTMENT_ADMIN": 4,
        "STATE_AUDITOR": 4,
        "CONTROL_ROOM_OPERATOR": 3,
        "POLICE_OFFICER": 3,
        "DISTRICT_OFFICER": 4
    }
    clearance = payload.clearance_level or clearance_map.get(payload.role, 3)

    # Passphrase handling
    plain_password = payload.passphrase.strip() if (payload.passphrase and payload.passphrase.strip()) else "Admin@1234"
    hashed_pwd = hash_password(plain_password)
    user_id = f"usr-{secrets.token_hex(4)}"

    # Default modules based on role
    allowed_modules = payload.allowed_modules
    if not allowed_modules:
        if payload.role in ["STATE_ADMIN", "DISTRICT_ADMIN"]:
            allowed_modules = ["overview", "cctv-gis", "registry", "sentinel-live-wall", "anpr-search", "vehicle-journey", "gap-analysis", "reports", "audit-logs", "administration"]
        else:
            allowed_modules = ["overview", "cctv-gis", "sentinel-live-wall", "anpr-search", "vehicle-journey"]

    user_record = {
        "id": user_id,
        "badge_id": payload.badge_id.strip().upper(),
        "name": payload.name.strip(),
        "email": payload.email.strip().lower(),
        "mobile": payload.mobile,
        "role": payload.role,
        "department_id": payload.department_id,
        "department_name": payload.department_name,
        "district": payload.district or "Ahmedabad",
        "clearance_level": clearance,
        "status": payload.status or "ACTIVE",
        "hashed_password": hashed_pwd,
        "reset_pin": payload.reset_pin or "1234",
        "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
        "allowed_modules": allowed_modules
    }

    try:
        created = await create_user(user_record)
        client_ip = request.client.host if request.client else "10.142.1.25"
        
        # Log to Immutable Audit Ledger
        await log_audit_event(
            operator_id=current_user.badge,
            operator_name=current_user.name,
            action=f"CREATE_USER (Badge: {payload.badge_id.upper()}, Role: {payload.role}, District: {payload.district})",
            ip_address=client_ip
        )

        return ApiResponse.ok({
            "user": created,
            "temporaryPassphrase": plain_password,
            "resetPin": payload.reset_pin or "1234",
            "message": "User provisioned successfully in AWS RDS Personnel Registry."
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User provisioning failed: {str(e)}"
        )

@router.patch("/{user_id}/status")
async def toggle_status(
    user_id: str,
    payload: UserStatusPayload,
    request: Request,
    current_user: UserTokenPayload = Depends(get_current_user)
):
    """Suspend or reactivate a user account"""
    caller_role = current_user.role
    if caller_role not in ["STATE_ADMIN", "DISTRICT_ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized action")

    target_user = await get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # District admin cannot suspend state admins or users outside district
    if caller_role == "DISTRICT_ADMIN":
        if target_user.get("role") == "STATE_ADMIN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot alter State Administrator account")
        if target_user.get("district") != current_user.district:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot alter accounts outside your district")

    new_status = payload.status.upper()
    if new_status not in ["ACTIVE", "SUSPENDED"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    success = await update_user_status(user_id, new_status)

    client_ip = request.client.host if request.client else "10.142.1.25"
    action_type = f"USER_{new_status}"
    await log_audit_event(
        operator_id=current_user.badge,
        operator_name=current_user.name,
        action=f"{action_type} (Badge: {target_user.get('badge_id')})",
        ip_address=client_ip
    )

    return ApiResponse.ok({
        "success": success,
        "userId": user_id,
        "newStatus": new_status
    })
