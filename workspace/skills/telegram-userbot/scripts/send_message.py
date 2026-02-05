#!/usr/bin/env python3
"""用 userbot 發送 Telegram 訊息"""

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


async def resolve_chat(client: TelegramClient, chat: str):
    """解析聊天 ID 或名稱"""
    if chat.lstrip('-').isdigit():
        return await client.get_entity(int(chat))
    if chat.startswith('@'):
        return await client.get_entity(chat)
    dialogs = await client.get_dialogs(limit=100)
    for d in dialogs:
        if chat.lower() in d.name.lower():
            return d.entity
    raise ValueError(f"找不到聊天：{chat}")


async def send_message(client: TelegramClient, chat: str, text: str, reply_to: int = None):
    """發送訊息"""
    entity = await resolve_chat(client, chat)
    msg = await client.send_message(entity, text, reply_to=reply_to)
    return {
        "id": msg.id,
        "chat_id": entity.id,
        "text": msg.text,
        "date": msg.date.isoformat() if msg.date else None
    }


async def main():
    parser = argparse.ArgumentParser(description="發送 Telegram 訊息")
    parser.add_argument("chat", help="聊天名稱、ID 或 @username")
    parser.add_argument("message", help="訊息內容")
    parser.add_argument("--reply-to", "-r", type=int, help="回覆指定訊息 ID")
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
        result = await send_message(client, args.chat, args.message, args.reply_to)
        
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(f"✓ 已發送 (msg_id: {result['id']})")
    except ValueError as e:
        print(f"錯誤：{e}", file=sys.stderr)
        sys.exit(1)
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
