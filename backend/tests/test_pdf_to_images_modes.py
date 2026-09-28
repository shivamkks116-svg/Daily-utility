"""Backend tests for POST /api/pdf/to-images multi-mode support.

Covers three modes on the updated endpoint:
  1) page_count_only=True → no rendering, just total page count
  2) pages=[...]           → renders only requested pages (1-indexed)
  3) legacy default        → renders all pages up to max_pages

Also validates input error handling (invalid base64, missing file_base64).
"""
import base64
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://daily-utility-ai.preview.emergentagent.com"

TIMEOUT = 60


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def guest_token(api):
    r = api.post(f"{BASE_URL}/api/auth/guest", json={"name": "TEST_PDFToImages"}, timeout=TIMEOUT)
    assert r.status_code == 200, f"guest login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "session_token" in data
    return data["session_token"]


@pytest.fixture(scope="session")
def auth_headers(guest_token):
    return {"Authorization": f"Bearer {guest_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def three_page_pdf_b64():
    """Build a small 3-page PDF using PyMuPDF and return its base64 content."""
    import fitz  # PyMuPDF
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page(width=300, height=400)
        page.insert_text((50, 80), f"TEST_PAGE_{i + 1}", fontsize=24)
    buf = doc.tobytes()
    doc.close()
    return base64.b64encode(buf).decode("ascii")


# ---------------- Mode 1: page_count_only ----------------
class TestPageCountOnly:
    def test_page_count_only_returns_total_without_rendering(self, api, auth_headers, three_page_pdf_b64):
        payload = {"file_base64": three_page_pdf_b64, "page_count_only": True}
        r = api.post(f"{BASE_URL}/api/pdf/to-images", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"unexpected {r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("total_pages") == 3, f"expected total_pages=3, got {data.get('total_pages')}"
        assert data.get("pages") == [], f"expected empty pages array, got {data.get('pages')}"
        assert "dpi" in data and "format" in data


# ---------------- Mode 2: specific pages ----------------
class TestSpecificPages:
    def test_renders_only_requested_pages(self, api, auth_headers, three_page_pdf_b64):
        payload = {
            "file_base64": three_page_pdf_b64,
            "pages": [1, 3],
            "dpi": 100,
            "format": "jpeg",
        }
        r = api.post(f"{BASE_URL}/api/pdf/to-images", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"unexpected {r.status_code}: {r.text[:400]}"
        data = r.json()
        pages = data.get("pages") or []
        assert len(pages) == 2, f"expected 2 pages rendered, got {len(pages)}"
        page_nums = sorted([p["page"] for p in pages])
        assert page_nums == [1, 3], f"expected pages [1,3], got {page_nums}"
        for p in pages:
            assert p.get("data"), f"empty data for page {p.get('page')}"
            assert p.get("mime") == "image/jpeg"
            assert p.get("width", 0) > 0 and p.get("height", 0) > 0
        assert data.get("total_pages") == 3, f"total_pages should still be 3, got {data.get('total_pages')}"
        assert data.get("format") == "jpeg"
        assert data.get("dpi") == 100

    def test_out_of_range_page_ignored(self, api, auth_headers, three_page_pdf_b64):
        """Pages outside the doc should be filtered silently."""
        payload = {"file_base64": three_page_pdf_b64, "pages": [2, 99], "dpi": 100}
        r = api.post(f"{BASE_URL}/api/pdf/to-images", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"unexpected {r.status_code}: {r.text[:400]}"
        data = r.json()
        pages = data.get("pages") or []
        assert len(pages) == 1 and pages[0]["page"] == 2


# ---------------- Mode 3: legacy full render ----------------
class TestLegacyFullRender:
    def test_default_renders_all_pages(self, api, auth_headers, three_page_pdf_b64):
        payload = {"file_base64": three_page_pdf_b64}
        r = api.post(f"{BASE_URL}/api/pdf/to-images", json=payload, headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200, f"unexpected {r.status_code}: {r.text[:400]}"
        data = r.json()
        pages = data.get("pages") or []
        assert len(pages) == 3, f"legacy render should return 3 pages, got {len(pages)}"
        page_nums = [p["page"] for p in pages]
        assert page_nums == [1, 2, 3], f"expected sequential [1,2,3], got {page_nums}"
        for p in pages:
            assert p.get("data"), f"empty data for page {p.get('page')}"
            assert p.get("mime") in ("image/png", "image/jpeg")
        assert data.get("total_pages") == 3


# ---------------- Input validation ----------------
class TestInputValidation:
    def test_invalid_base64_returns_400(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/pdf/to-images",
            json={"file_base64": "not_b64!!!"},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        # _decode_b64_bytes should reject → 400
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:400]}"

    def test_missing_file_base64_returns_422_or_400(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/pdf/to-images",
            json={},
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        # FastAPI/Pydantic validation → 422; explicit checks may return 400
        assert r.status_code in (400, 422), f"expected 400/422, got {r.status_code}: {r.text[:400]}"

    def test_no_auth_returns_401(self, api, three_page_pdf_b64):
        r = api.post(
            f"{BASE_URL}/api/pdf/to-images",
            json={"file_base64": three_page_pdf_b64, "page_count_only": True},
            timeout=TIMEOUT,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"
