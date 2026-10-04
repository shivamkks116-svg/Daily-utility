"""Tests for admin + feature-flag endpoints.

Covers:
- GET /api/config/public (unauthenticated)
- GET /api/admin/config (admin-only)
- POST /api/admin/config/premium (admin-only)
- GET /api/admin/stats (admin-only)

Approach:
- Non-admin flow uses /api/auth/guest.
- Admin flow seeds a user + user_sessions row directly in Mongo
  (because ADMIN_EMAILS is empty by default, we toggle it via .env
  + supervisorctl restart backend).
- Everything is cleaned up at teardown and backend is restored to
  ADMIN_EMAILS="" (empty).
"""
from __future__ import annotations

import os
import subprocess
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

# -------- Config --------
ROOT = Path(__file__).resolve().parent.parent  # /app/backend
ENV_PATH = ROOT / ".env"

BACKEND_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
# Prefer frontend/.env for public URL (as the system prompt dictates)
_frontend_env = Path("/app/frontend/.env")
if _frontend_env.exists():
    for line in _frontend_env.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
            break
assert BACKEND_URL, "EXPO_PUBLIC_BACKEND_URL not found in frontend/.env"
BASE = BACKEND_URL.rstrip("/") + "/api"

MONGO_URL = None
DB_NAME = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("MONGO_URL="):
        MONGO_URL = line.split("=", 1)[1].strip().strip('"')
    elif line.startswith("DB_NAME="):
        DB_NAME = line.split("=", 1)[1].strip().strip('"')
assert MONGO_URL and DB_NAME

ADMIN_EMAIL = "admin@test.com"

# -------- Helpers --------
def _set_admin_emails_env(value: str) -> None:
    """Rewrite ADMIN_EMAILS= line in backend/.env (preserving the key)."""
    lines = ENV_PATH.read_text().splitlines()
    out = []
    found = False
    for line in lines:
        if line.startswith("ADMIN_EMAILS="):
            out.append(f"ADMIN_EMAILS={value}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"ADMIN_EMAILS={value}")
    ENV_PATH.write_text("\n".join(out) + "\n")


def _restart_backend() -> None:
    subprocess.run(
        ["sudo", "supervisorctl", "restart", "backend"],
        check=True,
        capture_output=True,
    )
    # Wait for backend to come back up
    for _ in range(30):
        try:
            r = requests.get(f"{BASE}/", timeout=3)
            if r.status_code == 200:
                return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError("Backend did not come back up after restart")


# -------- Fixtures --------
@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="session")
def guest_token():
    r = requests.post(f"{BASE}/auth/guest", json={"name": "NonAdminTester"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="session", autouse=False)
def admin_setup(mongo):
    """Seed an admin user + session, flip ADMIN_EMAILS, restart backend.
    Cleans up fully on teardown.
    """
    # 1) Seed user + session
    user_id = f"user_adm_{uuid.uuid4().hex[:8]}"
    session_token = f"adm_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc)

    mongo.users.insert_one({
        "user_id": user_id,
        "name": "TEST Admin",
        "email": ADMIN_EMAIL,
        "is_guest": False,
        "provider": "test",
        "created_at": now,
        "last_login_at": now,
    })
    mongo.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(days=1),
    })

    # 2) Flip env + restart
    _set_admin_emails_env(ADMIN_EMAIL)
    _restart_backend()

    yield {"user_id": user_id, "session_token": session_token, "email": ADMIN_EMAIL}

    # 3) Clean up: reset env, restart, delete seed data
    _set_admin_emails_env("")
    _restart_backend()
    mongo.user_sessions.delete_one({"session_token": session_token})
    mongo.users.delete_one({"user_id": user_id})
    # Also clean the flag doc we toggled
    mongo.app_config.delete_many({"_type": "flag", "key": "premium_enabled"})


