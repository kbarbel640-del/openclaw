#!/usr/bin/env python3
"""
Telegram 感測器 - 監聯杜甫個人帳號，推送到主對話
功能：
1. 啟動時讀取各群最近消息建立上下文
2. 運行中持續監聽新消息
3. 推送重要消息到主對話
"""

import os
import sys
import json
import asyncio
import argparse
import httpx
from pathlib import Path
from datetime import datetime, timezone, timedelta

from telethon import TelegramClient, events
from telethon.tl.types import User, Chat, Channel

# 路徑
SKILL_DIR = Path(__file__).parent.parent
CONFIG_PATH = SKILL_DIR / "config.json"
LOG_DIR = SKILL_DIR / "logs"
CONTEXT_DIR = SKILL_DIR / "context"

# 台北時區
TZ_TAIPEI = timezone(timedelta(hours=8))

# Clawdbot Bot Token（用來推送通知）
CLAWDBOT_TOKEN = "8327498414:AAFVEs7Ouf6JESIWGpLnD77GvJkxe9uXp68"
DUFU_CHAT_ID = 8090790323  # 杜甫的 Telegram ID


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def get_taipei_time():
    """取得台北時間"""
    return datetime.now(TZ_TAIPEI)


def format_notification(chat_name: str, chat_type: str, sender_name: str, 
                        text: str, has_media: bool, msg_time: datetime) -> str:
    """格式化通知消息"""
    
    # 時間轉台北
    if msg_time.tzinfo is None:
        msg_time = msg_time.replace(tzinfo=timezone.utc)
    taipei_time = msg_time.astimezone(TZ_TAIPEI)
    time_str = taipei_time.strftime("%H:%M")
    
    # 消息類型
    type_emoji = "👤" if chat_type == "private" else "👥"
    
    # 媒體標記
    media_tag = "\n📎 [有附件]" if has_media else ""
    
    # 截斷長消息
    display_text = text[:500] + "..." if len(text) > 500 else text
    
    notification = f"""━━━━━━━━━━━━━━━━━━━━━━
{type_emoji} {chat_type.upper()} | {chat_name}
━━━━━━━━━━━━━━━━━━━━━━
👤 {sender_name}
⏰ {time_str}

{display_text}{media_tag}
━━━━━━━━━━━━━━━━━━━━━━"""
    
    return notification


async def generate_reply_suggestion(sender_name: str, text: str, chat_type: str, my_username: str = "DufuTheSage") -> str:
    """生成建議回覆（簡單版，之後可接 AI）"""
    
    # 檢查是否真的被 @ 到
    mentioned = f"@{my_username}".lower() in text.lower() or "@杜甫" in text or "@dofu" in text.lower()
    
    # 簡單規則
    if chat_type == "private":
        return "💡 建議：私聊消息，建議回覆"
    elif mentioned:
        return "💡 建議：被 @ 提及，需要回覆"
    elif "?" in text or "？" in text:
        return "💡 建議：這是問題，可能需要回覆"
    elif "急" in text or "幫忙" in text or "help" in text.lower():
        return "💡 建議：看起來緊急，優先處理"
    else:
        return "💡 建議：可稍後處理"


async def send_notification(text: str):
    """發送通知到杜甫"""
    url = f"https://api.telegram.org/bot{CLAWDBOT_TOKEN}/sendMessage"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json={
                "chat_id": DUFU_CHAT_ID,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            })
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"[ERROR] 發送通知失敗: {e}")
            return None


def log_message(entry: dict):
    """記錄消息到日誌"""
    LOG_DIR.mkdir(exist_ok=True)
    today = get_taipei_time().strftime("%Y-%m-%d")
    log_file = LOG_DIR / f"sensor-{today}.jsonl"
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")


def save_context(chat_id: int, chat_name: str, messages: list):
    """儲存群組上下文"""
    CONTEXT_DIR.mkdir(exist_ok=True)
    context_file = CONTEXT_DIR / f"{chat_id}.json"
    
    context = {
        "chat_id": chat_id,
        "chat_name": chat_name,
        "updated_at": get_taipei_time().isoformat(),
        "messages": messages
    }
    
    with open(context_file, "w", encoding="utf-8") as f:
        json.dump(context, f, ensure_ascii=False, indent=2, default=str)


def load_context(chat_id: int) -> list:
    """載入群組上下文"""
    context_file = CONTEXT_DIR / f"{chat_id}.json"
    if context_file.exists():
        with open(context_file) as f:
            data = json.load(f)
            return data.get("messages", [])
    return []


def append_to_context(chat_id: int, chat_name: str, message: dict):
    """追加消息到上下文（保留最近 100 條）"""
    messages = load_context(chat_id)
    messages.append(message)
    # 只保留最近 100 條
    if len(messages) > 100:
        messages = messages[-100:]
    save_context(chat_id, chat_name, messages)


