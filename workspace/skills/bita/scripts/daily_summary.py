#!/usr/bin/env python3
"""
幣塔每日工作摘要生成器

功能：
1. 讀取幣塔AI工作回報群組當天訊息
2. 下載並解析截圖
3. 識別訊息類型（交易/prompt/校準/回報）
4. 生成每日統計摘要
"""

import os
import sys
import json
import asyncio
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import base64

# Telethon
from telethon import TelegramClient
from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument

# OpenAI for image analysis
import httpx

# 設定
CONFIG_PATH = Path(__file__).parent.parent / "config.json"
SESSION_PATH = Path(__file__).parent.parent / "bita_session"
OUTPUT_DIR = Path.home() / "Documents/幣塔/data/daily"

# 群組 ID
GROUPS = {
    "幣塔AI工作回報": -5159438640,
    "幣塔管理群": -1003849990504,
    "幣塔-營銷客服": -5297227033,
}

# 訊息分類 patterns
PATTERNS = {
    "transaction": r"(買幣|賣幣|入幣|出幣|轉帳|匯款|交易成功|TWD|USDT|\d+\*\d+)",
    "prompt": r"(角色設定|提示詞|prompt|【.*?】.*?你是)",
    "calibration": r"(對答案|校準|會員原話|真人已回覆|會員問題)",
    "report": r"(打卡|日報|L[0-5]|觸及|回覆率|成交)",
}


def load_config():
    """載入 Telegram API 設定"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    # 預設值
    return {
        "api_id": 37267916,
        "api_hash": "74542a9d30de41fa61e1eb104399f8c6"
    }


def classify_message(text: str) -> str:
    """分類訊息類型"""
    if not text:
        return "other"
    
    for msg_type, pattern in PATTERNS.items():
        if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
            return msg_type
    return "other"


async def analyze_image_with_claude(image_path: str, context: str = "") -> dict:
    """用 Claude API 分析圖片"""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"error": "No ANTHROPIC_API_KEY"}
    
    # 讀取圖片
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")
    
    # 判斷 media type
    ext = Path(image_path).suffix.lower()
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", 
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }.get(ext, "image/jpeg")
    
    prompt = """分析這張幣商客服對話截圖，提取以下資訊（JSON 格式）：
{
  "type": "transaction|prompt|calibration|report|other",
  "transaction": {  // 如果是交易截圖
    "action": "買幣|賣幣",
    "amount_twd": 數字,
    "rate": 數字,
    "coins": 數字,
    "account": "帳號",
    "status": "成功|待確認|失敗"
  },
  "summary": "一句話摘要"
}

如果不是交易截圖，transaction 欄位留 null。"""
    
    if context:
        prompt += f"\n\n上下文：{context}"
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data
                            }
                        },
                        {"type": "text", "text": prompt}
                    ]
                }]
            },
            timeout=60.0
        )
        
        if resp.status_code == 200:
            result = resp.json()
            text = result["content"][0]["text"]
            # 嘗試解析 JSON
            try:
                # 找到 JSON 部分
                json_match = re.search(r'\{[\s\S]*\}', text)
                if json_match:
                    return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
            return {"summary": text}
        else:
            return {"error": f"API error: {resp.status_code}"}


async def fetch_daily_messages(client: TelegramClient, group_id: int, date: datetime) -> list:
    """取得指定日期的訊息"""
    messages = []
    
    # 設定時間範圍 (UTC+8)
    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    async for msg in client.iter_messages(group_id, offset_date=end_of_day, reverse=False):
        # 轉換時間到 UTC+8
        msg_time = msg.date.replace(tzinfo=None) + timedelta(hours=8)
        
        if msg_time < start_of_day:
            break
        if msg_time >= end_of_day:
            continue
            
        messages.append({
            "id": msg.id,
            "time": msg_time.isoformat(),
            "sender": msg.sender_id,
            "text": msg.text or "",
            "has_media": msg.media is not None,
            "media_type": type(msg.media).__name__ if msg.media else None,
            "raw_msg": msg  # 保留原始訊息用於下載媒體
        })
    
    return messages


async def process_messages(client: TelegramClient, messages: list, download_dir: Path) -> dict:
    """處理訊息並生成統計"""
    stats = {
        "total": len(messages),
        "by_type": {"transaction": 0, "prompt": 0, "calibration": 0, "report": 0, "other": 0},
        "transactions": [],
        "prompts": [],
        "calibrations": [],
        "reports": [],
        "senders": {},
    }
    
    download_dir.mkdir(parents=True, exist_ok=True)
    
    for msg in messages:
        # 分類
        msg_type = classify_message(msg["text"])
        stats["by_type"][msg_type] += 1
        
        # 統計發送者
        sender = str(msg["sender"])
        stats["senders"][sender] = stats["senders"].get(sender, 0) + 1
        
        # 處理媒體
        image_analysis = None
        if msg["has_media"] and msg["media_type"] in ("MessageMediaPhoto", "MessageMediaDocument"):
            try:
                # 下載媒體
                media_path = download_dir / f"{msg['id']}.jpg"
                await client.download_media(msg["raw_msg"], file=str(media_path))
                
                # 分析圖片
                image_analysis = await analyze_image_with_claude(str(media_path), msg["text"])
                
                # 如果圖片分析出是交易，覆蓋分類
                if image_analysis.get("type") == "transaction":
                    msg_type = "transaction"
                    stats["by_type"]["transaction"] += 1
                    stats["by_type"][classify_message(msg["text"])] -= 1
                    
            except Exception as e:
                image_analysis = {"error": str(e)}
        
        # 記錄詳細資訊
        record = {
            "id": msg["id"],
            "time": msg["time"],
            "sender": msg["sender"],
            "text": msg["text"][:500] if msg["text"] else "",
            "image_analysis": image_analysis
        }
        
        if msg_type == "transaction":
            if image_analysis and image_analysis.get("transaction"):
                record["transaction"] = image_analysis["transaction"]
            stats["transactions"].append(record)
        elif msg_type == "prompt":
            stats["prompts"].append(record)
        elif msg_type == "calibration":
            stats["calibrations"].append(record)
        elif msg_type == "report":
            stats["reports"].append(record)
    
    # 清理 raw_msg（不能序列化）
    for msg in messages:
        del msg["raw_msg"]
    
    return stats


def generate_summary(stats: dict, date: datetime) -> str:
    """生成摘要報告"""
    summary = f"""# 幣塔工作回報 - {date.strftime('%Y-%m-%d')}

