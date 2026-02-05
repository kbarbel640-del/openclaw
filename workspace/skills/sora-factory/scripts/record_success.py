#!/usr/bin/env python3
"""
Record successful prompt anchors into success_library.yaml.
Usage:
  python record_success.py --manifest shots/manifest.yaml --shot-ids 1,3,5
  python record_success.py --manifest shots/manifest.yaml --all
"""

import sys
import yaml
from pathlib import Path
from typing import List


def _load_yaml(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _save_yaml(path: Path, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)


def _parse_ids(arg: str) -> List[int]:
    return [int(x) for x in arg.split(",") if x.strip()]


def main():
    if "--manifest" not in sys.argv:
        print("Usage: python record_success.py --manifest shots/manifest.yaml [--shot-ids 1,2] [--all]")
        sys.exit(1)

    m_idx = sys.argv.index("--manifest")
    manifest_path = Path(sys.argv[m_idx + 1])
    if not manifest_path.exists():
        print(f"❌ manifest not found: {manifest_path}")
        sys.exit(1)

    shots = _load_yaml(manifest_path).get("shots", [])

    if "--all" in sys.argv:
        selected = shots
    elif "--shot-ids" in sys.argv:
        idx = sys.argv.index("--shot-ids")
        shot_ids = _parse_ids(sys.argv[idx + 1])
        selected = [s for s in shots if s.get("id") in shot_ids]
    else:
        print("❌ need --all or --shot-ids")
        sys.exit(1)

    assets_dir = Path(__file__).parent.parent / "assets"
    library_path = assets_dir / "success_library.yaml"
    library = _load_yaml(library_path)

    styles = library.get("style", []) or []
    palettes = library.get("color_palette", []) or []

    for s in selected:
        style = s.get("style")
        palette = s.get("color_palette")
        if style and style not in styles:
            styles.append(style)
        if palette and palette not in palettes:
            palettes.append(palette)

    library["style"] = styles
    library["color_palette"] = palettes

    _save_yaml(library_path, library)
    print(f"✅ updated {library_path}")


if __name__ == "__main__":
    main()
