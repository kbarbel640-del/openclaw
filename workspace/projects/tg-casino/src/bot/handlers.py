"""Telegram Bot Handlers"""
import logging
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from ..db import AsyncSessionLocal
from ..db.models import User, Bet, Transaction, WithdrawalRequest
from ..wallet.usdt import generate_wallet, format_balance, validate_address
from ..games.dice import play_dice, format_dice_result, DICE_PRESETS, calculate_multiplier
from ..games.provably_fair import generate_server_seed, generate_client_seed, hash_seed
from ..config import (
    REDIS_URL,
    ADMIN_TELEGRAM_IDS,
    MIN_WITHDRAWAL,
    MAX_WITHDRAWAL,
    DAILY_WITHDRAWAL_LIMIT,
    AUTO_APPROVE_MAX,
)

logger = logging.getLogger(__name__)


# === 語言檢測 ===

def detect_language(update: Update) -> str:
    """從用戶語言設置檢測語言"""
    lang_code = update.effective_user.language_code or 'en'
    if lang_code.startswith('zh'):
        return 'zh'
    return 'en'


# === 消息模板 ===

MESSAGES = {
    'zh': {
        'welcome': """
🎰 **歡迎來到 TG Casino！**

你的專屬錢包已創建 ✅

💰 **充值地址 (USDT-TRC20):**
`{address}`

📋 **指令列表:**
• /deposit - 查看充值地址
• /balance - 查看餘額
• /dice - 骰子遊戲
• /withdraw - 提款
• /help - 幫助

祝你好運！🍀
""",
        'balance': """
💰 **你的錢包**

餘額: **{balance}**

📊 統計:
• 總充值: {deposited}
• 總提款: {withdrawn}
• 總下注: {wagered}
• 總獲勝: {won}
""",
        'deposit': """
💵 **充值 USDT**

請向以下地址轉賬 **USDT-TRC20**:

`{address}`

⚠️ 注意:
• 只接受 **TRC20** 網絡的 USDT
• 最低充值: 1 USDT
• 到賬時間: 1-5 分鐘

充值後自動到賬，無需確認。
""",
        'withdraw_usage': "用法: /withdraw <地址> <金額>\n例如: /withdraw TXxxxxx 100",
        'withdraw_invalid_address': "❌ 地址格式錯誤，請輸入有效的 TRON 地址",
        'withdraw_invalid_amount': "❌ 金額格式錯誤",
        'withdraw_insufficient': "❌ 餘額不足\n當前餘額: {balance}",
        'withdraw_success': """
✅ **提款請求已提交**

金額: **{amount} USDT**
地址: `{address}`

預計 10 分鐘內到賬。
""",
        'dice_usage': """
🎲 **骰子遊戲**

用法: /dice <金額> <大/小> [目標]

例如:
• `/dice 10 大` - 下注 10 USDT，猜大於 50
• `/dice 10 小 30` - 下注 10 USDT，猜小於 30

或點擊下方按鈕快速下注 👇
""",
        'dice_insufficient': "❌ 餘額不足\n當前餘額: {balance}",
        'error': "❌ 發生錯誤，請稍後再試",
    },
    'en': {
        'welcome': """
🎰 **Welcome to TG Casino!**

Your wallet has been created ✅

💰 **Deposit Address (USDT-TRC20):**
`{address}`

📋 **Commands:**
• /deposit - View deposit address
• /balance - Check balance
• /dice - Dice game
• /withdraw - Withdraw
• /help - Help

Good luck! 🍀
""",
        'balance': """
💰 **Your Wallet**

Balance: **{balance}**

📊 Stats:
• Total Deposited: {deposited}
• Total Withdrawn: {withdrawn}
• Total Wagered: {wagered}
• Total Won: {won}
""",
        'deposit': """
💵 **Deposit USDT**

Send **USDT-TRC20** to this address:

`{address}`

⚠️ Note:
• Only **TRC20** network USDT accepted
• Minimum: 1 USDT
• Arrival time: 1-5 minutes

Deposits are credited automatically.
""",
        'withdraw_usage': "Usage: /withdraw <address> <amount>\nExample: /withdraw TXxxxxx 100",
        'withdraw_invalid_address': "❌ Invalid address format",
        'withdraw_invalid_amount': "❌ Invalid amount",
        'withdraw_insufficient': "❌ Insufficient balance\nCurrent: {balance}",
        'withdraw_success': """
✅ **Withdrawal Request Submitted**

Amount: **{amount} USDT**
Address: `{address}`

Expected arrival: ~10 minutes.
""",
        'dice_usage': """
🎲 **Dice Game**

Usage: /dice <amount> <over/under> [target]

Examples:
• `/dice 10 over` - Bet 10 USDT, over 50
• `/dice 10 under 30` - Bet 10 USDT, under 30

Or use the buttons below 👇
""",
        'dice_insufficient': "❌ Insufficient balance\nCurrent: {balance}",
        'error': "❌ An error occurred, please try again",
    }
}


