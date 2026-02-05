#!/usr/bin/env python3
"""
Download manager for Sora outputs.
Accepts a JSON list of URLs and downloads them into output/raw/ as shot_XXX.mp4.
"""

import json
import os
import sys
import time
import urllib.request
from pathlib import Path
from typing import Dict, List


def _load_urls(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "urls" in data:
        return list(dict.fromkeys(data["urls"]))
    if isinstance(data, list):
        return list(dict.fromkeys(data))
    return []


def _download(url: str, dest: Path, headers: Dict[str, str] = None, retries: int = 2) -> bool:
    headers = headers or {}
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
                f.write(resp.read())
            return True
        except Exception as e:
            if attempt >= retries:
                print(f"❌ 下載失敗: {url} ({e})")
                return False
            time.sleep(1)
    return False


def download_urls(urls: List[str], output_dir: str, start_index: int = 1) -> None:
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, url in enumerate(urls, start=start_index):
        filename = f"shot_{i:03d}.mp4"
        dest = out_dir / filename
        if dest.exists():
            print(f"⏭️ 已存在，跳過: {filename}")
            continue
        print(f"⬇️ 下載 {filename} ...")
        _download(url, dest)


def main():
    if len(sys.argv) < 2:
        print("Usage: python download_manager.py <urls.json> [--output <dir>] [--start-index N]")
        sys.exit(1)

    urls_path = sys.argv[1]
    output_dir = "output/raw"
    start_index = 1

    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]

    if "--start-index" in sys.argv:
        idx = sys.argv.index("--start-index")
        if idx + 1 < len(sys.argv):
            start_index = int(sys.argv[idx + 1])

    urls = _load_urls(urls_path)
    if not urls:
        print("⚠️ 沒有可下載的 URL")
        sys.exit(1)

    download_urls(urls, output_dir, start_index)


if __name__ == "__main__":
    main()
