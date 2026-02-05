#!/usr/bin/env python3
"""
杜甫宇宙儀表板
生成 Telegram 友好的 ASCII 熱力圖
"""

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 時區
TPE = timezone(timedelta(hours=8))

# 宇宙定義 — 每個領域包含多個頻道
UNIVERSES = {
    "工作": {
        "channels": [
            {"name": "BG666-數據", "ids": ["-5173465395", "-1003337225655", "-5150278361"], "type": "work"},
            {"name": "BG666-運營", "ids": ["-1003506161262", "-5000326699"], "type": "work"},
            {"name": "BG666-後台", "ids": ["-5210426893"], "type": "work"},
            {"name": "24Bet", "ids": ["-5299944691"], "type": "work"},
            {"name": "幣塔-管理", "ids": ["-1003849990504"], "type": "work"},
            {"name": "幣塔-客服", "ids": ["-5297227033"], "type": "work"},
            {"name": "幣塔-兔", "ids": ["-5148508655"], "type": "work"},
            {"name": "幣塔-峻", "ids": ["-5159438640"], "type": "work"},
        ],
        "max_slots": 8
    },
    "創業": {
        "channels": [
            {"name": "ThinkerCafe", "ids": ["-5135725975"], "type": "startup"},
            {"name": "AI課程", "ids": ["-5058107582"], "type": "startup"},
            {"name": "Threads", "ids": ["-5164354298"], "type": "startup"},
        ],
        "max_slots": 8
    },
    "家庭": {
        "channels": [
            {"name": "LINE家族", "ids": ["line:Cf529a05bf3b802a1ef1d4bacf9a5035e"], "type": "family"},
        ],
        "max_slots": 8
    },
    "社交": {
        "channels": [
            {"name": "Vivian", "ids": ["-5236959911"], "type": "social"},
            {"name": "XO", "ids": ["-5236199765"], "type": "social"},
        ],
        "max_slots": 8
    }
}

# 狀態定義
STATUS_CHARS = {
    "active": "█",      # 活躍（24h 內有互動）
    "pending": "▓",     # 待處理（有未讀或待辦）
    "dormant": "░",     # 休眠（超過 24h 沒動靜）
    "urgent": "▓",      # 緊急（標紅）
    "empty": "░"        # 空位
}

def get_sessions_data() -> dict:
    """從 Moltbot Gateway 獲取 session 數據"""
    import subprocess
    try:
        # 調用 gateway API 獲取 sessions（支持 docker 環境）
        gateway_url = "http://host.docker.internal:18799/sessions?limit=100"
        result = subprocess.run(
            ["curl", "-s", gateway_url],
            capture_output=True, text=True, timeout=10
        )
        data = json.loads(result.stdout)
        
        # 建立 chat_id -> session 映射
        sessions = {}
        for s in data.get("sessions", []):
            key = s.get("key", "")
            # 提取 chat_id（如 agent:main:telegram:group:-5173465395）
            if ":telegram:group:" in key:
                chat_id = key.split(":telegram:group:")[-1]
                sessions[chat_id] = s
            elif ":line:group:" in key:
                line_id = key.split(":line:group:")[-1].replace("group:", "")
                sessions[f"line:{line_id}"] = s
        return sessions
    except Exception as e:
        print(f"Error fetching sessions: {e}", file=__import__('sys').stderr)
        return {}

# 緩存 session 數據
_sessions_cache = None

def get_channel_status(channel_id: str) -> str:
    """
    獲取頻道狀態
    基於 session 最後活動時間判斷
    """
    global _sessions_cache
    if _sessions_cache is None:
        _sessions_cache = get_sessions_data()
    
    # 清理 channel_id 格式
    clean_id = channel_id.lstrip("-")
    
    # 嘗試匹配
    session = None
    for sid, s in _sessions_cache.items():
        if clean_id in sid or channel_id in sid:
            session = s
            break
    
    if not session:
        return "dormant"
    
    # 檢查最後更新時間
    updated_at = session.get("updatedAt", 0)
    if updated_at:
        now_ms = datetime.now(timezone.utc).timestamp() * 1000
        hours_ago = (now_ms - updated_at) / (1000 * 60 * 60)
        
        if hours_ago < 24:
            return "active"
        elif hours_ago < 72:
            return "pending"
        else:
            return "dormant"
    
    return "dormant"

def generate_bar(active: int, pending: int, dormant: int, max_slots: int) -> str:
    """生成進度條"""
    bar = ""
    bar += STATUS_CHARS["active"] * active
    bar += STATUS_CHARS["pending"] * pending
    bar += STATUS_CHARS["dormant"] * (max_slots - active - pending)
    return bar

def generate_dashboard() -> str:
    """生成儀表板"""
    now = datetime.now(TPE)
    timestamp = now.strftime("%m-%d %H:%M")
    
    lines = [
        f"杜甫宇宙 [{timestamp}]",
        "━" * 20
    ]
    
    for universe_name, universe_data in UNIVERSES.items():
        channels = universe_data["channels"]
        max_slots = universe_data["max_slots"]
        
        # 計算各狀態數量
        active = 0
        pending = 0
        
        for ch in channels:
            # TODO: 獲取真實狀態
            status = get_channel_status(ch["ids"][0] if ch["ids"] else "")
            if status == "active":
                active += 1
            elif status in ["pending", "urgent"]:
                pending += 1
        
        dormant = len(channels) - active - pending
        total = len(channels)
        
        bar = generate_bar(active, pending, dormant, max_slots)
        lines.append(f"{universe_name} {bar} {active}/{total}")
    
    lines.append("━" * 20)
    lines.append("█活躍 ▓待辦 ░休眠")
    
    return "\n".join(lines)

def generate_detailed_view(universe_name: str = None) -> str:
    """生成詳細視圖（微觀）"""
    now = datetime.now(TPE)
    timestamp = now.strftime("%m-%d %H:%M")
    
    if universe_name and universe_name in UNIVERSES:
        universes = {universe_name: UNIVERSES[universe_name]}
    else:
        universes = UNIVERSES
    
    lines = [f"📊 詳細視圖 [{timestamp}]", ""]
    
    for name, data in universes.items():
        lines.append(f"【{name}】")
        for ch in data["channels"]:
            status = get_channel_status(ch["ids"][0] if ch["ids"] else "")
            icon = "🟢" if status == "active" else "🟡" if status == "pending" else "⚪"
            lines.append(f"  {icon} {ch['name']}")
        lines.append("")
    
    return "\n".join(lines)

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--detail":
        universe = sys.argv[2] if len(sys.argv) > 2 else None
        print(generate_detailed_view(universe))
    else:
        print(generate_dashboard())