def msg(key: str, lang: str, **kwargs) -> str:
    """獲取本地化消息"""
    template = MESSAGES.get(lang, MESSAGES['en']).get(key, MESSAGES['en'].get(key, ''))
    return template.format(**kwargs) if kwargs else template


# === Handlers ===

def _is_admin(update: Update) -> bool:
    return update.effective_user and update.effective_user.id in ADMIN_TELEGRAM_IDS

async def get_or_create_user(session: AsyncSession, telegram_id: int, username: str = None, lang: str = 'en') -> User:
    """獲取或創建用戶"""
    result = await session.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    
    if not user:
        # 創建新用戶
        wallet = generate_wallet()
        user = User(
            telegram_id=telegram_id,
            username=username,
            language=lang,
            usdt_address=wallet.address,
            usdt_private_key_encrypted=wallet.private_key_encrypted,
            server_seed=generate_server_seed(),
            client_seed=generate_client_seed(),
            nonce=0,
            balance=0.0
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    
    return user


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理 /start 命令"""
    lang = detect_language(update)
    
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(
            session,
            update.effective_user.id,
            update.effective_user.username,
            lang
        )
        
        await update.message.reply_text(
            msg('welcome', lang, address=user.usdt_address),
            parse_mode='Markdown'
        )


async def balance_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理 /balance 命令"""
    lang = detect_language(update)
    
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session, update.effective_user.id, lang=lang)
        
        await update.message.reply_text(
            msg('balance', lang,
                balance=format_balance(user.balance),
                deposited=format_balance(user.total_deposited),
                withdrawn=format_balance(user.total_withdrawn),
                wagered=format_balance(user.total_wagered),
                won=format_balance(user.total_won)
            ),
            parse_mode='Markdown'
        )


async def deposit_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理 /deposit 命令"""
    lang = detect_language(update)
    
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session, update.effective_user.id, lang=lang)
        
        await update.message.reply_text(
            msg('deposit', lang, address=user.usdt_address),
            parse_mode='Markdown'
        )


async def withdraw_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理 /withdraw 命令"""
    lang = detect_language(update)
    args = context.args
    
    # 檢查參數
    if len(args) < 2:
        await update.message.reply_text(msg('withdraw_usage', lang))
        return
    
    address = args[0]
    
    # 驗證地址
    if not validate_address(address):
        await update.message.reply_text(msg('withdraw_invalid_address', lang))
        return
    
    # 解析金額
    try:
        amount = float(args[1])
    except ValueError:
        await update.message.reply_text(msg('withdraw_invalid_amount', lang))
        return

    if amount < MIN_WITHDRAWAL or amount > MAX_WITHDRAWAL:
        await update.message.reply_text(
            f"❌ 提款範圍: {MIN_WITHDRAWAL} - {MAX_WITHDRAWAL} USDT"
        )
        return
    
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session, update.effective_user.id, lang=lang)
        
        # 檢查餘額
        if user.balance < amount:
            await update.message.reply_text(
                msg('withdraw_insufficient', lang, balance=format_balance(user.balance))
            )
            return

        # 檢查日限額
        today = datetime.utcnow() - timedelta(hours=24)
        daily_total = await session.execute(
            select(func.coalesce(func.sum(WithdrawalRequest.amount), 0))
            .where(
                WithdrawalRequest.user_id == user.id,
                WithdrawalRequest.requested_at >= today,
                WithdrawalRequest.status.in_(["pending", "approved", "processing", "completed"])
            )
        )
        daily_total = daily_total.scalar() or 0
        if daily_total + amount > DAILY_WITHDRAWAL_LIMIT:
            await update.message.reply_text("❌ 超過每日提款上限")
            return
        
        # 扣除餘額並凍結
        user.balance -= amount
        user.frozen_balance += amount

        # 建立提款請求
        request = WithdrawalRequest(
            user_id=user.id,
            amount=amount,
            to_address=address,
            status='pending'
        )
        session.add(request)
        await session.commit()
        await session.refresh(request)

        # 自動審核
        if amount <= AUTO_APPROVE_MAX:
            request.status = "approved"
            request.approved_at = datetime.utcnow()
            await session.commit()

            # 推入提款隊列
            r = redis.from_url(REDIS_URL)
            await r.lpush("withdrawal:queue", request.id)

        await update.message.reply_text(
            msg('withdraw_success', lang, amount=amount, address=address),
            parse_mode='Markdown'
        )


