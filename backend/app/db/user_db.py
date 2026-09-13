"""
User Database Operations & AWS RDS Integration
Manages users table queries, password updates, hierarchical user listing, and audit logging.
"""
from typing import Optional, List, Dict, Any
import asyncpg
import json
from app.core.config import settings

async def get_db_connection():
    try:
        return await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            timeout=5.0
        )
    except Exception as e:
        print(f"[RDS WARNING] Database connection error: {e}")
        return None

async def log_audit_event(operator_id: str, operator_name: str, action: str, ip_address: str = "10.142.1.25"):
    """Inserts an immutable governance audit event into AWS RDS"""
    conn = await get_db_connection()
    if not conn:
        return
    try:
        await conn.execute("""
            INSERT INTO audit_logs (operator_id, operator_name, action, ip_address)
            VALUES ($1, $2, $3, $4);
        """, operator_id, operator_name, action, ip_address)
    except Exception as e:
        print(f"[AUDIT LOG ERROR] Could not log audit event: {e}")
    finally:
        await conn.close()

async def get_user_by_badge_or_email(identifier: str) -> Optional[Dict[str, Any]]:
    """Retrieves user with full security credentials for authentication verification"""
    conn = await get_db_connection()
    if not conn:
        return None
    try:
        row = await conn.fetchrow("""
            SELECT id, badge_id, name, email, mobile, role, department_id, department_name,
                   district, clearance_level, status, hashed_password, reset_pin, avatar,
                   allowed_modules, last_login, created_at, updated_at
            FROM users
            WHERE badge_id = $1 OR LOWER(email) = LOWER($1);
        """, identifier.strip())
        if row:
            res = dict(row)
            if isinstance(res.get("allowed_modules"), str):
                try:
                    res["allowed_modules"] = json.loads(res["allowed_modules"])
                except Exception:
                    res["allowed_modules"] = []
            return res
        return None
    except Exception as e:
        print(f"[RDS ERROR] get_user_by_badge_or_email error: {e}")
        return None
    finally:
        await conn.close()

async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves user by ID without sensitive password hash"""
    conn = await get_db_connection()
    if not conn:
        return None
    try:
        row = await conn.fetchrow("""
            SELECT id, badge_id, name, email, mobile, role, department_id, department_name,
                   district, clearance_level, status, avatar,
                   allowed_modules, last_login, created_at, updated_at
            FROM users
            WHERE id = $1;
        """, user_id)
        if row:
            res = dict(row)
            if isinstance(res.get("allowed_modules"), str):
                try:
                    res["allowed_modules"] = json.loads(res["allowed_modules"])
                except Exception:
                    res["allowed_modules"] = []
            return res
        return None
    except Exception as e:
        print(f"[RDS ERROR] get_user_by_id error: {e}")
        return None
    finally:
        await conn.close()

async def update_user_last_login(user_id: str):
    """Updates user last_login timestamp in RDS"""
    conn = await get_db_connection()
    if not conn:
        return
    try:
        await conn.execute("""
            UPDATE users
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = $1;
        """, user_id)
    except Exception as e:
        print(f"[RDS ERROR] update_user_last_login error: {e}")
    finally:
        await conn.close()

async def update_user_password(badge_id: str, new_hashed_password: str) -> bool:
    """Updates password hash for the specified badge"""
    conn = await get_db_connection()
    if not conn:
        return False
    try:
        result = await conn.execute("""
            UPDATE users
            SET hashed_password = $1, updated_at = CURRENT_TIMESTAMP
            WHERE badge_id = $2;
        """, new_hashed_password, badge_id)
        return "UPDATE 1" in result
    except Exception as e:
        print(f"[RDS ERROR] update_user_password error: {e}")
        return False
    finally:
        await conn.close()

async def list_users(
    district_filter: Optional[str] = None,
    role_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    search_query: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Lists users respecting hierarchical district scope.
    Passwords and reset pins are stripped from output.
    """
    conn = await get_db_connection()
    if not conn:
        return []
    try:
        query = """
            SELECT id, badge_id, name, email, mobile, role, department_id, department_name,
                   district, clearance_level, status, avatar,
                   allowed_modules, last_login, created_at, updated_at
            FROM users
            WHERE 1=1
        """
        params = []
        idx = 1

        if district_filter and district_filter != "ALL" and district_filter != "Statewide (All)":
            query += f" AND (district = ${idx} OR district = 'Statewide (All)' OR district IS NULL)"
            params.append(district_filter)
            idx += 1

        if role_filter and role_filter != "ALL":
            query += f" AND role = ${idx}"
            params.append(role_filter)
            idx += 1

        if status_filter and status_filter != "ALL":
            query += f" AND status = ${idx}"
            params.append(status_filter)
            idx += 1

        if search_query and search_query.strip():
            sq = f"%{search_query.strip()}%"
            query += f" AND (name ILIKE ${idx} OR badge_id ILIKE ${idx} OR email ILIKE ${idx} OR district ILIKE ${idx})"
            params.append(sq)
            idx += 1

        query += " ORDER BY created_at DESC;"

        rows = await conn.fetch(query, *params)
        users = []
        for r in rows:
            u = dict(r)
            if isinstance(u.get("allowed_modules"), str):
                try:
                    u["allowed_modules"] = json.loads(u["allowed_modules"])
                except Exception:
                    u["allowed_modules"] = []
            # Format datetime for JSON response
            if u.get("last_login"):
                u["last_login"] = u["last_login"].strftime("%Y-%m-%d %H:%M:%S IST")
            else:
                u["last_login"] = "Never (Newly Created)"
            if u.get("created_at"):
                u["created_at"] = u["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            if u.get("updated_at"):
                u["updated_at"] = u["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
            users.append(u)
        return users
    except Exception as e:
        print(f"[RDS ERROR] list_users error: {e}")
        return []
    finally:
        await conn.close()

async def create_user(user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Inserts a new user record into AWS RDS"""
    conn = await get_db_connection()
    if not conn:
        return None
    try:
        allowed_modules_json = json.dumps(user_data.get("allowed_modules", []))
        await conn.execute("""
            INSERT INTO users (
                id, badge_id, name, email, mobile, role, department_id, department_name,
                district, clearance_level, status, hashed_password, reset_pin, avatar, allowed_modules
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb);
        """, user_data["id"], user_data["badge_id"], user_data["name"], user_data["email"],
           user_data.get("mobile"), user_data["role"], user_data.get("department_id", "DEPT-POL-01"),
           user_data.get("department_name", "Gujarat Police"), user_data.get("district", "Ahmedabad"),
           user_data.get("clearance_level", 3), user_data.get("status", "ACTIVE"),
           user_data["hashed_password"], user_data.get("reset_pin", "1234"),
           user_data.get("avatar", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80"),
           allowed_modules_json)

        return await get_user_by_id(user_data["id"])
    except Exception as e:
        print(f"[RDS ERROR] create_user error: {e}")
        raise e
    finally:
        await conn.close()

async def update_user_status(user_id: str, status: str) -> bool:
    """Toggles status (ACTIVE / SUSPENDED)"""
    conn = await get_db_connection()
    if not conn:
        return False
    try:
        res = await conn.execute("""
            UPDATE users
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2;
        """, status, user_id)
        return "UPDATE 1" in res
    except Exception as e:
        print(f"[RDS ERROR] update_user_status error: {e}")
        return False
    finally:
        await conn.close()
