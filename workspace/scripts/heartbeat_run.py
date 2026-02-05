#!/usr/bin/env python3
"""Heartbeat runner with throttling and tiered tasks."""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPTS_DIR.parent

# Allow importing heartbeat_state from the same folder
sys.path.insert(0, str(SCRIPTS_DIR))
import heartbeat_state  # noqa: E402


def _run_cmd(cmd, timeout=60):
    start = time.time()
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=isinstance(cmd, str),
        )
        duration_ms = int((time.time() - start) * 1000)
        ok = result.returncode == 0
        return ok, result.stdout.strip(), result.stderr.strip(), duration_ms
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        return False, "", str(e), duration_ms


def _missing_env(vars_required):
    return [v for v in vars_required if not os.getenv(v)]


def _task_defs():
    health_check = ["python3", str(SCRIPTS_DIR / "health_check.py")]
    growth_tracker = ["python3", str(SCRIPTS_DIR / "growth_tracker.py")]
    memory_metrics = ["python3", str(SCRIPTS_DIR / "memory_metrics.py")]
    session_leak_scan = ["python3", str(SCRIPTS_DIR / "session_leak_scan.py"), "--minutes", "180"]

    github_token = os.getenv("GITHUB_TOKEN", "")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")

    pipeline_cmds = [
        [
            "curl",
            "-s",
            "-H",
            f"Authorization: token {github_token}",
            "https://api.github.com/repos/ThinkerCafe-tw/thinker-news/actions/runs?per_page=1",
        ],
        [
            "curl",
            "-s",
            "-H",
            f"Authorization: token {github_token}",
            "https://api.github.com/repos/ThinkerCafe-tw/maryos/actions/runs?per_page=1",
        ],
        [
            "curl",
            "-s",
            "-H",
            f"Authorization: token {github_token}",
            "https://api.github.com/repos/ThinkerCafe-tw/paomateng/actions/runs?per_page=1",
        ],
    ]

    deepseek_cmd = [
        "curl",
        "-s",
        "-H",
        f"Authorization: Bearer {deepseek_key}",
        "https://api.deepseek.com/user/balance",
    ]

    project_rotation = ["python3", str(SCRIPTS_DIR / "project_rotation.py"), "--count", "2", "--update"]
    demand_tracking = ["python3", str(SCRIPTS_DIR / "demand_tracker.py"), "--poll", "--update"]
    heartbeat_report = ["python3", str(SCRIPTS_DIR / "heartbeat_dashboard.py"), "report"]

    return [
        {
            "name": "health_check",
            "tier": "critical",
            "min_interval": 60,
            "commands": [health_check],
            "timeout": 30,
            "requires_env": [],
        },
        {
            "name": "growth_tracker",
            "tier": "critical",
            "min_interval": 300,
            "commands": [growth_tracker],
            "timeout": 30,
            "requires_env": [],
        },
        {
            "name": "memory_metrics",
            "tier": "critical",
            "min_interval": 300,
            "commands": [memory_metrics],
            "timeout": 30,
            "requires_env": [],
        },
        {
            "name": "session_leak_scan",
            "tier": "critical",
            "min_interval": 60,
            "commands": [session_leak_scan],
            "timeout": 30,
            "requires_env": [],
        },
        {
            "name": "pipelines",
            "tier": "critical",
            "min_interval": 300,
            "commands": pipeline_cmds,
            "timeout": 15,
            "requires_env": ["GITHUB_TOKEN"],
        },
        {
            "name": "deepseek_balance",
            "tier": "critical",
            "min_interval": 900,
            "commands": [deepseek_cmd],
            "timeout": 10,
            "requires_env": ["DEEPSEEK_API_KEY"],
        },
        {
            "name": "project_rotation",
            "tier": "standard",
            "min_interval": 900,
            "commands": [project_rotation],
            "timeout": 15,
            "requires_env": [],
        },
        {
            "name": "demand_tracking",
            "tier": "standard",
            "min_interval": 900,
            "commands": [demand_tracking],
            "timeout": 45,
            "requires_env": [],
        },
        {
            "name": "heartbeat_report",
            "tier": "slow",
            "min_interval": 14400,
            "commands": [heartbeat_report],
            "timeout": 30,
            "requires_env": [],
        },
    ]


def main(argv):
    parser = argparse.ArgumentParser(description="Heartbeat runner")
    parser.add_argument(
        "--tier",
        default="critical",
        choices=["critical", "standard", "slow", "all"],
        help="Task tier to run",
    )
    parser.add_argument("--force", action="store_true", help="Ignore throttling")
    parser.add_argument("--dry-run", action="store_true", help="Show what would run")
    parser.add_argument("--list", action="store_true", help="List available tasks")
    args = parser.parse_args(argv)

    tasks = _task_defs()

    if args.list:
        for t in tasks:
            print(f"{t['name']}: tier={t['tier']} min={t['min_interval']}s")
        return 0

    if args.tier == "all":
        selected = tasks
    else:
        selected = [t for t in tasks if t["tier"] == args.tier]

    if not selected:
        print("No tasks selected")
        return 1

    summary = []
    for t in selected:
        missing = _missing_env(t["requires_env"])
        if missing:
            msg = f"skip {t['name']}: missing env {', '.join(missing)}"
            print(msg)
            heartbeat_state.record(t["name"], False, error=f"missing_env:{','.join(missing)}")
            summary.append(msg)
            continue

        if not args.force:
            should = heartbeat_state.should_run(t["name"], t["min_interval"])
            if not should:
                msg = f"skip {t['name']}: throttled"
                print(msg)
                summary.append(msg)
                continue

        if args.dry_run:
            msg = f"run {t['name']} (dry)"
            print(msg)
            summary.append(msg)
            continue

        ok = True
        err = ""
        total_ms = 0
        for cmd in t["commands"]:
            c_ok, out, c_err, dur = _run_cmd(cmd, timeout=t["timeout"])
            total_ms += dur
            if not c_ok:
                ok = False
                err = c_err or out
                break

        heartbeat_state.record(t["name"], ok, error=(err if not ok else None), duration_ms=total_ms)
        status = "ok" if ok else "fail"
        msg = f"{t['name']}: {status} ({total_ms}ms)"
        print(msg)
        summary.append(msg)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
