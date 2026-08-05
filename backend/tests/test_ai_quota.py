"""Tests for the AI quota / rate-limiting endpoints in DailyHub AI.

Covers:
- GET  /api/ai/quota (initial + after usage)
- POST /api/ai/chat (increments used)
- Rate limit 429 after 5 successful chat calls
- POST /api/ai/reward (grants +5, cap at 15 = 3 grants)
- POST /api/ai/summarize (also consumes quota, 429 when exhausted)
- POST /api/ai/translate (also enforces quota)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")


def _new_guest_session():
    """Create a brand-new guest user and return (session_token, user_id)."""
    r = requests.post(f"{BASE_URL}/api/auth/guest", json={"name": "TEST_QuotaUser"}, timeout=15)
    assert r.status_code == 200, f"guest login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "session_token" in data and "user" in data
    return data["session_token"], data["user"]["user_id"]


def _auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _get_quota(tok):
    r = requests.get(f"{BASE_URL}/api/ai/quota", headers=_auth(tok), timeout=15)
    assert r.status_code == 200, f"quota GET failed: {r.status_code} {r.text}"
    return r.json()


# --------------------------------------------------------------------------
# 1) Initial quota shape for brand-new user
# --------------------------------------------------------------------------
class TestQuotaInitial:
    def test_initial_quota_new_user(self):
        tok, _ = _new_guest_session()
        q = _get_quota(tok)
        assert q["used"] == 0
        assert q["bonus"] == 0
        assert q["free_limit"] == 5
        assert q["total"] == 5
        assert q["remaining"] == 5
        assert q["bonus_available"] is True
        assert q["max_bonus"] == 15
        assert "reset_at" in q and isinstance(q["reset_at"], str)


# --------------------------------------------------------------------------
# 2 + 3) /ai/chat consumes quota + 6th call returns 429
# --------------------------------------------------------------------------
class TestChatQuotaAndRateLimit:
    def test_chat_increments_and_rate_limits_at_6(self):
        tok, _ = _new_guest_session()

        # Do 5 successful chat calls, verify `used` increments each time
        for i in range(1, 6):
            r = requests.post(
                f"{BASE_URL}/api/ai/chat",
                headers=_auth(tok),
                json={"session_id": "t1", "message": f"Hello #{i}"},
                timeout=60,
            )
            assert r.status_code == 200, f"chat #{i} failed: {r.status_code} {r.text}"
            body = r.json()
            assert "reply" in body and isinstance(body["reply"], str) and body["reply"].strip()

            q = _get_quota(tok)
            assert q["used"] == i, f"expected used={i}, got {q['used']}"
            assert q["remaining"] == 5 - i
            time.sleep(0.2)

        # 6th call must be 429
        r6 = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers=_auth(tok),
            json={"session_id": "t1", "message": "Should be blocked"},
            timeout=30,
        )
        assert r6.status_code == 429, f"expected 429, got {r6.status_code} {r6.text}"
        detail = r6.json().get("detail")
        assert isinstance(detail, dict)
        assert detail.get("error") == "quota_exceeded"
        assert "message" in detail and "free ai limit" in detail["message"].lower()
        assert detail.get("limit") == 5
        assert detail.get("used") == 5
        assert "reset_at" in detail


# --------------------------------------------------------------------------
# 4) /ai/reward grants +5 bonus and allows chat again
# --------------------------------------------------------------------------
class TestRewardGrantsBonus:
    def test_reward_after_exhaustion_reenables_chat(self):
        tok, _ = _new_guest_session()

        # exhaust with 5 chats
        for i in range(5):
            r = requests.post(
                f"{BASE_URL}/api/ai/chat",
                headers=_auth(tok),
                json={"session_id": "rw1", "message": f"burn {i}"},
                timeout=60,
            )
            assert r.status_code == 200

        # confirm exhausted
        q = _get_quota(tok)
        assert q["used"] == 5 and q["remaining"] == 0

        # claim reward
        rw = requests.post(f"{BASE_URL}/api/ai/reward", headers=_auth(tok), timeout=15)
        assert rw.status_code == 200, f"reward failed: {rw.status_code} {rw.text}"
        rw_body = rw.json()
        assert rw_body["granted"] == 5
        assert rw_body["bonus"] == 5
        assert rw_body["total"] == 10
        assert rw_body["remaining"] == 5

        # quota should reflect same
        q2 = _get_quota(tok)
        assert q2["bonus"] == 5
        assert q2["total"] == 10
        assert q2["remaining"] == 5
        assert q2["used"] == 5

        # next chat succeeds again
        r = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers=_auth(tok),
            json={"session_id": "rw1", "message": "bonus works"},
            timeout=60,
        )
        assert r.status_code == 200, f"post-reward chat failed: {r.status_code} {r.text}"

        q3 = _get_quota(tok)
        assert q3["used"] == 6
        assert q3["remaining"] == 4


# --------------------------------------------------------------------------
# 5) Max bonus cap: 3 rewards ok, 4th returns 400
# --------------------------------------------------------------------------
class TestRewardMaxCap:
    def test_reward_cap_at_15(self):
        tok, _ = _new_guest_session()

        # 3 successful reward grants -> bonus 5, 10, 15
        expected_bonus = [5, 10, 15]
        for i, exp in enumerate(expected_bonus, start=1):
            rw = requests.post(f"{BASE_URL}/api/ai/reward", headers=_auth(tok), timeout=15)
            assert rw.status_code == 200, f"reward #{i} failed: {rw.status_code} {rw.text}"
            body = rw.json()
            assert body["bonus"] == exp, f"expected bonus {exp} after grant #{i}, got {body['bonus']}"
            assert body["total"] == 5 + exp

        q = _get_quota(tok)
        assert q["bonus"] == 15
        assert q["max_bonus"] == 15
        assert q["bonus_available"] is False

        # 4th reward -> 400
        rw4 = requests.post(f"{BASE_URL}/api/ai/reward", headers=_auth(tok), timeout=15)
        assert rw4.status_code == 400, f"expected 400, got {rw4.status_code} {rw4.text}"
        detail = rw4.json().get("detail", "")
        assert "bonus limit" in str(detail).lower()


# --------------------------------------------------------------------------
# 6) /ai/summarize consumes quota, and returns 429 when exhausted
# --------------------------------------------------------------------------
class TestSummarizeQuota:
    def test_summarize_consumes_and_rate_limits(self):
        tok, _ = _new_guest_session()

        # First call -> 200, used becomes 1
        r = requests.post(
            f"{BASE_URL}/api/ai/summarize",
            headers=_auth(tok),
            json={"prompt": "React Native is a framework for building native mobile apps using React."},
            timeout=60,
        )
        assert r.status_code == 200, f"summarize failed: {r.status_code} {r.text}"
        body = r.json()
        assert "result" in body and isinstance(body["result"], str) and body["result"].strip()

        q = _get_quota(tok)
        assert q["used"] == 1

        # Burn remaining 4 slots via chat
        for i in range(4):
            rc = requests.post(
                f"{BASE_URL}/api/ai/chat",
                headers=_auth(tok),
                json={"session_id": "sum1", "message": f"burn {i}"},
                timeout=60,
            )
            assert rc.status_code == 200

        # 6th total call (summarize again) -> 429
        r2 = requests.post(
            f"{BASE_URL}/api/ai/summarize",
            headers=_auth(tok),
            json={"prompt": "Anything."},
            timeout=30,
        )
        assert r2.status_code == 429, f"expected 429, got {r2.status_code} {r2.text}"
        detail = r2.json().get("detail")
        assert isinstance(detail, dict) and detail.get("error") == "quota_exceeded"


# --------------------------------------------------------------------------
# 7) /ai/translate also enforces the quota
# --------------------------------------------------------------------------
class TestTranslateQuota:
    def test_translate_consumes_and_rate_limits(self):
        tok, _ = _new_guest_session()

        r = requests.post(
            f"{BASE_URL}/api/ai/translate",
            headers=_auth(tok),
            json={"text": "Hello", "target_language": "Spanish"},
            timeout=60,
        )
        assert r.status_code == 200, f"translate failed: {r.status_code} {r.text}"
        body = r.json()
        assert "result" in body and body["result"].strip()

        q = _get_quota(tok)
        assert q["used"] == 1

        # Burn remaining 4 slots
        for i in range(4):
            rc = requests.post(
                f"{BASE_URL}/api/ai/chat",
                headers=_auth(tok),
                json={"session_id": "tr1", "message": f"burn {i}"},
                timeout=60,
            )
            assert rc.status_code == 200

        # 6th (translate) -> 429
        r2 = requests.post(
            f"{BASE_URL}/api/ai/translate",
            headers=_auth(tok),
            json={"text": "Hello", "target_language": "French"},
            timeout=30,
        )
        assert r2.status_code == 429, f"expected 429, got {r2.status_code} {r2.text}"
        detail = r2.json().get("detail")
        assert isinstance(detail, dict) and detail.get("error") == "quota_exceeded"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
