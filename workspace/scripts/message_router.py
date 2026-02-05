#!/usr/bin/env python3
"""
消息路由服務 MVP
- 輪詢 telegram-userbot 新消息
- 根據 ROUTING.md 規則寫入對應 inbox/
"""

import os
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 配置
CLAWD_DIR = Path(os.path.expanduser("~/clawd"))

# 從 .env 讀取敏感配置
def _load_env():
    env_file = CLAWD_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("'\""))
_load_env()

BRIDGE_URL = os.environ.get("TELEGRAM_BRIDGE_URL", os.environ.get("BRIDGE_URL", "http://127.0.0.1:18790"))
INBOX_DIR = CLAWD_DIR / "inbox"
STATE_FILE = CLAWD_DIR / "inbox" / ".router_state.json"
POLL_INTERVAL = 60  # 秒

# 路由規則（從 ROUTING.md 複製）
ROUTES = {
    # BG666
    -5262004625: "bg666",      # 66 主群
    -1003337225655: "bg666",   # 数据需求群
    -5150278361: "bg666",      # 数据需求群(舊)
    -5173465395: "bg666",      # 日报群
    -1003506161262: "bg666",   # 运营咨询
    -5000326699: "bg666",      # 策划试用组
    -5210426893: "bg666",      # 杜甫工作後台
    -1003442940778: "bg666",   # 打卡日报群
    5665640546: "bg666",       # Red
    5038335338: "bg666",       # brandon
    5308534717: "bg666",       # Albert
    8243974830: "bg666",       # Petter
    7545465225: "bg666",       # Fendi
    
    # 24Bet
    -5299944691: "24bet",      # 24 主群
    
    # 幣塔
    -1003849990504: "bita",
    -5297227033: "bita",
    -5070604096: "bita",
    -5186655303: "bita",
    -5023713246: "bita",
    -5295280162: "bita",
    -5030731997: "bita",
    -5148508655: "bita",
    -5159438640: "bita",
}

# 忽略的 chat（系統/bot）
IGNORE = {8327498414, 8415477831, 8285963929, 777000, 93372553}

TPE = timezone(timedelta(hours=8))


def load_state():
    """載入上次處理的消息 ID"""
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"last_check": None, "processed": {}}


def save_state(state):
    """保存狀態"""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def http_get(url, timeout=10):
    """HTTP GET 請求"""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return {"error": str(e)}


def get_chats():
    """獲取所有聊天"""
    try:
        data = http_get(f"{BRIDGE_URL}/chats")
        if "error" in data:
            print(f"❌ 獲取聊天列表失敗: {data['error']}")
            return []
        return data if isinstance(data, list) else data.get("chats", [])
    except Exception as e:
        print(f"❌ 獲取聊天列表失敗: {e}")
        return []


def get_messages(chat_id, limit=10):
    """獲取聊天消息"""
    try:
        url = f"{BRIDGE_URL}/messages?chat={chat_id}&limit={limit}"
        data = http_get(url)
        if "error" in data:
            return []
        return data.get("messages", []) if isinstance(data, dict) else []
    except Exception as e:
        print(f"❌ 獲取消息失敗 ({chat_id}): {e}")
        return []


def route_message(chat_id):
    """判斷消息歸屬哪個 session"""
    return ROUTES.get(chat_id, "main")


def write_to_inbox(session, message, chat_name):
    """寫入 inbox"""
    inbox_path = INBOX_DIR / session
    inbox_path.mkdir(parents=True, exist_ok=True)
    
    today = datetime.now(TPE).strftime("%Y-%m-%d")
    file_path = inbox_path / f"{today}.jsonl"
    
    entry = {
        "timestamp": datetime.now(TPE).isoformat(),
        "chat_id": message.get("chat_id"),
        "chat_name": chat_name,
        "message_id": message.get("id"),
        "sender": message.get("sender"),
        "text": message.get("text", "")[:500],
        "date": message.get("date"),
        "has_media": message.get("has_media", False),
    }
    
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    
    return entry


def poll_once(state):
    """執行一次輪詢"""
    chats = get_chats()
    new_messages = 0
    
    for chat in chats:
        chat_id = chat.get("id")
        chat_name = chat.get("name", "unknown")
        unread = chat.get("unread", 0)
        
        # 跳過忽略的 chat
        if chat_id in IGNORE:
            continue
        
        # 只處理有未讀消息的
        if unread == 0:
            continue
        
        # 獲取最近消息
        messages = get_messages(chat_id, limit=min(unread + 5, 30))
        
        # 處理每條消息
        processed_key = str(chat_id)
        last_processed = state["processed"].get(processed_key, 0)
        
        for msg in messages:
            msg_id = msg.get("id", 0)
            if msg_id <= last_processed:
                continue
            
            # 路由並寫入
            session = route_message(chat_id)
            msg["chat_id"] = chat_id
            write_to_inbox(session, msg, chat_name)
            new_messages += 1
            
            # 更新已處理
            state["processed"][processed_key] = max(
                state["processed"].get(processed_key, 0), 
                msg_id
            )
    
    state["last_check"] = datetime.now(TPE).isoformat()
    return new_messages


def run_daemon():
    """運行 daemon"""
    print(f"🚀 消息路由服務啟動 (輪詢間隔: {POLL_INTERVAL}s)")
    state = load_state()
    
    while True:
        try:
            new = poll_once(state)
            save_state(state)
            if new > 0:
                print(f"✅ {datetime.now(TPE).strftime('%H:%M')} 路由 {new} 條新消息")
        except Exception as e:
            print(f"❌ 輪詢錯誤: {e}")
        
        time.sleep(POLL_INTERVAL)


def poll_now():
    """單次輪詢（供心跳調用）"""
    state = load_state()
    new = poll_once(state)
    save_state(state)
    return new


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        n = poll_now()
        print(f"路由 {n} 條消息")
    else:
        run_daemon()
