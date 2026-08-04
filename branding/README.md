# DailyHub AI — Marketing & Branding Kit

**by Shivam Innovation** · Ready for Google Play Store submission.

---

## 📁 Kit Contents

```
branding/
├── icons/                        App icons at all Android densities
│   ├── icon-1024.png             Master (1024×1024)
│   ├── play-store-512.png        Google Play listing icon
│   ├── icon-192.png              Web / favicon 192px
│   ├── ic_launcher_mdpi_48.png   48dp launcher
│   ├── ic_launcher_hdpi_72.png   72dp launcher
│   ├── ic_launcher_xhdpi_96.png  96dp launcher
│   ├── ic_launcher_xxhdpi_144.png
│   ├── ic_launcher_xxxhdpi_192.png
│   └── ic_launcher_round_*.png   Circular variants for each density
│
├── adaptive/                     Android adaptive icon (API 26+)
│   ├── adaptive-foreground-1024.png
│   ├── adaptive-background-1024.png
│   └── adaptive-monochrome-1024.png   Android 13+ themed icon
│
├── splash/
│   ├── splash-image.png                  Center-logo for expo-splash-screen
│   ├── splash-portrait-1242x2688.png     Full-bleed portrait
│   └── splash-landscape-2688x1242.png    Landscape (tablets)
│
├── feature/                       Play Store feature graphic
│   ├── feature-graphic-1024x500.jpg      (upload this)
│   └── feature-graphic-1024x500.png
│
├── logo/                          Brand marks (transparent + light + dark)
│   ├── logo-mark-transparent.png         Icon glyph only
│   ├── logo-horizontal-dark.png          Icon + wordmark, dark bg
│   ├── logo-horizontal-light.png         Icon + wordmark, light bg
│   └── logo-stacked-dark.png             Vertical stacked
│
├── brand-kit/
│   └── brand-palette.jpg                 Color palette + typography reference
│
├── screenshots/                   Raw device captures (source)
│   └── raw-01..08-*.png
│
└── play-store/                    Ready-to-upload Play Store screenshots
    ├── phone/                     8 × 1080×1920 (JPEG, ≤88% quality)
    │   ├── screenshot-01.jpg      "Your all-in-one daily hub"
    │   ├── screenshot-02.jpg      "Beautiful. Fast. Always yours."
    │   ├── screenshot-03.jpg      "Chat with AI. Get answers."
    │   ├── screenshot-04.jpg      "30+ tools. One app."
    │   ├── screenshot-05.jpg      "Deep focus. Every session."
    │   ├── screenshot-06.jpg      "Build habits. Every day."
    │   ├── screenshot-07.jpg      "Translate, Write, Summarize."
    │   └── screenshot-08.jpg      "Go Premium. Unlock everything."
    ├── tablet-7/                  8 × 1200×1920 (7-inch tablets)
    └── tablet-10/                 8 × 1600×2560 (10-inch tablets)
```

---

## 🎨 Brand Guidelines

### Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| **Brand Primary** | `#5EBA8B` | Buttons, CTAs, primary accents |
| **Brand Accent** | `#6DD58C` | Highlights, positive states |
| **Brand Deep**    | `#1B3626` | Gradient anchors, tertiary containers |
| **Brand Tertiary**| `#2E4F3E` | Secondary buttons, cards on brand |
| **Surface**       | `#111412` | App background (dark theme) |
| **Surface Sec.**  | `#1B221E` | Cards, sheets |
| **On-Surface**    | `#E2E6E3` | Primary text |
| **On-Surface Mut**| `#A0A5A1` | Secondary / muted text |

### Typography
- **System font stack** (SF Pro on iOS, Roboto on Android)
- **Display**: extrabold, negative letter-spacing (-1 to -1.5)
- **Body**: regular, 14–16px
- **Buttons / Labels**: semibold / bold

### Voice & Tone
- Calm, confident, product-first.
- Short sentences. Concrete verbs.
- Emphasize "one calm space", "unified", "beautiful", "your".
- Avoid: hype words, marketing fluff, "revolutionary", "AI-powered" (overused).

