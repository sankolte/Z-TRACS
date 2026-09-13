"""
AWS RDS PostgreSQL Users & Hierarchical RBAC Table Initializer
Creates the users table in AWS RDS and populates initial verified state bootstrap accounts.
"""
import os
import sys
import asyncio
import json

current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
backend_dir = os.path.dirname(app_dir)
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.security import hash_password

async def init_users_table():
    print(f"[AWS RDS] Initializing Users Table on {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}...")
    try:
        import asyncpg
        conn = await asyncpg.connect(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            database=settings.POSTGRES_DB,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
        )
        print("[SUCCESS] Connected to AWS RDS PostgreSQL!")

        # 1. Create users table
        print("[SCHEMA] Creating 'users' table if not exists...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(64) PRIMARY KEY,
                badge_id VARCHAR(64) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                mobile VARCHAR(64),
                role VARCHAR(64) NOT NULL,
                department_id VARCHAR(100) NOT NULL DEFAULT 'DEPT-POL-01',
                department_name VARCHAR(255) NOT NULL DEFAULT 'Gujarat Police',
                district VARCHAR(100),
                clearance_level INT NOT NULL DEFAULT 3,
                status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
                hashed_password VARCHAR(255) NOT NULL,
                reset_pin VARCHAR(64) NOT NULL DEFAULT '1234',
                avatar TEXT,
                allowed_modules JSONB DEFAULT '[]'::jsonb,
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Indexes for rapid lookup
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_badge_id ON users (badge_id);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_district ON users (district);")
        print("[SUCCESS] Users table & indexes confirmed!")

        # 2. Seed Default Bootstrap Accounts if table empty or accounts missing
        initial_password_hash = hash_password("Admin@1234")
        default_pin = "1234"

        bootstrap_users = [
            {
                "id": "usr-001",
                "badge_id": "GJ-POL-2018-09",
                "name": "Rajesh K. Sharma, IPS",
                "email": "adgp.telecom@gujaratpolice.gov.in",
                "mobile": "+91 98250 11001",
                "role": "STATE_ADMIN",
                "department_id": "DEPT-POL-01",
                "department_name": "Gujarat Police (Traffic & Law Enforcement)",
                "district": "Statewide (All)",
                "clearance_level": 5,
                "status": "ACTIVE",
                "hashed_password": initial_password_hash,
                "reset_pin": default_pin,
                "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
                "allowed_modules": json.dumps([
                    "overview", "cctv-gis", "registry", "sentinel-live-wall",
                    "anpr-search", "vehicle-journey", "gap-analysis",
                    "reports", "audit-logs", "administration"
                ])
            },
            {
                "id": "usr-002",
                "badge_id": "GJ-IAS-2012-04",
                "name": "Smt. Mona Khandhar, IAS",
                "email": "securb@gujarat.gov.in",
                "mobile": "+91 98250 22002",
                "role": "DISTRICT_ADMIN",
                "department_id": "DEPT-MNC-02",
                "department_name": "Urban & Municipal Corporations",
                "district": "Ahmedabad",
                "clearance_level": 4,
                "status": "ACTIVE",
                "hashed_password": initial_password_hash,
                "reset_pin": default_pin,
                "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
                "allowed_modules": json.dumps([
                    "overview", "cctv-gis", "registry", "sentinel-live-wall",
                    "anpr-search", "vehicle-journey", "gap-analysis",
                    "reports", "audit-logs", "administration"
                ])
            },
            {
                "id": "usr-003",
                "badge_id": "GJ-POL-2015-22",
                "name": "G. S. Malik, IPS",
                "email": "cp.ahmedabad@gujaratpolice.gov.in",
                "mobile": "+91 98250 33003",
                "role": "DISTRICT_ADMIN",
                "department_id": "DEPT-POL-01",
                "department_name": "Gujarat Police",
                "district": "Ahmedabad",
                "clearance_level": 4,
                "status": "ACTIVE",
                "hashed_password": initial_password_hash,
                "reset_pin": default_pin,
                "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
                "allowed_modules": json.dumps([
                    "overview", "cctv-gis", "registry", "sentinel-live-wall",
                    "anpr-search", "vehicle-journey", "gap-analysis",
                    "reports", "audit-logs", "administration"
                ])
            },
            {
                "id": "usr-004",
                "badge_id": "GJ-POL-2020-108",
                "name": "Insp. Vikram V. Solanki",
                "email": "operator.controlroom@gujarat.gov.in",
                "mobile": "+91 98250 44004",
                "role": "CONTROL_ROOM_OPERATOR",
                "department_id": "DEPT-POL-01",
                "department_name": "Gujarat Police",
                "district": "Surat",
                "clearance_level": 3,
                "status": "ACTIVE",
                "hashed_password": initial_password_hash,
                "reset_pin": default_pin,
                "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
                "allowed_modules": json.dumps([
                    "overview", "cctv-gis", "sentinel-live-wall", "anpr-search", "vehicle-journey"
                ])
            },
            {
                "id": "usr-005",
                "badge_id": "GJ-AUD-2016-03",
                "name": "Shri K. L. Mehta, AG Audit",
                "email": "auditor.state@gujarat.gov.in",
                "mobile": "+91 98250 55005",
                "role": "STATE_AUDITOR",
                "department_id": "DEPT-POL-01",
                "department_name": "State Audit Directorate",
                "district": "Gandhinagar",
                "clearance_level": 4,
                "status": "ACTIVE",
                "hashed_password": initial_password_hash,
                "reset_pin": default_pin,
                "avatar": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
                "allowed_modules": json.dumps([
                    "overview", "cctv-gis", "registry", "sentinel-live-wall", "anpr-search", "reports", "audit-logs"
                ])
            }
        ]

        print("[SEED] Seeding bootstrap accounts if not present...")
        for u in bootstrap_users:
            await conn.execute("""
                INSERT INTO users (
                    id, badge_id, name, email, mobile, role, department_id, department_name,
                    district, clearance_level, status, hashed_password, reset_pin, avatar, allowed_modules
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
                ON CONFLICT (badge_id) DO UPDATE SET
                    role = EXCLUDED.role,
                    clearance_level = EXCLUDED.clearance_level,
                    district = EXCLUDED.district,
                    updated_at = CURRENT_TIMESTAMP;
            """, u["id"], u["badge_id"], u["name"], u["email"], u["mobile"], u["role"],
               u["department_id"], u["department_name"], u["district"], u["clearance_level"],
               u["status"], u["hashed_password"], u["reset_pin"], u["avatar"], u["allowed_modules"])

        user_count = await conn.fetchval("SELECT count(*) FROM users;")
        print(f"[SUCCESS] Migration completed! Total registered users in RDS: {user_count}")
        await conn.close()
    except Exception as e:
        print(f"[ERROR] Failed to initialize users table: {e}")
        raise e

if __name__ == "__main__":
    asyncio.run(init_users_table())
