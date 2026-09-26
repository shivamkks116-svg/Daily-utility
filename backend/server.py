"""DailyHub AI Backend - FastAPI + MongoDB + Emergent Auth + Gemini 3 Flash."""
from fastapi import FastAPI, APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------- Setup ----------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ---------------------- Firebase Admin (no service account needed for verify) ----------------------
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', '')
FIREBASE_WEB_API_KEY = os.environ.get('FIREBASE_WEB_API_KEY', '')

try:
    import firebase_admin
    from firebase_admin import auth as _fb_auth, credentials as _fb_credentials
    if not firebase_admin._apps:
        # verify_id_token only needs projectId; no service-account required.
        firebase_admin.initialize_app(options={'projectId': FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None)
    _FB_READY = bool(FIREBASE_PROJECT_ID)
except Exception as _e:  # noqa
    _FB_READY = False
    _fb_auth = None
    logging.getLogger('dailyhub').warning('firebase-admin init failed: %s', _e)

app = FastAPI(title="DailyHub AI API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("dailyhub")


# ---------------------- Utils ----------------------
def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def clean(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    doc.pop("_id", None)
    # Normalize datetimes to iso strings
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            doc[k] = v.isoformat()
    return doc


async def get_user_from_token(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    exp = session.get("expires_at")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < utcnow():
            return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(authorization: Optional[str]) -> dict:
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ---------------------- Models ----------------------
class SessionExchangeIn(BaseModel):
    session_id: str


class GuestLoginIn(BaseModel):
    name: Optional[str] = "Guest"


class NoteIn(BaseModel):
    title: str = ""
    content: str = ""
    color: str = "#1B221E"
    pinned: bool = False


class TodoIn(BaseModel):
    title: str
    notes: Optional[str] = ""
    due_date: Optional[str] = None
    priority: str = "normal"  # low|normal|high
    completed: bool = False


class HabitIn(BaseModel):
    name: str
    emoji: str = "🌱"
    color: str = "#5EBA8B"
    target_per_week: int = 7


class HabitLogIn(BaseModel):
    date: str  # YYYY-MM-DD


class FocusSessionIn(BaseModel):
    mode: str = "pomodoro"  # pomodoro|short_break|long_break
    duration_seconds: int
    completed: bool = True
    label: Optional[str] = None


class AIRequestIn(BaseModel):
    prompt: str
    context: Optional[str] = None


class TranslateIn(BaseModel):
    text: str
    target_language: str = "English"


class ChatIn(BaseModel):
    session_id: str
    message: str


# --- Expense/Income Tracker ---
class ExpenseIn(BaseModel):
    amount: float
    kind: str = "expense"  # expense|income
    category: str = "General"
    note: Optional[str] = ""
    date: Optional[str] = None  # YYYY-MM-DD; default today


# --- Voice Notes ---
class VoiceNoteIn(BaseModel):
    title: str = ""
    duration_ms: int = 0
    audio_base64: str  # data URL or raw base64
    mime_type: str = "audio/m4a"


# --- QR Scan History ---
class QRScanIn(BaseModel):
    value: str
    type: str = "unknown"  # qr|barcode|url|text|wifi|contact


# --- Reminders (Water / Medicine) ---
class ReminderIn(BaseModel):
    kind: str = "water"  # water|medicine|custom
    title: str
    times: List[str] = []  # ["08:00","12:00","20:00"]
    enabled: bool = True
    dose: Optional[str] = None  # for medicine
    icon: Optional[str] = None


# ---------------------- Health ----------------------
@api_router.get("/")
async def root():
    return {"message": "DailyHub AI API", "status": "ok"}


# ---------------------- Auth ----------------------
@api_router.post("/auth/session")
async def auth_session(payload: SessionExchangeIn):
    session_id = payload.session_id.strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15) as h:
        try:
            resp = await h.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id})
        except Exception as e:
            logger.exception("Emergent auth error")
            raise HTTPException(status_code=401, detail="Auth service unreachable") from e

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    data = resp.json()
    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Malformed auth response")

    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login_at": utcnow()}},
        )
        user = {**existing, "name": name, "picture": picture}
    else:
        user_id = new_id("user")
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "provider": "google",
            "is_guest": False,
            "created_at": utcnow(),
            "last_login_at": utcnow(),
        }
        await db.users.insert_one({**user})

    # Store session (7 days)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(days=7),
    })

    return {"session_token": session_token, "user": clean(user)}


@api_router.post("/auth/guest")
async def auth_guest(payload: GuestLoginIn):
    user_id = new_id("guest")
    email = f"{user_id}@guest.local"
    user = {
        "user_id": user_id,
        "email": email,
        "name": payload.name or "Guest",
        "picture": None,
        "provider": "guest",
        "is_guest": True,
        "created_at": utcnow(),
        "last_login_at": utcnow(),
    }
    await db.users.insert_one({**user})
    session_token = f"guest_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(days=30),
    })
    return {"session_token": session_token, "user": clean(user)}


# -------- Firebase Auth (Google, Email/Password) --------
class FirebaseAuthIn(BaseModel):
    id_token: str
    provider: Optional[str] = None  # "google" | "password" (hint, not trusted)


async def _mint_app_session(user_id: str, days: int = 7) -> str:
    """Create a new 7-day session_token that reuses the app's existing token
    scheme. Callers pass the persisted user_id."""
    session_token = f"fb_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(days=days),
    })
    return session_token


