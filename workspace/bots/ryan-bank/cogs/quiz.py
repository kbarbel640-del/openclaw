"""
🎮 猜卡遊戲 Cog
- !猜卡 開始猜寶可夢遊戲
- 三個提示，越早猜對 XP 越高
"""
import json
import random
from pathlib import Path

import discord
from discord.ext import commands

from config import XP_QUIZ_CORRECT, XP_QUIZ_WRONG
from database import add_xp

# 載入寶可夢資料
DATA_DIR = Path(__file__).parent.parent / "data"
with open(DATA_DIR / "pokemon_gen1.json", "r", encoding="utf-8") as f:
    POKEMON_DATA = json.load(f)

# XP 獎勵：提示1猜對=15, 提示2=10, 提示3=5
HINT_XP = {1: 15, 2: 10, 3: 5}


class QuizSession:
    """一場猜卡遊戲的狀態"""
    def __init__(self, pokemon: dict):
        self.pokemon = pokemon
        self.hint_level = 0  # 0=還沒給提示, 1-3=已給幾個提示
        self.hints = self._generate_hints()
        self.answered = False

    def _generate_hints(self) -> list:
        """產生三個由模糊到具體的提示"""
        p = self.pokemon
        hints = []

        # 提示 1：屬性
        types = " / ".join(p.get("type", ["???"])) 
        hints.append(f"我是 **{types}** 屬性的寶可夢")

        # 提示 2：特徵（從 hints 欄位或 fun_fact）
        if p.get("hints") and len(p["hints"]) > 0:
            hints.append(p["hints"][0])
        elif p.get("fun_fact"):
            hints.append(p["fun_fact"])
        else:
            hints.append(f"我的 HP 是 **{p.get('hp', '???')}**")

        # 提示 3：更明確的線索
        if p.get("hints") and len(p["hints"]) > 1:
            hints.append(p["hints"][1])
        elif p.get("evolution"):
            hints.append(f"我的進化鏈是：{p['evolution']}")
        else:
            hints.append(f"我的圖鑑編號是 **#{p['id']:03d}**")

        return hints

    def get_next_hint(self) -> str | None:
        """取得下一個提示，None 表示沒有更多提示"""
        if self.hint_level >= 3:
            return None
        hint = self.hints[self.hint_level]
        self.hint_level += 1
        return hint

    def check_answer(self, answer: str) -> bool:
        """檢查答案是否正確"""
        answer = answer.strip().lower()
        correct = [
            self.pokemon["name_zh"].lower(),
            self.pokemon["name_en"].lower(),
        ]
        return answer in correct


class QuizCog(commands.Cog, name="猜卡遊戲"):
    def __init__(self, bot):
        self.bot = bot
        self._sessions = {}  # user_id -> QuizSession

    @commands.command(name="猜卡", aliases=["guess", "quiz"])
    async def start_quiz(self, ctx):
        """開始猜寶可夢遊戲！🔮"""
        user_id = str(ctx.author.id)

        # 如果已有進行中的遊戲
        if user_id in self._sessions and not self._sessions[user_id].answered:
            await ctx.send("你還有一場猜卡遊戲在進行中喔！回答或輸入 `!放棄` 結束它 😉")
            return

        # 隨機選一隻寶可夢
        pokemon = random.choice(POKEMON_DATA)
        session = QuizSession(pokemon)
        self._sessions[user_id] = session

        # 給第一個提示
        hint = session.get_next_hint()
        embed = discord.Embed(
            title="🔮 猜猜我是誰？",
            description=f"**提示 1**：{hint}",
            color=0x9B59B6,
        )
        embed.add_field(
            name="怎麼玩？",
            value=(
                "直接打寶可夢的名字來猜！（中文或英文都行）\n"
                "輸入 `!提示` 看下一個提示\n"
                "輸入 `!放棄` 看答案\n\n"
                f"🏆 第 1 提示猜對 = **+{HINT_XP[1]} XP**"
            ),
            inline=False,
        )
        await ctx.send(embed=embed)

    @commands.command(name="提示", aliases=["hint"])
    async def next_hint(self, ctx):
        """看下一個猜卡提示"""
        user_id = str(ctx.author.id)
        session = self._sessions.get(user_id)

        if not session or session.answered:
            await ctx.send("你沒有進行中的猜卡遊戲！輸入 `!猜卡` 開始一場 🎮")
            return

        hint = session.get_next_hint()
        if hint is None:
            await ctx.send("沒有更多提示了！直接猜或輸入 `!放棄` 看答案 🤔")
            return

        level = session.hint_level
        xp = HINT_XP.get(level, 5)
        embed = discord.Embed(
            title=f"🔍 提示 {level}",
            description=hint,
            color=0x9B59B6,
        )
        embed.set_footer(text=f"現在猜對 = +{xp} XP")
        await ctx.send(embed=embed)

    @commands.command(name="放棄", aliases=["giveup"])
    async def give_up(self, ctx):
        """放棄這場猜卡遊戲"""
        user_id = str(ctx.author.id)
        session = self._sessions.get(user_id)

        if not session or session.answered:
            await ctx.send("你沒有進行中的猜卡遊戲！")
            return

        session.answered = True
        p = session.pokemon
        embed = discord.Embed(
            title="😅 沒關係，下次再接再厲！",
            description=f"答案是：**{p['name_zh']}**（{p['name_en']}）#{p['id']:03d}",
            color=0xE67E22,
        )
        if p.get("fun_fact"):
            embed.add_field(name="💡 你知道嗎？", value=p["fun_fact"], inline=False)
        await ctx.send(embed=embed)
        del self._sessions[user_id]

    @commands.Cog.listener()
    async def on_message(self, message):
        """監聽訊息，檢查是否是猜卡答案"""
        if message.author.bot:
            return
        if message.content.startswith("!"):
            return

        user_id = str(message.author.id)
        session = self._sessions.get(user_id)
        if not session or session.answered:
            return

        # 檢查答案
        if session.check_answer(message.content):
            session.answered = True
            level = session.hint_level
            xp = HINT_XP.get(level, 5)
            result = await add_xp(user_id, xp, "quiz")
            p = session.pokemon

            embed = discord.Embed(
                title="🎉 答對了！太厲害了！",
                description=(
                    f"沒錯！就是 **{p['name_zh']}**（{p['name_en']}）！\n"
                    f"用了 {level} 個提示猜出來，**+{xp} XP**！\n"
                    f"你現在有 **{result['xp']:,} XP** 💫"
                ),
                color=0x2ECC71,
            )
            if p.get("fun_fact"):
                embed.add_field(name="💡 你知道嗎？", value=p["fun_fact"], inline=False)

            if result["leveled_up"]:
                from config import get_title
                title = get_title(result["level"])
                embed.add_field(
                    name="🎉 升級了！",
                    value=f"**Lv.{result['level']}** {title}",
                    inline=False,
                )

            await message.channel.send(embed=embed)
            del self._sessions[user_id]


async def setup(bot):
    await bot.add_cog(QuizCog(bot))
