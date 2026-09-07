from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status

class ABACPolicyEngine:
    """Attribute-Based Access Control (ABAC) and District Scope Enforcer for Government WAN."""
    
    @staticmethod
    def enforce_district_scope(user_role: str, user_district: Optional[str], target_district: str) -> bool:
        # State-level administrators have statewide clearance
        if user_role in ["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR"]:
            return True

        # District-level operators & police officers are scoped strictly to their assigned district
        if user_district and user_district.lower() == target_district.lower():
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"ABAC Access Denied: User scoped to district '{user_district}' cannot access resources in '{target_district}'"
        )

    @staticmethod
    def enforce_department_scope(user_role: str, user_dept: Optional[str], target_dept: str) -> bool:
        if user_role in ["SUPER_ADMIN", "STATE_ADMIN"]:
            return True
            
        if user_dept and user_dept == target_dept:
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"ABAC Access Denied: User in department '{user_dept}' is not authorized for target department '{target_dept}'"
        )

policy_engine = ABACPolicyEngine()
