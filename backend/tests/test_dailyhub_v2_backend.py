"""DailyHub AI v2 - Tests for NEW endpoints added in iteration 2.

Covers:
- Expenses CRUD + month aggregation (income/expense/balance)
- Voice Notes CRUD (list excludes audio_base64, GET/{id} includes it)
- QR Scans CRUD (ordered desc, user isolation)
- Reminders CRUD (toggle enabled via PUT)
- Premium status/mock-purchase/cancel (upsert - no duplicate on repeat purchase)
- Currency proxy /rates (base switching)
- Auth 401 for all new endpoints
- User isolation on all new resources
- MongoDB _id leakage check on all new endpoint responses
- Quick regression smoke test for prior endpoints
"""
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
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


def assert_no_mongo_id(obj):
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked in {obj}"
        for v in obj.values():
            assert_no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            assert_no_mongo_id(v)


# ---------------------- Fixtures ----------------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    r = session.post(f"{API}/auth/guest", json={"name": "TEST_V2_UserA"}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def user_b(session):
    r = session.post(f"{API}/auth/guest", json={"name": "TEST_V2_UserB"}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def ha(user_a):
    return {"Authorization": f"Bearer {user_a['session_token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def hb(user_b):
    return {"Authorization": f"Bearer {user_b['session_token']}", "Content-Type": "application/json"}


# ---------------------- Regression Smoke ----------------------
class TestRegressionSmoke:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=TIMEOUT)
        assert r.status_code == 200 and r.json().get("status") == "ok"

    def test_notes_still_work(self, session, ha):
        r = session.post(f"{API}/notes", headers=ha, json={"title": "TEST_V2_Smoke"}, timeout=TIMEOUT)
        assert r.status_code == 200
        nid = r.json()["id"]
        r = session.get(f"{API}/notes", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        session.delete(f"{API}/notes/{nid}", headers=ha, timeout=TIMEOUT)

    def test_todos_still_work(self, session, ha):
        r = session.post(f"{API}/todos", headers=ha, json={"title": "TEST_V2_TodoSmoke"}, timeout=TIMEOUT)
        assert r.status_code == 200
        tid = r.json()["id"]
        session.delete(f"{API}/todos/{tid}", headers=ha, timeout=TIMEOUT)


# ---------------------- Expenses ----------------------
class TestExpenses:
    def test_expenses_require_auth(self, session):
        assert session.get(f"{API}/expenses", timeout=TIMEOUT).status_code == 401
        assert session.post(f"{API}/expenses", json={"amount": 10}, timeout=TIMEOUT).status_code == 401

    def test_expenses_crud_and_month_totals(self, session, ha):
        # Clean state check - list first
        r = session.get(f"{API}/expenses", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        initial = r.json()
        base_inc = initial["month_income"]
        base_exp = initial["month_expense"]

        month = datetime.now(timezone.utc).strftime("%Y-%m")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Create expense (current month)
        r = session.post(f"{API}/expenses", headers=ha, json={
            "amount": 25.50, "kind": "expense", "category": "Food",
            "note": "TEST_V2 lunch", "date": today,
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        e1 = r.json()
        assert_no_mongo_id(e1)
        assert e1["amount"] == 25.50
        assert e1["kind"] == "expense"
        assert e1["date"] == today
        e1_id = e1["id"]

        # Create income
        r = session.post(f"{API}/expenses", headers=ha, json={
            "amount": 100.00, "kind": "income", "category": "Salary",
            "note": "TEST_V2 income",
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        e2 = r.json()
        e2_id = e2["id"]
        assert e2["date"].startswith(month)  # default = today

        # Create OLD dated expense (should not count toward month totals)
        r = session.post(f"{API}/expenses", headers=ha, json={
            "amount": 999.00, "kind": "expense", "category": "Old",
            "date": "2020-01-15",
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        e3_id = r.json()["id"]

        # List + verify aggregates
        r = session.get(f"{API}/expenses", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert_no_mongo_id(data)
        assert data["month"] == month
        # Old entry excluded from month totals
        assert data["month_expense"] == pytest.approx(base_exp + 25.50, rel=1e-3)
        assert data["month_income"] == pytest.approx(base_inc + 100.00, rel=1e-3)
        assert data["month_balance"] == pytest.approx(
            data["month_income"] - data["month_expense"], rel=1e-3
        )
        ids = [x["id"] for x in data["items"]]
        assert e1_id in ids and e2_id in ids and e3_id in ids

        # Delete cleanup
        for eid in (e1_id, e2_id, e3_id):
            r = session.delete(f"{API}/expenses/{eid}", headers=ha, timeout=TIMEOUT)
            assert r.status_code == 200

        # Verify removed
        r = session.get(f"{API}/expenses", headers=ha, timeout=TIMEOUT)
        remaining = [x["id"] for x in r.json()["items"]]
        assert e1_id not in remaining and e2_id not in remaining and e3_id not in remaining

    def test_expenses_isolation(self, session, ha, hb):
        r = session.post(f"{API}/expenses", headers=ha, json={
            "amount": 5, "note": "TEST_V2_ISO_A",
        }, timeout=TIMEOUT)
        eid = r.json()["id"]
        r = session.get(f"{API}/expenses", headers=hb, timeout=TIMEOUT)
        assert r.status_code == 200
        assert not any(x["id"] == eid for x in r.json()["items"])
        session.delete(f"{API}/expenses/{eid}", headers=ha, timeout=TIMEOUT)


# ---------------------- Voice Notes ----------------------
class TestVoiceNotes:
    def test_voice_notes_require_auth(self, session):
        assert session.get(f"{API}/voice-notes", timeout=TIMEOUT).status_code == 401
        assert session.post(f"{API}/voice-notes", json={"audio_base64": "AAAA"},
                            timeout=TIMEOUT).status_code == 401

    def test_voice_notes_crud_payload_exclusion(self, session, ha):
        payload_b64 = "AAAA" * 20  # small dummy base64
        r = session.post(f"{API}/voice-notes", headers=ha, json={
            "title": "TEST_V2_Voice", "duration_ms": 1234, "audio_base64": payload_b64,
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        created = r.json()
        assert_no_mongo_id(created)
        # POST response must NOT include audio payload (per implementation)
        assert "audio_base64" not in created, "POST response leaked audio_base64"
        vid = created["id"]
        assert created["duration_ms"] == 1234

        # List must exclude audio_base64
        r = session.get(f"{API}/voice-notes", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert_no_mongo_id(data)
        found = next(x for x in data["items"] if x["id"] == vid)
        assert "audio_base64" not in found, "LIST leaked audio_base64"

        # GET/{id} must include audio_base64
        r = session.get(f"{API}/voice-notes/{vid}", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        one = r.json()
        assert_no_mongo_id(one)
        assert one.get("audio_base64") == payload_b64

        # 404 for missing id
        r = session.get(f"{API}/voice-notes/nonexistent_xyz", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 404

        # 400 when audio_base64 missing (Pydantic will 422 actually, but ensure not 200)
        r = session.post(f"{API}/voice-notes", headers=ha, json={
            "title": "no audio", "duration_ms": 0, "audio_base64": "",
        }, timeout=TIMEOUT)
        assert r.status_code in (400, 422)

        # Delete
        r = session.delete(f"{API}/voice-notes/{vid}", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        r = session.get(f"{API}/voice-notes/{vid}", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_voice_notes_isolation(self, session, ha, hb):
        r = session.post(f"{API}/voice-notes", headers=ha, json={
            "title": "TEST_V2_VoiceIso", "audio_base64": "AAAA",
        }, timeout=TIMEOUT)
        vid = r.json()["id"]
        # user B list
        r = session.get(f"{API}/voice-notes", headers=hb, timeout=TIMEOUT)
        assert not any(x["id"] == vid for x in r.json()["items"])
        # user B GET/{id} => 404
        r = session.get(f"{API}/voice-notes/{vid}", headers=hb, timeout=TIMEOUT)
        assert r.status_code == 404
        session.delete(f"{API}/voice-notes/{vid}", headers=ha, timeout=TIMEOUT)


# ---------------------- QR Scans ----------------------
class TestQRScans:
    def test_qr_requires_auth(self, session):
        assert session.get(f"{API}/qr-scans", timeout=TIMEOUT).status_code == 401
        assert session.post(f"{API}/qr-scans", json={"value": "x"},
                            timeout=TIMEOUT).status_code == 401

    def test_qr_crud_order_and_isolation(self, session, ha, hb):
        # Create 2 scans; second should appear first (desc)
        r1 = session.post(f"{API}/qr-scans", headers=ha, json={
            "value": "TEST_V2_QR_1", "type": "text",
        }, timeout=TIMEOUT)
        assert r1.status_code == 200
        id1 = r1.json()["id"]
        assert_no_mongo_id(r1.json())

        r2 = session.post(f"{API}/qr-scans", headers=ha, json={
            "value": "https://example.com", "type": "url",
        }, timeout=TIMEOUT)
        assert r2.status_code == 200
        id2 = r2.json()["id"]

        r = session.get(f"{API}/qr-scans", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        items = r.json()["items"]
        assert_no_mongo_id(r.json())
        # find our two
        idx1 = next(i for i, x in enumerate(items) if x["id"] == id1)
        idx2 = next(i for i, x in enumerate(items) if x["id"] == id2)
        # desc = newer first, so id2 should be before id1
        assert idx2 < idx1, "qr-scans not sorted by created_at desc"

        # Isolation
        r = session.get(f"{API}/qr-scans", headers=hb, timeout=TIMEOUT)
        assert not any(x["id"] in (id1, id2) for x in r.json()["items"])

        # Delete
        for sid in (id1, id2):
            r = session.delete(f"{API}/qr-scans/{sid}", headers=ha, timeout=TIMEOUT)
            assert r.status_code == 200


# ---------------------- Reminders ----------------------
class TestReminders:
    def test_reminders_require_auth(self, session):
        assert session.get(f"{API}/reminders", timeout=TIMEOUT).status_code == 401
        assert session.post(f"{API}/reminders", json={"title": "x"},
                            timeout=TIMEOUT).status_code == 401

    def test_reminders_crud_and_toggle(self, session, ha, hb):
        r = session.post(f"{API}/reminders", headers=ha, json={
            "kind": "water", "title": "TEST_V2_Water",
            "times": ["08:00", "12:00", "20:00"], "enabled": True,
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert_no_mongo_id(d)
        rid = d["id"]
        assert d["kind"] == "water" and d["enabled"] is True
        assert d["times"] == ["08:00", "12:00", "20:00"]

        # List
        r = session.get(f"{API}/reminders", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200
        assert any(x["id"] == rid for x in r.json()["items"])

        # Toggle enabled=False
        r = session.put(f"{API}/reminders/{rid}", headers=ha, json={
            "kind": "water", "title": "TEST_V2_Water",
            "times": ["08:00", "12:00", "20:00"], "enabled": False,
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["enabled"] is False

        # 404 update on unknown
        r = session.put(f"{API}/reminders/unknown_id", headers=ha, json={
            "title": "x", "times": [],
        }, timeout=TIMEOUT)
        assert r.status_code == 404

        # Isolation
        r = session.get(f"{API}/reminders", headers=hb, timeout=TIMEOUT)
        assert not any(x["id"] == rid for x in r.json()["items"])

        # Delete
        r = session.delete(f"{API}/reminders/{rid}", headers=ha, timeout=TIMEOUT)
        assert r.status_code == 200


# ---------------------- Premium ----------------------
class TestPremium:
    def test_premium_requires_auth(self, session):
        assert session.get(f"{API}/premium/status", timeout=TIMEOUT).status_code == 401
        assert session.post(f"{API}/premium/mock-purchase", json={"plan": "yearly"},
                            timeout=TIMEOUT).status_code == 401
        assert session.post(f"{API}/premium/cancel", timeout=TIMEOUT).status_code == 401

    def test_premium_full_flow_and_upsert(self, session):
        # fresh user to have clean premium state
        r = session.post(f"{API}/auth/guest", json={"name": "TEST_V2_PremUser"}, timeout=TIMEOUT)
        tok = r.json()["session_token"]
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

        # Default status
        r = session.get(f"{API}/premium/status", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert_no_mongo_id(d)
        assert d["premium"] is False
        assert d["plan"] is None

        # Mock purchase yearly
        r = session.post(f"{API}/premium/mock-purchase", headers=h,
                         json={"plan": "yearly"}, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d["premium"] is True and d["plan"] == "yearly" and d["mocked"] is True

        # Status reflects
        r = session.get(f"{API}/premium/status", headers=h, timeout=TIMEOUT)
        assert r.json()["premium"] is True
        assert r.json()["plan"] == "yearly"

        # Second purchase (monthly) - should upsert (no duplicate)
        r = session.post(f"{API}/premium/mock-purchase", headers=h,
                         json={"plan": "monthly"}, timeout=TIMEOUT)
        assert r.status_code == 200
        # status shows monthly
        r = session.get(f"{API}/premium/status", headers=h, timeout=TIMEOUT)
        assert r.json()["plan"] == "monthly"

        # Cancel
        r = session.post(f"{API}/premium/cancel", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["premium"] is False

        # Status false
        r = session.get(f"{API}/premium/status", headers=h, timeout=TIMEOUT)
        assert r.json()["premium"] is False

    def test_premium_isolation(self, session, ha, hb):
        # Activate for A
        session.post(f"{API}/premium/mock-purchase", headers=ha,
                     json={"plan": "yearly"}, timeout=TIMEOUT)
        # B should still see false
        r = session.get(f"{API}/premium/status", headers=hb, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["premium"] is False
        # cleanup
        session.post(f"{API}/premium/cancel", headers=ha, timeout=TIMEOUT)


# ---------------------- Currency ----------------------
class TestCurrency:
    def test_currency_requires_auth(self, session):
        r = session.get(f"{API}/currency/rates", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_currency_default_usd(self, session, ha):
        r = session.get(f"{API}/currency/rates", headers=ha, timeout=TIMEOUT)
        if r.status_code == 502:
            pytest.skip("External currency service (frankfurter.dev) unavailable")
        assert r.status_code == 200, r.text
        d = r.json()
        assert_no_mongo_id(d)
        assert set(["base", "date", "rates"]).issubset(d.keys())
        assert d["base"] == "USD"
        assert isinstance(d["rates"], dict) and len(d["rates"]) > 0
        # Common target currency present
        assert "EUR" in d["rates"]

    def test_currency_base_switching(self, session, ha):
        r = session.get(f"{API}/currency/rates?base=EUR", headers=ha, timeout=TIMEOUT)
        if r.status_code == 502:
            pytest.skip("External currency service unavailable")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["base"] == "EUR"
        # base itself should not appear in rates (frankfurter behavior)
        assert "USD" in d["rates"]
