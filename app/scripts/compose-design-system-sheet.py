from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "design-system-pngs"
BEFORE = ROOT.parent / "artifacts" / "design-system-visual-pass-2026-09-08" / "before"
FILES = [
    "01-system-overview.png",
    "02-foundations.png",
    "03-controls.png",
    "04-board-ready.png",
    "05-board-danger.png",
    "06-journey-complete.png",
    "07-responsive-mobile.png",
    "08-standards-and-evidence.png",
]
LANDSCAPE_FILES = [name for name in FILES if name != "07-responsive-mobile.png"]

try:
    TITLE_FONT = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 48)
    LABEL_FONT = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 28)
    SMALL_FONT = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
except OSError:
    TITLE_FONT = ImageFont.load_default()
    LABEL_FONT = ImageFont.load_default()
    SMALL_FONT = ImageFont.load_default()


def label_for(filename):
    return filename.removesuffix(".png").replace("-", " ").upper()


def require_image(filename):
    path = SOURCE / filename
    if not path.exists():
        raise SystemExit(f"Missing capture: {path}")
    return path


def crop_trailing_background(source):
    background = Image.new("RGB", source.size, source.getpixel((0, 0)))
    difference = ImageChops.difference(source, background).convert("L")
    mask = difference.point(lambda value: 255 if value > 8 else 0)
    bounds = mask.getbbox()
    if not bounds:
        return source
    return source.crop((0, 0, source.width, min(source.height, bounds[3] + 24)))


def crop_slice_to_content(source):
    background = Image.new("RGB", source.size, source.getpixel((0, 0)))
    difference = ImageChops.difference(source, background).convert("L")
    mask = difference.point(lambda value: 255 if value > 8 else 0)
    bounds = mask.getbbox()
    if not bounds:
        return source
    return source.crop((0, max(0, bounds[1] - 24), source.width, min(source.height, bounds[3] + 24)))


def has_reviewable_content(source):
    background = Image.new("RGB", source.size, source.getpixel((0, 0)))
    difference = ImageChops.difference(source, background).convert("L")
    mask = difference.point(lambda value: 255 if value > 8 else 0)
    changed_pixels = mask.histogram()[255]
    return changed_pixels / max(1, source.width * source.height) >= 0.05


def compose_grid(output_name, files, columns=2, cell_height=880):
    canvas_width = 2400
    margin = 64
    gap = 42
    title_height = 130
    rows = (len(files) + columns - 1) // columns
    cell_width = (canvas_width - margin * 2 - gap * (columns - 1)) // columns
    canvas_height = title_height + margin + rows * (cell_height + gap) + margin
    canvas = Image.new("RGB", (canvas_width, canvas_height), "#09080d")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 42), "XENOVOYA DESIGN SYSTEM - REVIEW PLATES", fill="#e8c860", font=TITLE_FONT)

    for index, filename in enumerate(files):
        row, column = divmod(index, columns)
        x = margin + column * (cell_width + gap)
        y = title_height + margin + row * (cell_height + gap)
        draw.rounded_rectangle((x, y, x + cell_width, y + cell_height), radius=18, fill="#11150f", outline="#4a503b", width=2)
        draw.text((x + 24, y + 20), label_for(filename), fill="#c4cbb8", font=LABEL_FONT)
        with Image.open(require_image(filename)).convert("RGB") as source:
            source.thumbnail((cell_width - 48, cell_height - 92), Image.Resampling.LANCZOS)
            image_x = x + (cell_width - source.width) // 2
            image_y = y + 70 + (cell_height - 86 - source.height) // 2
            canvas.paste(source, (image_x, image_y))

    output = SOURCE / output_name
    canvas.save(output, optimize=True)
    print(f"CONTACT_SHEET {output}")