### Logo Rules
- Icon glyph = a stylized **"D"** with an AI **diamond spark** inside.
- Minimum icon size on light bg: 32×32; on dark: 24×24.
- Clear space around lockup: at least the height of the icon on all sides.
- Never distort, recolor to non-brand colors, or add drop shadows.

---

## 📤 Play Console Upload Checklist

When creating your Play Console listing, use these files:

| Play Console field | File to upload |
|--------------------|----------------|
| **App icon (512×512)** | `icons/play-store-512.png` |
| **Feature graphic (1024×500)** | `feature/feature-graphic-1024x500.jpg` |
| **Phone screenshots (min 2, up to 8)** | `play-store/phone/screenshot-01…08.jpg` |
| **7-inch tablet screenshots** | `play-store/tablet-7/screenshot-01…08.jpg` |
| **10-inch tablet screenshots** | `play-store/tablet-10/screenshot-01…08.jpg` |

**App details**
- **App name**: DailyHub AI
- **Short description** (80 chars): _"Notes, habits, focus & AI — your all-in-one daily hub."_
- **Full description**: see below
- **Category**: Productivity
- **Content rating**: Everyone
- **Contains ads**: No
- **In-app purchases**: Yes (Premium)

---

## 📝 Suggested Store Listing Copy

### Short Description (80 chars)
> Notes, habits, focus & AI — your all-in-one daily hub. Calm. Fast. Beautiful.

### Full Description

> **DailyHub AI is your calm, all-in-one productivity companion.**
>
> Notes, to-dos, habits, focus timers, AI writing tools, finance calculators, voice notes and more — beautifully unified in a single Material You inspired app that respects your attention.
>
> **Everything you need to build a better day:**
>
> ✦ **Notes & To-Do** — Auto-saving notes, pinning, priority tasks
> ✦ **Habits** — Streaks, heatmaps, tap-to-log
> ✦ **Focus & Pomodoro** — Deep-work sessions with daily totals
> ✦ **AI Chat** — Powered by Gemini 3 Flash. Ask anything, instantly
> ✦ **AI Tools** — Translator, Grammar Fixer, Summarizer, Email Writer, Study Assistant
> ✦ **Finance** — Expense tracker, EMI, SIP & Currency Converter (live rates)
> ✦ **Reminders** — Water, Medicine, Custom — with smart local notifications
> ✦ **Voice Notes** — Record, save, play back
> ✦ **QR Scanner** — With scan history & smart type detection
> ✦ **PDF Tools** — Image → PDF, reorder, share
> ✦ **Calculators** — Scientific, Unit Converter, EMI, SIP
>
> **Premium unlocks:** unlimited AI, cloud sync, zero ads, priority queue, advanced themes, and data export.
>
> Built by **Shivam Innovation** with performance, privacy, and craft at the center.

---

## 🔧 Where these assets are wired in your app

The main app icon files have been **automatically installed** into your project at:

```
/app/frontend/assets/images/
├── icon.png                (from icons/icon-1024.png)
├── adaptive-icon.png       (from adaptive/adaptive-foreground-1024.png)
├── splash-image.png        (from splash/splash-image.png)
└── favicon.png             (from icons/icon-192.png)
```

Next `expo prebuild` (either locally or on Emergent Publish) will pick these up automatically.

Optional: to also set the adaptive background color, edit `frontend/app.json` → `android.adaptiveIcon.backgroundColor` to `#111412` (already set).

---

## 🚀 Regenerating

If you tweak brand colors or want new variations, edit:
- `/app/branding/generate_assets.py` — icons, splash, feature, brand kit
- `/app/branding/compose_screenshots.py` — Play Store screenshot compositions

Then run:
```bash
cd /app/branding
python3 capture_screenshots.py    # refresh raw device captures
python3 generate_assets.py        # regenerate icons/splash/feature/logo
python3 compose_screenshots.py    # rebuild Play Store screenshots
```

---

## © Attribution

Design system, marks, and marketing kit built for **DailyHub AI by Shivam Innovation** — Material You Expressive Dark palette (moss/emerald) tokens defined in `/app/frontend/src/theme/index.ts`.
