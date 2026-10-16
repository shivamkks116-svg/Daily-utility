"""Push notification endpoints — DailyHub AI iteration 30."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def guest_token():
    r = requests.post(f"{BASE_URL}/api/auth/guest",
                      json={"name": f"TEST_push_{uuid.uuid4().hex[:6]}"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def auth_headers(guest_token):
    return {"Authorization": f"Bearer {guest_token}", "Content-Type": "application/json"}


class TestPushPrefs:
    """GET/PUT /api/push/prefs"""

    def test_get_prefs_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/push/prefs", timeout=10)
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_put_prefs_requires_auth(self):
        r = requests.put(f"{BASE_URL}/api/push/prefs",
                         json={"daily_reminder": False},
                         headers={"Content-Type": "application/json"}, timeout=10)
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_get_prefs_default_true(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/push/prefs", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "daily_reminder" in data
        assert isinstance(data["daily_reminder"], bool)
        assert data["daily_reminder"] is True, f"default should be true, got {data}"

    def test_put_prefs_false_persists(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/push/prefs",
                         json={"daily_reminder": False},
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["daily_reminder"] is False

        # GET to verify persisted
        g = requests.get(f"{BASE_URL}/api/push/prefs", headers=auth_headers, timeout=10)
        assert g.status_code == 200
        assert g.json()["daily_reminder"] is False, f"did not persist: {g.json()}"

    def test_put_prefs_toggle_back_true(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/push/prefs",
                         json={"daily_reminder": True},
                         headers=auth_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["daily_reminder"] is True
        g = requests.get(f"{BASE_URL}/api/push/prefs", headers=auth_headers, timeout=10)
        assert g.json()["daily_reminder"] is True


class TestAdminBroadcast:
    """POST /api/admin/push/broadcast"""

    def test_broadcast_requires_admin_non_admin_guest(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/admin/push/broadcast",
                          json={"title": "Hi", "message": "Test"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 403, f"expected 403 non-admin, got {r.status_code}: {r.text}"

    def test_broadcast_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/admin/push/broadcast",
                          json={"title": "Hi", "message": "Test"},
                          headers={"Content-Type": "application/json"}, timeout=10)
        # No auth → 401 (not 403)
        assert r.status_code == 401, f"expected 401 without auth, got {r.status_code}"

    def test_broadcast_empty_title_422(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/admin/push/broadcast",
                          json={"title": "", "message": "Something"},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 422, f"expected 422 empty title, got {r.status_code}: {r.text}"

    def test_broadcast_empty_message_422(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/admin/push/broadcast",
                          json={"title": "Hello", "message": ""},
                          headers=auth_headers, timeout=10)
        assert r.status_code == 422, f"expected 422 empty message, got {r.status_code}: {r.text}"


class TestRegisterPush:
    """POST /api/register-push"""

    def test_register_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/register-push",
                          json={"platform": "android", "device_token": "test-tok"},
                          headers={"Content-Type": "application/json"}, timeout=10)
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_register_with_placeholder_key_returns_500(self, auth_headers):
        """EXPECTED: placeholder EMERGENT_PUSH_KEY returns 500 'EMERGENT_PUSH_KEY missing or invalid'."""
        r = requests.post(f"{BASE_URL}/api/register-push",
                          json={"platform": "android", "device_token": "test-token-xyz"},
                          headers=auth_headers, timeout=15)
        # Expected 500 due to placeholder key (per spec). Also accept 502 if upstream down.
        assert r.status_code in (500, 502), f"expected 500/502, got {r.status_code}: {r.text}"
        if r.status_code == 500:
            # Message may or may not be in the body; just confirm it's a 500
            body = r.text
            assert "EMERGENT_PUSH_KEY" in body or "detail" in body
