#!/usr/bin/env python3
"""
Demand Tracker (generic)
Scans inbox/<session> and updates mapped task files with an AUTO-DEMAND summary block.
"""

import argparse
import json
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

TPE = timezone(timedelta(hours=8))
CLAWD = Path.home() / "clawd"
INBOX_ROOT = CLAWD / "inbox"
STATE_FILE = CLAWD / "memory" / "demand_state.json"
CONFIG_FILE = CLAWD / "configs" / "demand_map.json"
MESSAGE_ROUTER = CLAWD / "scripts" / "message_router.py"


def _now_str():
    return datetime.now(TPE).strftime("%Y-%m-%d %H:%M TPE")


def _parse_dt(text: str):
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=TPE)
    except Exception:
        return None


def _load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"sessions": {}}


def _save_state(state):
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"state:WARN {e}")


def _default_config():
    return {
        "version": 1,
        "defaults": {
            "tasks_dir": "~/clawd/tasks",
            "summary_limit": 5,
            "update_on_new_only": True
        },
        "sessions": {
            "bg666": {"task_file": "~/clawd/BG666_TASKS.md"},
            "main": {"task_file": "~/clawd/TASKS.md"}
        }
    }


def _load_config():
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text())
        except Exception:
            pass
    cfg = _default_config()
    _bootstrap_config(cfg)
    return cfg


def _bootstrap_config(cfg):
    try:
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        # Auto-add inbox folders not yet mapped
        if INBOX_ROOT.exists():
            for d in INBOX_ROOT.iterdir():
                if d.is_dir():
                    cfg["sessions"].setdefault(d.name, {})
        CONFIG_FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"config:WARN {e}")


def _resolve_task_path(cfg, session_name):
    session_cfg = cfg.get("sessions", {}).get(session_name, {})
    task_file = session_cfg.get("task_file", "")
    if task_file:
        return Path(task_file).expanduser()
    tasks_dir = Path(cfg.get("defaults", {}).get("tasks_dir", "~/clawd/tasks")).expanduser()
    return tasks_dir / f"{session_name}.md"


def _poll_router():
    if not MESSAGE_ROUTER.exists():
        return False, "message_router.py not found"
    try:
        result = subprocess.run(
            ["python3", str(MESSAGE_ROUTER), "--once"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        ok = result.returncode == 0
        msg = result.stdout.strip() or result.stderr.strip()
        return ok, msg
    except Exception as e:
        return False, str(e)


def _scan_inbox(session_name, since_dt):
    session_dir = INBOX_ROOT / session_name
    if not session_dir.exists():
        return [], None
    entries = []
    latest = since_dt
    for path in sorted(session_dir.glob("*.jsonl")):
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            ts = _parse_dt(obj.get("timestamp"))
            if not ts:
                continue
            if since_dt and ts <= since_dt:
                continue
            obj["_ts"] = ts
            entries.append(obj)
            if latest is None or ts > latest:
                latest = ts
    return entries, latest


def _clean_text(text):
    t = (text or "").replace("\n", " ").replace("\r", " ").strip()
    return " ".join(t.split())[:120]


def _ensure_file_header(task_path, session_name, timestamp):
    if task_path.exists():
        return task_path.read_text()
    title = f"# {session_name} 需求追蹤"
    content = f"{title}\n\n> 更新：{timestamp}\n\n"
    return content


def _update_task_file(task_path, session_name, entries, summary_limit, timestamp):
    task_path.parent.mkdir(parents=True, exist_ok=True)
    content = _ensure_file_header(task_path, session_name, timestamp)

    # Update or insert update line
    lines = content.splitlines()
    updated = False
    for i, line in enumerate(lines):
        if line.startswith("> 更新："):
            lines[i] = f"> 更新：{timestamp}"
            updated = True
            break
    if not updated:
        # insert after title
        for i, line in enumerate(lines):
            if line.startswith("# "):
                lines.insert(i + 1, "")
                lines.insert(i + 2, f"> 更新：{timestamp}")
                lines.insert(i + 3, "")
                break
        content = "\n".join(lines)
    else:
        content = "\n".join(lines)

    # Build summary block
    senders = {}
    chats = {}
    for e in entries:
        sender = e.get("sender") or "unknown"
        chat = e.get("chat_name") or "unknown"
        senders[sender] = senders.get(sender, 0) + 1
        chats[chat] = chats.get(chat, 0) + 1
    top_senders = sorted(senders.items(), key=lambda x: x[1], reverse=True)[:5]
    top_chats = sorted(chats.items(), key=lambda x: x[1], reverse=True)[:5]

    block_lines = []
    block_lines.append("<!-- AUTO-DEMAND-START -->")
    block_lines.append(f"## 🔄 自動摘要（{timestamp}）")
    block_lines.append(f"- 新消息: {len(entries)}")
    if top_senders:
        block_lines.append("- Top senders: " + ", ".join([f"{s}({n})" for s, n in top_senders]))
    if top_chats:
        block_lines.append("- Top chats: " + ", ".join([f"{c}({n})" for c, n in top_chats]))
    for i, e in enumerate(entries[:summary_limit], 1):
        chat = e.get("chat_name") or "unknown"
        sender = e.get("sender") or "unknown"
        text = _clean_text(e.get("text", ""))
        block_lines.append(f"- 示例{i}: [{chat}] {sender}: {text}")
    block_lines.append("<!-- AUTO-DEMAND-END -->")
    block = "\n".join(block_lines)

    if "<!-- AUTO-DEMAND-START -->" in content and "<!-- AUTO-DEMAND-END -->" in content:
        start = content.index("<!-- AUTO-DEMAND-START -->")
        end = content.index("<!-- AUTO-DEMAND-END -->") + len("<!-- AUTO-DEMAND-END -->")
        content = content[:start] + block + content[end:]
    else:
        # insert after update line block
        content = content.rstrip() + "\n\n" + block + "\n"

    try:
        task_path.write_text(content + ("\n" if not content.endswith("\n") else ""))
    except Exception as e:
        print(f"tasks:WARN {task_path} {e}")


def main():
    parser = argparse.ArgumentParser(description="Generic demand tracker")
    parser.add_argument("--poll", action="store_true", help="Poll telegram-userbot once")
    parser.add_argument("--update", action="store_true", help="Update task files")
    parser.add_argument("--session", action="append", help="Limit to session(s)")
    args = parser.parse_args()

    if args.poll:
        ok, msg = _poll_router()
        status = "OK" if ok else "WARN"
        if msg:
            print(f"router:{status} {msg}")

    cfg = _load_config()
    defaults = cfg.get("defaults", {})
    summary_limit = int(defaults.get("summary_limit", 5))
    update_on_new_only = bool(defaults.get("update_on_new_only", True))

    state = _load_state()
    state.setdefault("sessions", {})

    sessions = list(cfg.get("sessions", {}).keys())
    if args.session:
        # allow comma separated
        requested = []
        for s in args.session:
            requested.extend([x.strip() for x in s.split(",") if x.strip()])
        sessions = [s for s in sessions if s in requested]

    for session_name in sessions:
        last_seen = _parse_dt(state["sessions"].get(session_name))
        entries, latest = _scan_inbox(session_name, last_seen)
        if update_on_new_only and not entries:
            continue
        task_path = _resolve_task_path(cfg, session_name)
        if args.update:
            _update_task_file(task_path, session_name, entries, summary_limit, _now_str())
        if latest:
            state["sessions"][session_name] = latest.isoformat()

    _save_state(state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
