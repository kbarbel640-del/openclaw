#!/usr/bin/env python3
"""
整理幣塔員工客服對話

用法：
    python summarize_chat.py 俊      # 整理小峻的對話
    python summarize_chat.py 兔      # 整理兔兔的對話
    python summarize_chat.py --all   # 整理所有員工
"""

import asyncio
import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from telethon import TelegramClient

# 讀取配置
CONFIG_PATH = Path(__file__).parent.parent / "config.json"
with open(CONFIG_PATH) as f:
    config = json.load(f)

API_ID = config["telegram"]["api_id"]
API_HASH = config["telegram"]["api_hash"]
SESSION_DIR = Path(config["telegram"]["session_dir"])
SESSION_NAME = config["telegram"]["session_name"]

# 幣塔員工群組對照表
STAFF_CHATS = {
    "兔": {"id": -5148508655, "name": "兔兔", "full_name": "幣塔AI工作回報(兔)"},
    "俊": {"id": -5159438640, "name": "小峻", "full_name": "幣塔AI工作回報(俊)"},
    "QQ": {"id": -5030731997, "name": "QQ", "full_name": "幣塔AI工作回報(QQ)"},
    "子": {"id": -5070604096, "name": "Z", "full_name": "幣塔AI工作回報(子)"},
    "茂": {"id": -5186655303, "name": "茂", "full_name": "幣塔AI工作回報(茂)"},
    "周": {"id": -5295280162, "name": "小周", "full_name": "幣塔AI工作回報(周)"},
    "緯": {"id": -5023713246, "name": "葦葦", "full_name": "幣塔AI工作回報(緯)"},
}


def parse_timestamp(text: str) -> datetime | None:
    """嘗試解析時間戳"""
    patterns = [
        r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2})",
        r"(\d{2}/\d{2} \d{2}:\d{2})",
        r"(\d{2}:\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                return datetime.strptime(match.group(1), "%Y-%m-%d %H:%M")
            except:
                pass
    return None


def categorize_message(text: str) -> str:
    """分類訊息類型"""
    text_lower = text.lower()
    
    if any(k in text for k in ["上班打卡", "下班打卡", "早安", "晚安"]):
        return "打卡"
    elif any(k in text for k in ["氣質美女", "代打", "對答案"]):
        return "氣質美女"
    elif any(k in text for k in ["貴賓狗", "客訴", "補償", "奧客"]):
        return "貴賓狗"
    elif any(k in text for k in ["社交NB", "觸及", "L0", "L1", "L2", "L3", "L4", "L5"]):
        return "社交NB"
    elif any(k in text for k in ["問題", "遇到", "不會", "怎麼"]):
        return "問題"
    elif any(k in text for k in ["已完成", "完成", "搞定", "OK", "好了"]):
        return "完成"
    else:
        return "其他"


async def fetch_messages(client, chat_id: int, limit: int = 100, days: int = 7, download_dir: Path = None):
    """抓取訊息"""
    messages = []
    cutoff = datetime.now() - timedelta(days=days)
    
    async for msg in client.iter_messages(chat_id, limit=limit):
        if msg.date.replace(tzinfo=None) < cutoff:
            break
        
        entry = {
            "id": msg.id,
            "date": msg.date.strftime("%Y-%m-%d %H:%M"),
            "sender": msg.sender_id,
            "text": msg.text or "",
            "category": categorize_message(msg.text or ""),
            "has_photo": msg.photo is not None,
            "has_document": msg.document is not None,
            "media_path": None,
        }
        
        # 下載圖片
        if msg.photo and download_dir:
            try:
                path = await client.download_media(msg, file=download_dir / f"{msg.id}.jpg")
                entry["media_path"] = str(path) if path else None
                entry["category"] = "截圖對話"
            except Exception as e:
                entry["media_path"] = f"下載失敗: {e}"
        elif msg.photo:
            entry["category"] = "截圖對話"
        
        if msg.text or msg.photo or msg.document:
            messages.append(entry)
    
    return list(reversed(messages))  # 時間正序


