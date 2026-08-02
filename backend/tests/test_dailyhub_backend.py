"""DailyHub AI - Backend API test suite.

Covers:
- Health endpoint
- Guest auth flow + auth error handling
- Session exchange with invalid session_id
- Notes / Todos / Habits / Focus CRUD + user isolation
- AI Chat + history + AI tools (translate/grammar/summarize/email/study)
- MongoDB _id leakage check
- Session structure (expires_at) sanity
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # Fallback: read frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"')
                    break
    except Exception:
        pass
assert BASE_URL, "BASE_URL missing"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

TIMEOUT = 20
AI_TIMEOUT = 60


# ---------------------- Fixtures ----------------------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def guest_auth(session):
    r = session.post(f"{API}/auth/guest", json={"name": "TEST_User"}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data and data["session_token"]
    assert data["user"]["is_guest"] is True
    assert "_id" not in data["user"]
    return data


@pytest.fixture(scope="session")
def auth_headers(guest_auth):
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {guest_auth['session_token']}",
    }


@pytest.fixture(scope="session")
def second_user(session):
    r = session.post(f"{API}/auth/guest", json={"name": "TEST_User2"}, timeout=TIMEOUT)
    assert r.status_code == 200
    return r.json()


def assert_no_mongo_id(obj):
    """Recursively assert no '_id' anywhere."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked in {obj}"
        for v in obj.values():
            assert_no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            assert_no_mongo_id(v)


# ---------------------- Health ----------------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "message" in data