@api_router.post("/auth/firebase")
async def auth_firebase(payload: FirebaseAuthIn):
    """Verify a Firebase ID token, upsert the user, and return the app's own
    session_token. Preserves existing user_id when email already exists so
    downstream data (notes, todos, RevenueCat) keeps working."""
    if not _FB_READY or _fb_auth is None:
        raise HTTPException(status_code=503, detail="Firebase Admin not configured on server")

    token = (payload.id_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="id_token required")

    try:
        decoded = _fb_auth.verify_id_token(token, check_revoked=False)
    except Exception as e:
        logger.warning("firebase verify_id_token failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token") from e

    # Extract identity
    firebase_uid = decoded.get("uid") or decoded.get("user_id")
    email = (decoded.get("email") or "").lower().strip()
    name = decoded.get("name") or decoded.get("email") or "User"
    picture = decoded.get("picture")
    email_verified = bool(decoded.get("email_verified"))
    firebase_provider = decoded.get("firebase", {}).get("sign_in_provider", "")

    # Derive app-side provider label
    if firebase_provider == "google.com":
        provider = "google"
    elif firebase_provider == "password":
        provider = "password"
    else:
        provider = firebase_provider or (payload.provider or "firebase")

    if not email:
        raise HTTPException(status_code=401, detail="Email missing from Firebase token")

    # Upsert user — reuse existing user_id if email is already known
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": name,
                "picture": picture,
                "provider": provider,
                "firebase_uid": firebase_uid,
                "email_verified": email_verified,
                "last_login_at": utcnow(),
                "is_guest": False,
            }},
        )
        user = {**existing, "name": name, "picture": picture, "provider": provider,
                "firebase_uid": firebase_uid, "email_verified": email_verified,
                "is_guest": False}
    else:
        user_id = new_id("user")
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "provider": provider,
            "firebase_uid": firebase_uid,
            "email_verified": email_verified,
            "is_guest": False,
            "created_at": utcnow(),
            "last_login_at": utcnow(),
        }
        await db.users.insert_one({**user})

    session_token = await _mint_app_session(user_id, days=7)
    return {"session_token": session_token, "user": clean(user)}


@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    return {"user": clean(user)}


@api_router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------------------- Notes ----------------------
@api_router.get("/notes")
async def list_notes(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.notes.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1)
    items = [clean(x) for x in await cur.to_list(1000)]
    return {"items": items}


