"""
🏦 Ryan 成長銀行 — Discord Bot
================================
Ryan 的寶可夢主題成長系統！
發訊息得 XP、每日打卡、猜卡遊戲、等級稱號。

用法：
  export DISCORD_BOT_TOKEN=你的token
  python main.py
"""
import asyncio
import discord
from discord.ext import commands
from config import BOT_TOKEN
from database import init_db

# Bot 設定
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    help_command=None,  # 自訂 help
)


@bot.event
async def on_ready():
    """Bot 啟動完成"""
    await init_db()
    print(f"🏦 Ryan 成長銀行上線！ | {bot.user}")
    print(f"📡 伺服器數量：{len(bot.guilds)}")


@bot.command(name="help")
async def help_cmd(ctx):
    """顯示所有指令"""
    embed = discord.Embed(
        title="🏦 Ryan 成長銀行 — 指令表",
        description="歡迎來到寶可夢訓練師的世界！⚡",
        color=0xFFD700,
    )
    embed.add_field(
        name="📊 基本指令",
        value=(
            "`!rank` — 查看你的等級和 XP\n"
            "`!xp` — 查看今日 XP 明細\n"
            "`!daily` — 每日打卡（+15 XP！）\n"
            "`!leaderboard` — 排行榜\n"
        ),
        inline=False,
    )
    embed.add_field(
        name="🎮 遊戲指令",
        value=(
            "`!猜卡` — 開始猜寶可夢遊戲\n"
            "`!pokemon` — 今日寶可夢知識\n"
        ),
        inline=False,
    )
    embed.add_field(
        name="💡 小提示",
        value="每天發訊息也能得 XP 喔！連續打卡有額外獎勵 🔥",
        inline=False,
    )
    await ctx.send(embed=embed)


async def load_cogs():
    """載入所有 Cog 模組"""
    cog_list = [
        "cogs.xp",
        "cogs.daily",
        "cogs.quiz",
    ]
    for cog in cog_list:
        try:
            await bot.load_extension(cog)
            print(f"  ✅ 載入 {cog}")
        except Exception as e:
            print(f"  ❌ 載入 {cog} 失敗：{e}")


async def main():
    if not BOT_TOKEN:
        print("❌ 請設定環境變數 DISCORD_BOT_TOKEN")
        return
    async with bot:
        await load_cogs()
        await bot.start(BOT_TOKEN)


if __name__ == "__main__":
    asyncio.run(main())
