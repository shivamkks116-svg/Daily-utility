"""DailyHub AI — Complete Branding & Marketing Kit generator.

Generates:
- App icon at all Android + Play Store sizes
- Adaptive icon (foreground + background)
- Splash screens (portrait + landscape)
- Feature graphic (1024x500)
- Logo variations (icon, horizontal, stacked)
- Brand color palette
- Play Store screenshots framed with marketing captions
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import os
import math

ROOT = "/app/branding"

# ---------- Brand tokens ----------
BRAND_PRIMARY   = (94, 186, 139)   # #5EBA8B moss/emerald
BRAND_ACCENT    = (109, 213, 140)  # #6DD58C bright
BRAND_DEEP      = (27, 54, 38)     # #1B3626 deep
BRAND_TERTIARY  = (46, 79, 62)     # #2E4F3E
BRAND_ON_PRIM   = (0, 56, 32)      # #003820

SURFACE         = (17, 20, 18)     # #111412
SURFACE_SEC     = (27, 34, 30)     # #1B221E
ON_SURFACE      = (226, 230, 227)  # #E2E6E3
ON_SURFACE_SUB  = (196, 200, 197)  # #C4C8C5
ON_SURFACE_MUT  = (160, 165, 161)  # #A0A5A1
BORDER_STRONG   = (58, 71, 64)     # #3A4740


def _font(size, bold=False):
    """Load a nice font that's available in the container."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def rounded_rect_mask(size, radius):
    """Return an L-mode mask with anti-aliased rounded rectangle."""
    w, h = size
    ss = 4  # supersample factor for AA
    mask = Image.new("L", (w * ss, h * ss), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, w * ss, h * ss], radius=radius * ss, fill=255)
    return mask.resize(size, Image.LANCZOS)