async def dice_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理 /dice 命令"""
    lang = detect_language(update)
    args = context.args
    
    # 沒有參數，顯示用法和快速下注按鈕
    if not args:
        keyboard = [
            [
                InlineKeyboardButton("🎲 10 USDT 大於 50", callback_data="dice_10_over_50"),
                InlineKeyboardButton("🎲 10 USDT 小於 50", callback_data="dice_10_under_50"),
            ],
            [
                InlineKeyboardButton("🎲 50 USDT 大於 50", callback_data="dice_50_over_50"),
                InlineKeyboardButton("🎲 50 USDT 小於 50", callback_data="dice_50_under_50"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            msg('dice_usage', lang),
            parse_mode='Markdown',
            reply_markup=reply_markup
        )
        return
    
    # 解析參數
    try:
        amount = float(args[0])
        bet_type_raw = args[1].lower()
        target = int(args[2]) if len(args) > 2 else 50
        
        # 轉換中文
        if bet_type_raw in ['大', 'over', 'o', '>']:
            bet_type = 'over'
        elif bet_type_raw in ['小', 'under', 'u', '<']:
            bet_type = 'under'
        else:
            raise ValueError("Invalid bet type")
            
    except (ValueError, IndexError):
        await update.message.reply_text(msg('dice_usage', lang), parse_mode='Markdown')
        return
    
    # 執行遊戲
    await execute_dice(update, amount, bet_type, target, lang)


async def execute_dice(update: Update, amount: float, bet_type: str, target: int, lang: str):
    """執行骰子遊戲"""
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session, update.effective_user.id, lang=lang)
        
        # 檢查餘額
        if user.balance < amount:
            if update.callback_query:
                await update.callback_query.answer(
                    "餘額不足" if lang == 'zh' else "Insufficient balance",
                    show_alert=True
                )
            else:
                await update.message.reply_text(
                    msg('dice_insufficient', lang, balance=format_balance(user.balance))
                )
            return
        
        # 扣除下注金額
        user.balance -= amount
        user.total_wagered += amount
        
        # 執行遊戲
        result = play_dice(
            amount=amount,
            target=target,
            bet_type=bet_type,
            server_seed=user.server_seed,
            client_seed=user.client_seed,
            nonce=user.nonce
        )
        
        # 更新 nonce
        user.nonce += 1
        
        # 更新餘額
        if result.is_win:
            user.balance += result.payout
            user.total_won += result.payout
        
        # 記錄下注
        bet = Bet(
            user_id=user.id,
            game='dice',
            amount=amount,
            bet_data=f'{{"target": {target}, "type": "{bet_type}"}}',
            result_data=f'{{"roll": {result.roll}}}',
            server_seed_hash=result.server_seed_hash,
            client_seed=result.client_seed,
            nonce=result.nonce,
            multiplier=result.multiplier,
            payout=result.payout,
            profit=result.profit,
            is_win=result.is_win
        )
        session.add(bet)
        await session.commit()
        
        # 發送結果
        message = format_dice_result(result, lang)
        message += f"\n💰 當前餘額: **{format_balance(user.balance)}**"
        
        # 再來一局按鈕
        keyboard = [[
            InlineKeyboardButton(
                "🔄 再來一局" if lang == 'zh' else "🔄 Play Again",
                callback_data=f"dice_{int(amount)}_{bet_type}_{target}"
            )
        ]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        if update.callback_query:
            await update.callback_query.message.reply_text(
                message,
                parse_mode='Markdown',
                reply_markup=reply_markup
            )
        else:
            await update.message.reply_text(
                message,
                parse_mode='Markdown',
                reply_markup=reply_markup
            )


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理按鈕回調"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    lang = detect_language(update)
    
    if data.startswith('dice_'):
        # dice_金額_類型_目標
        parts = data.split('_')
        amount = float(parts[1])
        bet_type = parts[2]
        target = int(parts[3])
        
        await execute_dice(update, amount, bet_type, target, lang)


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """處理 /help 命令"""
    lang = detect_language(update)
    
    if lang == 'zh':
        text = """
