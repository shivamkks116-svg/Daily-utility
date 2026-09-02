"""
DailyHub AI — Play Store screenshot regenerator (v2, professional layout).

Produces (all JPGs, high quality):
  play-store-v2/phone/       1080 x 1920  (portrait 9:16)          x 8
  play-store-v2/tablet-7/    1920 x 1080  (landscape 16:9)         x 8
  play-store-v2/tablet-10/   2560 x 1440  (landscape 16:9)         x 8

Design:
  * Deep-green atmospheric gradient background (brand)
  * Rounded phone mockup (dark bezel + notch pill) with raw screenshot inside
  * Big bold headline + subtitle in DailyHub brand tone
  * DailyHub AI wordmark corner accent
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os
import math

ROOT = "/app/branding"
RAW = os.path.join(ROOT, "screenshots")
OUT = os.path.join(ROOT, "play-store-v2")

# 8 marketing beats, aligned to the 8 raw screenshots
COPY = [
    ("Your all-in-one\ndaily hub.",       "Notes, habits, focus & AI — one calm space.",     "raw-01-login.png"),
    ("Start every day\nwith clarity.",     "Beautiful home with progress & daily insights.",  "raw-02-home.png"),
    ("30+ tools.\nOne app.",               "Productivity, AI, finance, health — all inside.",  "raw-03-tools.png"),
    ("AI that actually\nhelps you focus.", "Gemini-powered chat, writing & study assistants.", "raw-04-ai-hub.png"),
    ("Chat with AI in\nseconds.",          "Ask anything — instant, private, on-the-go.",     "raw-05-ai-chat.png"),
    ("Deep-focus\nsessions.",              "Pomodoro-style timer with streaks and history.",  "raw-06-focus.png"),
    ("Build habits\nthat stick.",          "Daily streaks, gentle nudges, real progress.",    "raw-07-habits.png"),
    ("Premium tools,\ncoming soon.",       "No ads, unlimited AI, cloud backup & themes.",    "raw-08-premium.png"),
]

BG_TOP    = (11, 30, 22)      # deep forest
BG_MID    = (18, 51, 40)      # rich green
BG_BOTTOM = (5, 15, 11)       # near-black
BRAND     = (110, 209, 175)   # mint
TEXT_HI   = (240, 245, 240)
TEXT_LO   = (170, 200, 185)
BEZEL     = (12, 12, 14)
NOTCH     = (0, 0, 0)


def find_font(size, bold=False):
    candidates = [
        # DejaVu is always available on Debian/Ubuntu
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def gradient_bg(w, h, radial_glow=True):
    """Vertical linear gradient with an optional soft radial mint glow top-left."""
    img = Image.new("RGB", (w, h), BG_BOTTOM)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        # 3-stop gradient: top -> mid -> bottom
        if t < 0.5:
            k = t / 0.5
            r = int(BG_TOP[0]   * (1 - k) + BG_MID[0]    * k)
            g = int(BG_TOP[1]   * (1 - k) + BG_MID[1]    * k)
            b = int(BG_TOP[2]   * (1 - k) + BG_MID[2]    * k)
        else:
            k = (t - 0.5) / 0.5
            r = int(BG_MID[0]   * (1 - k) + BG_BOTTOM[0] * k)
            g = int(BG_MID[1]   * (1 - k) + BG_BOTTOM[1] * k)
            b = int(BG_MID[2]   * (1 - k) + BG_BOTTOM[2] * k)
        for x in range(w):
            px[x, y] = (r, g, b)

    if radial_glow:
        # Soft mint glow blob
        glow = Image.new("RGB", (w, h), (0, 0, 0))
        gd = ImageDraw.Draw(glow)
        cx, cy = int(w * 0.28), int(h * 0.18)
        rad = int(min(w, h) * 0.45)
        gd.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=(50, 130, 100))
        glow = glow.filter(ImageFilter.GaussianBlur(radius=int(min(w, h) * 0.15)))
        img = Image.blend(img, Image.eval(glow, lambda v: v).convert("RGB"), 0.35)
    return img


def rounded_mask(w, h, radius):
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    return m


def build_phone(inner_img, target_h):
    """Wrap a raw screenshot (1170x2532) into a phone-shaped mockup.
    Returns a PIL image with transparent bg. `target_h` is the phone height in px.
    """
    raw_w, raw_h = inner_img.size
    aspect = raw_w / raw_h
    inner_h = int(target_h * 0.955)
    inner_w = int(inner_h * aspect)

    bezel_pad = max(12, int(inner_h * 0.012))
    phone_w = inner_w + bezel_pad * 2
    phone_h = inner_h + bezel_pad * 2

    corner_r = int(phone_h * 0.05)
    # Build RGBA canvas
    phone = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(phone)

    # Outer soft shadow
    shadow = Image.new("RGBA", (phone_w + 60, phone_h + 60), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((30, 40, phone_w + 30, phone_h + 40), radius=corner_r + 6, fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=24))

    # Bezel
    pd.rounded_rectangle((0, 0, phone_w, phone_h), radius=corner_r, fill=BEZEL + (255,))

    # Screen (rounded rect mask)
    inner_r = max(1, corner_r - int(bezel_pad * 0.9))
    screen = inner_img.convert("RGB").resize((inner_w, inner_h), Image.LANCZOS)
    mask = rounded_mask(inner_w, inner_h, inner_r)
    phone.paste(screen, (bezel_pad, bezel_pad), mask)

    # Notch pill (top center)
    notch_w = int(phone_w * 0.32)
    notch_h = int(phone_h * 0.018)
    notch_x = (phone_w - notch_w) // 2
    notch_y = bezel_pad + int(inner_h * 0.012)
    pd.rounded_rectangle(
        (notch_x, notch_y, notch_x + notch_w, notch_y + notch_h),
        radius=notch_h // 2,
        fill=NOTCH + (255,),
    )

    # Composite shadow + phone
    canvas = Image.new("RGBA", (phone_w + 60, phone_h + 60), (0, 0, 0, 0))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(phone, (30, 20))
    return canvas


def wrap_text_by_width(draw, text, font, max_w):
    """Simple greedy wrap. `text` may already contain \\n; keep those breaks."""
    out_lines = []
    for para in text.split("\n"):
        words = para.split(" ")
        line = ""
        for w in words:
            trial = (line + " " + w).strip()
            bbox = draw.textbbox((0, 0), trial, font=font)
            if bbox[2] - bbox[0] <= max_w:
                line = trial
            else:
                if line:
                    out_lines.append(line)
                line = w
        if line:
            out_lines.append(line)
    return out_lines


def draw_headline(draw, x, y, max_w, headline, subtitle, headline_size, subtitle_size, tight=False):
    hf = find_font(headline_size, bold=True)
    sf = find_font(subtitle_size, bold=False)

    lines = wrap_text_by_width(draw, headline, hf, max_w)
    line_gap = int(headline_size * (0.98 if tight else 1.05))
    cur_y = y
    for i, ln in enumerate(lines):
        # Brand-tint the last line for pop
        colour = BRAND if i == len(lines) - 1 else TEXT_HI
        draw.text((x, cur_y), ln, font=hf, fill=colour)
        cur_y += line_gap

    cur_y += int(subtitle_size * 0.4)
    sub_lines = wrap_text_by_width(draw, subtitle, sf, max_w)
    for ln in sub_lines:
        draw.text((x, cur_y), ln, font=sf, fill=TEXT_LO)
        cur_y += int(subtitle_size * 1.35)
    return cur_y


def draw_brand_tag(draw, x, y, size=28):
    f = find_font(size, bold=True)
    # bullet + wordmark
    r = size // 3
    draw.ellipse((x, y + size // 4, x + r * 2, y + size // 4 + r * 2), fill=BRAND)
    draw.text((x + r * 2 + int(size * 0.35), y), "DailyHub AI", font=f, fill=TEXT_HI)


def compose_phone(raw_path, headline, subtitle, out_path):
    W, H = 1080, 1920
    bg = gradient_bg(W, H)
    draw = ImageDraw.Draw(bg)

    pad = 72
    # Headline block at top
    draw_brand_tag(draw, pad, pad, size=34)
    text_top = pad + 100
    text_max_w = W - pad * 2
    end_y = draw_headline(
        draw, pad, text_top, text_max_w,
        headline, subtitle,
        headline_size=100, subtitle_size=42, tight=True,
    )

    # Phone mockup below text, centered horizontally
    raw = Image.open(raw_path)
    phone_area_top = end_y + 30
    phone_area_h = H - phone_area_top - 40
    phone = build_phone(raw, target_h=phone_area_h)
    px = (W - phone.width) // 2
    py = phone_area_top - 10
    bg.paste(phone, (px, py), phone)

    bg.save(out_path, "JPEG", quality=92, optimize=True)


def compose_tablet(raw_path, headline, subtitle, size_wh, out_path):
    W, H = size_wh
    bg = gradient_bg(W, H)
    draw = ImageDraw.Draw(bg)

    pad = int(min(W, H) * 0.07)
    left_col_w = int(W * 0.52) - pad
    # Brand corner
    draw_brand_tag(draw, pad, pad, size=int(H * 0.028))

    text_top = pad + int(H * 0.11)
    head_size = int(H * 0.11)
    sub_size = int(H * 0.038)

    draw_headline(
        draw, pad, text_top, left_col_w - pad,
        headline, subtitle,
        headline_size=head_size, subtitle_size=sub_size, tight=True,
    )

    # Phone on right column, centered vertically
    raw = Image.open(raw_path)
    phone_h = int(H * 0.86)
    phone = build_phone(raw, target_h=phone_h)

    right_col_x = pad + left_col_w
    right_col_w = W - right_col_x - pad
    px = right_col_x + (right_col_w - phone.width) // 2
    py = (H - phone.height) // 2
    bg.paste(phone, (px, py), phone)

    bg.save(out_path, "JPEG", quality=92, optimize=True)


def main():
    for sub in ("phone", "tablet-7", "tablet-10"):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)

    for i, (head, sub, raw_name) in enumerate(COPY, start=1):
        raw_path = os.path.join(RAW, raw_name)
        if not os.path.exists(raw_path):
            print("MISSING:", raw_path)
            continue

        idx = f"{i:02d}"
        # Phone (9:16 portrait)
        compose_phone(
            raw_path, head, sub,
            os.path.join(OUT, "phone", f"phone-{idx}.jpg"),
        )
        # 7-inch tablet (16:9 landscape) — 1920x1080
        compose_tablet(
            raw_path, head, sub, (1920, 1080),
            os.path.join(OUT, "tablet-7", f"tablet7-{idx}.jpg"),
        )
        # 10-inch tablet (16:9 landscape) — 2560x1440
        compose_tablet(
            raw_path, head, sub, (2560, 1440),
            os.path.join(OUT, "tablet-10", f"tablet10-{idx}.jpg"),
        )
        print(f"  ✓ set {idx}: {head.splitlines()[0]}")


if __name__ == "__main__":
    print("Regenerating Play Store screenshots v2 …")
    main()
    print("Done →", OUT)
