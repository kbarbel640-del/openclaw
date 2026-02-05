"""Ryan 成長銀行 — SQLite 資料庫管理"""
import aiosqlite
from config import DB_PATH

async def init_db():
    """初始化資料庫表"""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                partner_pokemon TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS xp_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                amount INTEGER,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS checkins (
                user_id TEXT,
                date TEXT,
                streak INTEGER DEFAULT 1,
                PRIMARY KEY (user_id, date)
            );

            CREATE TABLE IF NOT EXISTS collection (
                user_id TEXT,
                pokemon_id INTEGER,
                rarity TEXT,
                obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                obtained_via TEXT,
                PRIMARY KEY (user_id, pokemon_id)
            );

            CREATE TABLE IF NOT EXISTS achievements (
                user_id TEXT,
                badge_id TEXT,
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, badge_id)
            );

            CREATE TABLE IF NOT EXISTS quiz_state (
                user_id TEXT PRIMARY KEY,
                pokemon_id INTEGER,
                hint_level INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await db.commit()


async def get_user(user_id: str):
    """取得使用者資料，不存在則建立"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        row = await cursor.fetchone()
        if row:
            return dict(row)
        # 新使用者
        await db.execute(
            "INSERT INTO users (user_id, xp, level) VALUES (?, 0, 1)",
            (user_id,)
        )
        await db.commit()
        return {"user_id": user_id, "xp": 0, "level": 1, "partner_pokemon": None}


async def add_xp(user_id: str, amount: int, reason: str) -> dict:
    """增加 XP 並檢查升級，回傳 {xp, level, leveled_up, new_level}"""
    from config import xp_for_level
    async with aiosqlite.connect(DB_PATH) as db:
        # 確保使用者存在
        await db.execute(
            "INSERT OR IGNORE INTO users (user_id, xp, level) VALUES (?, 0, 1)",
            (user_id,)
        )
        # 加 XP
        await db.execute(
            "UPDATE users SET xp = xp + ? WHERE user_id = ?",
            (amount, user_id)
        )
        # 記錄
        await db.execute(
            "INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)",
            (user_id, amount, reason)
        )
        await db.commit()

        # 讀取最新資料
        cursor = await db.execute(
            "SELECT xp, level FROM users WHERE user_id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        xp, level = row[0], row[1]

        # 檢查升級
        leveled_up = False
        new_level = level
        while new_level < 50 and xp >= xp_for_level(new_level + 1):
            new_level += 1
            leveled_up = True

        if leveled_up:
            await db.execute(
                "UPDATE users SET level = ? WHERE user_id = ?",
                (new_level, user_id)
            )
            await db.commit()

        return {
            "xp": xp,
            "level": new_level,
            "leveled_up": leveled_up,
            "old_level": level,
        }


async def do_checkin(user_id: str) -> dict:
    """執行打卡，回傳 {streak, bonus, already_done}"""
    from datetime import datetime, timezone, timedelta
    tpe = timezone(timedelta(hours=8))
    today = datetime.now(tpe).strftime("%Y-%m-%d")
    yesterday = (datetime.now(tpe) - timedelta(days=1)).strftime("%Y-%m-%d")

    async with aiosqlite.connect(DB_PATH) as db:
        # 檢查今天是否已打卡
        cursor = await db.execute(
            "SELECT streak FROM checkins WHERE user_id = ? AND date = ?",
            (user_id, today)
        )
        row = await cursor.fetchone()
        if row:
            return {"streak": row[0], "bonus": 0, "already_done": True}

        # 查昨天的連續天數
        cursor = await db.execute(
            "SELECT streak FROM checkins WHERE user_id = ? AND date = ?",
            (user_id, yesterday)
        )
        row = await cursor.fetchone()
        streak = (row[0] + 1) if row else 1

        await db.execute(
            "INSERT INTO checkins (user_id, date, streak) VALUES (?, ?, ?)",
            (user_id, today, streak)
        )
        await db.commit()

        # 計算連續獎勵
        from config import STREAK_BONUSES
        bonus = STREAK_BONUSES.get(streak, 0)

        return {"streak": streak, "bonus": bonus, "already_done": False}


async def get_daily_message_xp(user_id: str) -> int:
    """取得今天已獲得的訊息 XP 總量"""
    from datetime import datetime, timezone, timedelta
    tpe = timezone(timedelta(hours=8))
    today = datetime.now(tpe).strftime("%Y-%m-%d")
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM xp_log WHERE user_id = ? AND reason = 'message' AND date(created_at) = ?",
            (user_id, today)
        )
        row = await cursor.fetchone()
        return row[0]


async def get_leaderboard(limit: int = 10):
    """取得排行榜"""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT user_id, xp, level FROM users ORDER BY xp DESC LIMIT ?",
            (limit,)
        )
        return [dict(r) for r in await cursor.fetchall()]
