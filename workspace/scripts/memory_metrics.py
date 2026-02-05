#!/usr/bin/env python3
"""
Memory Metrics Phase 1 — Passive Collection
Collects metrics from existing data without changing behavior.
Run during heartbeat to build up daily metrics.
"""

import json
import os
import re
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

WORKSPACE = Path(os.environ.get("WORKSPACE", "/home/node/clawd"))
MEMORY_DIR = WORKSPACE / "memory"
METRICS_DIR = MEMORY_DIR / "metrics" / "daily"
ERRORS_DIR = MEMORY_DIR / "metrics" / "errors"
SKILLS_DIR = WORKSPACE / "skills"
MEMORY_MD = WORKSPACE / "MEMORY.md"

TPE = timezone(timedelta(hours=8))

def ensure_dirs():
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    ERRORS_DIR.mkdir(parents=True, exist_ok=True)

def today_str():
    return datetime.now(TPE).strftime("%Y-%m-%d")

def count_daily_lines(date_str):
    """Count lines in today's daily log."""
    p = MEMORY_DIR / f"{date_str}.md"
    if not p.exists():
        return 0
    return len(p.read_text().splitlines())

def memory_md_stats():
    """Get MEMORY.md stats."""
    if not MEMORY_MD.exists():
        return {"lines": 0, "last_modified": None, "size_bytes": 0}
    stat = MEMORY_MD.stat()
    return {
        "lines": len(MEMORY_MD.read_text().splitlines()),
        "last_modified": datetime.fromtimestamp(stat.st_mtime, TPE).isoformat(),
        "size_bytes": stat.st_size
    }

def count_skills():
    """Count total skills and detect recent changes."""
    if not SKILLS_DIR.exists():
        return {"total": 0, "names": []}
    skills = [d.name for d in SKILLS_DIR.iterdir() if d.is_dir() and (d / "SKILL.md").exists()]
    return {"total": len(skills), "names": sorted(skills)}

def extract_errors_from_daily(date_str):
    """Extract error/correction entries from daily log."""
    p = MEMORY_DIR / f"{date_str}.md"
    if not p.exists():
        return []
    text = p.read_text()
    errors = []
    error_keywords = ["教訓", "糾正", "錯誤", "犯錯", "被糾正", "修正", "wrong", "mistake"]
    for line in text.splitlines():
        if any(kw in line for kw in error_keywords):
            errors.append(line.strip())
    return errors

def extract_importance_from_daily(date_str):
    """Count entries by importance tag [I:N] if present, otherwise estimate."""
    p = MEMORY_DIR / f"{date_str}.md"
    if not p.exists():
        return {"tagged": 0, "untagged": 0, "distribution": {}}
    text = p.read_text()
    tagged = 0
    untagged = 0
    dist = {}
    # Count ### headers as entries
    entries = [l for l in text.splitlines() if l.startswith("### ")]
    for entry in entries:
        match = re.search(r'\[I:(\d+)\]', entry)
        if match:
            score = int(match.group(1))
            tagged += 1
            dist[str(score)] = dist.get(str(score), 0) + 1
        else:
            untagged += 1
    return {"tagged": tagged, "untagged": untagged, "distribution": dist}

def git_commit_count_today(date_str):
    """Count git commits from today."""
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", f"--since={date_str}", f"--until={date_str} 23:59:59"],
            capture_output=True, text=True, cwd=str(WORKSPACE), timeout=10
        )
        if result.returncode == 0:
            lines = [l for l in result.stdout.strip().splitlines() if l]
            return len(lines)
    except:
        pass
    return 0

def git_skills_used_today(date_str):
    """Scan git log for skill references."""
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", f"--since={date_str}", f"--until={date_str} 23:59:59"],
            capture_output=True, text=True, cwd=str(WORKSPACE), timeout=10
        )
        if result.returncode == 0:
            text = result.stdout.lower()
            skills_info = count_skills()
            used = [s for s in skills_info["names"] if s.lower() in text]
            return used
    except:
        pass
    return []

def memory_file_count():
    """Count total memory files."""
    if not MEMORY_DIR.exists():
        return 0
    return len(list(MEMORY_DIR.glob("*.md")))

