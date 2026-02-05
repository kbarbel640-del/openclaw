"""
⚡ XP 系統 Cog
- 發訊息得 XP（冷卻 60 秒，每日上限 20）
- !rank 查看等級
- !xp 查看今日 XP
- !leaderboard 排行榜
"""
import time
import discord
from discord.ext import commands
from config import (
    XP_PER_MESSAGE, XP_MESSAGE_COOLDOWN, XP_MESSAGE_DAILY_CAP,
    get_title, xp_for_level,
)
from database import get_user, add_xp, get_daily_message_xp, get_leaderboard


class XPCog(commands.Cog, name="XP 系統"):
    def __init__(self, bot):
        self.bot = bot
        self._cooldowns = {}  # user_id -> last_xp_time

    @commands.Cog.listener()
    async def on_message(self, message):
        """每則訊息自動給 XP"""
        if message.author.bot:
            return
        # 忽略指令訊息
        if message.content.startswith("!"):
            return

        user_id = str(message.author.id)
        now = time.time()

        # 冷卻檢查
        last = self._cooldowns.get(user_id, 0)
        if now - last < XP_MESSAGE_COOLDOWN:
            return

        # 每日上限檢查
        today_xp = await get_daily_message_xp(user_id)
        if today_xp >= XP_MESSAGE_DAILY_CAP:
            return

        # 給 XP
        self._cooldowns[user_id] = now
        result = await add_xp(user_id, XP_PER_MESSAGE, "message")

        # 升級通知
        if result["leveled_up"]:
            title = get_title(result["level"])
            embed = discord.Embed(
                title="🎉 升級啦！！！",
                description=(
                    f"**{message.author.display_name}** 升到了 **Lv.{result['level']}**！\n"
                    f"新稱號：**{title}**\n\n"
                    f"繼續加油，訓練師！💪⚡"
                ),
                color=0xFFD700,
            )
            await message.channel.send(embed=embed)

    @commands.command(name="rank")
    async def rank(self, ctx):
        """查看你的等級和 XP"""
        user = await get_user(str(ctx.author.id))
        level = user["level"]
        xp = user["xp"]
        title = get_title(level)
        next_level_xp = xp_for_level(level + 1) if level < 50 else xp

        # 進度條
        current_level_xp = xp_for_level(level)
        progress = (xp - current_level_xp) / max(next_level_xp - current_level_xp, 1)
        bar_len = 15
        filled = int(progress * bar_len)
        bar = "█" * filled + "░" * (bar_len - filled)

        embed = discord.Embed(
            title=f"📊 {ctx.author.display_name} 的訓練師檔案",
            color=0x3498DB,
        )
        embed.add_field(name="等級", value=f"**Lv.{level}**", inline=True)
        embed.add_field(name="稱號", value=title, inline=True)
        embed.add_field(name="總 XP", value=f"**{xp:,}**", inline=True)
        embed.add_field(
            name=f"升級進度（→ Lv.{level + 1}）",
            value=f"`{bar}` {xp:,}/{next_level_xp:,}",
            inline=False,
        )
        embed.set_footer(text="每天發訊息、打卡、猜卡都能得到 XP 喔！⚡")
        await ctx.send(embed=embed)

    @commands.command(name="xp")
    async def xp_info(self, ctx):
        """查看今日 XP 獲得明細"""
        user = await get_user(str(ctx.author.id))
        today_msg_xp = await get_daily_message_xp(str(ctx.author.id))

        embed = discord.Embed(
            title=f"⚡ {ctx.author.display_name} 的今日 XP",
            color=0xF1C40F,
        )
        embed.add_field(name="💬 訊息 XP", value=f"{today_msg_xp}/{XP_MESSAGE_DAILY_CAP}", inline=True)
        embed.add_field(name="📊 總 XP", value=f"{user['xp']:,}", inline=True)
        embed.add_field(
            name="💡 獲得更多 XP 的方法",
            value=(
                "• 每日打卡 `!daily` (+15)\n"
                "• 猜寶可夢 `!猜卡` (+5~15)\n"
                "• 繼續聊天！ (+2/則)"
            ),
            inline=False,
        )
        await ctx.send(embed=embed)

    @commands.command(name="leaderboard", aliases=["lb", "排行"])
    async def leaderboard(self, ctx):
        """XP 排行榜"""
        rows = await get_leaderboard(10)
        if not rows:
            await ctx.send("還沒有任何訓練師的資料！快開始你的冒險吧 🚀")
            return

        medals = ["🥇", "🥈", "🥉"]
        lines = []
        for i, row in enumerate(rows):
            medal = medals[i] if i < 3 else f"`{i+1}.`"
            title = get_title(row["level"])
            # 嘗試取得使用者名稱
            user = self.bot.get_user(int(row["user_id"]))
            name = user.display_name if user else f"訓練師#{row['user_id'][-4:]}"
            lines.append(f"{medal} **{name}** — Lv.{row['level']} | {row['xp']:,} XP")

        embed = discord.Embed(
            title="🏆 訓練師排行榜",
            description="\n".join(lines),
            color=0xE74C3C,
        )
        await ctx.send(embed=embed)


async def setup(bot):
    await bot.add_cog(XPCog(bot))