📚 **幫助**

**遊戲:**
• /dice - 骰子遊戲

**錢包:**
• /deposit - 充值 USDT
• /balance - 查看餘額
• /withdraw - 提款

**其他:**
• /seed - 查看/更換種子
• /verify - 驗證遊戲公平性
• /support - 聯繫客服

---
🔐 所有遊戲使用 Provably Fair 算法
可驗證每一局的公平性
"""
    else:
        text = """
📚 **Help**

**Games:**
• /dice - Dice game

**Wallet:**
• /deposit - Deposit USDT
• /balance - Check balance
• /withdraw - Withdraw

**Other:**
• /seed - View/change seeds
• /verify - Verify game fairness
• /support - Contact support

---
🔐 All games use Provably Fair algorithm
Every round can be verified
"""
    
    await update.message.reply_text(text, parse_mode='Markdown')


# === Admin commands ===

async def pending_withdrawals_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_admin(update):
        return

    async with AsyncSessionLocal() as session:
        rows = await session.execute(
            select(WithdrawalRequest).where(WithdrawalRequest.status == "pending").order_by(WithdrawalRequest.requested_at)
        )
        requests = rows.scalars().all()

    if not requests:
        await update.message.reply_text("✅ 沒有待審核提款")
        return

    lines = ["📋 待審核提款："]
    for r in requests[:30]:
        lines.append(f"- #{r.id} | user:{r.user_id} | {r.amount} USDT | {r.to_address}")
    await update.message.reply_text("\n".join(lines))


async def approve_withdrawal_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_admin(update):
        return

    if not context.args:
        await update.message.reply_text("用法: /approve <request_id>")
        return

    try:
        request_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("request_id 必須是數字")
        return

    async with AsyncSessionLocal() as session:
        req = await session.get(WithdrawalRequest, request_id)
        if not req or req.status != "pending":
            await update.message.reply_text("找不到待審核提款")
            return

        req.status = "approved"
        req.approved_at = datetime.utcnow()
        await session.commit()

    r = redis.from_url(REDIS_URL)
    await r.lpush("withdrawal:queue", request_id)
    await update.message.reply_text(f"✅ 已審核通過 #{request_id}")


async def reject_withdrawal_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not _is_admin(update):
        return

    if len(context.args) < 1:
        await update.message.reply_text("用法: /reject <request_id> [reason]")
        return

    try:
        request_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("request_id 必須是數字")
        return

    reason = " ".join(context.args[1:]) if len(context.args) > 1 else "rejected"

    async with AsyncSessionLocal() as session:
        req = await session.get(WithdrawalRequest, request_id)
        if not req or req.status != "pending":
            await update.message.reply_text("找不到待審核提款")
            return

        user = await session.get(User, req.user_id)
        if user:
            user.balance += req.amount
            user.frozen_balance = max(0.0, user.frozen_balance - req.amount)

        req.status = "rejected"
        req.reject_reason = reason
        await session.commit()

    await update.message.reply_text(f"✅ 已拒絕 #{request_id}")
