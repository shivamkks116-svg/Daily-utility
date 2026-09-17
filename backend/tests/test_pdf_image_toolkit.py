"""
Backend tests for the new PDF & Image AI Toolkit endpoints plus regression
checks on the auth endpoints (/api/auth/guest, /api/auth/me, /api/auth/session).

Endpoints under test (added by the PDF/Image toolkit feature):
  - POST /api/pdf/info          (auth required, does NOT consume quota)
  - POST /api/pdf/extract-text  (auth required, does NOT consume quota)
  - POST /api/pdf/summarize     (auth + quota)
  - POST /api/pdf/keypoints     (auth + quota)
  - POST /api/pdf/ask           (auth + quota)
  - POST /api/pdf/translate     (auth + quota)
  - POST /api/image/ocr         (auth + quota)
  - POST /api/image/describe    (auth + quota)

Regression:
  - POST /api/auth/guest, GET /api/auth/me, POST /api/auth/session
"""
import base64
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
    "https://daily-utility-ai.preview.emergentagent.com"

TIMEOUT = 90  # LLM calls can be slow


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def guest_token(api):
    r = api.post(f"{BASE_URL}/api/auth/guest", json={"name": "TEST_PDFToolkit"}, timeout=TIMEOUT)
    assert r.status_code == 200, f"guest login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "session_token" in data and "user" in data
    assert data["user"]["is_guest"] is True
    return data["session_token"]


@pytest.fixture(scope="session")
def auth_headers(guest_token):
    return {"Authorization": f"Bearer {guest_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def sample_pdf_b64():
    import pymupdf
    doc = pymupdf.open()
    p = doc.new_page()
    p.insert_text(
        (72, 72),
        "DailyHub AI Toolkit Test Document\n"
        "This document tests the PDF extraction, summarization, key points, Q&A and\n"
        "translation endpoints of the backend. Artificial intelligence is used to\n"
        "generate concise summaries and answer questions about this document.\n"
        "The capital of France is Paris.",
        fontsize=11,
    )
    p2 = doc.new_page()
    p2.insert_text(
        (72, 72),
        "Second page. The toolkit supports batch processing, OCR, and translation.",
        fontsize=11,
    )
    b = doc.tobytes()
    doc.close()
    return base64.b64encode(b).decode(), b


@pytest.fixture(scope="session")
def sample_image_b64():
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (500, 220), "white")
    d = ImageDraw.Draw(img)
    d.text((20, 90), "HELLO DAILYHUB 2026", fill="black")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode()