def summarize(messages: list, staff_name: str) -> str:
    """整理成報告格式"""
    if not messages:
        return f"# {staff_name} 客服記錄\n\n（無訊息）"
    
    # 按日期分組
    by_date = {}
    for msg in messages:
        date = msg["date"].split(" ")[0]
        if date not in by_date:
            by_date[date] = []
        by_date[date].append(msg)
    
    # 統計
    categories = {}
    for msg in messages:
        cat = msg["category"]
        categories[cat] = categories.get(cat, 0) + 1
    
    # 生成報告
    lines = [
        f"# {staff_name} 客服記錄整理",
        f"",
        f"**統計** ({len(messages)} 則訊息)",
        "",
    ]
    
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        lines.append(f"- {cat}: {count}")
    
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # 按日期輸出
    for date, day_msgs in sorted(by_date.items()):
        lines.append(f"## {date}")
        lines.append("")
        
        for msg in day_msgs:
            time = msg["date"].split(" ")[1]
            cat = msg["category"]
            text = msg["text"][:200].replace("\n", " ") if msg["text"] else ""
            if msg["text"] and len(msg["text"]) > 200:
                text += "..."
            
            # 標記媒體
            media_tag = ""
            if msg.get("has_photo"):
                media_tag = "📷 "
                if msg.get("media_path") and not msg["media_path"].startswith("下載失敗"):
                    media_tag = f"📷[{Path(msg['media_path']).name}] "
            if msg.get("has_document"):
                media_tag = "📎 "
            
            lines.append(f"- `{time}` [{cat}] {media_tag}{text}")
        
        lines.append("")
    
    return "\n".join(lines)


async def main():
    parser = argparse.ArgumentParser(description="整理幣塔員工客服對話")
    parser.add_argument("staff", nargs="?", help="員工簡稱（俊/兔/QQ/子/茂/周/緯）")
    parser.add_argument("--all", action="store_true", help="整理所有員工")
    parser.add_argument("--limit", type=int, default=100, help="訊息數量上限")
    parser.add_argument("--days", type=int, default=7, help="抓取天數")
    parser.add_argument("--output", "-o", help="輸出檔案（預設 stdout）")
    parser.add_argument("--download", "-d", action="store_true", help="下載圖片")
    parser.add_argument("--download-dir", help="圖片下載目錄")
    args = parser.parse_args()
    
    if not args.staff and not args.all:
        parser.print_help()
        print("\n可用員工：", ", ".join(STAFF_CHATS.keys()))
        return
    
    # 連接 Telegram
    session_path = SESSION_DIR / SESSION_NAME
    client = TelegramClient(str(session_path), API_ID, API_HASH)
    await client.start()
    
    try:
        targets = STAFF_CHATS.keys() if args.all else [args.staff]
        results = []
        
        for key in targets:
            if key not in STAFF_CHATS:
                print(f"⚠️  找不到員工：{key}")
                continue
            
            staff = STAFF_CHATS[key]
            print(f"📥 抓取 {staff['name']} 的對話...", flush=True)
            
            # 設定下載目錄
            download_dir = None
            if args.download:
                download_dir = Path(args.download_dir) if args.download_dir else Path(f"./downloads/{key}")
                download_dir.mkdir(parents=True, exist_ok=True)
            
            messages = await fetch_messages(
                client, 
                staff["id"], 
                limit=args.limit,
                days=args.days,
                download_dir=download_dir
            )
            
            report = summarize(messages, staff["name"])
            results.append(report)
            print(f"✅ {staff['name']}: {len(messages)} 則訊息")
        
        output = "\n\n---\n\n".join(results)
        
        if args.output:
            Path(args.output).write_text(output, encoding="utf-8")
            print(f"\n📄 已輸出到 {args.output}")
        else:
            print("\n" + "=" * 50 + "\n")
            print(output)
    
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
