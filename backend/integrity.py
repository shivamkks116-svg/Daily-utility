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
def _norm_digest(d: str) -> str:
    """Accept hex (with/without colons) or base64/base64url; return base64url without padding."""
    import base64
    s = d.strip()
    hexs = s.replace(":", "")
    if len(hexs) == 64 and all(c in "0123456789abcdefABCDEF" for c in hexs):
        return base64.urlsafe_b64encode(bytes.fromhex(hexs)).decode().rstrip("=")
    return s.replace("+", "-").replace("/", "_").rstrip("=")


CERT_DIGESTS = {_norm_digest(x) for x in os.environ.get("PLAY_CERT_DIGESTS", "").split(",") if x.strip()}
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
        logger.warning("Integrity decode failed %s: %s", r.status_code, r.text[:300])
        return True, f"allow_decode_{r.status_code}:{r.text[:160]}"
    payload = r.json().get("tokenPayloadExternal") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    app = payload.get("appIntegrity", {})
    verdict = app.get("appRecognitionVerdict")
    # Block ONLY when Google explicitly says the binary is not the one on Play
    # (modded / re-signed APK). Everything else is allowed and just logged.
    if verdict == "UNRECOGNIZED_VERSION":
        return False, "app_UNRECOGNIZED_VERSION"
    detail = {
        "verdict": verdict,
        "license": payload.get("accountDetails", {}).get("appLicensingVerdict"),
        "pkg": payload.get("requestDetails", {}).get("requestPackageName"),
        "hash_ok": payload.get("requestDetails", {}).get("requestHash") == expected_nonce,
        "cert_match": (not CERT_DIGESTS) or bool(CERT_DIGESTS.intersection({_norm_digest(x) for x in app.get("certificateSha256Digest", [])})),
    }
    return True, f"ok {json.dumps(detail)}"
