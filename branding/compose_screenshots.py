"""Compose Play Store listing screenshots.

Takes raw app captures and wraps them in:
- A phone-shaped device frame (rounded, bezel, notch)
- A big marketing caption above
- Branded gradient background

Output: 1080×1920 for phone listing (Play Console recommended).
Also generates 7-inch tablet (1200×1920) and 10-inch tablet (1600×2560).
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = "/app/branding"
RAW = f"{ROOT}/screenshots"
OUT_PHONE = f"{ROOT}/play-store/phone"
OUT_T7 = f"{ROOT}/play-store/tablet-7"
OUT_T10 = f"{ROOT}/play-store/tablet-10"
os.makedirs(OUT_PHONE, exist_ok=True)
os.makedirs(OUT_T7, exist_ok=True)
os.makedirs(OUT_T10, exist_ok=True)

BRAND_PRIMARY = (94, 186, 139)
BRAND_ACCENT  = (109, 213, 140)
BRAND_DEEP    = (27, 54, 38)
SURFACE       = (17, 20, 18)
SURFACE_SEC   = (27, 34, 30)
ON_SURFACE    = (226, 230, 227)
ON_SURFACE_MUT= (160, 165, 161)

# Screens: (raw filename, title, subtitle)
SCREENS = [
    ("raw-01-login.png",   "Your all-in-one\ndaily hub.",       "Notes, habits, focus & AI — in one calm space."),
    ("raw-02-home.png",    "Beautiful. Fast.\nAlways yours.",   "Personalized dashboard, quick actions, insights."),
    ("raw-05-ai-chat.png", "Chat with AI.\nGet answers.",       "Powered by Gemini 3 Flash. Fast. Smart. Free."),
    ("raw-03-tools.png",   "30+ tools.\nOne app.",              "Productivity, AI, Finance, Health, Files & more."),
    ("raw-06-focus.png",   "Deep focus.\nEvery session.",       "Pomodoro & focus timers with daily streaks."),
    ("raw-07-habits.png",  "Build habits.\nEvery day.",         "Track daily wins, streaks & progress calmly."),
    ("raw-04-ai-hub.png",  "Translate, Write,\nSummarize.",     "Six AI tools. Instant results. All in one place."),
    ("raw-08-premium.png", "Go Premium.\nUnlock everything.",   "No ads, unlimited AI, cloud sync & more."),
]


def _font(size, bold=False):
    p = ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
         else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    try:
        return ImageFont.truetype(p, size)
    except Exception:
        return ImageFont.load_default()


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, *size], radius=radius, fill=255)
    return m


def paint_bg(size, tint):
    """Vertical gradient background — deep brand at top → surface at bottom."""
    w, h = size
    img = Image.new("RGBA", size, SURFACE + (255,))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        r = int(tint[0] * (1 - t) + SURFACE[0] * t)
        g = int(tint[1] * (1 - t) + SURFACE[1] * t)
        b = int(tint[2] * (1 - t) + SURFACE[2] * t)
        d.line([(0, y), (w, y)], fill=(r, g, b, 255))
    # Soft brand glow blob
    blob = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(blob).ellipse(
        [w * 0.15, -h * 0.15, w * 0.85, h * 0.35],
        fill=BRAND_PRIMARY + (55,),
    )
    blob = blob.filter(ImageFilter.GaussianBlur(radius=100))
    img = Image.alpha_composite(img, blob)
    return img


def draw_phone_frame(inner_img, radius_ratio=0.075, bezel=18, shadow=True):
    """Wrap a screenshot in a phone frame — rounded bezel, small notch."""
    iw, ih = inner_img.size
    frame_w = iw + bezel * 2
    frame_h = ih + bezel * 2

    canvas = Image.new("RGBA", (frame_w + 40, frame_h + 40), (0, 0, 0, 0))

    if shadow:
        sh = Image.new("RGBA", (frame_w + 40, frame_h + 40), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle(
            [20, 30, 20 + frame_w, 30 + frame_h],
            radius=int(frame_w * radius_ratio),
            fill=(0, 0, 0, 130),
        )
        sh = sh.filter(ImageFilter.GaussianBlur(radius=22))
        canvas = Image.alpha_composite(canvas, sh)

    # Frame (dark bezel)
    frame = Image.new("RGBA", (frame_w, frame_h), (12, 14, 13, 255))
    fm = rounded_mask((frame_w, frame_h), int(frame_w * radius_ratio))
    frame_layer = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    frame_layer.paste(frame, (0, 0), fm)
    canvas.paste(frame_layer, (20, 20), frame_layer)

    # Inner content clipped to inner rounded rect
    inner_mask = rounded_mask((iw, ih), int(iw * (radius_ratio - 0.01)))
    canvas.paste(inner_img, (20 + bezel, 20 + bezel), inner_mask)

    # Notch (pill at top)
    nd = ImageDraw.Draw(canvas)
    notch_w = int(frame_w * 0.22)
    notch_h = 22
    nx = 20 + (frame_w - notch_w) // 2
    ny = 20 + 6
    nd.rounded_rectangle([nx, ny, nx + notch_w, ny + notch_h], radius=11, fill=(0, 0, 0, 255))

    return canvas


def wrap_lines(draw, text, font, max_width):
    lines = []
    for raw_line in text.split("\n"):
        words = raw_line.split()
        cur = ""
        for w in words:
            candidate = (cur + " " + w).strip()
            if draw.textlength(candidate, font=font) <= max_width:
                cur = candidate
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
    return lines


def compose(preset, out_dir):
    W, H = preset["canvas"]
    frame_target_h = int(H * preset["frame_h_ratio"])

    for i, (raw_name, title, sub) in enumerate(SCREENS, start=1):
        raw_path = f"{RAW}/{raw_name}"
        if not os.path.exists(raw_path):
            print(f"skip: {raw_name} not found")
            continue

        raw = Image.open(raw_path).convert("RGBA")

        # Resize raw to target frame height (keep aspect)
        rw, rh = raw.size
        scale = frame_target_h / rh
        new_w = int(rw * scale)
        new_h = frame_target_h
        raw_resized = raw.resize((new_w, new_h), Image.LANCZOS)

        # Build gradient background
        bg = paint_bg((W, H), BRAND_DEEP)
        d = ImageDraw.Draw(bg)

        # Title
        title_font = _font(preset["title_size"], bold=True)
        max_text_w = int(W * 0.88)
        title_lines = wrap_lines(d, title, title_font, max_text_w)
        y = int(H * preset["title_y_ratio"])
        for ln in title_lines:
            tw = d.textlength(ln, font=title_font)
            d.text(((W - tw) / 2, y), ln, font=title_font, fill=ON_SURFACE)
            y += int(preset["title_size"] * 1.05)

        # Subtitle
        sub_font = _font(preset["sub_size"])
        sub_lines = wrap_lines(d, sub, sub_font, max_text_w)
        y += int(preset["title_size"] * 0.15)
        for ln in sub_lines:
            sw = d.textlength(ln, font=sub_font)
            d.text(((W - sw) / 2, y), ln, font=sub_font, fill=BRAND_ACCENT)
            y += int(preset["sub_size"] * 1.3)

        # Frame the phone
        framed = draw_phone_frame(raw_resized, radius_ratio=0.055, bezel=14)
        fw, fh = framed.size
        fx = (W - fw) // 2
        fy = H - fh - int(H * 0.03)
        bg.paste(framed, (fx, fy), framed)

        # Bottom brand strip
        brand_font = _font(preset["brand_size"], bold=True)
        brand_text = "DailyHub AI"
        bw = d.textlength(brand_text, font=brand_font)
        d.text(((W - bw) / 2, H - int(H * 0.028)),
               brand_text, font=brand_font, fill=ON_SURFACE_MUT)

        out_path = f"{out_dir}/screenshot-{i:02d}.jpg"
        bg.convert("RGB").save(out_path, "JPEG", quality=88, optimize=True)
        print(f"  {out_path}")


PRESETS = {
    "phone": {
        "canvas": (1080, 1920),
        "frame_h_ratio": 0.65,
        "title_size": 108,
        "sub_size": 44,
        "brand_size": 30,
        "title_y_ratio": 0.055,
    },
    "tablet-7": {
        "canvas": (1200, 1920),
        "frame_h_ratio": 0.63,
        "title_size": 116,
        "sub_size": 48,
        "brand_size": 32,
        "title_y_ratio": 0.055,
    },
    "tablet-10": {
        "canvas": (1600, 2560),
        "frame_h_ratio": 0.63,
        "title_size": 148,
        "sub_size": 62,
        "brand_size": 40,
        "title_y_ratio": 0.055,
    },
}


if __name__ == "__main__":
    print("→ Phone screenshots (1080×1920)")
    compose(PRESETS["phone"], OUT_PHONE)
    print("→ 7-inch tablet (1200×1920)")
    compose(PRESETS["tablet-7"], OUT_T7)
    print("→ 10-inch tablet (1600×2560)")
    compose(PRESETS["tablet-10"], OUT_T10)
    print("\n✓ Play Store listing screenshots ready in /app/branding/play-store/")
