"""
Tests for public legal HTML pages (Privacy Policy, Terms) and Play Console
submission documents.

- Legal routes must return 200 + text/html
- HTML content must include required sections and contact
- Regression: existing /api/ and guest auth still work
- Play Console docs must exist and contain expected substrings
"""

import os
import re
from pathlib import Path

import pytest
import requests

BASE_URL = "http://localhost:8001"

PRIVACY_ROUTES = [
    "/privacy",
    "/privacy.html",
    "/api/legal/privacy",
]
TERMS_ROUTES = [
    "/terms",
    "/terms.html",
    "/api/legal/terms",
]


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    return s


# ---------------------- Legal routes: status + content-type ----------------------
@pytest.mark.parametrize("path", PRIVACY_ROUTES + TERMS_ROUTES)
def test_legal_route_returns_200_html(api_client, path):
    r = api_client.get(f"{BASE_URL}{path}", timeout=10)
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    ct = r.headers.get("Content-Type", "")
    assert "text/html" in ct.lower(), f"{path} content-type: {ct}"
    assert len(r.content) > 3000, f"{path} body too small: {len(r.content)}"


# ---------------------- Privacy HTML content validation ----------------------
PRIVACY_EXPECTED = [
    "<title>Privacy Policy · DailyHub AI</title>",
    "Shivam Innovation",
    "Last updated: June 2026",
    "1. Overview",
    "2. Information we collect",
    "3. How we use your data",
    "4. AI features",
    "5. Data storage",
    "security",
    "6. Third-party services",
    "7. Children",
    "8. Your rights",
    "GDPR",
    "CCPA",
    "DPDP",
    "9. Ads",
    "10. Changes",
    "11. Contact",
    "support@shivaminnovation.dev",
]


@pytest.mark.parametrize("needle", PRIVACY_EXPECTED)
def test_privacy_html_contains(api_client, needle):
    r = api_client.get(f"{BASE_URL}/api/legal/privacy", timeout=10)
    assert r.status_code == 200
    body_lower = r.text.lower()
    assert needle.lower() in body_lower, f"Missing '{needle}' in /api/legal/privacy"


# ---------------------- Terms HTML content validation ----------------------
TERMS_HEADINGS = [
    "1. Acceptance",
    "2.",
    "3.",
    "4.",
    "5.",
    "6.",
    "7.",
    "8.",
    "9.",
    "10.",
    "11.",
    "12.",
    "13. Contact",
]


def test_terms_html_title_and_contact(api_client):
    r = api_client.get(f"{BASE_URL}/api/legal/terms", timeout=10)
    assert r.status_code == 200
    body = r.text
    # title can be html-escaped
    assert (
        "<title>Terms & Conditions · DailyHub AI</title>" in body
        or "<title>Terms &amp; Conditions · DailyHub AI</title>" in body
    ), "Terms title missing/mismatched"
    assert "support@shivaminnovation.dev" in body


@pytest.mark.parametrize("heading", TERMS_HEADINGS)
def test_terms_html_has_all_13_headings(api_client, heading):
    r = api_client.get(f"{BASE_URL}/api/legal/terms", timeout=10)
    assert r.status_code == 200
    assert heading in r.text, f"Terms missing heading '{heading}'"


# ---------------------- Regression: /api/ and guest auth ----------------------
def test_api_root(api_client):
    r = api_client.get(f"{BASE_URL}/api/", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "DailyHub AI API"
    assert data.get("status") == "ok"


def test_auth_guest(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/guest",
        json={"name": "Guest"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data and isinstance(data["session_token"], str)
    assert len(data["session_token"]) > 10


# ---------------------- Play Console docs ----------------------
SUBMISSION_MD = Path("/app/branding/PLAY-CONSOLE-SUBMISSION.md")
QUICK_REF_MD = Path("/app/branding/QUICK-REFERENCE-CARD.md")

SUBMISSION_REQUIRED = [
    "DailyHub AI",
    "Package Name",
    "Privacy Policy URL",
    "Data Safety",
    "Permissions Declaration",
    "IARC",
    "Store Listing",
]

QUICK_REF_REQUIRED = [
    "com.dailyutility.app",
    "api/legal/privacy",
    "support@shivaminnovation.dev",
]


def test_play_console_submission_exists():
    assert SUBMISSION_MD.exists(), "PLAY-CONSOLE-SUBMISSION.md missing"
    content = SUBMISSION_MD.read_text(encoding="utf-8")
    assert len(content) >= 5000, f"submission doc too small: {len(content)}"


@pytest.mark.parametrize("needle", SUBMISSION_REQUIRED)
def test_play_console_submission_contains(needle):
    content = SUBMISSION_MD.read_text(encoding="utf-8")
    assert needle in content, f"'{needle}' missing from PLAY-CONSOLE-SUBMISSION.md"


def test_quick_reference_card_exists():
    assert QUICK_REF_MD.exists(), "QUICK-REFERENCE-CARD.md missing"
    content = QUICK_REF_MD.read_text(encoding="utf-8")
    assert len(content) >= 1000, f"quick-ref doc too small: {len(content)}"


@pytest.mark.parametrize("needle", QUICK_REF_REQUIRED)
def test_quick_reference_card_contains(needle):
    content = QUICK_REF_MD.read_text(encoding="utf-8")
    assert needle in content, f"'{needle}' missing from QUICK-REFERENCE-CARD.md"
