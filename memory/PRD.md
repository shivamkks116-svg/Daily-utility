# DailyHub AI — Product Requirements (MVP v1)

## Overview
DailyHub AI is a premium Expo React Native mobile app developed by Shivam Innovation. It combines productivity, AI, and daily-life utilities in a single beautiful application, optimized for Android and iOS with a Material You-inspired dark palette (Moss/Emerald).

## MVP Scope
### Authentication
- Emergent-managed Google Sign-In (production-ready OAuth via `auth.emergentagent.com`).
- Guest login (30-day session).
- Session token stored in `expo-secure-store` (mobile) / `localStorage` (web).

### Dashboard (Home tab)
- Personalized greeting (morning/afternoon/evening) and date.
- Hero card with abstract moss-gradient background + daily insight + Start Focus CTA.
- Quick actions grid: Notes, To-Do, Habits, Focus, AI Chat, Translate.
- Today stats row (Focused minutes, Tasks, Streak).
- "Coming soon" chips previewing future categories.

### Productivity Features
- **Notes**: List + rich text editor with auto-save (800ms debounce), pin, delete.
- **To-Do**: List + priority (low/normal/high), bottom-sheet modal for new task, toggle, delete.
- **Habits**: Streak counter, 14-day heatmap tap-to-log, emoji icon picker.
- **Focus/Pomodoro**: 25/5/15 minute modes, circular ring, start/pause/reset, session logging + daily total.

### AI Tools (Gemini 3 Flash via Emergent LLM Key)
- **AI Chat**: Persistent multi-turn conversation with starter prompts and history.
- **Translator**: Multi-language target selection.
- **Grammar Fixer**: Rewrite for grammar and clarity.
- **Summarizer**: Bulleted summaries.
- **Email Writer**: Subject-line-first drafts from intent.
- **Study Assistant**: Structured explanations with self-check.

### All Tools tab
- Category filter chips (Productivity, AI, Finance, Health, Device, Files).
- Search input across all tools.
- Grid of tool cards with "Soon" badges for future scope (Finance, Health, Device utilities, File tools).

### Profile tab
- User card (avatar, name, email, provider badge).
- Premium upgrade upsell card.
- Preferences, Privacy, About sections.
- Sign out.

## Backend (FastAPI + MongoDB)
- Base: `/api`
- Auth: `POST /api/auth/session`, `POST /api/auth/guest`, `GET /api/auth/me`, `POST /api/auth/logout`.
- Notes: `GET/POST /api/notes`, `PUT/DELETE /api/notes/{id}`.
- Todos: `GET/POST /api/todos`, `PUT/DELETE /api/todos/{id}`.
- Habits: `GET/POST /api/habits`, `POST /api/habits/{id}/log`, `DELETE /api/habits/{id}`.
- Focus: `GET/POST /api/focus`.
- AI: `POST /api/ai/chat` (persistent), `/api/ai/translate`, `/api/ai/email-writer`, `/api/ai/grammar`, `/api/ai/summarize`, `/api/ai/study`, `GET /api/ai/history/{session_id}`.

MongoDB indexes for users, sessions (TTL), notes, todos, habits, habit_logs, focus_sessions, ai_messages.

## Design
- Material You Expressive Dark palette (moss/emerald). See `/app/design_guidelines.json`.
- Bottom tab bar with glassmorphism (iOS blur, Android solid).
- SafeArea aware, keyboard-controller for text inputs, expo-linear-gradient for hero.
- Ionicons for all iconography.

## Future scope (placeholders visible in Tools screen)
- Finance: Expense/Income Tracker, Budget, EMI/SIP/GST/Currency calculators.
- Health: Water/Medicine reminders, Sleep, BMI, Weight log.
- Device: QR/Barcode, Flashlight, Compass, Calculator, Unit Converter, Device Info.
- Files: PDF tools, ZIP, Image converter, Secure Vault.
- Voice notes, Journal, Mood tracker.
