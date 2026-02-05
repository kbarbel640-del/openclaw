"""Ryan 成長銀行 — 設定檔"""
import os

# Discord Bot Token（從環境變數讀取）
BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")

# 資料庫路徑
DB_PATH = os.path.join(os.path.dirname(__file__), "db", "ryan.db")

# XP 設定
XP_PER_MESSAGE = 2          # 每則訊息
XP_MESSAGE_COOLDOWN = 60    # 秒，防灌水
XP_MESSAGE_DAILY_CAP = 20   # 每日訊息 XP 上限
XP_CHECKIN = 15             # 每日打卡
XP_QUIZ_CORRECT = 15        # 猜卡答對
XP_QUIZ_WRONG = 5           # 猜卡答錯（鼓勵嘗試）

# 等級公式：所需 XP = 50 × Level²
LEVEL_FORMULA = lambda lvl: 50 * lvl * lvl

# 等級稱號（每 5 級一個）
LEVEL_TITLES = {
    1:  "🥚 寶可夢蛋",
    5:  "🐛 小小訓練師",
    10: "⚡ 初級訓練師",
    15: "🔥 進階訓練師",
    20: "💧 菁英訓練師",
    25: "🌿 資深訓練師",
    30: "🌟 道館館主",
    35: "💎 四天王",
    40: "👑 冠軍",
    45: "🏆 傳說訓練師",
    50: "🌈 寶可夢大師",
}

# 連續打卡獎勵
STREAK_BONUSES = {
    3:  5,
    7:  15,
    14: 30,
    30: 100,
}

# 每日寶可夢推送時間（UTC，台北 07:30 = UTC 23:30 前一天）
DAILY_POKEMON_HOUR = 23
DAILY_POKEMON_MINUTE = 30

def get_title(level: int) -> str:
    """取得目前等級的稱號"""
    title = LEVEL_TITLES[1]
    for lvl, t in sorted(LEVEL_TITLES.items()):
        if level >= lvl:
            title = t
    return title

def xp_for_level(level: int) -> int:
    """計算到達該等級所需的累計 XP"""
    return LEVEL_FORMULA(level)
