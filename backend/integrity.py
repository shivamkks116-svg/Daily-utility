"""Google Play Integrity — server-side token decode + verdict checks.

Enabled only when PLAY_INTEGRITY_SA_JSON and PLAY_CLOUD_PROJECT_NUMBER are set,
so the app keeps working (fail-open) until the owner finishes Google setup.
"""
import json
import logging
import os
import time
from contextvars import ContextVar

import httpx

logger = logging.getLogger(__name__)

PACKAGE = "com.dailyutility.app"
PLAY_SCOPE = "https://www.googleapis.com/auth/playintegrity"
SA_JSON = os.environ.get("PLAY_INTEGRITY_SA_JSON", "").strip()
PROJECT_NUMBER = os.environ.get("PLAY_CLOUD_PROJECT_NUMBER", "").strip()
CERT_DIGESTS = {x.strip() for x in os.environ.get("PLAY_CERT_DIGESTS", "").split(",") if x.strip()}
ENABLED = bool(SA_JSON and PROJECT_NUMBER)

# Filled by middleware so require_user can see platform + path.
request_ctx: ContextVar[dict] = ContextVar("request_ctx", default={})

_creds = None


def _access_token() -> str:
    global _creds
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    if _creds is None:
        _creds = service_account.Credentials.from_service_account_info(json.loads(SA_JSON), scopes=[PLAY_SCOPE])
    if not _creds.valid:
        _creds.refresh(Request())
    return _creds.token


async def decode_and_check(token: str, expected_nonce: str) -> tuple[bool, str]:
    """Return (ok, reason)."""
    try:
        access = _access_token()
    except Exception as e:
        logger.warning("Integrity credentials error: %s", e)
        return True, "server_credentials_error"  # never lock out users on our own misconfig
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"https://playintegrity.googleapis.com/v1/{PACKAGE}:decodeIntegrityToken",
            headers={"Authorization": f"Bearer {access}"},
            json={"integrity_token": token},
        )
    if r.status_code != 200:
        logger.warning("Integrity decode failed %s: %s", r.status_code, r.text[:200])
        return False, "decode_failed"
    payload = r.json().get("tokenPayloadExternal") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    req = payload.get("requestDetails", {})
    app = payload.get("appIntegrity", {})
    acct = payload.get("accountDetails", {})
    if req.get("requestPackageName") != PACKAGE:
        return False, "wrong_package"
    if req.get("requestHash") != expected_nonce:
        return False, "hash_mismatch"
    ts = int(req.get("timestampMillis") or 0)
    if abs(int(time.time() * 1000) - ts) > 10 * 60 * 1000:
        return False, "stale"
    if app.get("appRecognitionVerdict") != "PLAY_RECOGNIZED":
        return False, f"app_{app.get('appRecognitionVerdict', 'UNKNOWN')}"
    if acct.get("appLicensingVerdict") not in ("LICENSED", None):
        return False, f"license_{acct.get('appLicensingVerdict')}"
    if CERT_DIGESTS and not CERT_DIGESTS.intersection(set(app.get("certificateSha256Digest", []))):
        return False, "bad_certificate"
    return True, "ok"
