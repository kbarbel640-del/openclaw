#!/usr/bin/env python3
"""
Sora API batch runner (OpenAI SDK)
Creates jobs for prompts, polls status, and downloads outputs.
Requires OPENAI_API_KEY and the openai Python package.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional


def _load_prompt_files(shots_dir: str) -> List[Path]:
    p = Path(shots_dir)
    if (p / "manifest.yaml").exists():
        # prefer manifest order
        import yaml
        with open(p / "manifest.yaml", "r", encoding="utf-8") as f:
            manifest = yaml.safe_load(f)
        files = []
        for shot in manifest.get("shots", []):
            files.append(p / shot["file"])
        return files
    return sorted(p.glob("shot_*.txt"))


def _read_text(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def _ensure_openai():
    try:
        import openai  # noqa: F401
        from openai import OpenAI  # type: ignore
        return OpenAI
    except Exception as e:
        print("❌ openai SDK not available:", e)
        print("請先安裝: pip install openai")
        sys.exit(1)


def _get_job_id(resp) -> Optional[str]:
    for key in ("id", "job_id", "video_id"):
        if isinstance(resp, dict) and key in resp:
            return resp[key]
        if hasattr(resp, key):
            return getattr(resp, key)
    return None


def _get_status(resp) -> str:
    for key in ("status", "state"):
        if isinstance(resp, dict) and key in resp:
            return resp[key]
        if hasattr(resp, key):
            return getattr(resp, key)
    return "unknown"


def _get_output_url(resp) -> Optional[str]:
    # try common shapes
    if isinstance(resp, dict):
        if "url" in resp:
            return resp["url"]
        if "output" in resp and isinstance(resp["output"], list) and resp["output"]:
            return resp["output"][0].get("url")
    if hasattr(resp, "url"):
        return getattr(resp, "url")
    if hasattr(resp, "output"):
        output = getattr(resp, "output")
        if isinstance(output, list) and output:
            return getattr(output[0], "url", None) or output[0].get("url")
    return None


def _download(url: str, dest: Path):
    import urllib.request
    with urllib.request.urlopen(url) as resp, open(dest, "wb") as f:
        f.write(resp.read())


def run(shots_dir: str, output_dir: str, model: str, seconds: str, size: str, poll_sec: int):
    if not os.environ.get("OPENAI_API_KEY"):
        print("❌ OPENAI_API_KEY not set")
        sys.exit(1)

    OpenAI = _ensure_openai()
    client = OpenAI()

    files = _load_prompt_files(shots_dir)
    if not files:
        print("⚠️ 沒有找到 prompts")
        sys.exit(1)

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    jobs: Dict[str, Dict[str, str]] = {}

    # Create jobs
    for idx, prompt_file in enumerate(files, start=1):
        prompt = _read_text(prompt_file)
        print(f"🎬 Create job: {prompt_file.name}")
        try:
            resp = client.videos.generate(
                model=model,
                prompt=prompt,
                seconds=seconds,
                size=size,
            )
        except Exception as e:
            print("❌ create failed:", e)
            sys.exit(1)

        job_id = _get_job_id(resp)
        if not job_id:
            print("❌ 無法取得 job id")
            sys.exit(1)
        jobs[job_id] = {"shot": f"shot_{idx:03d}.mp4"}

    # Poll
    pending = set(jobs.keys())
    while pending:
        done = set()
        for job_id in list(pending):
            try:
                resp = client.videos.retrieve(job_id)
            except Exception as e:
                print("⚠️ poll failed:", e)
                continue
            status = _get_status(resp)
            if status in ("succeeded", "completed", "done"):
                url = _get_output_url(resp)
                if url:
                    dest = out_dir / jobs[job_id]["shot"]
                    print(f"⬇️ download {dest.name}")
                    _download(url, dest)
                done.add(job_id)
            elif status in ("failed", "error"):
                print(f"❌ job failed: {job_id}")
                done.add(job_id)
        pending -= done
        if pending:
            time.sleep(poll_sec)


def main():
    if len(sys.argv) < 2:
        print("Usage: python sora_api_batch.py <shots_dir> [--output <dir>] [--model <name>] [--seconds <4|8|12>] [--size <WxH>] [--poll <sec>]")
        sys.exit(1)

    shots_dir = sys.argv[1]
    output_dir = "output/raw"
    model = "sora-2"
    seconds = "4"
    size = "1280x720"
    poll_sec = 10

    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_dir = sys.argv[idx + 1]
    if "--model" in sys.argv:
        idx = sys.argv.index("--model")
        if idx + 1 < len(sys.argv):
            model = sys.argv[idx + 1]
    if "--seconds" in sys.argv:
        idx = sys.argv.index("--seconds")
        if idx + 1 < len(sys.argv):
            seconds = sys.argv[idx + 1]
    if "--size" in sys.argv:
        idx = sys.argv.index("--size")
        if idx + 1 < len(sys.argv):
            size = sys.argv[idx + 1]
    if "--poll" in sys.argv:
        idx = sys.argv.index("--poll")
        if idx + 1 < len(sys.argv):
            poll_sec = int(sys.argv[idx + 1])

    run(shots_dir, output_dir, model, seconds, size, poll_sec)


if __name__ == "__main__":
    main()
