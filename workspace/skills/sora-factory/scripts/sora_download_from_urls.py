#!/usr/bin/env python3
"""Auto-download Sora drafts from URLs via CDP.

MVP (B1): remove the need to manually click "Download" 3 times.

Usage:
  python3 scripts/sora_download_from_urls.py --config assets/sora_browser_config.yaml --urls urls.json

urls.json formats:
  ["https://sora.../d/gen_xxx", ...]
  {"urls": ["...", "..."]}

Note:
- Requires Chrome running with remote debugging (CDP) at cdp.base_url.
- Requires downloads.download_dir set in config if you want deterministic download location.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from sora_browser_driver import SoraBrowserDriver


def _load_urls(path: str):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("urls"), list):
        return data["urls"]
    if isinstance(data, list):
        return data
    raise ValueError("Invalid urls.json")


async def main_async(args):
    urls = _load_urls(args.urls)
    driver = SoraBrowserDriver.from_config_file(args.config)

    await driver._attach()
    outcomes = await driver.download_from_urls(
        urls,
        per_url_attempts=args.attempts,
        sleep_between_sec=args.sleep,
    )

    out = {
        "outcomes": outcomes,
        "captured_urls": driver.captured_urls,
    }
    if args.out:
        Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        print(json.dumps(out, ensure_ascii=False, indent=2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, help="Path to sora_browser_config.yaml")
    ap.add_argument("--urls", required=True, help="urls.json")
    ap.add_argument("--attempts", type=int, default=6, help="Attempts per URL (menu open + click download)")
    ap.add_argument("--sleep", type=float, default=1.0, help="Sleep between URLs")
    ap.add_argument("--out", default=None, help="Write results JSON")
    args = ap.parse_args()

    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
