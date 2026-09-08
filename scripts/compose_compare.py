#!/usr/bin/env python3
"""Compose a labeled reference-left / actual-right comparison PNG."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--actual", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--height", type=int, default=1080, help="Displayed image height in pixels")
    parser.add_argument("--gap", type=int, default=32)
    parser.add_argument("--header", type=int, default=72)
    parser.add_argument("--reference-label", default="REFERENCE")
    parser.add_argument("--actual-label", default="ACTUAL")
    return parser.parse_args()


def resize_to_height(image: Image.Image, height: int) -> Image.Image:
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def main() -> None:
    args = parse_args()
    if args.height <= 0 or args.gap < 0 or args.header < 0:
        raise SystemExit("height must be positive; gap and header must be non-negative")

    reference = resize_to_height(Image.open(args.reference).convert("RGB"), args.height)
    actual = resize_to_height(Image.open(args.actual).convert("RGB"), args.height)
    width = reference.width + args.gap + actual.width
    canvas = Image.new("RGB", (width, args.header + args.height), "#09070b")
    canvas.paste(reference, (0, args.header))
    canvas.paste(actual, (reference.width + args.gap, args.header))

    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=max(14, args.header // 3))
    baseline = max(4, (args.header - font.size) // 2)
    draw.text((18, baseline), args.reference_label, fill="#f272b5", font=font)
    draw.text((reference.width + args.gap + 18, baseline), args.actual_label, fill="#f272b5", font=font)
    if args.gap:
        divider_x = reference.width + args.gap // 2
        draw.line((divider_x, 0, divider_x, canvas.height), fill="#6f2853", width=max(1, args.gap // 10))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, format="PNG", optimize=True)
    print(args.output.resolve())


if __name__ == "__main__":
    main()
