#!/usr/bin/env python3
"""列出所有 Telegram 聊天（群組、頻道、私聊）"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from telethon import TelegramClient

# 預設使用 two 專案的設定
DEFAULT_CONFIG = Path.home() / "Documents/two/mcp-telegram/config.json"
DEFAULT_SESSION_DIR = Path.home() / "Documents/two/mcp-telegram/session"


def load_config(config_path: Path) -> dict:
    with open(config_path) as f:
        return json.load(f)


async def list_chats(client: TelegramClient, limit: int = 30, filter_type: str = None):
    """列出聊天"""
    dialogs = await client.get_dialogs(limit=limit)
    
    results = []
    for d in dialogs:
        chat_type = "user"
        if d.is_group:
            chat_type = "group"
        elif d.is_channel:
            chat_type = "channel"
        
        if filter_type and chat_type != filter_type:
            continue
            
        results.append({
            "id": d.id,
            "name": d.name,
            "type": chat_type,
            "unread": d.unread_count
        })
    
    return results


async def main():
    parser = argparse.ArgumentParser(description="列出 Telegram 聊天")
    parser.add_argument("--limit", "-l", type=int, default=30, help="數量限制")
    parser.add_argument("--type", "-t", choices=["user", "group", "channel"], help="過濾類型")
    parser.add_argument("--json", "-j", action="store_true", help="JSON 輸出")
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
        chats = await list_chats(client, args.limit, args.type)
        
        if args.json:
            print(json.dumps(chats, ensure_ascii=False, indent=2))
        else:
            for c in chats:
                unread = f" ({c['unread']} 未讀)" if c['unread'] > 0 else ""
                print(f"{c['id']:>15} | {c['type']:>7} | {c['name']}{unread}")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
