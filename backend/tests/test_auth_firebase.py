"""Backend tests for POST /api/auth/firebase after switching to
google.oauth2.id_token.verify_firebase_token (no ADC required).

Covers:
  1. Missing id_token -> 400
  2. Empty id_token    -> 400
  3. Garbage token     -> 401 "Firebase token rejected: ..."
  4. 3-segment junk    -> 401 "Firebase token rejected: ..."
  5. Pre-warm startup log present
  6. No ADC error in logs
"""
import os
import re
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE:
    # Fallback to reading frontend/.env since this is where it's canonicalized
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE = line.split("=", 1)[1].strip().strip('"')
                    break

assert BASE, "EXPO_PUBLIC_BACKEND_URL must be set"
ENDPOINT = f"{BASE.rstrip('/')}/api/auth/firebase"

BACKEND_LOGS = [
    "/var/log/supervisor/backend.err.log",
    "/var/log/supervisor/backend.out.log",
]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Case 1: no body / missing id_token ----
def test_missing_id_token_returns_400(session):
    r = session.post(ENDPOINT, json={})
    assert r.status_code == 400, f"got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("detail") == "id_token required", body


# ---- Case 2: empty id_token ----
def test_empty_id_token_returns_400(session):
    r = session.post(ENDPOINT, json={"id_token": ""})
    assert r.status_code == 400, f"got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("detail") == "id_token required", body


# ---- Case 3: garbage non-JWT token ----
def test_garbage_token_returns_401(session):
    r = session.post(ENDPOINT, json={"id_token": "not-a-real-jwt"})
    assert r.status_code == 401, f"got {r.status_code}: {r.text}"
    body = r.json()
    detail = body.get("detail", "")
    assert detail.startswith("Firebase token rejected: "), detail
    # CRITICAL: must NOT be ADC error (would mean fix didn't take effect)
    assert "default credentials were not found" not in detail.lower(), (
        f"ADC error leaked through — google-auth switch didn't take effect: {detail}"
    )


# ---- Case 4: 3-segment junk JWT ----
def test_three_segment_junk_jwt_returns_401(session):
    r = session.post(ENDPOINT, json={"id_token": "ey.ey.sig"})
    assert r.status_code == 401, f"got {r.status_code}: {r.text}"
    body = r.json()
    detail = body.get("detail", "")
    assert detail.startswith("Firebase token rejected: "), detail
    assert "default credentials were not found" not in detail.lower(), (
        f"ADC error leaked through: {detail}"
    )


# ---- Case 5: pre-warm startup log appears ----
def test_firebase_jwks_prewarm_log_present():
    found = False
    for p in BACKEND_LOGS:
        if not os.path.exists(p):
            continue
        with open(p, errors="ignore") as f:
            if "Firebase JWKS pre-warmed" in f.read():
                found = True
                break
    assert found, "Expected 'Firebase JWKS pre-warmed' log line in backend logs"


# ---- Case 6: no ADC error anywhere in backend logs ----
def test_no_adc_error_in_backend_logs():
    needle = re.compile(r"default credentials were not found", re.IGNORECASE)
    hits = []
    for p in BACKEND_LOGS:
        if not os.path.exists(p):
            continue
        with open(p, errors="ignore") as f:
            for i, line in enumerate(f, 1):
                if needle.search(line):
                    hits.append(f"{p}:{i}: {line.strip()}")
    assert not hits, "ADC error present in logs:\n" + "\n".join(hits)