def compose_vertical_details():
    sources = ["06-journey-complete.png", "07-responsive-mobile.png", "08-standards-and-evidence.png"]
    canvas_width = 2400
    margin = 64
    gap = 28
    title_height = 150
    columns = 3
    card_width = (canvas_width - margin * 2 - gap * (columns - 1)) // columns
    source_slice_height = 780
    cards = []

    for filename in sources:
        with Image.open(require_image(filename)).convert("RGB") as source:
            source = crop_trailing_background(source)
            for top in range(0, source.height, source_slice_height):
                crop = source.crop((0, top, source.width, min(source.height, top + source_slice_height)))
                if not has_reviewable_content(crop):
                    continue
                crop = crop_slice_to_content(crop)
                if crop.height < 150:
                    continue
                crop.thumbnail((card_width - 40, 740), Image.Resampling.LANCZOS)
                cards.append((filename, top // source_slice_height + 1, crop.copy()))

    rows = (len(cards) + columns - 1) // columns
    card_height = 830
    canvas_height = title_height + margin + rows * (card_height + gap) + margin
    canvas = Image.new("RGB", (canvas_width, canvas_height), "#09080d")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 38), "VERTICAL FLOWS - FULL-SCALE SLICES", fill="#e8c860", font=TITLE_FONT)
    draw.text((margin, 102), "Journey, mobile, and evidence plates split for legible review.", fill="#9ca58f", font=SMALL_FONT)

    for index, (filename, segment, crop) in enumerate(cards):
        row, column = divmod(index, columns)
        x = margin + column * (card_width + gap)
        y = title_height + margin + row * (card_height + gap)
        draw.rounded_rectangle((x, y, x + card_width, y + card_height), radius=16, fill="#11150f", outline="#4a503b", width=2)
        draw.text((x + 20, y + 16), f"{label_for(filename)} / {segment:02d}", fill="#c4cbb8", font=SMALL_FONT)
        image_x = x + (card_width - crop.width) // 2
        image_y = y + 64 + (card_height - 76 - crop.height) // 2
        canvas.paste(crop, (image_x, image_y))

    output = SOURCE / "design-system-vertical-sheet.png"
    canvas.save(output, optimize=True)
    print(f"CONTACT_SHEET {output}")


def compose_before_after():
    if not BEFORE.exists():
        return
    canvas_width = 2400
    margin = 64
    gap = 34
    title_height = 170
    row_height = 720
    column_width = (canvas_width - margin * 2 - gap) // 2
    canvas_height = title_height + margin + len(FILES) * (row_height + gap) + margin
    canvas = Image.new("RGB", (canvas_width, canvas_height), "#09080d")
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 34), "DESIGN SYSTEM - BEFORE / AFTER", fill="#e8c860", font=TITLE_FONT)
    draw.text((margin, 100), "Same routes, lenses, viewports, and reduced-motion capture conditions.", fill="#9ca58f", font=SMALL_FONT)
    draw.text((margin, 142), "BEFORE", fill="#ef6257", font=SMALL_FONT)
    draw.text((margin + column_width + gap, 142), "AFTER", fill="#55d692", font=SMALL_FONT)

    for row, filename in enumerate(FILES):
        y = title_height + margin + row * (row_height + gap)
        for column, path in enumerate((BEFORE / filename, SOURCE / filename)):
            x = margin + column * (column_width + gap)
            draw.rounded_rectangle((x, y, x + column_width, y + row_height), radius=16, fill="#11150f", outline="#4a503b", width=2)
            draw.text((x + 20, y + 16), label_for(filename), fill="#c4cbb8", font=SMALL_FONT)
            with Image.open(path).convert("RGB") as source:
                source.thumbnail((column_width - 40, row_height - 72), Image.Resampling.LANCZOS)
                image_x = x + (column_width - source.width) // 2
                image_y = y + 56 + (row_height - 64 - source.height) // 2
                canvas.paste(source, (image_x, image_y))

    output = SOURCE / "design-system-before-after-sheet.png"
    canvas.save(output, optimize=True)
    print(f"CONTACT_SHEET {output}")


compose_grid("design-system-contact-sheet.png", FILES)
compose_grid("design-system-landscape-sheet.png", LANDSCAPE_FILES)
compose_vertical_details()
compose_before_after()