@api_router.post("/notes")
async def create_note(payload: NoteIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    now = utcnow()
    note = {
        "id": new_id("note"),
        "user_id": user["user_id"],
        "title": payload.title,
        "content": payload.content,
        "color": payload.color,
        "pinned": payload.pinned,
        "created_at": now,
        "updated_at": now,
    }
    await db.notes.insert_one({**note})
    return clean(note)


@api_router.put("/notes/{note_id}")
async def update_note(note_id: str, payload: NoteIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    upd = payload.dict()
    upd["updated_at"] = utcnow()
    r = await db.notes.update_one({"id": note_id, "user_id": user["user_id"]}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Note not found")
    doc = await db.notes.find_one({"id": note_id}, {"_id": 0})
    return clean(doc)


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.notes.delete_one({"id": note_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------- Todos ----------------------
@api_router.get("/todos")
async def list_todos(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.todos.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    items = [clean(x) for x in await cur.to_list(1000)]
    return {"items": items}


@api_router.post("/todos")
async def create_todo(payload: TodoIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    now = utcnow()
    todo = {
        "id": new_id("todo"),
        "user_id": user["user_id"],
        **payload.dict(),
        "created_at": now,
        "updated_at": now,
    }
    await db.todos.insert_one({**todo})
    return clean(todo)


@api_router.put("/todos/{todo_id}")
async def update_todo(todo_id: str, payload: TodoIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    upd = payload.dict()
    upd["updated_at"] = utcnow()
    r = await db.todos.update_one({"id": todo_id, "user_id": user["user_id"]}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Todo not found")
    doc = await db.todos.find_one({"id": todo_id}, {"_id": 0})
    return clean(doc)


@api_router.delete("/todos/{todo_id}")
async def delete_todo(todo_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.todos.delete_one({"id": todo_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------- Habits ----------------------
@api_router.get("/habits")
async def list_habits(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.habits.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1)
    habits = [clean(x) for x in await cur.to_list(500)]
    # Attach recent logs (last 60 days)
    for h in habits:
        logs_cur = db.habit_logs.find({"habit_id": h["id"], "user_id": user["user_id"]}, {"_id": 0})
        logs = await logs_cur.to_list(500)
        h["logs"] = [l["date"] for l in logs]
    return {"items": habits}


@api_router.post("/habits")
async def create_habit(payload: HabitIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    now = utcnow()
    habit = {
        "id": new_id("habit"),
        "user_id": user["user_id"],
        **payload.dict(),
        "created_at": now,
    }
    await db.habits.insert_one({**habit})
    doc = clean(habit)
    doc["logs"] = []
    return doc


@api_router.post("/habits/{habit_id}/log")
async def log_habit(habit_id: str, payload: HabitLogIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    habit = await db.habits.find_one({"id": habit_id, "user_id": user["user_id"]}, {"_id": 0})
    if not habit:
        raise HTTPException(404, "Habit not found")
    existing = await db.habit_logs.find_one({"habit_id": habit_id, "date": payload.date, "user_id": user["user_id"]})
    if existing:
        await db.habit_logs.delete_one({"habit_id": habit_id, "date": payload.date, "user_id": user["user_id"]})
        return {"toggled": False}
    await db.habit_logs.insert_one({
        "id": new_id("log"),
        "habit_id": habit_id,
        "user_id": user["user_id"],
        "date": payload.date,
        "created_at": utcnow(),
    })
    return {"toggled": True}


@api_router.delete("/habits/{habit_id}")
async def delete_habit(habit_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.habits.delete_one({"id": habit_id, "user_id": user["user_id"]})
    await db.habit_logs.delete_many({"habit_id": habit_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------- Focus Sessions ----------------------
@api_router.get("/focus")
async def list_focus(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.focus_sessions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(50)
    items = [clean(x) for x in await cur.to_list(50)]
    # Aggregate today total
    today = utcnow().strftime("%Y-%m-%d")
    today_total_cur = db.focus_sessions.find({
        "user_id": user["user_id"],
        "date": today,
        "completed": True,
    }, {"_id": 0})
    today_docs = await today_total_cur.to_list(200)
    today_seconds = sum(d.get("duration_seconds", 0) for d in today_docs)
    return {"items": items, "today_seconds": today_seconds}


@api_router.post("/focus")
async def create_focus(payload: FocusSessionIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    now = utcnow()
    doc = {
        "id": new_id("focus"),
        "user_id": user["user_id"],
        **payload.dict(),
        "date": now.strftime("%Y-%m-%d"),
        "created_at": now,
    }
    await db.focus_sessions.insert_one({**doc})
    return clean(doc)


# ---------------------- AI (Gemini 3 Flash) ----------------------
# Free tier: 5 AI requests / user / day. Users can watch a rewarded ad to earn
# +5 bonus requests (up to a daily cap).
FREE_AI_LIMIT_PER_DAY = 5
REWARDED_AI_BONUS = 5
MAX_BONUS_PER_DAY = 15  # cap: 3 rewarded ads worth of bonus per day

def _today_key() -> str:
    return utcnow().strftime("%Y-%m-%d")

async def _get_quota_doc(user_id: str):
    key = _today_key()
    doc = await db.ai_quota.find_one({"user_id": user_id, "date": key}, {"_id": 0})
    if not doc:
        doc = {"user_id": user_id, "date": key, "used": 0, "bonus": 0}
        await db.ai_quota.insert_one({**doc})
    return doc

async def _check_and_increment_quota(user_id: str):
    """Raise 429 if quota exhausted; otherwise increment `used` and return doc."""
    key = _today_key()
    doc = await _get_quota_doc(user_id)
    remaining = FREE_AI_LIMIT_PER_DAY + int(doc.get("bonus", 0)) - int(doc.get("used", 0))
    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "quota_exceeded",
                "message": "You've reached today's free AI limit.",
                "used": int(doc.get("used", 0)),
                "limit": FREE_AI_LIMIT_PER_DAY,
                "bonus": int(doc.get("bonus", 0)),
                "reset_at": (utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat(),
            },
        )
    await db.ai_quota.update_one(
        {"user_id": user_id, "date": key},
        {"$inc": {"used": 1}},
        upsert=True,
    )
    return doc


@api_router.get("/ai/quota")
async def ai_quota(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    doc = await _get_quota_doc(user["user_id"])
    used = int(doc.get("used", 0))
    bonus = int(doc.get("bonus", 0))
    total = FREE_AI_LIMIT_PER_DAY + bonus
    remaining = max(0, total - used)
    reset_at = (utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    return {
        "used": used,
        "bonus": bonus,
        "free_limit": FREE_AI_LIMIT_PER_DAY,
        "total": total,
        "remaining": remaining,
        "reset_at": reset_at,
        "bonus_available": bonus < MAX_BONUS_PER_DAY,
        "max_bonus": MAX_BONUS_PER_DAY,
    }


@api_router.post("/ai/reward")
async def ai_reward(authorization: Optional[str] = Header(default=None)):
    """Called by the client after a successful rewarded ad view. Grants +5 requests."""
    user = await require_user(authorization)
    key = _today_key()
    doc = await _get_quota_doc(user["user_id"])
    if int(doc.get("bonus", 0)) >= MAX_BONUS_PER_DAY:
        raise HTTPException(status_code=400, detail="Daily bonus limit reached. Come back tomorrow.")
    await db.ai_quota.update_one(
        {"user_id": user["user_id"], "date": key},
        {"$inc": {"bonus": REWARDED_AI_BONUS}},
        upsert=True,
    )
    new_doc = await _get_quota_doc(user["user_id"])
    used = int(new_doc.get("used", 0))
    bonus = int(new_doc.get("bonus", 0))
    total = FREE_AI_LIMIT_PER_DAY + bonus
    return {"granted": REWARDED_AI_BONUS, "used": used, "bonus": bonus, "total": total, "remaining": max(0, total - used)}


def _make_chat(session_id: str, system_message: str):
    from emergentintegrations.llm.chat import LlmChat
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("gemini", "gemini-3-flash-preview")


async def _one_shot(system_message: str, user_text: str, session_key: str = "one-shot") -> str:
    from emergentintegrations.llm.chat import UserMessage
    chat = _make_chat(f"{session_key}-{uuid.uuid4().hex[:8]}", system_message)
    try:
        resp = await chat.send_message(UserMessage(text=user_text))
        return str(resp).strip()
    except Exception as e:
        logger.exception("LLM one-shot error")
        raise HTTPException(500, f"AI error: {str(e)[:200]}")


@api_router.post("/ai/chat")
async def ai_chat(payload: ChatIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    from emergentintegrations.llm.chat import UserMessage
    session_id = f"{user['user_id']}-{payload.session_id}"
    # Rebuild history: emergentintegrations LlmChat keeps history in-memory per instance.
    # We store history in Mongo and pass system context; we send only the current message.
    # For multi-turn we let the library append via send_message but since we create new chat per call,
    # we prepend prior messages summary as context.
    prev = await db.ai_messages.find(
        {"user_id": user["user_id"], "session_id": payload.session_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(50)

    history_text = ""
    if prev:
        parts = []
        for m in prev[-20:]:
            role = "User" if m["role"] == "user" else "Assistant"
            parts.append(f"{role}: {m['content']}")
        history_text = "\n\nPrior conversation:\n" + "\n".join(parts)

    system_msg = (
        "You are DailyHub AI, a helpful, concise, friendly productivity assistant. "
        "Answer clearly. Use markdown when useful."
        + history_text
    )
    chat = _make_chat(session_id, system_msg)
    try:
        reply = await chat.send_message(UserMessage(text=payload.message))
        reply_text = str(reply).strip()
    except Exception as e:
        logger.exception("AI chat error")
        raise HTTPException(500, f"AI error: {str(e)[:200]}")

    now = utcnow()
    await db.ai_messages.insert_many([
        {
            "id": new_id("msg"),
            "user_id": user["user_id"],
            "session_id": payload.session_id,
            "role": "user",
            "content": payload.message,
            "created_at": now,
        },
        {
            "id": new_id("msg"),
            "user_id": user["user_id"],
            "session_id": payload.session_id,
            "role": "assistant",
            "content": reply_text,
            "created_at": utcnow(),
        },
    ])
    return {"reply": reply_text}


@api_router.get("/ai/history/{session_id}")
async def ai_history(session_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    msgs = await db.ai_messages.find(
        {"user_id": user["user_id"], "session_id": session_id}, {"_id": 0},
    ).sort("created_at", 1).to_list(200)
    return {"items": [clean(m) for m in msgs]}


@api_router.post("/ai/translate")
async def ai_translate(payload: TranslateIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    sys = (
        f"You are a professional translator. Translate the user's text to {payload.target_language}. "
        "Return ONLY the translated text with no preface, no quotes, no explanations."
    )
    out = await _one_shot(sys, payload.text, "translate")
    return {"result": out}


@api_router.post("/ai/email-writer")
async def ai_email(payload: AIRequestIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    sys = (
        "You are an expert email writer. Given the user's intent, write a clear, polite, professional email. "
        "Include a subject line prefixed 'Subject:' on the first line, then a blank line, then the body. Keep it concise."
    )
    out = await _one_shot(sys, payload.prompt, "email")
    return {"result": out}


@api_router.post("/ai/grammar")
async def ai_grammar(payload: AIRequestIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    sys = (
        "You are a grammar and clarity expert. Rewrite the user's text with correct grammar, spelling, "
        "punctuation, and natural flow. Keep the original meaning and tone. Return ONLY the corrected text."
    )
    out = await _one_shot(sys, payload.prompt, "grammar")
    return {"result": out}


@api_router.post("/ai/summarize")
async def ai_summarize(payload: AIRequestIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    sys = (
        "You are a summarization expert. Produce a crisp summary of the user's content. "
        "Use 3–6 bullet points, each starting with '• '. Keep it under 120 words total."
    )
    out = await _one_shot(sys, payload.prompt, "summarize")
    return {"result": out}


@api_router.post("/ai/study")
async def ai_study(payload: AIRequestIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    sys = (
        "You are a friendly study assistant. Explain the user's topic simply and thoroughly. "
        "Structure the reply with: 1) A one-line definition, 2) Key points (bullets), "
        "3) A short example, 4) A quick 2-question self-check. Use markdown."
    )
    out = await _one_shot(sys, payload.prompt, "study")
    return {"result": out}


# ---------------------- Expenses ----------------------
@api_router.get("/expenses")
async def list_expenses(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.expenses.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1)
    items = [clean(x) for x in await cur.to_list(2000)]
    # Aggregate month totals
    month = utcnow().strftime("%Y-%m")
    inc = 0.0
    exp = 0.0
    for it in items:
        d = it.get("date") or ""
        if isinstance(d, str) and d.startswith(month):
            if it.get("kind") == "income":
                inc += float(it.get("amount", 0))
            else:
                exp += float(it.get("amount", 0))
    return {
        "items": items,
        "month": month,
        "month_income": round(inc, 2),
        "month_expense": round(exp, 2),
        "month_balance": round(inc - exp, 2),
    }


@api_router.post("/expenses")
async def create_expense(payload: ExpenseIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    now = utcnow()
    doc = {
        "id": new_id("exp"),
        "user_id": user["user_id"],
        "amount": float(payload.amount),
        "kind": payload.kind if payload.kind in ("expense", "income") else "expense",
        "category": payload.category or "General",
        "note": payload.note or "",
        "date": payload.date or now.strftime("%Y-%m-%d"),
        "created_at": now,
    }
    await db.expenses.insert_one({**doc})
    return clean(doc)


@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.expenses.delete_one({"id": expense_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------- Voice Notes ----------------------
@api_router.get("/voice-notes")
async def list_voice_notes(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.voice_notes.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "audio_base64": 0},  # exclude payload from list
    ).sort("created_at", -1)
    items = [clean(x) for x in await cur.to_list(500)]
    return {"items": items}


@api_router.get("/voice-notes/{voice_id}")
async def get_voice_note(voice_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    doc = await db.voice_notes.find_one({"id": voice_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return clean(doc)


@api_router.post("/voice-notes")
async def create_voice_note(payload: VoiceNoteIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    if not payload.audio_base64:
        raise HTTPException(400, "audio_base64 required")
    now = utcnow()
    doc = {
        "id": new_id("voice"),
        "user_id": user["user_id"],
        "title": payload.title or now.strftime("Voice %b %d %H:%M"),
        "duration_ms": int(payload.duration_ms),
        "audio_base64": payload.audio_base64,
        "mime_type": payload.mime_type or "audio/m4a",
        "created_at": now,
    }
    await db.voice_notes.insert_one({**doc})
    # Return without the payload
    return clean({k: v for k, v in doc.items() if k != "audio_base64"})


@api_router.delete("/voice-notes/{voice_id}")
async def delete_voice_note(voice_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.voice_notes.delete_one({"id": voice_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------- QR Scan History ----------------------
@api_router.get("/qr-scans")
async def list_qr_scans(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.qr_scans.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(200)
    items = [clean(x) for x in await cur.to_list(200)]
    return {"items": items}


@api_router.post("/qr-scans")
async def create_qr_scan(payload: QRScanIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    now = utcnow()
    doc = {
        "id": new_id("qr"),
        "user_id": user["user_id"],
        "value": payload.value,
        "type": payload.type or "unknown",
        "created_at": now,
    }
    await db.qr_scans.insert_one({**doc})
    return clean(doc)


@api_router.delete("/qr-scans/{scan_id}")
async def delete_qr_scan(scan_id: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.qr_scans.delete_one({"id": scan_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------- Reminders (Water / Medicine) ----------------------
@api_router.get("/reminders")
async def list_reminders(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    cur = db.reminders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", 1)
    items = [clean(x) for x in await cur.to_list(200)]
    return {"items": items}


@api_router.post("/reminders")
async def create_reminder(payload: ReminderIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    now = utcnow()
    doc = {
        "id": new_id("rmd"),
        "user_id": user["user_id"],
        **payload.dict(),
        "created_at": now,
        "updated_at": now,
    }
    await db.reminders.insert_one({**doc})
    return clean(doc)


@api_router.put("/reminders/{rid}")
async def update_reminder(rid: str, payload: ReminderIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    upd = payload.dict()
    upd["updated_at"] = utcnow()
    r = await db.reminders.update_one({"id": rid, "user_id": user["user_id"]}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.reminders.find_one({"id": rid}, {"_id": 0})
    return clean(doc)


@api_router.delete("/reminders/{rid}")
async def delete_reminder(rid: str, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.reminders.delete_one({"id": rid, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------- Premium (MOCKED billing) ----------------------
@api_router.get("/premium/status")
async def premium_status(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    doc = await db.premium.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        return {"premium": False, "plan": None, "activated_at": None}
    return {
        "premium": bool(doc.get("premium")),
        "plan": doc.get("plan"),
        "activated_at": doc.get("activated_at").isoformat() if isinstance(doc.get("activated_at"), datetime) else doc.get("activated_at"),
    }


class PremiumMockIn(BaseModel):
    plan: str = "monthly"  # monthly|yearly|lifetime


@api_router.post("/premium/mock-purchase")
async def premium_mock_purchase(payload: PremiumMockIn, authorization: Optional[str] = Header(default=None)):
    """MOCKED endpoint. Real Play Billing v8 requires a native dev build.
    This activates premium locally for UX testing. In production, replace with server-side
    receipt verification from Google Play Developer API."""
    user = await require_user(authorization)
    now = utcnow()
    await db.premium.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "premium": True,
            "plan": payload.plan,
            "activated_at": now,
            "source": "mock",
        }},
        upsert=True,
    )
    return {"premium": True, "plan": payload.plan, "activated_at": now.isoformat(), "mocked": True}


@api_router.post("/premium/cancel")
async def premium_cancel(authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await db.premium.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"premium": False, "cancelled_at": utcnow()}},
    )
    return {"premium": False}


# ---------------------- Currency Rates (public API proxy) ----------------------
@api_router.get("/currency/rates")
async def currency_rates(base: str = "USD", authorization: Optional[str] = Header(default=None)):
    await require_user(authorization)
    base = base.upper()
    try:
        async with httpx.AsyncClient(timeout=10) as h:
            r = await h.get(f"https://api.frankfurter.dev/v1/latest?base={base}")
        if r.status_code != 200:
            raise HTTPException(502, "Rate service error")
        data = r.json()
        return {"base": data.get("base", base), "date": data.get("date"), "rates": data.get("rates", {})}
    except HTTPException:
        raise
    except Exception:
        logger.exception("currency error")
        raise HTTPException(502, "Rate service unavailable")


# ---------------------- Public legal pages (Play Store requirement) ----------------------
_STATIC_DIR = ROOT_DIR / "static"


def _read_static(name: str) -> str:
    try:
        return (_STATIC_DIR / name).read_text(encoding="utf-8")
    except Exception:  # noqa: BLE001
        return "<!doctype html><html><body><h1>Not Found</h1></body></html>"


# Root-level routes (work when the backend is directly reachable, e.g. on emergent.host domain).
@app.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
async def privacy_html():
    return HTMLResponse(_read_static("privacy.html"))


@app.get("/privacy.html", response_class=HTMLResponse, include_in_schema=False)
async def privacy_html_alias():
    return HTMLResponse(_read_static("privacy.html"))


@app.get("/terms", response_class=HTMLResponse, include_in_schema=False)
async def terms_html():
    return HTMLResponse(_read_static("terms.html"))


@app.get("/terms.html", response_class=HTMLResponse, include_in_schema=False)
async def terms_html_alias():
    return HTMLResponse(_read_static("terms.html"))


# API-prefixed aliases (guaranteed to route through /api/* kubernetes ingress rules).
@api_router.get("/legal/privacy", response_class=HTMLResponse, include_in_schema=False)
async def api_privacy_html():
    return HTMLResponse(_read_static("privacy.html"))


@api_router.get("/legal/terms", response_class=HTMLResponse, include_in_schema=False)
async def api_terms_html():
    return HTMLResponse(_read_static("terms.html"))


# Account deletion — Google Play mandatory URL for apps with user accounts.
@app.get("/account-deletion", response_class=HTMLResponse, include_in_schema=False)
async def account_deletion_html():
    return HTMLResponse(_read_static("account-deletion.html"))


@app.get("/account-deletion.html", response_class=HTMLResponse, include_in_schema=False)
async def account_deletion_html_alias():
    return HTMLResponse(_read_static("account-deletion.html"))


@api_router.get("/legal/account-deletion", response_class=HTMLResponse, include_in_schema=False)
async def api_account_deletion_html():
    return HTMLResponse(_read_static("account-deletion.html"))


# Play Store marketing assets — one-click download bundle for the store submission.
_DOWNLOAD_DIR = _STATIC_DIR / "downloads"


@app.get("/downloads/{filename}", include_in_schema=False)
async def download_static(filename: str):
    # Prevent path traversal
    if "/" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = _DOWNLOAD_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path), filename=filename, media_type="application/octet-stream")


@api_router.get("/downloads/{filename}", include_in_schema=False)
async def api_download_static(filename: str):
    return await download_static(filename)


class DeletionRequestIn(BaseModel):
    email: str
    reason: Optional[str] = None
    notes: Optional[str] = None


@api_router.post("/legal/account-deletion")
async def api_submit_deletion(payload: DeletionRequestIn, request: Request):
    """Record a public account-deletion request. Admin/support processes within 30 days."""
    email = (payload.email or "").strip().lower()
    if "@" not in email or "." not in email or len(email) > 254:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "reason": (payload.reason or "").strip()[:100] or None,
        "notes": (payload.notes or "").strip()[:1000] or None,
        "created_at": utcnow(),
        "status": "pending",
        "user_agent": (request.headers.get("user-agent") or "")[:300],
        "ip": (request.headers.get("x-forwarded-for") or request.client.host if request.client else "")[:64],
    }
    try:
        await db.deletion_requests.insert_one({**doc})
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Could not save request. Please email support@shivaminnovation.dev.")
    return {"status": "received", "message": "Your deletion request has been received. We will confirm within 24 hours and complete deletion within 30 days.", "request_id": doc["id"]}


# ---------------------- PDF & Image AI Toolkit ----------------------
# All these endpoints accept a base64-encoded file, run local extraction with
# PyMuPDF (no upload to external services beyond Emergent LLM for the AI parts),
# and return processed results. We never persist user documents.

import base64 as _b64
import re as _re

try:
    import fitz  # PyMuPDF
except Exception:  # pragma: no cover
    fitz = None  # type: ignore


def _decode_b64_bytes(data: str) -> bytes:
    """Accepts either a data URL (data:application/pdf;base64,...) or raw b64."""
    if not data:
        raise HTTPException(400, "Empty file")
    if "," in data[:80]:
        data = data.split(",", 1)[1]
    # Hard cap on payload size — protects the server from a runaway upload.
    # Base64 is ~4/3 the raw byte size, so 40 MB base64 ≈ 30 MB decoded, which is
    # more than enough for the typical mobile PDF.
    if len(data) > 40 * 1024 * 1024:
        raise HTTPException(413, "File too large (max ~30 MB)")
    try:
        return _b64.b64decode(data, validate=False)
    except Exception:
        raise HTTPException(400, "Invalid base64 payload")


def _pdf_extract_text_bytes(pdf_bytes: bytes, max_chars: int = 60000) -> str:
    if fitz is None:
        raise HTTPException(500, "PDF text extraction not available on server")
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    pieces: List[str] = []
    total = 0
    try:
        for page in doc:
            t = page.get_text("text") or ""
            if not t:
                continue
            pieces.append(t)
            total += len(t)
            if total >= max_chars:
                break
    finally:
        doc.close()
    text = "\n".join(pieces).strip()
    # Collapse insane whitespace runs
    text = _re.sub(r"[ \t]+", " ", text)
    text = _re.sub(r"\n{3,}", "\n\n", text)
    return text[:max_chars]


class PDFFileIn(BaseModel):
    file_base64: str = Field(..., description="PDF bytes as base64 or data URL")
    filename: Optional[str] = None


class PDFAskIn(PDFFileIn):
    question: str


class PDFTranslateIn(PDFFileIn):
    target_language: str = "Hindi"


@api_router.post("/pdf/extract-text")
async def pdf_extract_text(payload: PDFFileIn, authorization: Optional[str] = Header(default=None)):
    await require_user(authorization)
    data = _decode_b64_bytes(payload.file_base64)
    text = _pdf_extract_text_bytes(data)
    return {"text": text, "chars": len(text)}


@api_router.post("/pdf/info")
async def pdf_info(payload: PDFFileIn, authorization: Optional[str] = Header(default=None)):
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    try:
        meta = dict(doc.metadata or {})
        pages = doc.page_count
        # First page size (points -> 1/72 inch)
        try:
            r = doc[0].rect
            size = {"w": round(r.width, 2), "h": round(r.height, 2)}
        except Exception:
            size = None
        encrypted = bool(doc.is_encrypted)
    finally:
        doc.close()
    return {"pages": pages, "metadata": meta, "size_pt": size, "encrypted": encrypted, "bytes": len(data)}


@api_router.post("/pdf/summarize")
async def pdf_summarize(payload: PDFFileIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    data = _decode_b64_bytes(payload.file_base64)
    text = _pdf_extract_text_bytes(data, max_chars=45000)
    if not text:
        raise HTTPException(422, "This PDF has no extractable text (it may be a scanned image). Try OCR.")
    # Only consume quota once we know the document is usable — never burn a
    # unit on unopenable/empty PDFs.
    await _check_and_increment_quota(user["user_id"])
    summary = await _one_shot(
        "You are a concise executive summariser. Return a well-structured Markdown summary with the sections: **TL;DR** (2 lines), **Key Points** (5-8 bullets), **Notable Details**, and **Suggested Actions**. Preserve technical accuracy. Never invent facts.",
        f"Summarise the following document extract:\n\n{text}",
        session_key="pdf-summarize",
    )
    return {"summary": summary, "extract_chars": len(text)}


@api_router.post("/pdf/keypoints")
async def pdf_keypoints(payload: PDFFileIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    data = _decode_b64_bytes(payload.file_base64)
    text = _pdf_extract_text_bytes(data, max_chars=40000)
    if not text:
        raise HTTPException(422, "No extractable text found in the document.")
    await _check_and_increment_quota(user["user_id"])
    result = await _one_shot(
        "Extract the most important key points from the given document. Return 8-12 crisp Markdown bullets. Each bullet <= 22 words. No fluff, no repetition.",
        text,
        session_key="pdf-keypoints",
    )
    return {"keypoints": result}


@api_router.post("/pdf/ask")
async def pdf_ask(payload: PDFAskIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    q = (payload.question or "").strip()
    if not q:
        raise HTTPException(400, "Question is required")
    data = _decode_b64_bytes(payload.file_base64)
    text = _pdf_extract_text_bytes(data, max_chars=40000)
    if not text:
        raise HTTPException(422, "No extractable text in the document.")
    await _check_and_increment_quota(user["user_id"])
    result = await _one_shot(
        "You are a document Q&A assistant. Use ONLY the provided document extract to answer. If the answer is not present, say so explicitly. Cite short quoted phrases from the document when relevant. Reply in the same language the user asks.",
        f"DOCUMENT EXTRACT:\n\"\"\"\n{text}\n\"\"\"\n\nQUESTION: {q}",
        session_key="pdf-ask",
    )
    return {"answer": result}


@api_router.post("/pdf/translate")
async def pdf_translate(payload: PDFTranslateIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    data = _decode_b64_bytes(payload.file_base64)
    text = _pdf_extract_text_bytes(data, max_chars=25000)
    if not text:
        raise HTTPException(422, "No extractable text in the document.")
    await _check_and_increment_quota(user["user_id"])
    target = (payload.target_language or "Hindi").strip()[:50]
    result = await _one_shot(
        f"You are a professional translator. Translate the document to {target}. Preserve headings, bullet points, numbers and technical terms. Return only the translated text in Markdown.",
        text,
        session_key="pdf-translate",
    )
    return {"translation": result, "target_language": target}


# ---------------- New PDF utility endpoints (v7.3) ----------------

class PDFProtectIn(PDFFileIn):
    password: str = Field(..., min_length=1, max_length=128)


class PDFUnlockIn(PDFFileIn):
    password: str = Field(..., min_length=1, max_length=128)


class PDFCompressIn(PDFFileIn):
    quality: Optional[int] = 75   # 30..90 — used for embedded image recompression


class PDFToImagesIn(PDFFileIn):
    dpi: Optional[int] = 150       # 72..300
    format: Optional[str] = "png"  # png | jpeg
    max_pages: Optional[int] = 100


@api_router.post("/pdf/to-images")
async def pdf_to_images(payload: PDFToImagesIn, authorization: Optional[str] = Header(default=None)):
    """Render every page of a PDF to base64 PNG/JPEG for in-app viewing / export."""
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    dpi = max(72, min(int(payload.dpi or 150), 300))
    fmt = (payload.format or "png").lower()
    if fmt not in ("png", "jpeg", "jpg"):
        raise HTTPException(400, "format must be png or jpeg")
    max_pages = max(1, min(int(payload.max_pages or 100), 200))
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    images: List[Dict[str, Any]] = []
    total = min(len(doc), max_pages)
    try:
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        for i in range(total):
            page = doc[i]
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            if fmt in ("jpeg", "jpg"):
                buf = pix.tobytes("jpeg", jpg_quality=85)
                mime = "image/jpeg"
            else:
                buf = pix.tobytes("png")
                mime = "image/png"
            images.append({
                "page": i + 1,
                "width": pix.width,
                "height": pix.height,
                "mime": mime,
                "data": _b64.b64encode(buf).decode("ascii"),
            })
    finally:
        doc.close()
    return {"pages": images, "total_pages": total, "dpi": dpi, "format": fmt}


@api_router.post("/pdf/compress")
async def pdf_compress(payload: PDFCompressIn, authorization: Optional[str] = Header(default=None)):
    """Compress a PDF using PyMuPDF's incremental garbage collector + deflate."""
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    original_size = len(data)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    try:
        # garbage=4 = remove duplicate/unused objects · deflate=True = zlib streams
        # clean=True = tidy content streams
        out = doc.tobytes(garbage=4, deflate=True, clean=True, deflate_images=True, deflate_fonts=True)
    finally:
        doc.close()
    new_size = len(out)
    return {
        "file_base64": _b64.b64encode(out).decode("ascii"),
        "original_size": original_size,
        "compressed_size": new_size,
        "saved_bytes": max(0, original_size - new_size),
        "saved_pct": round(max(0, original_size - new_size) / original_size * 100, 1) if original_size else 0,
    }


@api_router.post("/pdf/protect")
async def pdf_protect(payload: PDFProtectIn, authorization: Optional[str] = Header(default=None)):
    """Password-protect a PDF with AES-256 encryption."""
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    try:
        perm = int(
            fitz.PDF_PERM_ACCESSIBILITY
            | fitz.PDF_PERM_PRINT
            | fitz.PDF_PERM_COPY
            | fitz.PDF_PERM_ANNOTATE
        )
        out = doc.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=payload.password,
            owner_pw=payload.password,
            permissions=perm,
        )
    finally:
        doc.close()
    return {
        "file_base64": _b64.b64encode(out).decode("ascii"),
        "size": len(out),
        "encrypted": True,
    }


@api_router.post("/pdf/unlock")
async def pdf_unlock(payload: PDFUnlockIn, authorization: Optional[str] = Header(default=None)):
    """Remove password from a PDF (requires the correct password)."""
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    try:
        if doc.needs_pass:
            if not doc.authenticate(payload.password):
                raise HTTPException(401, "Incorrect password")
        out = doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()
    return {
        "file_base64": _b64.b64encode(out).decode("ascii"),
        "size": len(out),
        "encrypted": False,
    }


class PDFToDocxIn(PDFFileIn):
    use_ocr: Optional[str] = "auto"  # "auto" | "force" | "off"


@api_router.post("/pdf/to-docx")
async def pdf_to_docx(payload: PDFToDocxIn, authorization: Optional[str] = Header(default=None)):
    """Extract text from a PDF and package it as a downloadable .docx.

    OCR strategy (`use_ocr`):
      • `off`   → text-only extraction (fastest)
      • `auto`  → per-page: if `get_text` returns < 40 chars, run Gemini vision OCR
      • `force` → always OCR every page (slowest, most accurate on scans)
    """
    user = await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    try:
        from docx import Document
    except Exception:
        raise HTTPException(500, "DOCX writer not installed on server")
    data = _decode_b64_bytes(payload.file_base64)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")

    use_ocr = (payload.use_ocr or "auto").lower()
    if use_ocr not in ("auto", "force", "off"):
        use_ocr = "auto"

    docx_doc = Document()
    total_chars = 0
    ocr_pages = 0

    # Quota: an OCR page costs one image-OCR request.  Charge once up-front
    # for OCR usage; text-only extraction is free.
    if use_ocr != "off" and len(doc) > 0:
        try:
            await _check_and_increment_quota(user["user_id"])
        except Exception:
            pass

    try:
        for i, page in enumerate(doc):
            text_blocks = page.get_text("blocks") or []
            page_text = "\n".join((b[4] if len(b) > 4 else "").strip() for b in text_blocks if len(b) > 4)
            page_text = page_text.strip()

            do_ocr = use_ocr == "force" or (use_ocr == "auto" and len(page_text) < 40)

            if do_ocr:
                # Render page → PNG → Gemini OCR
                try:
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                    b64_img = _b64.b64encode(pix.tobytes("png")).decode("ascii")
                    ocr_text = await _gemini_vision(
                        "You are an OCR engine. Return ONLY the exact text found in the image, preserving line breaks and structure. Do not add commentary. If the image has no readable text, respond with exactly: [NO_TEXT_DETECTED].",
                        f"Extract all text from page {i + 1} of this PDF.",
                        b64_img,
                        "image/png",
                    )
                    if ocr_text and "[NO_TEXT_DETECTED]" not in ocr_text:
                        page_text = ocr_text.strip()
                        ocr_pages += 1
                except HTTPException:
                    raise
                except Exception:
                    logger.exception("OCR failed on page %d", i + 1)

            if not page_text:
                continue

            # Heuristic: title-like first block on page 0 → heading.
            paragraphs = page_text.split("\n\n") if "\n\n" in page_text else [page_text]
            for j, para in enumerate(paragraphs):
                para = para.strip()
                if not para:
                    continue
                if i == 0 and j == 0 and len(para) < 80 and "\n" not in para:
                    docx_doc.add_heading(para, level=2)
                else:
                    docx_doc.add_paragraph(para)
                total_chars += len(para)
            if i < len(doc) - 1:
                docx_doc.add_page_break()
    finally:
        doc.close()

    from io import BytesIO
    buf = BytesIO()
    docx_doc.save(buf)
    return {
        "file_base64": _b64.b64encode(buf.getvalue()).decode("ascii"),
        "size": buf.tell(),
        "chars": total_chars,
        "used_ocr": ocr_pages > 0,
        "ocr_pages": ocr_pages,
        "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }


# ---------------- PDF Signature ----------------

class PDFSignIn(PDFFileIn):
    signature_base64: str = Field(..., description="Signature image bytes (PNG recommended)")
    page: int = Field(..., ge=1, le=500)
    x_pct: float = Field(..., ge=0, le=100, description="Left position as % of page width")
    y_pct: float = Field(..., ge=0, le=100, description="Top position as % of page height")
    width_pct: Optional[float] = 25.0  # signature width as % of page width


@api_router.post("/pdf/sign")
async def pdf_sign(payload: PDFSignIn, authorization: Optional[str] = Header(default=None)):
    """Stamp a signature image onto a specific PDF page at (x_pct, y_pct)."""
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    sig_data = _decode_b64_bytes(payload.signature_base64)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    if payload.page > len(doc):
        raise HTTPException(400, f"Page {payload.page} out of range (PDF has {len(doc)} pages)")

    try:
        page = doc[payload.page - 1]
        pw, ph = page.rect.width, page.rect.height
        w = pw * ((payload.width_pct or 25.0) / 100.0)
        # Try to preserve aspect ratio of the signature image
        try:
            from PIL import Image as _PIL
            from io import BytesIO as _BIO
            im = _PIL.open(_BIO(sig_data))
            aspect = im.height / max(1, im.width)
        except Exception:
            aspect = 0.4
        h = w * aspect
        x = pw * (payload.x_pct / 100.0)
        y = ph * (payload.y_pct / 100.0)
        rect = fitz.Rect(x, y, x + w, y + h)
        page.insert_image(rect, stream=sig_data, keep_proportion=True)
        out = doc.tobytes(garbage=3, deflate=True)
    finally:
        doc.close()
    return {
        "file_base64": _b64.b64encode(out).decode("ascii"),
        "size": len(out),
    }


# ---------------- PDF Form Fields ----------------

WIDGET_TYPE_MAP = {
    2: "text",       # PDF_WIDGET_TYPE_TEXT
    3: "checkbox",   # PDF_WIDGET_TYPE_CHECKBOX
    4: "radio",      # PDF_WIDGET_TYPE_RADIOBUTTON
    5: "listbox",    # PDF_WIDGET_TYPE_LISTBOX
    6: "combobox",   # PDF_WIDGET_TYPE_COMBOBOX
    7: "signature",  # PDF_WIDGET_TYPE_SIGNATURE
}


@api_router.post("/pdf/fields")
async def pdf_fields(payload: PDFFileIn, authorization: Optional[str] = Header(default=None)):
    """Enumerate every form field in a PDF (widgets)."""
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    fields: List[Dict[str, Any]] = []
    try:
        for i, page in enumerate(doc):
            for w in (page.widgets() or []):
                ftype = WIDGET_TYPE_MAP.get(getattr(w, "field_type", 0), "unknown")
                fields.append({
                    "name": w.field_name or f"field_{i}_{len(fields)}",
                    "label": w.field_label or w.field_name or "",
                    "type": ftype,
                    "value": w.field_value or "",
                    "page": i + 1,
                    "options": list(getattr(w, "choice_values", None) or []) if ftype in ("listbox", "combobox", "radio") else [],
                    "required": bool(getattr(w, "field_flags", 0) & 2),
                    "max_len": int(getattr(w, "text_maxlen", 0) or 0),
                })
    finally:
        doc.close()
    return {"fields": fields, "count": len(fields)}


class PDFFillIn(PDFFileIn):
    values: Dict[str, Any]   # field_name -> value


@api_router.post("/pdf/fill")
async def pdf_fill(payload: PDFFillIn, authorization: Optional[str] = Header(default=None)):
    """Fill PDF form fields with user-supplied values and flatten the result."""
    await require_user(authorization)
    if fitz is None:
        raise HTTPException(500, "PDF service unavailable")
    data = _decode_b64_bytes(payload.file_base64)
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as e:
        raise HTTPException(400, f"Could not open PDF: {str(e)[:120]}")
    filled = 0
    try:
        for page in doc:
            for w in (page.widgets() or []):
                if w.field_name and w.field_name in payload.values:
                    val = payload.values[w.field_name]
                    try:
                        if getattr(w, "field_type", 0) == 3:  # checkbox
                            w.field_value = bool(val)
                        else:
                            w.field_value = "" if val is None else str(val)
                        w.update()
                        filled += 1
                    except Exception:
                        logger.warning("Failed to fill field %s", w.field_name)
        out = doc.tobytes(garbage=3, deflate=True)
    finally:
        doc.close()
    return {
        "file_base64": _b64.b64encode(out).decode("ascii"),
        "size": len(out),
        "filled": filled,
    }




# ---------------- Image AI (OCR + Describe) ----------------
class ImageFileIn(BaseModel):
    image_base64: str = Field(..., description="Image bytes as base64 or data URL")
    mime: Optional[str] = "image/jpeg"


async def _gemini_vision(system: str, user_text: str, image_b64: str, mime: str) -> str:
    """Call Emergent LLM (Gemini) with an image attachment via emergentintegrations."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"vision-{uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("gemini", "gemini-3-flash-preview")
    # Strip data URL if present
    raw_b64 = image_b64.split(",", 1)[1] if "," in image_b64[:80] else image_b64
    try:
        resp = await chat.send_message(
            UserMessage(text=user_text, file_contents=[ImageContent(image_base64=raw_b64)])
        )
        return str(resp).strip()
    except Exception as e:
        logger.exception("Vision LLM error")
        raise HTTPException(500, f"AI error: {str(e)[:200]}")


@api_router.post("/image/ocr")
async def image_ocr(payload: ImageFileIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    if not payload.image_base64:
        raise HTTPException(400, "Empty image")
    result = await _gemini_vision(
        "You are an OCR engine. Return ONLY the exact text found in the image, preserving line breaks and structure. Do not add commentary. If the image has no readable text, respond with exactly: [NO_TEXT_DETECTED].",
        "Extract all text from this image.",
        payload.image_base64,
        payload.mime or "image/jpeg",
    )
    return {"text": result}


@api_router.post("/image/describe")
async def image_describe(payload: ImageFileIn, authorization: Optional[str] = Header(default=None)):
    user = await require_user(authorization)
    await _check_and_increment_quota(user["user_id"])
    if not payload.image_base64:
        raise HTTPException(400, "Empty image")
    result = await _gemini_vision(
        "You are an image describer for accessibility. Give a 2-3 sentence description of the image and 4-6 key tags.",
        "Describe this image and list its key tags.",
        payload.image_base64,
        payload.mime or "image/jpeg",
    )
    return {"description": result}


# ---------------------- Startup ----------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.notes.create_index([("user_id", 1), ("updated_at", -1)])
        await db.todos.create_index([("user_id", 1), ("created_at", -1)])
        await db.habits.create_index([("user_id", 1), ("created_at", 1)])
        await db.habit_logs.create_index([("user_id", 1), ("habit_id", 1), ("date", 1)])
        await db.focus_sessions.create_index([("user_id", 1), ("created_at", -1)])
        await db.ai_messages.create_index([("user_id", 1), ("session_id", 1), ("created_at", 1)])
        await db.expenses.create_index([("user_id", 1), ("date", -1)])
        await db.voice_notes.create_index([("user_id", 1), ("created_at", -1)])
        await db.qr_scans.create_index([("user_id", 1), ("created_at", -1)])
        await db.reminders.create_index([("user_id", 1), ("created_at", 1)])
        await db.premium.create_index("user_id", unique=True)
        logger.info("Indexes ensured.")
    except Exception:
        logger.exception("Index creation issue")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