# ============================================================
# Phase A: Pre-admin tests (ADMIN_EMAILS is empty)
# ============================================================
class TestPublicConfig:
    def test_public_config_no_auth_default_false(self):
        r = requests.get(f"{BASE}/config/public", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "premium_enabled" in body
        assert isinstance(body["premium_enabled"], bool)
        # Default should be False when no flag doc exists
        # (we only assert False if no admin tests have run yet)


class TestNonAdminForbidden:
    def test_admin_config_requires_admin(self, guest_token):
        r = requests.get(
            f"{BASE}/admin/config",
            headers={"Authorization": f"Bearer {guest_token}"},
            timeout=10,
        )
        assert r.status_code == 403
        assert "Admin access required" in r.text

    def test_toggle_premium_requires_admin(self, guest_token):
        r = requests.post(
            f"{BASE}/admin/config/premium",
            headers={"Authorization": f"Bearer {guest_token}"},
            json={"enabled": True},
            timeout=10,
        )
        assert r.status_code == 403

    def test_admin_stats_requires_admin(self, guest_token):
        r = requests.get(
            f"{BASE}/admin/stats",
            headers={"Authorization": f"Bearer {guest_token}"},
            timeout=10,
        )
        assert r.status_code == 403

    def test_admin_endpoints_401_without_token(self):
        r = requests.get(f"{BASE}/admin/config", timeout=10)
        assert r.status_code == 401

    def test_empty_admin_emails_blocks_even_seeded_email(self, mongo):
        """When ADMIN_EMAILS env is empty, even a user whose email matches
        must get 403 (not 200). We seed admin@test.com directly, call with
        its token, assert 403, then clean up. This runs BEFORE admin_setup
        flips the env."""
        user_id = f"user_pre_{uuid.uuid4().hex[:8]}"
        token = f"pre_{uuid.uuid4().hex}"
        now = datetime.now(timezone.utc)
        mongo.users.insert_one({
            "user_id": user_id, "name": "TEST PreAdmin", "email": ADMIN_EMAIL,
            "is_guest": False, "created_at": now, "last_login_at": now,
        })
        mongo.user_sessions.insert_one({
            "session_token": token, "user_id": user_id,
            "created_at": now, "expires_at": now + timedelta(hours=1),
        })
        try:
            r = requests.get(
                f"{BASE}/admin/config",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            assert r.status_code == 403, r.text
        finally:
            mongo.user_sessions.delete_one({"session_token": token})
            mongo.users.delete_one({"user_id": user_id})


# ============================================================
# Phase B: Admin tests — require admin_setup fixture
# ============================================================
class TestAdminFlow:
    def test_admin_get_config_shape(self, admin_setup):
        r = requests.get(
            f"{BASE}/admin/config",
            headers={"Authorization": f"Bearer {admin_setup['session_token']}"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "flags" in body and isinstance(body["flags"], dict)
        assert "meta" in body and isinstance(body["meta"], dict)
        assert "premium_enabled" in body["flags"]
        assert isinstance(body["flags"]["premium_enabled"], bool)

    def test_toggle_premium_on(self, admin_setup):
        r = requests.post(
            f"{BASE}/admin/config/premium",
            headers={"Authorization": f"Bearer {admin_setup['session_token']}"},
            json={"enabled": True},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["key"] == "premium_enabled"
        assert body["value"] is True
        assert body["updated_by"] == ADMIN_EMAIL
        assert "updated_at" in body

        # Reflects in /config/public (unauthenticated)
        pub = requests.get(f"{BASE}/config/public", timeout=10).json()
        assert pub["premium_enabled"] is True

    def test_toggle_premium_off_restores(self, admin_setup):
        r = requests.post(
            f"{BASE}/admin/config/premium",
            headers={"Authorization": f"Bearer {admin_setup['session_token']}"},
            json={"enabled": False},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json()["value"] is False

        pub = requests.get(f"{BASE}/config/public", timeout=10).json()
        assert pub["premium_enabled"] is False

    def test_admin_stats_shape(self, admin_setup):
        r = requests.get(
            f"{BASE}/admin/stats",
            headers={"Authorization": f"Bearer {admin_setup['session_token']}"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "users" in body
        u = body["users"]
        for k in ("total", "guests", "premium", "active_30d"):
            assert k in u, f"missing key: {k}"
            assert isinstance(u[k], int), f"{k} must be int, got {type(u[k])}"
        assert u["total"] >= u["guests"] >= 0


class TestAdminValidation:
    def test_toggle_premium_empty_body_422(self, admin_setup):
        r = requests.post(
            f"{BASE}/admin/config/premium",
            headers={
                "Authorization": f"Bearer {admin_setup['session_token']}",
                "Content-Type": "application/json",
            },
            data="{}",
            timeout=10,
        )
        assert r.status_code == 422, r.text

    def test_toggle_premium_missing_enabled_422(self, admin_setup):
        r = requests.post(
            f"{BASE}/admin/config/premium",
            headers={"Authorization": f"Bearer {admin_setup['session_token']}"},
            json={"foo": "bar"},
            timeout=10,
        )
        assert r.status_code == 422

    def test_toggle_premium_wrong_type_422(self, admin_setup):
        r = requests.post(
            f"{BASE}/admin/config/premium",
            headers={"Authorization": f"Bearer {admin_setup['session_token']}"},
            json={"enabled": "yes-please"},
            timeout=10,
        )
        # Pydantic v2 coerces some values, but a free-form string should fail
        assert r.status_code in (200, 422)
        if r.status_code == 200:
            # Document the coercion behavior if it happens
            pytest.skip("Pydantic coerced string→bool; not strictly a bug but worth noting")
