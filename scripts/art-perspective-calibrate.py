#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def parse_line(value):
    points = [float(item) for item in value.split(",")]
    if len(points) != 4:
        raise argparse.ArgumentTypeError("line must be x1,y1,x2,y2")
    return points


def parse_args():
    parser = argparse.ArgumentParser(description="Estimate a visual vanishing point from inspected line segments.")
    parser.add_argument("image")
    parser.add_argument("--line", action="append", type=parse_line, required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--record", required=True)
    parser.add_argument("--horizon-assumption", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    image = cv2.imread(str(Path(args.image).resolve()), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"Unable to read image: {args.image}")
    height, width = image.shape[:2]
    equations = []
    for x1, y1, x2, y2 in args.line:
        line = np.cross(np.array([x1, y1, 1.0]), np.array([x2, y2, 1.0]))
        magnitude = np.hypot(line[0], line[1])
        equations.append(line / max(magnitude, 1e-8))
    equations = np.asarray(equations)
    point, _, _, _ = np.linalg.lstsq(equations[:, :2], -equations[:, 2], rcond=None)
    residuals = np.abs(equations[:, :2] @ point + equations[:, 2])
    vp = tuple(int(round(value)) for value in point)

    overlay = image.copy()
    for segment in args.line:
        x1, y1, x2, y2 = (int(round(value)) for value in segment)
        cv2.line(overlay, (x1, y1), (x2, y2), (76, 145, 219), 5, cv2.LINE_AA)
        cv2.line(overlay, (x2, y2), vp, (64, 160, 128), 2, cv2.LINE_AA)
    cv2.drawMarker(overlay, vp, (96, 96, 232), cv2.MARKER_CROSS, 36, 4, cv2.LINE_AA)

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output), overlay)
    record = {
        "source": str(Path(args.image).resolve()),
        "segments": args.line,
        "vanishingPointPixels": {"x": float(point[0]), "y": float(point[1])},
        "vanishingPointNormalized": {"x": float(point[0] / width), "y": float(point[1] / height)},
        "horizonAssumption": args.horizon_assumption,
        "meanLineResidualPixels": float(np.mean(residuals)),
        "overlay": str(output),
    }
    record_path = Path(args.record).resolve()
    record_path.parent.mkdir(parents=True, exist_ok=True)
    record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
