#!/usr/bin/env python3
"""Download watcher for Sora outputs.

Problem solved:
- Sora UI download is manual and Chrome may save to an unknown folder/name.
- Pipeline expects `shot_XXX.mp4` under a known raw_dir.

This script watches (or scans) a download directory, waits for downloads to finish
(.crdownload/.part disappears, file size stabilizes), then renames/moves the most
recent N videos into `output_dir/shot_XXX.<ext>`.

Typical use (after clicking Download in Sora for 3 shots):
  python3 scripts/download_watcher.py \
    --download-dir ~/Downloads \
    --output-dir projects/<proj>/output/raw \
    --count 3

Or continuous watch (click download one by one):
  python3 scripts/download_watcher.py --watch --count 3 ...
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple, Dict, Any

VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v"}
TEMP_EXTS = {".crdownload", ".part", ".tmp"}


@dataclass
class Candidate:
    path: Path
    mtime: float
    size: int


def _is_video_file(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() in VIDEO_EXTS


def _is_temp_file(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() in TEMP_EXTS


def _list_candidates(download_dir: Path, since_ts: Optional[float] = None) -> List[Candidate]:
    out: List[Candidate] = []
    for p in download_dir.iterdir():
        if not _is_video_file(p):
            continue
        st = p.stat()
        if since_ts is not None and st.st_mtime < since_ts:
            continue
        out.append(Candidate(path=p, mtime=st.st_mtime, size=st.st_size))
    # oldest -> newest
    out.sort(key=lambda c: c.mtime)
    return out


def _has_active_download(download_dir: Path) -> bool:
    for p in download_dir.iterdir():
        if _is_temp_file(p):
            return True
    return False


def _wait_file_stable(path: Path, stable_seconds: int = 2, timeout_seconds: int = 180) -> bool:
    """Wait until file size stops changing for stable_seconds."""
    start = time.time()
    last_size = -1
    stable_for = 0

    while time.time() - start < timeout_seconds:
        if not path.exists():
            time.sleep(0.5)
            continue
        size = path.stat().st_size
        if size == last_size and size > 0:
            stable_for += 1
        else:
            stable_for = 0
            last_size = size
        if stable_for >= stable_seconds:
            return True
        time.sleep(1)

    return False


def _move_rename(src: Path, dest: Path, overwrite: bool = False) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        if not overwrite:
            raise FileExistsError(f"Destination exists: {dest}")
        dest.unlink()
    shutil.move(str(src), str(dest))


def scan_mode(download_dir: Path, output_dir: Path, count: int, start_index: int, since_minutes: int,
              overwrite: bool, since_ts: Optional[float] = None, interactive_map: bool = False,
              manifest_path: Optional[Path] = None) -> List[Path]:
    # since_ts (unix seconds) takes precedence; fallback to since_minutes.
    if since_ts is None:
        since_ts = time.time() - since_minutes * 60 if since_minutes > 0 else None
    cands = _list_candidates(download_dir, since_ts=since_ts)
    if len(cands) < count:
        raise RuntimeError(f"Not enough video files in {download_dir}. Found {len(cands)}, need {count}.")

    chosen = cands[-count:]  # newest N

    # By default we assign in chronological order (oldest -> newest).
    # If user downloaded out-of-order, enable interactive_map to manually map files to shots.
    order = list(range(len(chosen)))

    if interactive_map:
        print("\n🧭 Download candidates (oldest -> newest):")
        for idx, cand in enumerate(chosen, start=1):
            mb = cand.size / 1024 / 1024
            ts = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cand.mtime))
            print(f"  [{idx}] {cand.path.name}  ({mb:.2f} MB, mtime={ts})")
        print("\n請輸入『對應 shot 的下載檔順序』：")
        print("- 例：你其實是先下載 shot1，後下載 shot2，最後 shot3 → 輸入：1,2,3")
        print("- 若你下載順序亂了（例如先下載了 shot3，再 shot1，再 shot2）→ 輸入：2,3,1")
        raw = input("mapping> ").strip()
        nums = [int(x) for x in raw.split(',') if x.strip().isdigit()]
        if len(nums) != len(chosen) or any(n < 1 or n > len(chosen) for n in nums):
            raise RuntimeError("Invalid mapping input")
        # mapping is list of indices into chosen, in shot order
        order = [n - 1 for n in nums]

    moved: List[Path] = []
    manifest: List[Dict[str, Any]] = []

    for shot_offset, chosen_idx in enumerate(order, start=0):
        cand = chosen[chosen_idx]
        shot_num = start_index + shot_offset
        ext = cand.path.suffix.lower()
        dest = output_dir / f"shot_{shot_num:03d}{ext}"

        # capture metadata BEFORE move
        entry = {
            "shot": shot_num,
            "source_name": cand.path.name,
            "source_path": str(cand.path),
            "source_mtime": cand.mtime,
            "source_size": cand.size,
            "dest_path": str(dest),
            "dest_ext": ext,
        }

        _move_rename(cand.path, dest, overwrite=overwrite)
        moved.append(dest)
        manifest.append(entry)
        print(f"✅ moved: {entry['source_name']} -> {dest}")

    if manifest_path:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "download_dir": str(download_dir),
            "output_dir": str(output_dir),
            "count": count,
            "start_index": start_index,
            "since_ts": since_ts,
            "interactive_map": interactive_map,
            "moved": manifest,
            "generated_at": time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        }
        manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n📋 downloads manifest written: {manifest_path}")

    return moved


def watch_mode(download_dir: Path, output_dir: Path, count: int, start_index: int, overwrite: bool,
               idle_poll: float = 0.5, since_ts: Optional[float] = None, manifest_path: Optional[Path] = None) -> List[Path]:
    """Continuously wait for new downloads, move each as it completes.

    - since_ts: if provided, ignore files modified before this timestamp.
    - manifest_path: if provided, append/update a downloads manifest as we move files.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # baseline snapshot
    seen = {p.name for p in download_dir.iterdir() if p.is_file()}
    moved: List[Path] = []

    manifest_entries: List[Dict[str, Any]] = []
    if manifest_path and manifest_path.exists():
        try:
            existing = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(existing, dict) and isinstance(existing.get("moved"), list):
                manifest_entries = list(existing["moved"])
        except Exception:
            pass

    print(f"👀 watching: {download_dir}")

    while len(moved) < count:
        # wait for a new file to appear
        current = {p.name for p in download_dir.iterdir() if p.is_file()}
        new_names = [n for n in current - seen if Path(n).suffix.lower() in VIDEO_EXTS]

        if new_names:
            # pick the newest among new ones
            new_files = [download_dir / n for n in new_names]
            new_files.sort(key=lambda p: p.stat().st_mtime)
            src = new_files[-1]

            if since_ts is not None and src.stat().st_mtime < since_ts:
                # ignore old file and continue watching
                seen.add(src.name)
                continue

            # wait for temp downloads to finish + file stabilize
            start_wait = time.time()
            while _has_active_download(download_dir):
                if time.time() - start_wait > 180:
                    break
                time.sleep(1)

            if not _wait_file_stable(src, stable_seconds=2, timeout_seconds=180):
                print(f"⚠️ file not stable in time: {src}")

            idx = start_index + len(moved)
            dest = output_dir / f"shot_{idx:03d}{src.suffix.lower()}"

            st = src.stat()
            entry = {
                "shot": idx,
                "source_name": src.name,
                "source_path": str(src),
                "source_mtime": st.st_mtime,
                "source_size": st.st_size,
                "dest_path": str(dest),
                "dest_ext": src.suffix.lower(),
            }

            _move_rename(src, dest, overwrite=overwrite)
            moved.append(dest)
            manifest_entries.append(entry)
            print(f"✅ moved: {src.name} -> {dest}")

            if manifest_path:
                payload = {
                    "download_dir": str(download_dir),
                    "output_dir": str(output_dir),
                    "count": count,
                    "start_index": start_index,
                    "since_ts": since_ts,
                    "interactive_map": False,
                    "moved": manifest_entries,
                    "generated_at": time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                }
                manifest_path.parent.mkdir(parents=True, exist_ok=True)
                manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

            seen = {p.name for p in download_dir.iterdir() if p.is_file()}
            continue

        time.sleep(idle_poll)

    return moved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download-dir", required=True, help="Browser download directory")
    ap.add_argument("--output-dir", required=True, help="Destination raw dir (workspace/output/raw)")
    ap.add_argument("--count", type=int, required=True, help="How many videos to move")
    ap.add_argument("--start-index", type=int, default=1, help="Start shot index")
    ap.add_argument("--since-minutes", type=int, default=60, help="Scan mode: only consider files modified within N minutes")
    ap.add_argument("--since-ts", type=float, default=None, help="Scan mode: only consider files modified after this unix timestamp (seconds)")
    ap.add_argument("--manifest", type=str, default=None, help="Write a downloads manifest JSON to this path")
    ap.add_argument("--watch", action="store_true", help="Watch mode: wait for new downloads and move one-by-one")
    ap.add_argument("--interactive-map", action="store_true", help="Scan mode: interactively map downloaded files to shot order (fix out-of-order downloads)")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing shot_XXX files")

    args = ap.parse_args()

    download_dir = Path(os.path.expanduser(args.download_dir)).resolve()
    output_dir = Path(os.path.expanduser(args.output_dir)).resolve()

    if not download_dir.exists():
        print(f"❌ download dir not found: {download_dir}")
        sys.exit(2)

    manifest_path = Path(os.path.expanduser(args.manifest)).resolve() if args.manifest else None

    if args.watch:
        moved = watch_mode(
            download_dir,
            output_dir,
            args.count,
            args.start_index,
            args.overwrite,
            since_ts=args.since_ts,
            manifest_path=manifest_path,
        )
    else:
        moved = scan_mode(
            download_dir,
            output_dir,
            args.count,
            args.start_index,
            args.since_minutes,
            args.overwrite,
            since_ts=args.since_ts,
            interactive_map=args.interactive_map,
            manifest_path=manifest_path,
        )

    print("\n📦 done")
    for p in moved:
        print(f"- {p}")


if __name__ == "__main__":
    main()