def load_error_registry():
    """Load or create error registry."""
    reg_path = ERRORS_DIR / "error_registry.json"
    if reg_path.exists():
        return json.loads(reg_path.read_text())
    return {"errors": [], "last_updated": None}

def update_error_registry(date_str, new_errors):
    """Update error registry with today's errors."""
    reg = load_error_registry()
    for err in new_errors:
        reg["errors"].append({
            "date": date_str,
            "text": err[:200],
            "repeated": False
        })
    reg["last_updated"] = datetime.now(TPE).isoformat()
    reg_path = ERRORS_DIR / "error_registry.json"
    reg_path.write_text(json.dumps(reg, ensure_ascii=False, indent=2))
    return reg

def collect_metrics():
    """Collect all Phase 1 metrics."""
    ensure_dirs()
    date_str = today_str()
    
    daily_lines = count_daily_lines(date_str)
    mem_stats = memory_md_stats()
    skills = count_skills()
    errors = extract_errors_from_daily(date_str)
    importance = extract_importance_from_daily(date_str)
    commits = git_commit_count_today(date_str)
    skills_used = git_skills_used_today(date_str)
    mem_files = memory_file_count()
    
    # Update error registry
    if errors:
        reg = update_error_registry(date_str, errors)
        error_count = len(reg["errors"])
        repeated = sum(1 for e in reg["errors"] if e.get("repeated", False))
    else:
        error_count = len(load_error_registry().get("errors", []))
        repeated = 0
    
    metrics = {
        "date": date_str,
        "collected_at": datetime.now(TPE).isoformat(),
        "memory": {
            "daily_lines": daily_lines,
            "daily_entries": importance["tagged"] + importance["untagged"],
            "importance_tagged": importance["tagged"],
            "importance_untagged": importance["untagged"],
            "importance_distribution": importance["distribution"],
            "memory_md_lines": mem_stats["lines"],
            "memory_md_size_bytes": mem_stats["size_bytes"],
            "memory_md_last_modified": mem_stats["last_modified"],
            "total_memory_files": mem_files
        },
        "errors": {
            "corrections_today": len(errors),
            "total_registered": error_count,
            "repeated": repeated,
            "today_errors": errors[:10]  # cap at 10
        },
        "skills": {
            "total": skills["total"],
            "used_today": skills_used,
            "used_count": len(skills_used)
        },
        "git": {
            "commits_today": commits
        },
        "recall": {
            "searches": 0,
            "results_used": 0,
            "precision": None,
            "_note": "Phase 2: will be populated when recall logging is active"
        },
        "sessions": {
            "_note": "Phase 2: will be populated from sessions_list API"
        }
    }
    
    # Write daily metrics
    out_path = METRICS_DIR / f"{date_str}.json"
    
    # If file exists, merge (keep highest values for counters)
    if out_path.exists():
        existing = json.loads(out_path.read_text())
        # Update with latest snapshot
        metrics["_previous_snapshots"] = existing.get("_previous_snapshots", 0) + 1
    
    out_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2))
    return metrics

def print_summary(m):
    """Print human-readable summary."""
    print(f"📊 記憶指標 — {m['date']}")
    print(f"📝 Daily log: {m['memory']['daily_lines']} 行 | {m['memory']['daily_entries']} 條目")
    
    imp = m['memory']['importance_distribution']
    if imp:
        print(f"⭐ Importance: {imp}")
    else:
        print(f"⭐ Importance: 尚未標記（{m['memory']['importance_untagged']} 條未標）")
    
    print(f"🧠 MEMORY.md: {m['memory']['memory_md_lines']} 行 | {m['memory']['total_memory_files']} 個記憶檔")
    print(f"🔧 Skills: {m['skills']['total']} 個 | 今日使用: {m['skills']['used_today'] or '無'}")
    print(f"📦 Git: {m['git']['commits_today']} commits")
    print(f"⚠️ Errors: 今日 {m['errors']['corrections_today']} | 累計 {m['errors']['total_registered']} | 重複 {m['errors']['repeated']}")

if __name__ == "__main__":
    metrics = collect_metrics()
    print_summary(metrics)