## 📊 統計

| 類型 | 數量 |
|------|------|
| 總訊息數 | {stats['total']} |
| 交易截圖 | {stats['by_type']['transaction']} |
| Prompt/設定 | {stats['by_type']['prompt']} |
| 對答案/校準 | {stats['by_type']['calibration']} |
| 工作回報 | {stats['by_type']['report']} |
| 其他 | {stats['by_type']['other']} |

## 👥 活躍成員

"""
    for sender, count in sorted(stats['senders'].items(), key=lambda x: -x[1])[:10]:
        summary += f"- {sender}: {count} 則\n"
    
    if stats['transactions']:
        summary += "\n## 💰 交易記錄\n\n"
        total_twd = 0
        total_coins = 0
        for tx in stats['transactions']:
            if tx.get('transaction'):
                t = tx['transaction']
                summary += f"- {tx['time']}: {t.get('action', '?')} NT${t.get('amount_twd', '?')} → {t.get('coins', '?')} 幣\n"
                total_twd += t.get('amount_twd', 0) or 0
                total_coins += t.get('coins', 0) or 0
            elif tx.get('image_analysis', {}).get('summary'):
                summary += f"- {tx['time']}: {tx['image_analysis']['summary']}\n"
        summary += f"\n**今日總計**: NT${total_twd:,} → {total_coins:,} 幣\n"
    
    if stats['prompts']:
        summary += "\n## 📝 Prompt 更新\n\n"
        for p in stats['prompts'][:5]:
            text_preview = p['text'][:100].replace('\n', ' ') + "..." if len(p['text']) > 100 else p['text']
            summary += f"- {p['time']}: {text_preview}\n"
    
    if stats['calibrations']:
        summary += "\n## 🎯 校準記錄\n\n"
        for c in stats['calibrations'][:5]:
            text_preview = c['text'][:100].replace('\n', ' ') + "..." if len(c['text']) > 100 else c['text']
            summary += f"- {c['time']}: {text_preview}\n"
    
    return summary


async def main(target_date: Optional[str] = None, group_name: str = "幣塔AI工作回報"):
    """主程式"""
    config = load_config()
    
    # 解析日期
    if target_date:
        date = datetime.strptime(target_date, "%Y-%m-%d")
    else:
        date = datetime.now()
    
    # 確保輸出目錄存在
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    download_dir = OUTPUT_DIR / date.strftime("%Y-%m-%d") / "media"
    
    group_id = GROUPS.get(group_name)
    if not group_id:
        print(f"Unknown group: {group_name}")
        print(f"Available: {list(GROUPS.keys())}")
        return
    
    print(f"📅 處理日期: {date.strftime('%Y-%m-%d')}")
    print(f"📱 群組: {group_name} ({group_id})")
    
    async with TelegramClient(str(SESSION_PATH), config["api_id"], config["api_hash"]) as client:
        # 取得訊息
        print("📥 取得訊息...")
        messages = await fetch_daily_messages(client, group_id, date)
        print(f"   找到 {len(messages)} 則訊息")
        
        if not messages:
            print("⚠️ 沒有訊息")
            return
        
        # 處理訊息
        print("🔍 分析訊息...")
        stats = await process_messages(client, messages, download_dir)
        
        # 生成摘要
        summary = generate_summary(stats, date)
        
        # 儲存
        output_file = OUTPUT_DIR / f"{date.strftime('%Y-%m-%d')}.md"
        output_file.write_text(summary, encoding="utf-8")
        print(f"✅ 摘要已存到: {output_file}")
        
        # 儲存原始資料
        raw_file = OUTPUT_DIR / f"{date.strftime('%Y-%m-%d')}.json"
        # 移除不能序列化的 raw_msg
        raw_file.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"📄 原始資料: {raw_file}")
        
        print("\n" + summary)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="幣塔每日工作摘要")
    parser.add_argument("--date", "-d", help="目標日期 (YYYY-MM-DD)，預設今天")
    parser.add_argument("--group", "-g", default="幣塔AI工作回報", help="群組名稱")
    args = parser.parse_args()
    
    asyncio.run(main(args.date, args.group))