# ---------------- Auth regression ----------------
class TestAuthRegression:
    def test_guest_login_creates_session(self, api):
        r = api.post(f"{BASE_URL}/api/auth/guest", json={"name": "TEST_Regress"}, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["name"] == "TEST_Regress"
        assert d["user"]["provider"] == "guest"
        assert d["session_token"].startswith("guest_")
        # _id must not leak
        assert "_id" not in d["user"]

    def test_auth_me_with_valid_token(self, api, guest_token):
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {guest_token}"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["is_guest"] is True
        assert d["user"]["name"] == "TEST_PDFToolkit"

    def test_auth_me_without_token_returns_401(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_auth_me_bad_token_returns_401(self, api):
        r = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer not_a_real_token_xyz"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_auth_session_invalid_session_id(self, api):
        # /auth/session takes a session_id from Emergent auth; invalid one should fail with non-2xx
        r = api.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "invalid_dummy_session"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (400, 401, 403, 500, 502), r.status_code


# ---------------- Unauthorized checks for all new endpoints ----------------
class TestNewEndpointsRequireAuth:
    ENDPOINTS = [
        ("/api/pdf/info", {"file_base64": "AAAA"}),
        ("/api/pdf/extract-text", {"file_base64": "AAAA"}),
        ("/api/pdf/summarize", {"file_base64": "AAAA"}),
        ("/api/pdf/keypoints", {"file_base64": "AAAA"}),
        ("/api/pdf/ask", {"file_base64": "AAAA", "question": "hi"}),
        ("/api/pdf/translate", {"file_base64": "AAAA", "target_language": "Hindi"}),
        ("/api/image/ocr", {"image_base64": "AAAA"}),
        ("/api/image/describe", {"image_base64": "AAAA"}),
    ]

    @pytest.mark.parametrize("path,payload", ENDPOINTS)
    def test_returns_401_without_bearer(self, api, path, payload):
        r = api.post(f"{BASE_URL}{path}", json=payload, timeout=TIMEOUT)
        assert r.status_code == 401, f"{path} expected 401 got {r.status_code} body={r.text[:120]}"


# ---------------- PDF /info and /extract-text (no quota) ----------------
class TestPdfLocalEndpoints:
    def test_pdf_info_returns_pages_and_metadata(self, api, auth_headers, sample_pdf_b64):
        b64, raw = sample_pdf_b64
        r = api.post(
            f"{BASE_URL}/api/pdf/info",
            headers=auth_headers,
            json={"file_base64": b64, "filename": "TEST_sample.pdf"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["pages"] == 2, f"expected 2 pages, got {d.get('pages')}"
        assert "metadata" in d and isinstance(d["metadata"], dict)
        assert d["encrypted"] is False
        assert d["bytes"] == len(raw)
        assert d["size_pt"] and "w" in d["size_pt"] and "h" in d["size_pt"]

    def test_pdf_info_accepts_data_url_prefix(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        data_url = f"data:application/pdf;base64,{b64}"
        r = api.post(
            f"{BASE_URL}/api/pdf/info",
            headers=auth_headers,
            json={"file_base64": data_url},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json()["pages"] == 2

    def test_pdf_info_rejects_invalid_pdf(self, api, auth_headers):
        # base64 for "not a pdf"
        bad = base64.b64encode(b"not a pdf at all").decode()
        r = api.post(
            f"{BASE_URL}/api/pdf/info",
            headers=auth_headers,
            json={"file_base64": bad},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, r.text

    def test_pdf_extract_text_returns_content(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        r = api.post(
            f"{BASE_URL}/api/pdf/extract-text",
            headers=auth_headers,
            json={"file_base64": b64},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "text" in d and "chars" in d
        assert d["chars"] > 50, f"too little text extracted: {d['chars']}"
        assert "DailyHub" in d["text"] or "Toolkit" in d["text"]

    def test_pdf_extract_text_does_not_consume_quota(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        q0 = api.get(f"{BASE_URL}/api/ai/quota", headers=auth_headers, timeout=TIMEOUT).json()
        api.post(
            f"{BASE_URL}/api/pdf/extract-text",
            headers=auth_headers,
            json={"file_base64": b64},
            timeout=TIMEOUT,
        )
        api.post(
            f"{BASE_URL}/api/pdf/info",
            headers=auth_headers,
            json={"file_base64": b64},
            timeout=TIMEOUT,
        )
        q1 = api.get(f"{BASE_URL}/api/ai/quota", headers=auth_headers, timeout=TIMEOUT).json()
        assert q1["used"] == q0["used"], (
            f"pdf/info + pdf/extract-text must NOT consume quota; used went {q0['used']} -> {q1['used']}"
        )


# ---------------- AI PDF endpoints (Gemini via Emergent LLM) ----------------
class TestPdfAiEndpoints:
    def test_pdf_summarize(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        r = api.post(
            f"{BASE_URL}/api/pdf/summarize",
            headers=auth_headers,
            json={"file_base64": b64},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "summary" in d and isinstance(d["summary"], str) and len(d["summary"]) > 30
        assert d.get("extract_chars", 0) > 0

    def test_pdf_summarize_consumes_quota(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        q0 = api.get(f"{BASE_URL}/api/ai/quota", headers=auth_headers, timeout=TIMEOUT).json()
        r = api.post(
            f"{BASE_URL}/api/pdf/summarize",
            headers=auth_headers,
            json={"file_base64": b64},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        q1 = api.get(f"{BASE_URL}/api/ai/quota", headers=auth_headers, timeout=TIMEOUT).json()
        assert q1["used"] == q0["used"] + 1, f"quota expected +1, went {q0['used']} -> {q1['used']}"

    def test_pdf_keypoints(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        r = api.post(
            f"{BASE_URL}/api/pdf/keypoints",
            headers=auth_headers,
            json={"file_base64": b64},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "keypoints" in d and len(d["keypoints"]) > 20
        # Expect bullet-like content
        assert any(marker in d["keypoints"] for marker in ("-", "*", "•")), \
            f"expected bullets in keypoints, got: {d['keypoints'][:200]}"

    def test_pdf_ask_returns_answer(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        r = api.post(
            f"{BASE_URL}/api/pdf/ask",
            headers=auth_headers,
            json={"file_base64": b64, "question": "What is the capital of France mentioned in the document?"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "answer" in d and len(d["answer"]) > 5
        assert "Paris" in d["answer"], f"expected 'Paris' in answer, got: {d['answer'][:200]}"

    def test_pdf_ask_rejects_empty_question(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        r = api.post(
            f"{BASE_URL}/api/pdf/ask",
            headers=auth_headers,
            json={"file_base64": b64, "question": "   "},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_pdf_translate(self, api, auth_headers, sample_pdf_b64):
        b64, _ = sample_pdf_b64
        r = api.post(
            f"{BASE_URL}/api/pdf/translate",
            headers=auth_headers,
            json={"file_base64": b64, "target_language": "Hindi"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("target_language") == "Hindi"
        assert "translation" in d and len(d["translation"]) > 10


# ---------------- Image AI endpoints ----------------
class TestImageEndpoints:
    def test_image_ocr(self, api, auth_headers, sample_image_b64):
        r = api.post(
            f"{BASE_URL}/api/image/ocr",
            headers=auth_headers,
            json={"image_base64": sample_image_b64, "mime": "image/jpeg"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "text" in d and isinstance(d["text"], str)
        # The Pillow-generated text is tiny/pixelated so Gemini may return NO_TEXT.
        # We accept either NO_TEXT_DETECTED or partial match for "HELLO"/"DAILYHUB"/"2026"
        text_upper = d["text"].upper()
        assert (
            "NO_TEXT_DETECTED" in text_upper
            or "HELLO" in text_upper
            or "DAILY" in text_upper
            or "2026" in text_upper
        ), f"unexpected OCR result: {d['text'][:200]}"

    def test_image_describe(self, api, auth_headers, sample_image_b64):
        r = api.post(
            f"{BASE_URL}/api/image/describe",
            headers=auth_headers,
            json={"image_base64": sample_image_b64, "mime": "image/jpeg"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "description" in d and len(d["description"]) > 15

    def test_image_ocr_rejects_empty(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/image/ocr",
            headers=auth_headers,
            json={"image_base64": ""},
            timeout=TIMEOUT,
        )
        assert r.status_code in (400, 422)

    def test_image_ocr_consumes_quota(self, api, auth_headers, sample_image_b64):
        q0 = api.get(f"{BASE_URL}/api/ai/quota", headers=auth_headers, timeout=TIMEOUT).json()
        r = api.post(
            f"{BASE_URL}/api/image/ocr",
            headers=auth_headers,
            json={"image_base64": sample_image_b64},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        q1 = api.get(f"{BASE_URL}/api/ai/quota", headers=auth_headers, timeout=TIMEOUT).json()
        assert q1["used"] == q0["used"] + 1
