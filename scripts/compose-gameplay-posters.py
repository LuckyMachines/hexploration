"""Compose gameplay-led Xenovoya posters and email-ready derivatives.

Run from the repository root with:
    python scripts/compose-gameplay-posters.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "app" / "public" / "images" / "posters"
EVIDENCE = ROOT.parent / "xenovoya-coordinator" / "reports" / "visual-evidence"

BARLOW_BOLD = ROOT / "app" / "public" / "fonts" / "barlow-condensed" / "barlow-condensed-700.ttf"
BARLOW_MEDIUM = ROOT / "app" / "public" / "fonts" / "barlow-condensed" / "barlow-condensed-500.ttf"
MONO = ROOT / "app" / "public" / "fonts" / "jetbrains-mono" / "jetbrains-mono-500.ttf"

INK = (5, 12, 12)
PAPER = (239, 237, 226)
CYAN = (119, 218, 216)
GOLD = (230, 192, 76)
GREEN = (73, 197, 153)
RED = (241, 95, 100)
MUTED = (146, 169, 158)


def required_inputs():
    return [
        PUBLIC / "xenovoya-poster-vertical.png",
        PUBLIC / "xenovoya-poster-landscape.png",
        ROOT / "app" / "public" / "design-system-pngs" / "04-board-ready.png",
        ROOT / "app" / "public" / "design-system-pngs" / "05-board-danger.png",
        EVIDENCE / "2026-09-07" / "help-rescue-loop" / "board-help-rescue.png",
        BARLOW_BOLD,
        BARLOW_MEDIUM,
        MONO,
    ]


def validate_inputs():
    missing = [path for path in required_inputs() if not path.is_file()]
    if missing:
        formatted = "\n".join(f"- {path}" for path in missing)
        raise FileNotFoundError(f"Poster workflow inputs are missing:\n{formatted}")


def font(path, size):
    return ImageFont.truetype(str(path), size=size)


def tracking_text(draw, position, text, face, fill, tracking):
    x, y = position
    for char in text:
        draw.text((x, y), char, font=face, fill=fill)
        width = draw.textlength(char, font=face)
        x += width + tracking


def dark_backdrop(path, size, strength=0.66):
    image = Image.open(path).convert("RGB")
    image = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)
    image = ImageEnhance.Color(image).enhance(0.72)
    image = image.filter(ImageFilter.GaussianBlur(7))
    veil = Image.new("RGBA", size, (*INK, round(255 * strength)))
    image = Image.alpha_composite(image.convert("RGBA"), veil)
    vignette = Image.new("L", size, 0)
    vignette_draw = ImageDraw.Draw(vignette)
    for inset in range(0, min(size) // 2, 16):
        alpha = min(220, int(255 * (inset / (min(size) / 2)) ** 1.8))
        vignette_draw.rounded_rectangle(
            (inset, inset, size[0] - inset, size[1] - inset),
            radius=max(1, min(size) // 7 - inset // 2),
            outline=alpha,
            width=18,
        )
    black = Image.new("RGBA", size, (0, 0, 0, 0))
    black.putalpha(vignette)
    return Image.alpha_composite(image, black)


def crop_image(path, crop=None):
    image = Image.open(path).convert("RGB")
    if crop:
        image = image.crop(crop)
    return image


def add_panel(canvas, source, box, border, radius=34, border_width=5):
    x, y, width, height = box
    fitted = ImageOps.fit(source, (width, height), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(shadow_mask).rounded_rectangle(
        (x + 18, y + 28, x + width + 18, y + height + 28), radius=radius + 8, fill=190
    )
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(30))
    shadow.putalpha(shadow_mask)
    canvas.alpha_composite(shadow)

    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    layer.paste(fitted, (0, 0), mask)
    canvas.alpha_composite(layer, (x, y))

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        (x, y, x + width - 1, y + height - 1),
        radius=radius,
        outline=border,
        width=border_width,
    )


def label(draw, x, y, index, text, color):
    face = font(MONO, 28)
    tracking_text(draw, (x, y), f"{index:02d} / {text}", face, color, 7)


def compose_vertical():
    size = (2160, 3840)
    base = dark_backdrop(PUBLIC / "xenovoya-poster-vertical.png", size, 0.74)
    draw = ImageDraw.Draw(base)

    tracking_text(draw, (130, 105), "OPEN ALPHA / SEPOLIA", font(MONO, 34), GOLD, 7)
    draw.line((130, 180, 2030, 180), fill=(*GOLD, 210), width=4)
    draw.text((120, 205), "XENOVOYA", font=font(BARLOW_BOLD, 330), fill=PAPER)
    tracking_text(draw, (132, 565), "ACTUAL GAMEPLAY / COOPERATIVE HEX EXPEDITIONS", font(BARLOW_MEDIUM, 54), CYAN, 8)

    ready = crop_image(
        ROOT / "app" / "public" / "design-system-pngs" / "04-board-ready.png",
        (0, 280, 1134, 1015),
    )
    danger = crop_image(
        ROOT / "app" / "public" / "design-system-pngs" / "05-board-danger.png",
        (0, 245, 1134, 1062),
    )
    help_screen = crop_image(
        EVIDENCE / "2026-09-07" / "help-rescue-loop" / "board-help-rescue.png",
        (0, 120, 1130, 730),
    )

    label(draw, 130, 710, 1, "ROUTE PLANNING", GOLD)
    add_panel(base, ready, (120, 775, 1920, 1245), (*GOLD, 235), radius=38, border_width=6)

    label(draw, 130, 2110, 2, "CREW RESCUE", GREEN)
    label(draw, 1115, 2110, 3, "REDLINE DECISION", RED)
    add_panel(base, help_screen, (120, 2180, 925, 810), (*GREEN, 235), radius=32, border_width=5)
    add_panel(base, danger, (1115, 2180, 925, 810), (*RED, 235), radius=32, border_width=5)

    draw.line((130, 3135, 2030, 3135), fill=(54, 94, 86), width=3)
    tracking_text(draw, (130, 3205), "EXPLORE SHARED FOG.", font(BARLOW_MEDIUM, 70), CYAN, 5)
    tracking_text(draw, (130, 3310), "RECOVER RELICS.", font(BARLOW_MEDIUM, 70), GOLD, 5)
    tracking_text(draw, (130, 3415), "ESCAPE TOGETHER.", font(BARLOW_MEDIUM, 70), GREEN, 5)
    tracking_text(draw, (130, 3635), "PLAY.XENOVOYA.COM", font(MONO, 42), PAPER, 8)
    draw.line((130, 3720, 2030, 3720), fill=(*CYAN, 180), width=3)

    output = PUBLIC / "xenovoya-poster-gameplay-vertical.png"
    base.convert("RGB").save(output, format="PNG", optimize=True)
    return output


def compose_landscape():
    size = (3840, 2160)
    base = dark_backdrop(PUBLIC / "xenovoya-poster-landscape.png", size, 0.71)
    draw = ImageDraw.Draw(base)

    tracking_text(draw, (150, 120), "OPEN ALPHA / SEPOLIA", font(MONO, 34), GOLD, 7)
    draw.line((150, 195, 1370, 195), fill=(*GOLD, 210), width=4)
    draw.text((135, 215), "XENOVOYA", font=font(BARLOW_BOLD, 300), fill=PAPER)
    tracking_text(draw, (150, 545), "ACTUAL GAMEPLAY", font(BARLOW_MEDIUM, 60), CYAN, 9)
    draw.text(
        (150, 675),
        "A shared expedition where every\nroute, rescue, relic, and escape\nbecomes a crew decision.",
        font=font(BARLOW_MEDIUM, 64),
        fill=PAPER,
        spacing=22,
    )

    ready = crop_image(
        ROOT / "app" / "public" / "design-system-pngs" / "04-board-ready.png",
        (0, 280, 1134, 1015),
    )
    danger = crop_image(
        ROOT / "app" / "public" / "design-system-pngs" / "05-board-danger.png",
        (0, 245, 1134, 1062),
    )
    help_screen = crop_image(
        EVIDENCE / "2026-09-07" / "help-rescue-loop" / "board-help-rescue.png",
        (0, 120, 1130, 730),
    )

    label(draw, 1510, 170, 1, "ROUTE PLANNING", GOLD)
    add_panel(base, ready, (1490, 235, 2210, 1435), (*GOLD, 235), radius=40, border_width=7)

    label(draw, 1510, 1750, 2, "CREW RESCUE", GREEN)
    label(draw, 2665, 1750, 3, "REDLINE DECISION", RED)
    add_panel(base, help_screen, (1490, 1810, 1060, 270), (*GREEN, 235), radius=24, border_width=4)
    add_panel(base, danger, (2640, 1810, 1060, 270), (*RED, 235), radius=24, border_width=4)

    tracking_text(draw, (150, 1330), "EXPLORE SHARED FOG.", font(BARLOW_MEDIUM, 56), CYAN, 4)
    tracking_text(draw, (150, 1420), "RECOVER RELICS.", font(BARLOW_MEDIUM, 56), GOLD, 4)
    tracking_text(draw, (150, 1510), "ESCAPE TOGETHER.", font(BARLOW_MEDIUM, 56), GREEN, 4)
    draw.line((150, 1720, 1290, 1720), fill=(54, 94, 86), width=3)
    tracking_text(draw, (150, 1815), "PLAY.XENOVOYA.COM", font(MONO, 40), PAPER, 7)

    output = PUBLIC / "xenovoya-poster-gameplay-landscape.png"
    base.convert("RGB").save(output, format="PNG", optimize=True)
    return output


def export_email_versions(paths):
    email_dir = PUBLIC / "email"
    email_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for path in paths:
        destination = email_dir / f"{path.stem}.jpg"
        with Image.open(path) as image:
            image.convert("RGB").save(destination, "JPEG", quality=88, optimize=True, progressive=True)
        results.append(destination)
    return results


def main():
    validate_inputs()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    gameplay = [compose_vertical(), compose_landscape()]
    campaign = [
        PUBLIC / "xenovoya-poster-vertical.png",
        PUBLIC / "xenovoya-poster-landscape.png",
        *gameplay,
    ]
    email = export_email_versions(campaign)
    for path in [*gameplay, *email]:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
