#!/usr/bin/env python3
"""
Layout gate for Klabo Times.
Analyzes a PGM image rendered from the PDF and fails if layout is sparse or gappy.
"""

import argparse
import sys


def read_pgm(path):
    with open(path, "rb") as f:
        magic = f.readline().strip()
        if magic not in (b"P5", b"P2"):
            raise ValueError("Unsupported PGM format")

        tokens = []
        while len(tokens) < 3:
            line = f.readline()
            if not line:
                break
            line = line.split(b"#")[0]
            tokens.extend(line.split())

        if len(tokens) < 3:
            raise ValueError("Invalid PGM header")

        width, height, maxval = map(int, tokens[:3])

        if magic == b"P5":
            data = f.read(width * height)
            if len(data) != width * height:
                raise ValueError("Unexpected PGM data length")
            return width, height, maxval, data

        # ASCII P2 fallback
        data = []
        for line in f:
            line = line.split(b"#")[0]
            if not line.strip():
                continue
            data.extend([int(x) for x in line.split()])
        if len(data) != width * height:
            raise ValueError("Unexpected PGM data length")
        return width, height, maxval, bytes(data)


def get_pixel(data, width, x, y):
    return data[y * width + x]


def analyze_image(width, height, data, strict=False, columns=0):
    dpi_x = width / 8.5
    dpi_y = height / 11.0
    dpi = (dpi_x + dpi_y) / 2.0

    margin = int(0.4 * dpi)
    masthead = int(0.9 * dpi)
    footer = int(0.3 * dpi)
    gutter = int(0.125 * dpi)

    content_left = margin
    content_right = width - margin
    content_top = margin + masthead
    content_bottom = height - margin - footer

    content_width = content_right - content_left
    content_height = content_bottom - content_top

    if content_width <= 0 or content_height <= 0:
        return ["Content area is invalid"], []

    ink_threshold = 245

    max_gap_px = int((1.2 if not strict else 0.9) * dpi)
    max_bottom_gap = int((0.45 if not strict else 0.35) * dpi)
    max_variance = 0.18 if not strict else 0.12
    min_ink = 0.03 if not strict else 0.035

    errors = []
    warnings = []

    # Ink coverage
    ink_pixels = 0
    total_pixels = content_width * content_height

    for y in range(content_top, content_bottom):
        row_start = y * width
        row = data[row_start + content_left : row_start + content_right]
        ink_pixels += sum(1 for value in row if value < ink_threshold)

    ink_ratio = ink_pixels / max(1, total_pixels)
    if ink_ratio < min_ink:
        errors.append(f"Ink coverage too low: {ink_ratio:.1%}")
    elif ink_ratio < min_ink + 0.02:
        warnings.append(f"Ink coverage borderline: {ink_ratio:.1%}")

    last_ink_rows = []
    if columns and columns > 1:
        column_width = int((content_width - gutter * (columns - 1)) / columns)

        # Column checks (bottom alignment)
        for col in range(columns):
            col_left = content_left + col * (column_width + gutter)
            col_right = col_left + column_width

            # Find last ink row in column
            last_ink = None
            for y in range(content_bottom - 1, content_top - 1, -1):
                row_start = y * width
                row = data[row_start + col_left : row_start + col_right]
                if any(value < ink_threshold for value in row):
                    last_ink = y
                    break
            if last_ink is None:
                last_ink_rows.append(content_top)
                errors.append(f"Column {col + 1} has no ink")
                continue

            last_ink_rows.append(last_ink)
            bottom_gap = content_bottom - last_ink
            if bottom_gap > max_bottom_gap:
                errors.append(f"Column {col + 1} bottom gap too large: {bottom_gap}px")

    # Global gap check (blank horizontal bands across full content width)
    blank_run = 0
    min_ink_pixels = max(1, int(0.001 * content_width))
    for y in range(content_top, content_bottom):
        row_start = y * width
        row = data[row_start + content_left : row_start + content_right]
        ink_count = sum(1 for value in row if value < ink_threshold)
        if ink_count < min_ink_pixels:
            blank_run += 1
            if blank_run > max_gap_px:
                errors.append(f"Horizontal gap too large: {blank_run}px")
                break
        else:
            blank_run = 0

    if last_ink_rows:
        max_height = max(last_ink_rows)
        min_height = min(last_ink_rows)
        variance = (max_height - min_height) / max(1, content_height)
        if variance > max_variance:
            errors.append(f"Column balance variance too high: {variance:.1%}")

    return errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Klabo Times layout gate")
    parser.add_argument("pgm", help="Path to PGM file")
    parser.add_argument("--strict", action="store_true", help="Tighter thresholds")
    parser.add_argument("--columns", type=int, default=0, help="Column count for layout checks (0 disables)")
    args = parser.parse_args()

    try:
        width, height, _maxval, data = read_pgm(args.pgm)
    except Exception as exc:
        print(f"Gate error: {exc}")
        return 2

    errors, warnings = analyze_image(width, height, data, strict=args.strict, columns=args.columns)

    if warnings:
        for item in warnings:
            print(f"WARN: {item}")

    if errors:
        for item in errors:
            print(f"FAIL: {item}")
        return 1

    print("PASS: layout gate")
    return 0


if __name__ == "__main__":
    sys.exit(main())
