"""
📅 每日系統 Cog
- !daily 每日打卡
- !pokemon 今日寶可夢知識
- 自動推送每日寶可夢（排程）
"""
import json
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

import discord
from discord.ext import commands, tasks

from config import XP_CHECKIN, STREAK_BONUSES, get_title
from database import do_checkin, add_xp, get_user

# 台北時區
TPE = timezone(timedelta(hours=8))

# 載入寶可夢資料
DATA_DIR = Path(__file__).parent.parent / "data"
with open(DATA_DIR / "pokemon_gen1.json", "r", encoding="utf-8") as f:
    POKEMON_DATA = json.load(f)


def get_daily_pokemon() -> dict:
    """根據今天日期取得一隻寶可夢（每天固定一隻）"""
    today = datetime.now(TPE)
    day_of_year = today.timetuple().tm_yday
    idx = day_of_year % len(POKEMON_DATA)
    return POKEMON_DATA[idx]


def pokemon_embed(poke: dict) -> discord.Embed:
    """建立寶可夢知識卡 Embed"""
    type_emoji = {
        "火": "🔥", "水": "💧", "草": "🌿", "電": "⚡", "一般": "⚪",
        "格鬥": "🥊", "毒": "☠️", "地面": "🌍", "飛行": "🦅", "超能力": "🔮",
        "蟲": "🐛", "岩石": "🪨", "幽靈": "👻", "龍": "🐉", "冰": "❄️",
        "鋼": "⚙️", "妖精": "🧚", "暗": "🌑",
    }
    ptype = poke.get("type", ["一般"])[0]
    emoji = type_emoji.get(ptype, "❓")

    embed = discord.Embed(
        title=f"🌟 今日寶可夢 #{poke['id']:03d} — {poke['name_zh']} {poke['name_en']}",
        color=0x3498DB,
    )
    embed.add_field(name="屬性", value=f"{emoji} {' / '.join(poke['type'])}", inline=True)
    embed.add_field(name="HP", value=str(poke.get("hp", "?")), inline=True)

    if poke.get("evolution"):
        embed.add_field(name="進化鏈", value=poke["evolution"], inline=False)

    if poke.get("moves"):
        moves_str = " ｜ ".join(poke["moves"][:3])
        embed.add_field(name="代表招式", value=moves_str, inline=False)

    if poke.get("fun_fact"):
        embed.add_field(name="💡 冷知識", value=poke["fun_fact"], inline=False)

    embed.set_footer(text="每天認識一隻寶可夢，成為真正的訓練師！🎓")
    return embed


class DailyCog(commands.Cog, name="每日系統"):
    def __init__(self, bot):
        self.bot = bot

    @commands.command(name="daily", aliases=["打卡", "簽到"])
    async def daily_checkin(self, ctx):
        """每日打卡！連續打卡有額外獎勵 🔥"""
        user_id = str(ctx.author.id)
        result = await do_checkin(user_id)

        if result["already_done"]:
            embed = discord.Embed(
                title="📅 今天已經打卡過囉！",
                description=f"你的連續打卡：**{result['streak']} 天** 🔥\n明天再來！",
                color=0x95A5A6,
            )
            await ctx.send(embed=embed)
            return

        # 打卡成功，給 XP
        xp_result = await add_xp(user_id, XP_CHECKIN, "checkin")
        streak = result["streak"]
        bonus = result["bonus"]

        # 連續獎勵
        if bonus > 0:
            await add_xp(user_id, bonus, "streak_bonus")

        # 找下一個里程碑
        next_milestone = None
        for days in sorted(STREAK_BONUSES.keys()):
            if streak < days:
                next_milestone = days
                break

        desc = f"**+{XP_CHECKIN} XP** 打卡獎勵！\n"
        desc += f"🔥 連續打卡：**{streak} 天**\n"
        if bonus > 0:
            desc += f"🎁 連續 {streak} 天獎勵：**+{bonus} XP**！\n"
        if next_milestone:
            desc += f"\n再打卡 **{next_milestone - streak} 天** 就有下一個獎勵！加油 💪"

        embed = discord.Embed(
            title="✅ 打卡成功！",
            description=desc,
            color=0x2ECC71,
        )

        # 升級通知
        if xp_result["leveled_up"]:
            title = get_title(xp_result["level"])
            embed.add_field(
                name="🎉 升級了！",
                value=f"Lv.{xp_result['old_level']} → **Lv.{xp_result['level']}** {title}",
                inline=False,
            )

        await ctx.send(embed=embed)

    @commands.command(name="pokemon", aliases=["寶可夢", "今日寶可夢"])
    async def daily_pokemon(self, ctx):
        """查看今日寶可夢知識卡"""
        poke = get_daily_pokemon()
        embed = pokemon_embed(poke)
        await ctx.send(embed=embed)


async def setup(bot):
    await bot.add_cog(DailyCog(bot))
