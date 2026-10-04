#!/usr/bin/env python3
"""
Generate production widget preview thumbnails for the DailyHub AI
Android home-screen widgets.

Outputs two PNGs under `assets/images/` that match the real widget JSX
exactly so the launcher's widget picker shows what the user actually
gets after dropping the widget on their home screen.

Run from repo root:
  python3 frontend/scripts/generate_widget_previews.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"

# Palette mirrors src/widgets/palette.ts (dark variant — the preview most
# launchers surface by default).
SURFACE = "#111412"
SURFACE_SECONDARY = "#1B221E"
SURFACE_TERTIARY = "#252D28"
BRAND = "#5EBA8B"
BRAND_TILE = "#1B3626"
ON_SURFACE = "#E2E6E3"
ON_SURFACE_MUTED = "#A0A5A1"

# Font paths — Debian/Ubuntu base image ships these out of the box.
FONT_REGULAR = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_EMOJI = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radius: int,
    fill: str,
) -> None:
    """PIL >= 8 has rounded_rectangle but syntax changed in 9. Use the
    cross-version `rounded_rectangle` call."""
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def paste_emoji(
    canvas: Image.Image, glyph: str, center: tuple[int, int], size: int
) -> None:
    """NotoColorEmoji only ships at a fixed 109-px bitmap size. Render
    at that native size, then resample down to our target."""
    native = 109
    f = font(FONT_EMOJI, native)
    # Build a transparent tile, draw the emoji in the middle.
    tile = Image.new("RGBA", (native * 2, native * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.text(
        (native, native),
        glyph,
        font=f,
        embedded_color=True,
        anchor="mm",
    )
    # Crop to a tight bbox for a crisper downscale.
    bbox = tile.getbbox() or (0, 0, native * 2, native * 2)
    tile = tile.crop(bbox)
    tile = tile.resize((size, size), Image.LANCZOS)
    canvas.paste(tile, (center[0] - size // 2, center[1] - size // 2), tile)


def draw_header(
    draw: ImageDraw.ImageDraw,
    canvas: Image.Image,
    *,
    y: int,
    width: int,
    pad: int,
    header_font_size: int,
) -> None:
    f_brand = font(FONT_BOLD, header_font_size)
    f_open = font(FONT_REGULAR, int(header_font_size * 0.78))
    draw.text((pad + 4, y), "DailyHub AI", font=f_brand, fill=BRAND)
    text = "Open ›"
    bb = draw.textbbox((0, 0), text, font=f_open)
    tw = bb[2] - bb[0]
    draw.text((width - pad - 4 - tw, y + 3), text, font=f_open, fill=ON_SURFACE_MUTED)


def draw_tile_row(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    *,
    tiles: list[tuple[str, str]],
    y: int,
    pad: int,
    width: int,
    tile_height: int,
    tile_radius: int,
    circle_diameter: int,
    label_size: int,
    emoji_size: int,
) -> None:
    gap = 10
    inner_width = width - pad * 2
    tile_w = (inner_width - gap * (len(tiles) - 1)) // len(tiles)

    f_label = font(FONT_BOLD, label_size)

    for i, (glyph, label) in enumerate(tiles):
        x0 = pad + i * (tile_w + gap)
        x1 = x0 + tile_w
        y0 = y
        y1 = y + tile_height
        rounded_rect(draw, (x0, y0, x1, y1), tile_radius, SURFACE_TERTIARY)

        # Icon circle
        cx = (x0 + x1) // 2
        cy = y0 + tile_height // 2 - (label_size + 8) // 2
        rounded_rect(
            draw,
            (
                cx - circle_diameter // 2,
                cy - circle_diameter // 2,
                cx + circle_diameter // 2,
                cy + circle_diameter // 2,
            ),
            circle_diameter // 2,
            BRAND_TILE,
        )
        paste_emoji(canvas, glyph, (cx, cy), emoji_size)

        # Label
        bb = draw.textbbox((0, 0), label, font=f_label)
        tw = bb[2] - bb[0]
        label_y = cy + circle_diameter // 2 + 6
        draw.text(
            ((x0 + x1) // 2 - tw // 2, label_y),
            label,
            font=f_label,
            fill=ON_SURFACE,
        )


def render_quick_actions() -> Image.Image:
    W, H = 720, 288  # ~ 240dp x 96dp @ 3x density
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer surface
    pad = 20
    rounded_rect(draw, (0, 0, W, H), 44, SURFACE)

    # Header
    draw_header(
        draw,
        img,
        y=pad,
        width=W,
        pad=pad,
        header_font_size=26,
    )

    # Tiles row
    draw_tile_row(
        img,
        draw,
        tiles=[
            ("📄", "Scan PDF"),
            ("🤖", "AI Chat"),
            ("📝", "New Note"),
            ("🔳", "Scan QR"),
        ],
        y=pad + 44,
        pad=pad,
        width=W,
        tile_height=H - pad - (pad + 44),
        tile_radius=28,
        circle_diameter=70,
        label_size=22,
        emoji_size=42,
    )

    return img


def render_recents() -> Image.Image:
    W, H = 720, 560
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = 20
    rounded_rect(draw, (0, 0, W, H), 44, SURFACE)

    # Header
    draw_header(
        draw,
        img,
        y=pad,
        width=W,
        pad=pad,
        header_font_size=26,
    )

    # Compact tiles row
    tile_y = pad + 44
    tile_h = 120
    draw_tile_row(
        img,
        draw,
        tiles=[
            ("📄", "Scan"),
            ("🤖", "AI"),
            ("📝", "Note"),
            ("🔳", "QR"),
        ],
        y=tile_y,
        pad=pad,
        width=W,
        tile_height=tile_h,
        tile_radius=24,
        circle_diameter=56,
        label_size=20,
        emoji_size=34,
    )

    # Recent rows
    sample = [
        ("📕", "Invoice_June.pdf", "Scan · Just now"),
        ("📕", "Lease Agreement.pdf", "Merge · 2h ago"),
        ("🖼️", "Whiteboard Snap.jpg", "OCR · Yesterday"),
    ]
    row_y = tile_y + tile_h + 18
    row_h = 90
    row_gap = 12
    f_title = font(FONT_BOLD, 24)
    f_meta = font(FONT_REGULAR, 18)
    for i, (glyph, title, meta) in enumerate(sample):
        y0 = row_y + i * (row_h + row_gap)
        y1 = y0 + row_h
        rounded_rect(draw, (pad, y0, W - pad, y1), 24, SURFACE_SECONDARY)

        # Icon circle
        cx = pad + 20 + 32
        cy = (y0 + y1) // 2
        rounded_rect(draw, (cx - 32, cy - 32, cx + 32, cy + 32), 32, BRAND_TILE)
        paste_emoji(img, glyph, (cx, cy), 38)

        # Title + meta
        tx = cx + 32 + 20
        draw.text((tx, y0 + 20), title, font=f_title, fill=ON_SURFACE)
        draw.text((tx, y0 + 50), meta, font=f_meta, fill=ON_SURFACE_MUTED)

    return img


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    render_quick_actions().save(ASSETS / "widget-preview-quick.png", "PNG")
    render_recents().save(ASSETS / "widget-preview-recents.png", "PNG")
    print(f"Wrote {ASSETS / 'widget-preview-quick.png'}")
    print(f"Wrote {ASSETS / 'widget-preview-recents.png'}")


if __name__ == "__main__":
    main()
