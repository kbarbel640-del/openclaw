#!/usr/bin/env python3
"""
Session Alignment Report — 跨 session 對齊工具
用於心跳時掃描所有 session 狀態，生成對齊報告
"""

# 這個腳本由無極在心跳時手動執行邏輯
# 實際執行是透過 sessions_list + sessions_history

# === 對齊三步驟 ===
# 
# 第一步：知識同步（3）
# - 掃描所有活躍 session 的最後訊息
# - 找出有價值的新知識/決策
# - 寫入 memory/YYYY-MM-DD.md 供所有 session 共享
#
# 第二步：願景對齊（2）  
# - 檢查每個 session 的任務是否指向核心願景
# - 核心願景：AI 員工自動運轉（KPI = 自動運轉天數）
# - 偏離的標記出來，心跳報告提醒
#
# 第三步：狀態檢查（1）
# - 哪些 session 卡住了（token 用很多但沒產出）
# - 哪些 session 很久沒動
# - 哪些 session 需要介入

# === Session 分類 ===
SESSION_CATEGORIES = {
    "core_work": {
        "description": "核心工作 session",
        "sessions": [
            "agent:main:main",                          # 主 session（杜甫直聊）
            "agent:main:telegram:group:-5262004625",     # 66 群
            "agent:main:telegram:group:-5299944691",     # 24 群
        ]
    },
    "bita": {
        "description": "幣塔客服",
        "sessions": [
            "agent:main:telegram:group:-5148508655",     # 幣塔(茂)
            "agent:main:telegram:group:-5159438640",     # 幣塔(子)
            "agent:main:telegram:group:-1003849990504",  # 幣塔主群
        ]
    },
    "community": {
        "description": "社群/教學",
        "sessions": [
            "agent:main:telegram:group:-5058107582",     # 沛綺教學
            "agent:main:telegram:group:-5131977116",     # 鄒老師
            "agent:main:telegram:group:-5030731997",     # QQ 群
            "agent:main:telegram:group:-5023713246",     # 24Bet 工作
        ]
    },
    "discord": {
        "description": "Discord",
        "sessions": [
            "agent:main:discord:channel:1311455771057197136",  # Moltbot Discord
            "agent:main:discord:channel:1466274977664995339",  # Ryan 成長銀行
        ]
    },
    "line": {
        "description": "LINE 群組",
        "sessions": [
            # ThinkerCafe 各群 + 家族群
        ]
    },
    "cron": {
        "description": "定時任務",
        "sessions": [
            # cron sessions
        ]
    }
}

# === 對齊頻率 ===
# 每次心跳：快速掃（看最後一條訊息）
# 每 4 小時：深度掃（看最近 5 條，找知識點）
# 每日冥想：全面回顧
