#!/usr/bin/env python3
"""讀取指定聊天的歷史訊息"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from datetime import datetime
from telethon import TelegramClient

# 預設使用 two 專案的設定
DEFAULT_CONFIG = Path.home() / "Documents/two/mcp-telegram/config.json"
DEFAULT_SESSION_DIR = Path.home() / "Documents/two/mcp-telegram/session"


def load_config(config_path: Path) -> dict:
    with open(config_path) as f:
        return json.load(f)


async def resolve_chat(client: TelegramClient, chat: str):
    """解析聊天 ID 或名稱"""
    # 純數字：當作 chat ID
    if chat.lstrip('-').isdigit():
        return await client.get_entity(int(chat))
    # @ 開頭：當作 username
    if chat.startswith('@'):
        return await client.get_entity(chat)
    # 其他：嘗試搜尋
    dialogs = await client.get_dialogs(limit=100)
    for d in dialogs:
        if chat.lower() in d.name.lower():
            return d.entity
    raise ValueError(f"找不到聊天：{chat}")


async def read_messages(client: TelegramClient, chat: str, limit: int = 20, search: str = None):
    """讀取訊息"""
    entity = await resolve_chat(client, chat)
    
    if search:
        messages = await client.get_messages(entity, limit=limit, search=search)
    else:
        messages = await client.get_messages(entity, limit=limit)
    
    results = []
    for msg in messages:
        sender_name = ""
        if msg.sender:
            sender_name = getattr(msg.sender, 'first_name', '') or \
                         getattr(msg.sender, 'title', '') or \
                         str(msg.sender_id)
        
        results.append({
            "id": msg.id,
            "date": msg.date.isoformat() if msg.date else None,
            "sender": sender_name,
            "sender_id": msg.sender_id,
            "text": msg.text or "",
            "has_media": msg.media is not None
        })
    
    return results


def format_message(msg: dict, verbose: bool = False) -> str:
    """格式化單條訊息"""
    date = datetime.fromisoformat(msg["date"]).strftime("%m-%d %H:%M") if msg["date"] else "???"
    sender = msg["sender"][:15].ljust(15)
    text = msg["text"][:200] if msg["text"] else "[媒體]"
    
    if verbose:
        return f"[{msg['id']}] {date} | {sender} | {text}"
    return f"{date} | {sender}: {text}"


async def main():
    parser = argparse.ArgumentParser(description="讀取 Telegram 聊天訊息")
    parser.add_argument("chat", help="聊天名稱、ID 或 @username")
    parser.add_argument("--limit", "-l", type=int, default=20, help="訊息數量")
    parser.add_argument("--search", "-s", help="搜尋關鍵字")
    parser.add_argument("--json", "-j", action="store_true", help="JSON 輸出")
    parser.add_argument("--verbose", "-v", action="store_true", help="詳細輸出（含 msg ID）")
    parser.add_argument("--reverse", "-r", action="store_true", help="時間正序（舊→新）")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="設定檔路徑")
    args = parser.parse_args()
    
    config = load_config(args.config)
    session_path = DEFAULT_SESSION_DIR / config["session_name"]
    
    client = TelegramClient(str(session_path), config["api_id"], config["api_hash"])
    await client.connect()
    
    if not await client.is_user_authorized():
        print("錯誤：未登入。請先執行 auth.py", file=sys.stderr)
        sys.exit(1)
    
    try:
        messages = await read_messages(client, args.chat, args.limit, args.search)
        
        if args.reverse:
            messages = list(reversed(messages))
        
        if args.json:
            print(json.dumps(messages, ensure_ascii=False, indent=2))
        else:
            for msg in messages:
                print(format_message(msg, args.verbose))
                if not args.verbose:
                    print("---")
    except ValueError as e:
        print(f"錯誤：{e}", file=sys.stderr)
        sys.exit(1)
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