# ---------------------- Auth ----------------------
class TestAuth:
    def test_guest_login_creates_user_and_token(self, guest_auth):
        assert guest_auth["user"]["provider"] == "guest"
        assert guest_auth["user"]["user_id"].startswith("guest_")
        assert guest_auth["session_token"].startswith("guest_")
        assert_no_mongo_id(guest_auth)

    def test_me_with_token(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["is_guest"] is True
        assert_no_mongo_id(data)

    def test_me_without_token_returns_401(self, session):
        r = session.get(f"{API}/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401, f"Expected 401 got {r.status_code}"

    def test_me_with_invalid_token_returns_401(self, session):
        r = session.get(
            f"{API}/auth/me",
            headers={"Authorization": "Bearer invalid_token_xyz"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_session_exchange_invalid_session_id(self, session):
        r = session.post(
            f"{API}/auth/session",
            json={"session_id": "invalid_bogus_id_1234"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_logout_invalidates_token(self, session):
        # Create a throw-away guest and log it out
        r = session.post(f"{API}/auth/guest", json={"name": "TEST_Logout"}, timeout=TIMEOUT)
        assert r.status_code == 200
        tok = r.json()["session_token"]
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # Confirm token works
        assert session.get(f"{API}/auth/me", headers=h, timeout=TIMEOUT).status_code == 200
        # Logout
        r = session.post(f"{API}/auth/logout", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200
        # Should now be 401
        r = session.get(f"{API}/auth/me", headers=h, timeout=TIMEOUT)
        assert r.status_code == 401


# ---------------------- Notes ----------------------
class TestNotes:
    def test_notes_crud_and_isolation(self, session, auth_headers, second_user):
        # Create
        r = session.post(f"{API}/notes", headers=auth_headers, json={
            "title": "TEST_Note", "content": "hello", "color": "#111", "pinned": False,
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        note = r.json()
        assert_no_mongo_id(note)
        note_id = note["id"]
        assert note["title"] == "TEST_Note"

        # List
        r = session.get(f"{API}/notes", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        assert_no_mongo_id(r.json())
        assert any(n["id"] == note_id for n in items)

        # Update (pin)
        r = session.put(f"{API}/notes/{note_id}", headers=auth_headers, json={
            "title": "TEST_Note", "content": "hello", "color": "#111", "pinned": True,
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["pinned"] is True

        # Isolation check
        h2 = {"Authorization": f"Bearer {second_user['session_token']}",
              "Content-Type": "application/json"}
        r = session.get(f"{API}/notes", headers=h2, timeout=TIMEOUT)
        assert r.status_code == 200
        assert not any(n["id"] == note_id for n in r.json()["items"])

        # Delete
        r = session.delete(f"{API}/notes/{note_id}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200

        # Verify gone
        r = session.get(f"{API}/notes", headers=auth_headers, timeout=TIMEOUT)
        assert not any(n["id"] == note_id for n in r.json()["items"])


# ---------------------- Todos ----------------------
class TestTodos:
    def test_todos_crud(self, session, auth_headers, second_user):
        r = session.post(f"{API}/todos", headers=auth_headers, json={
            "title": "TEST_Todo", "priority": "high",
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        todo = r.json()
        assert_no_mongo_id(todo)
        tid = todo["id"]
        assert todo["priority"] == "high"
        assert todo["completed"] is False

        # List
        r = session.get(f"{API}/todos", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert any(t["id"] == tid for t in r.json()["items"])

        # Toggle completed
        r = session.put(f"{API}/todos/{tid}", headers=auth_headers, json={
            "title": "TEST_Todo", "priority": "high", "completed": True,
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["completed"] is True

        # Isolation
        h2 = {"Authorization": f"Bearer {second_user['session_token']}",
              "Content-Type": "application/json"}
        r = session.get(f"{API}/todos", headers=h2, timeout=TIMEOUT)
        assert not any(t["id"] == tid for t in r.json()["items"])

        # Delete
        r = session.delete(f"{API}/todos/{tid}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ---------------------- Habits ----------------------
class TestHabits:
    def test_habits_flow(self, session, auth_headers):
        r = session.post(f"{API}/habits", headers=auth_headers, json={
            "name": "TEST_Habit", "emoji": "💪",
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        habit = r.json()
        assert_no_mongo_id(habit)
        hid = habit["id"]
        assert habit["logs"] == []
        assert habit["emoji"] == "💪"

        # List
        r = session.get(f"{API}/habits", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        our = next((h for h in items if h["id"] == hid), None)
        assert our is not None
        assert isinstance(our["logs"], list)

        # Log a date -> should toggle True
        date_str = "2026-01-15"
        r = session.post(f"{API}/habits/{hid}/log", headers=auth_headers,
                         json={"date": date_str}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["toggled"] is True

        # Verify log present
        r = session.get(f"{API}/habits", headers=auth_headers, timeout=TIMEOUT)
        our = next(h for h in r.json()["items"] if h["id"] == hid)
        assert date_str in our["logs"]

        # Toggle same date off
        r = session.post(f"{API}/habits/{hid}/log", headers=auth_headers,
                         json={"date": date_str}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["toggled"] is False

        # Verify removed
        r = session.get(f"{API}/habits", headers=auth_headers, timeout=TIMEOUT)
        our = next(h for h in r.json()["items"] if h["id"] == hid)
        assert date_str not in our["logs"]

        # Delete
        r = session.delete(f"{API}/habits/{hid}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200


# ---------------------- Focus ----------------------
class TestFocus:
    def test_focus_create_and_aggregate(self, session, auth_headers):
        r = session.post(f"{API}/focus", headers=auth_headers, json={
            "mode": "pomodoro", "duration_seconds": 1500, "completed": True,
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        f1 = r.json()
        assert_no_mongo_id(f1)
        assert f1["duration_seconds"] == 1500

        r = session.post(f"{API}/focus", headers=auth_headers, json={
            "mode": "pomodoro", "duration_seconds": 600, "completed": True,
        }, timeout=TIMEOUT)
        assert r.status_code == 200

        r = session.get(f"{API}/focus", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "today_seconds" in data
        assert data["today_seconds"] >= 2100
        assert_no_mongo_id(data)


# ---------------------- AI ----------------------
class TestAI:
    def test_ai_chat_and_history(self, session, auth_headers):
        sid = f"test-{uuid.uuid4().hex[:8]}"
        # First message
        r = session.post(f"{API}/ai/chat", headers=auth_headers, json={
            "session_id": sid, "message": "My favorite color is teal. Remember it.",
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, r.text
        reply1 = r.json()["reply"]
        assert isinstance(reply1, str) and len(reply1) > 0

        # Follow-up should have context
        r = session.post(f"{API}/ai/chat", headers=auth_headers, json={
            "session_id": sid, "message": "What color did I just say?",
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, r.text
        reply2 = r.json()["reply"].lower()
        # Reasonably robust: expect the model to mention teal
        assert "teal" in reply2, f"Context not maintained. Reply: {reply2}"

        # History
        r = session.get(f"{API}/ai/history/{sid}", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        assert_no_mongo_id(r.json())
        assert len(items) >= 4  # 2 user + 2 assistant
        roles = [m["role"] for m in items]
        # ordered by created_at ascending; first item should be user
        assert roles[0] == "user"

    def test_ai_chat_requires_auth(self, session):
        r = session.post(f"{API}/ai/chat", json={
            "session_id": "x", "message": "hi",
        }, timeout=TIMEOUT)
        assert r.status_code == 401

    def test_ai_translate(self, session, auth_headers):
        r = session.post(f"{API}/ai/translate", headers=auth_headers, json={
            "text": "Hello, how are you?", "target_language": "Spanish",
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, r.text
        out = r.json()["result"]
        assert isinstance(out, str) and len(out) > 0

    def test_ai_translate_requires_auth(self, session):
        r = session.post(f"{API}/ai/translate", json={
            "text": "hi", "target_language": "French",
        }, timeout=TIMEOUT)
        assert r.status_code == 401

    def test_ai_grammar(self, session, auth_headers):
        r = session.post(f"{API}/ai/grammar", headers=auth_headers, json={
            "prompt": "she dont likes apple",
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, r.text
        assert len(r.json()["result"]) > 0

    def test_ai_grammar_requires_auth(self, session):
        r = session.post(f"{API}/ai/grammar", json={"prompt": "x"}, timeout=TIMEOUT)
        assert r.status_code == 401

    def test_ai_summarize(self, session, auth_headers):
        long_text = ("Artificial intelligence is transforming industries. " * 20)
        r = session.post(f"{API}/ai/summarize", headers=auth_headers, json={
            "prompt": long_text,
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, r.text
        assert len(r.json()["result"]) > 0

    def test_ai_summarize_requires_auth(self, session):
        r = session.post(f"{API}/ai/summarize", json={"prompt": "x"}, timeout=TIMEOUT)
        assert r.status_code == 401

    def test_ai_email(self, session, auth_headers):
        r = session.post(f"{API}/ai/email-writer", headers=auth_headers, json={
            "prompt": "Ask my manager for a day off on Friday",
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, r.text
        assert "subject" in r.json()["result"].lower()

    def test_ai_email_requires_auth(self, session):
        r = session.post(f"{API}/ai/email-writer", json={"prompt": "x"}, timeout=TIMEOUT)
        assert r.status_code == 401

    def test_ai_study(self, session, auth_headers):
        r = session.post(f"{API}/ai/study", headers=auth_headers, json={
            "prompt": "Photosynthesis",
        }, timeout=AI_TIMEOUT)
        assert r.status_code == 200, r.text
        assert len(r.json()["result"]) > 0

    def test_ai_study_requires_auth(self, session):
        r = session.post(f"{API}/ai/study", json={"prompt": "x"}, timeout=TIMEOUT)
        assert r.status_code == 401


# ---------------------- Session structure (TTL) ----------------------
class TestSessionStructure:
    def test_session_document_has_expires_at(self, session):
        """Verify session structure by using pymongo directly."""
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not available")
        r = session.post(f"{API}/auth/guest", json={"name": "TEST_TTL"}, timeout=TIMEOUT)
        assert r.status_code == 200
        tok = r.json()["session_token"]

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        cli = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        try:
            doc = cli[db_name].user_sessions.find_one({"session_token": tok})
        except Exception:
            pytest.skip("Mongo not reachable from test env")
        assert doc is not None
        assert "expires_at" in doc
        assert "created_at" in doc
        assert "user_id" in doc