# ---------- Icon glyph: stylized "D" combined with a spark/diamond ----------
def draw_glyph(canvas: Image.Image, box, primary=BRAND_PRIMARY, accent=BRAND_ACCENT, ring=True):
    """Draw the DailyHub AI glyph — a modern "D" with an AI spark inside."""
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    d = ImageDraw.Draw(canvas)

    # Backing ring (subtle)
    if ring:
        pad = int(w * 0.06)
        d.ellipse(
            [x0 - pad, y0 - pad, x1 + pad, y1 + pad],
            outline=(255, 255, 255, 25),
            width=max(2, w // 60),
        )

    # Big rounded "D" wedge — a rounded square with a big circle on the right cut
    d_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(d_layer)
    # Left vertical bar
    bar_w = int(w * 0.28)
    dd.rounded_rectangle(
        [int(w * 0.08), int(h * 0.10), int(w * 0.08) + bar_w, int(h * 0.90)],
        radius=int(bar_w * 0.35),
        fill=primary,
    )
    # Right rounded belly (arc)
    dd.pieslice(
        [int(w * 0.08), int(h * 0.10), int(w * 0.86), int(h * 0.90)],
        start=270, end=90, fill=primary,
    )
    # Inner cutout for hollow D
    inner_pad_x = int(w * 0.22)
    inner_pad_y = int(h * 0.24)
    dd.pieslice(
        [int(w * 0.08) + inner_pad_x, int(h * 0.10) + inner_pad_y,
         int(w * 0.86) - inner_pad_x + int(w * 0.10), int(h * 0.90) - inner_pad_y],
        start=270, end=90, fill=(0, 0, 0, 0),
    )
    canvas.paste(d_layer, (x0, y0), d_layer)

    # Diamond / sparkle accent
    cx = x0 + int(w * 0.62)
    cy = y0 + int(h * 0.50)
    size = int(w * 0.16)
    diamond = [
        (cx, cy - size),
        (cx + size * 0.82, cy),
        (cx, cy + size),
        (cx - size * 0.82, cy),
    ]
    d.polygon(diamond, fill=accent)
    # Small outer twinkle
    for tx, ty, sz in [
        (x0 + int(w * 0.78), y0 + int(h * 0.20), int(w * 0.045)),
        (x0 + int(w * 0.20), y0 + int(h * 0.78), int(w * 0.035)),
    ]:
        d.polygon(
            [(tx, ty - sz), (tx + sz * 0.6, ty), (tx, ty + sz), (tx - sz * 0.6, ty)],
            fill=accent,
        )


# ---------- Master icon ----------
def make_master_icon(size=1024, corner=0.22, with_bg=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if with_bg:
        # Radial-ish gradient background
        bg = Image.new("RGBA", (size, size), SURFACE_SEC + (255,))
        d = ImageDraw.Draw(bg)
        # Overlay a soft diagonal glow
        glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for i in range(60, 0, -2):
            alpha = int(120 * (i / 60))
            gd.ellipse(
                [int(size * 0.05) - i, int(size * 0.05) - i,
                 int(size * 0.55) + i, int(size * 0.55) + i],
                fill=BRAND_DEEP + (alpha,),
            )
        glow = glow.filter(ImageFilter.GaussianBlur(radius=size // 20))
        bg = Image.alpha_composite(bg, glow)
        # Rounded corners
        mask = rounded_rect_mask((size, size), int(size * corner))
        img.paste(bg, (0, 0), mask)

    # Glyph
    pad = int(size * 0.18)
    draw_glyph(img, (pad, pad, size - pad, size - pad), ring=with_bg)
    return img


def generate_icons():
    print("→ Icons")
    master = make_master_icon(1024)
    master.save(f"{ROOT}/icons/icon-1024.png", "PNG", optimize=True)

    # Play Store
    master.resize((512, 512), Image.LANCZOS).save(f"{ROOT}/icons/play-store-512.png", "PNG", optimize=True)
    master.resize((192, 192), Image.LANCZOS).save(f"{ROOT}/icons/icon-192.png", "PNG", optimize=True)

    # Android launcher densities
    launcher_sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for name, sz in launcher_sizes.items():
        master.resize((sz, sz), Image.LANCZOS).save(
            f"{ROOT}/icons/ic_launcher_{name}_{sz}.png", "PNG", optimize=True,
        )

    # Round icon variants (circular)
    for name, sz in launcher_sizes.items():
        r = master.resize((sz, sz), Image.LANCZOS)
        m = Image.new("L", (sz, sz), 0)
        ImageDraw.Draw(m).ellipse([0, 0, sz, sz], fill=255)
        circ = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
        circ.paste(r, (0, 0), m)
        circ.save(f"{ROOT}/icons/ic_launcher_round_{name}_{sz}.png", "PNG", optimize=True)


# ---------- Adaptive icon (foreground + background) ----------
def generate_adaptive():
    print("→ Adaptive icon")
    # Foreground: transparent-bg glyph on 1024x1024 with 264px safe-area padding
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    # Adaptive icon foreground: content must fit within 66dp of 108dp (i.e. 61%)
    inner = int(1024 * 0.60)
    off = (1024 - inner) // 2
    draw_glyph(fg, (off, off, off + inner, off + inner), ring=False)
    fg.save(f"{ROOT}/adaptive/adaptive-foreground-1024.png", "PNG", optimize=True)

    # Background: solid moss with subtle gradient
    bg = Image.new("RGBA", (1024, 1024), SURFACE_SEC + (255,))
    d = ImageDraw.Draw(bg)
    for i in range(1024):
        t = i / 1024
        r = int(SURFACE_SEC[0] * (1 - t) + BRAND_DEEP[0] * t)
        g = int(SURFACE_SEC[1] * (1 - t) + BRAND_DEEP[1] * t)
        b = int(SURFACE_SEC[2] * (1 - t) + BRAND_DEEP[2] * t)
        d.line([(0, i), (1024, i)], fill=(r, g, b, 255))
    bg.save(f"{ROOT}/adaptive/adaptive-background-1024.png", "PNG", optimize=True)

    # Monochrome (Android 13+ themed icon)
    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw_glyph(mono, (off, off, off + inner, off + inner),
               primary=(255, 255, 255), accent=(255, 255, 255), ring=False)
    mono.save(f"{ROOT}/adaptive/adaptive-monochrome-1024.png", "PNG", optimize=True)


# ---------- Splash screen ----------
def make_splash(size, portrait=True):
    img = Image.new("RGBA", size, SURFACE + (255,))
    d = ImageDraw.Draw(img)
    w, h = size

    # Radial glow behind logo
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = w // 2, h // 2
    for r in range(max(w, h) // 2, 0, -6):
        a = int(60 * (1 - r / (max(w, h) / 2)))
        if a <= 0:
            continue
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRAND_DEEP + (a,))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(w, h) // 30))
    img = Image.alpha_composite(img, glow)

    # Icon
    icon_size = int(min(w, h) * 0.34)
    icon = make_master_icon(icon_size, corner=0.24, with_bg=True)
    img.paste(icon, ((w - icon_size) // 2, (h - icon_size) // 2 - int(h * 0.05)), icon)

    d = ImageDraw.Draw(img)
    # Wordmark
    title_size = int(icon_size * 0.28)
    title = "DailyHub AI"
    font_title = _font(title_size, bold=True)
    tw = d.textlength(title, font=font_title)
    d.text(((w - tw) / 2, (h + icon_size) / 2 - int(h * 0.03)),
           title, font=font_title, fill=ON_SURFACE)

    sub_size = int(icon_size * 0.09)
    sub = "by Shivam Innovation"
    font_sub = _font(sub_size)
    sw = d.textlength(sub, font=font_sub)
    d.text(((w - sw) / 2, (h + icon_size) / 2 + title_size - int(h * 0.005)),
           sub, font=font_sub, fill=ON_SURFACE_MUT)

    return img


def generate_splash():
    print("→ Splash")
    # Master high-res portrait (source for expo-splash-screen)
    portrait = make_splash((1242, 2688), portrait=True)
    portrait.save(f"{ROOT}/splash/splash-portrait-1242x2688.png", "PNG", optimize=True)

    # 2x export for expo (in-app splash-image.png)
    logo_only = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    icon = make_master_icon(360, corner=0.24, with_bg=True)
    logo_only.paste(icon, (20, 20), icon)
    logo_only.save(f"{ROOT}/splash/splash-image.png", "PNG", optimize=True)

    # Landscape (for tablets)
    land = make_splash((2688, 1242), portrait=False)
    land.save(f"{ROOT}/splash/splash-landscape-2688x1242.png", "PNG", optimize=True)


# ---------- Feature graphic (1024x500) ----------
def generate_feature_graphic():
    print("→ Feature graphic")
    W, H = 1024, 500
    img = Image.new("RGBA", (W, H), SURFACE + (255,))

    # Left half: gradient wash
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for x in range(W):
        t = x / W
        r = int(BRAND_DEEP[0] * (1 - t) + SURFACE[0] * t)
        g = int(BRAND_DEEP[1] * (1 - t) + SURFACE[1] * t)
        b = int(BRAND_DEEP[2] * (1 - t) + SURFACE[2] * t)
        gd.line([(x, 0), (x, H)], fill=(r, g, b, 255))
    img = Image.alpha_composite(img, grad)

    # Soft brand glow blob top-left
    blob = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blob)
    bd.ellipse([-200, -200, 500, 500], fill=BRAND_PRIMARY + (60,))
    blob = blob.filter(ImageFilter.GaussianBlur(radius=80))
    img = Image.alpha_composite(img, blob)

    # Icon left
    icon = make_master_icon(280, corner=0.24, with_bg=True)
    img.paste(icon, (60, (H - 280) // 2), icon)

    d = ImageDraw.Draw(img)
    # Headline
    font_head = _font(70, bold=True)
    d.text((380, 120), "DailyHub AI", font=font_head, fill=ON_SURFACE)
    # Tagline
    font_sub = _font(30)
    d.text((382, 210), "Your all-in-one daily hub.", font=font_sub, fill=BRAND_ACCENT)

    # Feature pill row
    font_pill = _font(22, bold=True)
    pills = ["Notes", "Habits", "Focus", "AI", "Finance"]
    x = 382
    y = 300
    for p in pills:
        pw = int(d.textlength(p, font=font_pill)) + 34
        d.rounded_rectangle([x, y, x + pw, y + 44], radius=22, fill=BRAND_TERTIARY + (255,))
        d.text((x + 17, y + 10), p, font=font_pill, fill=ON_SURFACE)
        x += pw + 12

    # Badge bottom-right
    font_badge = _font(20, bold=True)
    badge_text = "Powered by Gemini 3"
    bw = int(d.textlength(badge_text, font=font_badge)) + 30
    d.rounded_rectangle([W - bw - 40, H - 60, W - 40, H - 20], radius=20,
                        fill=BRAND_PRIMARY + (255,))
    d.text((W - bw - 25, H - 52), badge_text, font=font_badge, fill=BRAND_ON_PRIM)

    img.convert("RGB").save(f"{ROOT}/feature/feature-graphic-1024x500.jpg",
                            "JPEG", quality=90, optimize=True)
    img.save(f"{ROOT}/feature/feature-graphic-1024x500.png", "PNG", optimize=True)


# ---------- Logo variations ----------
def generate_logo_variants():
    print("→ Logo variations")
    # Icon only (transparent bg)
    icon_only = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw_glyph(icon_only, (100, 100, 924, 924), ring=False)
    icon_only.save(f"{ROOT}/logo/logo-mark-transparent.png", "PNG", optimize=True)

    # Horizontal lockup (icon + wordmark side by side)
    W, H = 1600, 480
    horiz = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ic = make_master_icon(400, corner=0.24, with_bg=True)
    horiz.paste(ic, (30, 40), ic)
    d = ImageDraw.Draw(horiz)
    d.text((470, 130), "DailyHub AI", font=_font(140, bold=True), fill=ON_SURFACE)
    d.text((478, 300), "by Shivam Innovation", font=_font(48), fill=ON_SURFACE_MUT)
    horiz.save(f"{ROOT}/logo/logo-horizontal-dark.png", "PNG", optimize=True)

    # Horizontal light bg
    horiz_l = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    horiz_l.paste(ic, (30, 40), ic)
    d = ImageDraw.Draw(horiz_l)
    d.text((470, 130), "DailyHub AI", font=_font(140, bold=True), fill=(20, 30, 25))
    d.text((478, 300), "by Shivam Innovation", font=_font(48), fill=(90, 100, 95))
    horiz_l.save(f"{ROOT}/logo/logo-horizontal-light.png", "PNG", optimize=True)

    # Stacked
    W, H = 800, 900
    stack = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ic2 = make_master_icon(500, corner=0.24, with_bg=True)
    stack.paste(ic2, ((W - 500) // 2, 60), ic2)
    d = ImageDraw.Draw(stack)
    title_font = _font(90, bold=True)
    tw = d.textlength("DailyHub AI", font=title_font)
    d.text(((W - tw) / 2, 620), "DailyHub AI", font=title_font, fill=ON_SURFACE)
    sub_font = _font(34)
    sw = d.textlength("by Shivam Innovation", font=sub_font)
    d.text(((W - sw) / 2, 740), "by Shivam Innovation", font=sub_font, fill=ON_SURFACE_MUT)
    stack.save(f"{ROOT}/logo/logo-stacked-dark.png", "PNG", optimize=True)


# ---------- Brand color palette poster ----------
def generate_brand_kit():
    print("→ Brand kit palette")
    W, H = 1600, 1000
    img = Image.new("RGBA", (W, H), SURFACE + (255,))
    d = ImageDraw.Draw(img)
    d.text((80, 60), "DailyHub AI", font=_font(64, bold=True), fill=ON_SURFACE)
    d.text((82, 140), "Brand Kit · Colors & Type", font=_font(30), fill=BRAND_ACCENT)

    swatches = [
        ("Brand Primary",  "#5EBA8B", BRAND_PRIMARY),
        ("Brand Accent",   "#6DD58C", BRAND_ACCENT),
        ("Brand Deep",     "#1B3626", BRAND_DEEP),
        ("Brand Tertiary", "#2E4F3E", BRAND_TERTIARY),
        ("Surface",        "#111412", SURFACE),
        ("Surface Sec.",   "#1B221E", SURFACE_SEC),
        ("On-Surface",     "#E2E6E3", ON_SURFACE),
        ("Border Strong",  "#3A4740", BORDER_STRONG),
    ]
    x0, y0 = 80, 240
    sw_w, sw_h, gap = 340, 180, 30
    per_row = 4
    for i, (name, hexv, rgb) in enumerate(swatches):
        r = i // per_row
        c = i % per_row
        x = x0 + c * (sw_w + gap)
        y = y0 + r * (sw_h + 110)
        d.rounded_rectangle([x, y, x + sw_w, y + sw_h], radius=20, fill=rgb + (255,),
                            outline=(255, 255, 255, 40), width=2)
        d.text((x + 12, y + sw_h + 12), name, font=_font(24, bold=True), fill=ON_SURFACE)
        d.text((x + 12, y + sw_h + 46), hexv, font=_font(22), fill=ON_SURFACE_MUT)

    # Typography section
    d.text((80, 830), "Typography — System (SF / Roboto)", font=_font(28, bold=True), fill=ON_SURFACE)
    d.text((80, 872), "Display / Extrabold  ·  Headings / Bold  ·  Body / Regular",
           font=_font(22), fill=ON_SURFACE_MUT)

    img.convert("RGB").save(f"{ROOT}/brand-kit/brand-palette.jpg", "JPEG", quality=92, optimize=True)


if __name__ == "__main__":
    generate_icons()
    generate_adaptive()
    generate_splash()
    generate_feature_graphic()
    generate_logo_variants()
    generate_brand_kit()
    print("\n✓ All assets generated in /app/branding/")
