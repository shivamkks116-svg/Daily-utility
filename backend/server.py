"""DailyHub AI Backend - FastAPI + MongoDB + Emergent Auth + Gemini 3 Flash."""
from fastapi import FastAPI, APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse
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