async def fetch_chat_history(client, chat_id: int, chat_name: str, limit: int = 30):
    """讀取群組歷史消息"""
    print(f"[INFO] 讀取 {chat_name} 最近 {limit} 條消息...")
    
    try:
        messages = await client.get_messages(chat_id, limit=limit)
        
        history = []
        for msg in reversed(messages):  # 時間正序
            if not msg.text:
                continue
            
            sender_name = ""
            if msg.sender:
                sender_name = getattr(msg.sender, 'first_name', '') or \
                             getattr(msg.sender, 'title', 'Unknown')
            
            # 時間轉台北
            msg_time = msg.date
            if msg_time.tzinfo is None:
                msg_time = msg_time.replace(tzinfo=timezone.utc)
            taipei_time = msg_time.astimezone(TZ_TAIPEI)
            
            history.append({
                "id": msg.id,
                "time": taipei_time.isoformat(),
                "sender": sender_name,
                "text": msg.text[:500] if msg.text else ""
            })
        
        save_context(chat_id, chat_name, history)
        print(f"[INFO] ✅ {chat_name}: {len(history)} 條消息已載入")
        return history
        
    except Exception as e:
        print(f"[WARN] 無法讀取 {chat_name}: {e}")
        return []


async def main(args):
    config = load_config()
    
    # Telegram 連接
    tg = config["telegram"]
    session_dir = Path(tg.get("session_dir", SKILL_DIR / "session"))
    session_path = str(session_dir / tg["session_name"])
    
    print(f"[INFO] 連接 Telegram...")
    client = TelegramClient(session_path, tg["api_id"], tg["api_hash"])
    await client.connect()
    
    if not await client.is_user_authorized():
        print("[ERROR] 未授權，請先登入")
        sys.exit(1)
    
    me = await client.get_me()
    my_id = me.id
    print(f"[INFO] 已登入: {me.first_name} (@{me.username})")
    
    # 監聽設定
    monitor = config.get("monitor", {})
    allowed_chats = set(monitor.get("chats", []))
    chat_names = monitor.get("names", {})
    
    # 是否監聽所有消息（測試模式）
    watch_all = args.all
    
    if watch_all:
        print("[INFO] 🔥 測試模式：監聽所有消息")
    else:
        print(f"[INFO] 監聯 {len(allowed_chats)} 個對話")
    
    # 啟動時讀取各群歷史消息建立上下文
    if not args.skip_history:
        print("\n[INFO] 📚 建立初始上下文...")
        for chat_id in allowed_chats:
            chat_name = chat_names.get(str(chat_id), str(chat_id))
            await fetch_chat_history(client, chat_id, chat_name, limit=30)
        print("[INFO] ✅ 上下文建立完成\n")
    
    # 消息處理器
    @client.on(events.NewMessage(incoming=True))
    async def handler(event):
        # 忽略自己發的
        if event.out:
            return
        
        chat = await event.get_chat()
        chat_id = event.chat_id
        
        # 判斷是否監聽
        if not watch_all and chat_id not in allowed_chats:
            return
        
        # 取得發送者
        sender = await event.get_sender()
        if sender is None:
            return
        
        # 忽略機器人
        if isinstance(sender, User) and sender.bot:
            return
        
        # 基本資訊
        sender_name = getattr(sender, 'first_name', '') or getattr(sender, 'title', 'Unknown')
        sender_id = getattr(sender, 'id', 0)
        text = event.raw_text or ""
        has_media = event.media is not None
        
        # 空消息跳過（除非有媒體）
        if not text and not has_media:
            return
        
        # 對話類型
        if isinstance(chat, User):
            chat_type = "private"
            chat_name = sender_name
        elif isinstance(chat, (Chat, Channel)):
            chat_type = "group"
            chat_name = chat_names.get(str(chat_id), getattr(chat, 'title', str(chat_id)))
        else:
            chat_type = "unknown"
            chat_name = str(chat_id)
        
        # 記錄到日誌
        entry = {
            "time": get_taipei_time().isoformat(),
            "chat_id": chat_id,
            "chat_name": chat_name,
            "chat_type": chat_type,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "text": text,
            "has_media": has_media,
            "message_id": event.id
        }
        log_message(entry)
        
        # 追加到上下文
        msg_time = event.date
        if msg_time.tzinfo is None:
            msg_time = msg_time.replace(tzinfo=timezone.utc)
        taipei_time = msg_time.astimezone(TZ_TAIPEI)
        
        append_to_context(chat_id, chat_name, {
            "id": event.id,
            "time": taipei_time.isoformat(),
            "sender": sender_name,
            "text": text[:500] if text else ""
        })
        
        # 終端輸出
        preview = text[:60].replace('\n', ' ') if text else "[媒體]"
        print(f"[{get_taipei_time().strftime('%H:%M:%S')}] [{chat_name}] {sender_name}: {preview}")
        
        # 生成通知
        notification = format_notification(
            chat_name=chat_name,
            chat_type=chat_type,
            sender_name=sender_name,
            text=text or "[媒體消息]",
            has_media=has_media,
            msg_time=event.date
        )
        
        # 生成建議
        suggestion = await generate_reply_suggestion(sender_name, text, chat_type)
        
        # 組合完整通知
        full_notification = f"{notification}\n\n{suggestion}"
        
        # 發送
        await send_notification(full_notification)
    
    print(f"[INFO] 🎧 感測器啟動，監聽中...")
    print(f"[INFO] 日誌目錄: {LOG_DIR}")
    print("[INFO] Ctrl+C 停止")
    
    await client.run_until_disconnected()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Telegram 感測器")
    parser.add_argument("--all", "-a", action="store_true", 
                        help="監聽所有消息（測試模式）")
    parser.add_argument("--skip-history", "-s", action="store_true",
                        help="跳過啟動時讀取歷史")
    parser.add_argument("--debug", action="store_true", help="Debug 模式")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(main(args))
    except KeyboardInterrupt:
        print("\n[INFO] 已停止")
