#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation


def parse_args():
    parser = argparse.ArgumentParser(description="Create relative depth evidence for visual art review.")
    parser.add_argument("images", nargs="+", help="Images to analyze.")
    parser.add_argument("--out-dir", required=True, help="Directory for grayscale and color depth maps.")
    parser.add_argument("--model", default="depth-anything/Depth-Anything-V2-Small-hf")
    return parser.parse_args()


def main():
    args = parse_args()
    output_dir = Path(args.out_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    processor = AutoImageProcessor.from_pretrained(args.model)
    model = AutoModelForDepthEstimation.from_pretrained(args.model)
    model.eval()

    records = []
    for source_value in args.images:
        source = Path(source_value).resolve()
        image = Image.open(source).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            depth = model(**inputs).predicted_depth
        depth = torch.nn.functional.interpolate(
            depth.unsqueeze(1),
            size=(image.height, image.width),
            mode="bicubic",
            align_corners=False,
        ).squeeze().cpu().numpy()
        low, high = np.percentile(depth, (2, 98))
        normalized = np.clip((depth - low) / max(high - low, 1e-8), 0, 1)
        gray = np.uint8(normalized * 255)
        color = cv2.applyColorMap(gray, cv2.COLORMAP_TURBO)

        gray_path = output_dir / f"{source.stem}-depth-gray.png"
        color_path = output_dir / f"{source.stem}-depth-color.png"
        Image.fromarray(gray, mode="L").save(gray_path)
        cv2.imwrite(str(color_path), color)
        records.append({
            "source": str(source),
            "model": args.model,
            "interpretation": "relative inverse depth; warm/bright is nearer and cool/dark is farther",
            "grayscale": str(gray_path),
            "color": str(color_path),
        })

    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
