#!/usr/bin/env python3
"""
BG666 Demand Tracker
Polls telegram-userbot once, then summarizes new inbox messages.
"""

import argparse
import json
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

TPE = timezone(timedelta(hours=8))
CLAWD = Path.home() / "clawd"
INBOX_DIR = CLAWD / "inbox" / "bg666"
STATE_FILE = Path("/tmp/clawd_bg666_demand_state.json")
TASKS_FILE = CLAWD / "BG666_TASKS.md"
MESSAGE_ROUTER = CLAWD / "scripts" / "message_router.py"


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
    return {"last_seen": None}


def _save_state(state):
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"state:WARN {e}")


def _time_ago(dt):
    if not dt:
        return "未知"
    delta = datetime.now(TPE) - dt
    if delta.days > 0:
        return f"{delta.days}d前"
    hours = delta.seconds // 3600
    if hours > 0:
        return f"{hours}h前"
    mins = delta.seconds // 60
    return f"{mins}m前"


def _poll_router():
    if not MESSAGE_ROUTER.exists():
        return False, "message_router.py not found"
    try:
        result = subprocess.run(
            ["python3", str(MESSAGE_ROUTER), "--once"],
            capture_output=True,
            text=True,
            timeout=20,
        )
        ok = result.returncode == 0
        msg = result.stdout.strip() or result.stderr.strip()
        return ok, msg
    except Exception as e:
        return False, str(e)


def _scan_inbox(since_dt):
    if not INBOX_DIR.exists():
        return [], None
    entries = []
    latest = since_dt
    for path in sorted(INBOX_DIR.glob("*.jsonl")):
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
            entries.append({**obj, "_ts": ts})
            if latest is None or ts > latest:
                latest = ts
    return entries, latest


def _tasks_mtime():
    if not TASKS_FILE.exists():
        return None
    return datetime.fromtimestamp(TASKS_FILE.stat().st_mtime, TPE)


def main():
    parser = argparse.ArgumentParser(description="BG666 demand tracker")
    parser.add_argument("--poll", action="store_true", help="Poll telegram-userbot once")
    parser.add_argument("--update", action="store_true", help="Update BG666_TASKS.md summary block")
    args = parser.parse_args()

    if args.poll:
        ok, msg = _poll_router()
        status = "OK" if ok else "WARN"
        if msg:
            print(f"router:{status} {msg}")

    state = _load_state()
    last_seen = _parse_dt(state.get("last_seen"))

    entries, latest = _scan_inbox(last_seen)
    count = len(entries)

    print("📋 BG666 需求追蹤")
    if count == 0:
        print("新消息：0")
    else:
        print(f"新消息：{count}")

    # Summaries
    if entries:
        senders = {}
        chats = {}
        for e in entries:
            sender = e.get("sender") or "unknown"
            chat = e.get("chat_name") or "unknown"
            senders[sender] = senders.get(sender, 0) + 1
            chats[chat] = chats.get(chat, 0) + 1
        top_senders = sorted(senders.items(), key=lambda x: x[1], reverse=True)[:5]
        top_chats = sorted(chats.items(), key=lambda x: x[1], reverse=True)[:5]
        print("Top senders: " + ", ".join([f"{s}({n})" for s, n in top_senders]))
        print("Top chats: " + ", ".join([f"{c}({n})" for c, n in top_chats]))

    # Tasks freshness
    tasks_mtime = _tasks_mtime()
    tasks_age = _time_ago(tasks_mtime)
    print(f"BG666_TASKS.md：{tasks_age} 更新")

    if count > 0:
        print("建議：如有新需求，更新 BG666_TASKS.md 並推送彙整")

    if latest:
        state["last_seen"] = latest.isoformat()
        _save_state(state)

    if args.update:
        _update_tasks(entries, top_senders if entries else [], top_chats if entries else [])

    return 0


def _update_tasks(entries, top_senders, top_chats):
    if not TASKS_FILE.exists():
        print("tasks:WARN BG666_TASKS.md not found")
        return

    now = datetime.now(TPE)
    timestamp = now.strftime("%Y-%m-%d %H:%M TPE")

    def _clean_text(text):
        t = (text or "").replace("\n", " ").replace("\r", " ").strip()
        return " ".join(t.split())[:120]

    # Build summary block
    lines = []
    lines.append("<!-- AUTO-DEMAND-START -->")
    lines.append(f"## 🔄 自動摘要（{timestamp}）")
    lines.append(f"- 新消息: {len(entries)}")
    if top_senders:
        lines.append("- Top senders: " + ", ".join([f"{s}({n})" for s, n in top_senders]))
    if top_chats:
        lines.append("- Top chats: " + ", ".join([f"{c}({n})" for c, n in top_chats]))

    samples = entries[:5] if entries else []
    for i, e in enumerate(samples, 1):
        chat = e.get("chat_name") or "unknown"
        sender = e.get("sender") or "unknown"
        text = _clean_text(e.get("text", ""))
        lines.append(f"- 示例{i}: [{chat}] {sender}: {text}")

    lines.append("<!-- AUTO-DEMAND-END -->")
    block = "\n".join(lines)

    content = TASKS_FILE.read_text()
    if "<!-- AUTO-DEMAND-START -->" in content and "<!-- AUTO-DEMAND-END -->" in content:
        start = content.index("<!-- AUTO-DEMAND-START -->")
        end = content.index("<!-- AUTO-DEMAND-END -->") + len("<!-- AUTO-DEMAND-END -->")
        content = content[:start] + block + content[end:]
    else:
        # Insert after header and update line if present
        parts = content.splitlines()
        insert_at = 0
        for i, line in enumerate(parts):
            if line.startswith("# "):
                insert_at = i + 1
                continue
            if line.startswith("> 更新："):
                parts[i] = f"> 更新：{timestamp}"
                insert_at = i + 1
                continue
            if line.strip() == "":
                insert_at = i + 1
                continue
            break
        parts.insert(insert_at, block)
        content = "\n".join(parts)

    try:
        TASKS_FILE.write_text(content + ("\n" if not content.endswith("\n") else ""))
    except Exception as e:
        print(f"tasks:WARN {e}")


if __name__ == "__main__":
    raise SystemExit(main())
