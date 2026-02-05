#!/usr/bin/env python3
"""Scan inbox logs for potential unreplied user messages.

Goal: fast, low-risk detection of "should reply but didn't" situations.

Data source: ~/clawd/inbox/**/*.jsonl (router/userbot style logs)
Each line is expected to be a JSON object containing:
  - timestamp (ISO)
  - chat_id
  - chat_name
  - message_id (optional)
  - sender
  - text

Heuristic (configurable): flag chats where the latest non-assistant message is newer
than the latest assistant message, and the message looks like a question/command.

Exit codes:
  0: no findings
  2: findings present
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

ROOT = Path.home() / "clawd"
INBOX_DIR = ROOT / "inbox"

ASSISTANT_NAMES = {"無極", "Wuji", "wuji", "assistant", "clawdbot"}

# Very simple intent heuristic: tweak as needed.
INTENT_RE = re.compile(
    r"(@|\?|？|請|麻煩|幫|協助|去查|查一下|為何|怎麼|什麼|哪裡|在嗎|可以嗎|要嗎|需要|處理|看看|/\w+)")

SPAM_RE = re.compile(r"(招聘|远程|驻场|薪资|t\.me/|http)" , re.IGNORECASE)


@dataclass
class Msg:
    ts: datetime
    chat_id: str
    chat_name: str
    sender: str
    text: str
    message_id: Optional[int]
    raw: dict[str, Any]


def _parse_dt(s: str) -> Optional[datetime]:
    # accepts 2026-02-04T15:43:58.720752+08:00
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _load_jsonl(path: Path):
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


def _looks_intent(text: str) -> bool:
    if not text:
        return False
    return bool(INTENT_RE.search(text))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=int, default=120, help="Lookback window")
    ap.add_argument("--limit", type=int, default=20000, help="Max lines to scan total")
    ap.add_argument("--json", action="store_true", help="Output JSON")
    args = ap.parse_args()

    now = datetime.now().astimezone()
    cutoff = now - timedelta(minutes=args.minutes)

    lines_scanned = 0

    latest_user: dict[str, Msg] = {}
    latest_bot: dict[str, Msg] = {}

    for jsonl in sorted(INBOX_DIR.rglob("*.jsonl")):
        # skip giant archives outside window quickly by mtime if desired (cheap guard)
        try:
            if datetime.fromtimestamp(jsonl.stat().st_mtime).astimezone() < cutoff:
                continue
        except Exception:
            pass

        for obj in _load_jsonl(jsonl):
            lines_scanned += 1
            if lines_scanned > args.limit:
                break

            ts = _parse_dt(obj.get("timestamp", ""))
            if not ts:
                continue
            if ts < cutoff:
                continue

            chat_id = str(obj.get("chat_id", ""))
            chat_name = str(obj.get("chat_name", ""))
            sender = str(obj.get("sender", ""))
            text = str(obj.get("text", "") or "")
            mid = obj.get("message_id")
            try:
                mid = int(mid) if mid is not None else None
            except Exception:
                mid = None

            m = Msg(ts=ts, chat_id=chat_id, chat_name=chat_name, sender=sender, text=text, message_id=mid, raw=obj)

            if sender in ASSISTANT_NAMES:
                cur = latest_bot.get(chat_id)
                if (cur is None) or (m.ts > cur.ts):
                    latest_bot[chat_id] = m
            else:
                cur = latest_user.get(chat_id)
                if (cur is None) or (m.ts > cur.ts):
                    latest_user[chat_id] = m

        if lines_scanned > args.limit:
            break

    findings = []
    IGNORE_EXACT = {"/newww"}

    for chat_id, umsg in latest_user.items():
        bmsg = latest_bot.get(chat_id)

        # Ignore known non-action commands that are handled elsewhere.
        if umsg.text.strip() in IGNORE_EXACT:
            continue

        # Prefer message_id ordering if available.
        if bmsg and (bmsg.message_id is not None) and (umsg.message_id is not None):
            if bmsg.message_id > umsg.message_id:
                continue  # replied after
        else:
            if bmsg and bmsg.ts >= umsg.ts:
                continue  # replied after (fallback to timestamp)

        # If the last user msg doesn't look like it needs a response, ignore.
        if not _looks_intent(umsg.text):
            continue

        # Heuristic spam ignore (e.g., recruiting ads in large groups).
        if SPAM_RE.search(umsg.text):
            continue

        findings.append(
            {
                "chat_id": chat_id,
                "chat_name": umsg.chat_name,
                "last_user_ts": umsg.ts.isoformat(),
                "last_user_sender": umsg.sender,
                "last_user_text": (umsg.text[:200] + "…") if len(umsg.text) > 200 else umsg.text,
                "last_bot_ts": bmsg.ts.isoformat() if bmsg else None,
                "source": "inbox_jsonl",
            }
        )

    findings.sort(key=lambda x: x["last_user_ts"], reverse=True)

    if args.json:
        print(json.dumps({"cutoff": cutoff.isoformat(), "findings": findings}, ensure_ascii=False, indent=2))
    else:
        if not findings:
            print(f"OK: no suspected leaks (window={args.minutes}m, scanned={lines_scanned} lines)")
        else:
            print(f"ALERT: suspected unreplied sessions={len(findings)} (window={args.minutes}m, scanned={lines_scanned} lines)\n")
            for i, f in enumerate(findings, 1):
                print(f"{i}. {f['chat_name']} ({f['chat_id']})")
                print(f"   user: {f['last_user_sender']} @ {f['last_user_ts']}")
                print(f"   text: {f['last_user_text']}")
                print(f"   last_bot: {f['last_bot_ts']}\n")

    raise SystemExit(2 if findings else 0)


if __name__ == "__main__":
    main()
