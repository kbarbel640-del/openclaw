#!/usr/bin/env python3
"""
Telegram Userbot Bridge for Clawdbot
監聽指定對話，轉發到 Clawdbot，選擇性回覆
"""

import os
import sys
import json
import asyncio
import argparse
import httpx
from pathlib import Path
from datetime import datetime
from telethon import TelegramClient, events

# Config 路徑
SKILL_DIR = Path(__file__).parent.parent
CONFIG_PATH = SKILL_DIR / "config.json"
LOG_DIR = SKILL_DIR / "logs"


def load_config():
    """載入設定"""
    with open(CONFIG_PATH) as f:
        return json.load(f)


def log_message(chat_id: int, chat_name: str, sender_name: str, text: str, log_dir: Path):
    """記錄訊息到日誌"""
    log_dir.mkdir(exist_ok=True)
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = log_dir / f"{today}.jsonl"
    
    entry = {
        "time": datetime.now().isoformat(),
        "chat_id": chat_id,
        "chat_name": chat_name,
        "sender": sender_name,
        "text": text
    }
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


async def send_to_clawdbot(config: dict, message: str, chat_id: int, sender_id: int, sender_name: str) -> str:
    """發送訊息到 Clawdbot Gateway，取得回覆"""
    
    gateway_url = config["clawdbot"]["gateway_url"]
    gateway_token = config["clawdbot"].get("gateway_token", "")
    
    headers = {"Content-Type": "application/json"}
    if gateway_token:
        headers["Authorization"] = f"Bearer {gateway_token}"
    
    payload = {
        "model": "default",
        "messages": [
            {"role": "user", "content": message}
        ],
        "metadata": {
            "source": "telegram-userbot",
            "chat_id": chat_id,
            "sender_id": sender_id,
            "sender_name": sender_name
        }
    }
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                f"{gateway_url}/v1/chat/completions",
                headers=headers,
                json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            return None
            
        except httpx.HTTPStatusError as e:
            print(f"[ERROR] Clawdbot API error: {e.response.status_code}")
            return None
        except Exception as e:
            print(f"[ERROR] Failed to contact Clawdbot: {e}")
            return None


async def list_chats(client):
    """列出所有對話"""
    print("\n📋 你的對話列表：\n")
    print(f"{'Chat ID':<20} {'類型':<10} {'名稱'}")
    print("-" * 60)
    
    async for dialog in client.iter_dialogs(limit=50):
        chat_type = "私聊" if dialog.is_user else ("群組" if dialog.is_group else "頻道")
        name = dialog.name or "(無名稱)"
        print(f"{dialog.id:<20} {chat_type:<10} {name}")
    
    print("\n把要監聽的 chat_id 加到 config.json 的 monitor.chats 陣列")


async def main(args):
    """主程式"""
    config = load_config()
    
    tg_config = config["telegram"]
    session_dir = Path(tg_config.get("session_dir", SKILL_DIR / "session"))
    session_name = str(session_dir / tg_config["session_name"])
    
    print(f"[INFO] Connecting to Telegram...")
    
    client = TelegramClient(session_name, tg_config["api_id"], tg_config["api_hash"])
    await client.connect()
    
    if not await client.is_user_authorized():
        print("[ERROR] Not authorized. Please login first.")
        sys.exit(1)
    
    me = await client.get_me()
    my_username = me.username or ""
    print(f"[INFO] Logged in as: {me.first_name} (@{my_username})")
    
    # 列出對話模式
    if args.list_chats:
        await list_chats(client)
        await client.disconnect()
        return
    
    # 取得要監聽的對話
    monitor_config = config.get("monitor", {})
    allowed_chats = set(monitor_config.get("chats", []))
    chat_names = monitor_config.get("names", {})
    
    # Watch-only 模式
    watch_only = args.watch_only
    mention_only = args.mention_only
    
    if not allowed_chats:
        print("[WARN] ⚠️  config.json monitor.chats 是空的！")
        print("[WARN] 使用 --list-chats 列出對話，然後填入要監聽的 chat_id")
    else:
        mode_desc = "watch-only" if watch_only else ("mention-only" if mention_only else "auto-reply")
        print(f"[INFO] 監聽 {len(allowed_chats)} 個對話 (模式: {mode_desc})")
        for cid in allowed_chats:
            name = chat_names.get(str(cid), "未命名")
            print(f"  • {cid}: {name}")
    
    # 設定訊息處理器
    @client.on(events.NewMessage(incoming=True))
    async def handler(event):
        if event.out:
            return
        
        chat_id = event.chat_id
        
        if chat_id not in allowed_chats:
            if args.debug:
                print(f"[DEBUG] Ignored chat {chat_id}")
            return
        
        sender = await event.get_sender()
        sender_name = getattr(sender, 'first_name', '') or getattr(sender, 'title', 'Unknown')
        sender_id = getattr(sender, 'id', 0)
        message_text = event.raw_text or ""
        
        if not message_text:
            return
        
        chat_name = chat_names.get(str(chat_id), str(chat_id))
        
        # 記錄到日誌
        log_message(chat_id, chat_name, sender_name, message_text, LOG_DIR)
        
        # 輸出到終端
        preview = message_text[:60].replace('\n', ' ')
        print(f"[{datetime.now().strftime('%H:%M:%S')}] [{chat_name}] {sender_name}: {preview}{'...' if len(message_text) > 60 else ''}")
        
        # Watch-only 模式：不回覆
        if watch_only:
            return
        
        # Mention-only 模式：只在被 @ 時回覆
        if mention_only:
            if my_username and f"@{my_username}" not in message_text:
                if args.debug:
                    print(f"[DEBUG] Not mentioned, skipping reply")
                return
        
        # 發送到 Clawdbot 取得回覆
        reply = await send_to_clawdbot(
            config=config,
            message=message_text,
            chat_id=chat_id,
            sender_id=sender_id,
            sender_name=sender_name
        )
        
        if reply and reply.strip() and reply.strip() not in ("NO_REPLY", "HEARTBEAT_OK"):
            await event.reply(reply)
            print(f"[REPLY] {reply[:60]}{'...' if len(reply) > 60 else ''}")
    
    print(f"[INFO] 🎧 Listening... (logs → {LOG_DIR})")
    print("[INFO] Ctrl+C to stop")
    await client.run_until_disconnected()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Telegram Userbot Bridge")
    parser.add_argument("--list-chats", action="store_true", help="列出所有對話")
    parser.add_argument("--watch-only", "-w", action="store_true", help="只監聽記錄，不回覆")
    parser.add_argument("--mention-only", "-m", action="store_true", help="只在被 @ 時回覆")
    parser.add_argument("--debug", action="store_true", help="Debug 輸出")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(main(args))
    except KeyboardInterrupt:
        print("\n[INFO] Stopped.")
