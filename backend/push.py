"""Emergent managed push relay (SuprSend passthrough).

The backend never stores device tokens — `send_push(recipients=[user_id])`
resolves tokens upstream. EMERGENT_PUSH_KEY is injected by the deploy pipeline.
"""
import asyncio
import logging
import os

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)


async def register_device(user_id: str, platform: str, device_token: str) -> None:
    resp = await _client.post(
        "/api/v1/push/users/register",
        json={"user_id": user_id, "platform": platform, "device_token": device_token},
    )
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def send_push(
    recipients: list,
    data: dict,
    idempotency_key: str | None = None,
    _attempt: int = 0,
) -> None:
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    code = resp.json().get("code", "") if resp.headers.get("content-type", "").startswith("application/json") else ""
    if code == "idempotency_key_in_progress" and idempotency_key and _attempt < 3:
        await asyncio.sleep(3)
        return await send_push(recipients, data, idempotency_key=idempotency_key, _attempt=_attempt + 1)
    if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
        logger.warning(f"Push paused: {code} ({resp.status_code}): {resp.json().get('message', '')}")
        raise HTTPException(402, f"Push paused: {code}")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def send_push_chunked(user_ids: list, data: dict, idempotency_prefix: str | None = None) -> int:
    """Send to any number of users in chunks of 100. Returns recipients attempted."""
    sent = 0
    for i in range(0, len(user_ids), 100):
        chunk = user_ids[i:i + 100]
        key = f"{idempotency_prefix}-{i // 100}" if idempotency_prefix else None
        await send_push(chunk, data, idempotency_key=key)
        sent += len(chunk)
    return sent
