"""Tests for the Account Deletion feature (Google Play mandatory URL)."""
import os
import re
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

# Local base URL per review request
LOCAL_BASE = "http://localhost:8001"
# Public URL (through ingress) for /api routes
PUBLIC_BASE = os.environ.get("EXPO_BACKEND_URL", "").rstrip("/") or LOCAL_BASE

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------------------------------------------------------------------
# 1. HTML page routes
# ---------------------------------------------------------------------------
HTML_ROUTES = [
    f"{LOCAL_BASE}/account-deletion",
    f"{LOCAL_BASE}/account-deletion.html",
    f"{LOCAL_BASE}/api/legal/account-deletion",
]


@pytest.mark.parametrize("url", HTML_ROUTES)
def test_html_route_returns_200_html(api, url):
    r = api.get(url, timeout=10)
    assert r.status_code == 200, f"{url} -> {r.status_code}"
    ct = r.headers.get("content-type", "").lower()
    assert "text/html" in ct, f"{url} content-type={ct}"


# ---------------------------------------------------------------------------
# 2. HTML content validation
# ---------------------------------------------------------------------------
REQUIRED_SUBSTRINGS = [
    "<title>Delete Your Account · DailyHub AI</title>",
    "Delete Your Account",
    "permanently erase",
    "30 days",
    "irreversible",
    "Sign Out",
    "support@shivaminnovation.dev",
    "Submit Deletion Request",
]

REQUIRED_FIELD_NAMES = ["email", "reason", "notes", "confirm1", "confirm2"]


def test_html_contains_required_text(api):
    r = api.get(f"{LOCAL_BASE}/account-deletion", timeout=10)
    assert r.status_code == 200
    body = r.text
    body_lower = body.lower()
    for token in REQUIRED_SUBSTRINGS:
        assert token.lower() in body_lower, f"HTML missing required text: {token!r}"


def test_html_contains_form_fields(api):
    r = api.get(f"{LOCAL_BASE}/account-deletion", timeout=10)
    body = r.text
    for name in REQUIRED_FIELD_NAMES:
        # name attribute or id
        pattern = re.compile(rf'(name|id)\s*=\s*"{re.escape(name)}"', re.IGNORECASE)
        assert pattern.search(body), f"HTML missing form field: {name}"


# ---------------------------------------------------------------------------
# 3. POST success path
# ---------------------------------------------------------------------------
def test_post_success(api, db):
    payload = {"email": "TEST_delete@example.com", "reason": "privacy", "notes": "testing"}
    r = api.post(f"{LOCAL_BASE}/api/legal/account-deletion", json=payload, timeout=10)
    assert r.status_code == 200, f"body={r.text}"
    data = r.json()
    assert data.get("status") == "received"
    assert "request_id" in data
    # request_id must be a UUID
    rid = data["request_id"]
    assert re.match(r"^[0-9a-f-]{36}$", rid), f"request_id not UUID: {rid}"
    msg = data.get("message", "").lower()
    assert "24 hours" in msg
    assert "30 days" in msg

    # Verify persistence
    doc = db.deletion_requests.find_one({"id": rid})
    assert doc is not None, "deletion_requests doc not found"
    assert doc["email"] == "test_delete@example.com"  # lowercased
    assert doc["reason"] == "privacy"
    assert doc["notes"] == "testing"
    assert doc["status"] == "pending"
    assert "created_at" in doc


# ---------------------------------------------------------------------------
# 4. POST invalid email variants
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("email", ["invalid", "", "noatsign", "no_at_symbol.com", "user@nodot"])
def test_post_invalid_email(api, email):
    r = api.post(f"{LOCAL_BASE}/api/legal/account-deletion", json={"email": email}, timeout=10)
    assert r.status_code == 400, f"email={email!r} status={r.status_code} body={r.text}"
    detail = r.json().get("detail", "")
    assert "valid email" in detail.lower()


# ---------------------------------------------------------------------------
# 5. Email too long (>254)
# ---------------------------------------------------------------------------
def test_post_email_too_long(api):
    long_email = ("a" * 290) + "@example.com"  # > 254
    r = api.post(f"{LOCAL_BASE}/api/legal/account-deletion", json={"email": long_email}, timeout=10)
    assert r.status_code == 400, f"status={r.status_code}"


# ---------------------------------------------------------------------------
# 6. + 7. Optional fields null
# ---------------------------------------------------------------------------
def test_post_optional_fields_null(api, db):
    r = api.post(f"{LOCAL_BASE}/api/legal/account-deletion",
                 json={"email": "TEST_only@example.com"}, timeout=10)
    assert r.status_code == 200
    rid = r.json()["request_id"]
    doc = db.deletion_requests.find_one({"id": rid})
    assert doc is not None
    assert doc.get("reason") is None
    assert doc.get("notes") is None
    assert doc["email"] == "test_only@example.com"


# ---------------------------------------------------------------------------
# 8. Regression - existing endpoints
# ---------------------------------------------------------------------------
def test_regression_root_health(api):
    r = api.get(f"{LOCAL_BASE}/api/", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


def test_regression_privacy(api):
    r = api.get(f"{LOCAL_BASE}/api/legal/privacy", timeout=10)
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "").lower()


def test_regression_terms(api):
    r = api.get(f"{LOCAL_BASE}/api/legal/terms", timeout=10)
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "").lower()


# ---------------------------------------------------------------------------
# Cleanup TEST_ documents after run
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module", autouse=True)
def _cleanup(db):
    yield
    db.deletion_requests.delete_many({"email": {"$regex": "^test_"}})
