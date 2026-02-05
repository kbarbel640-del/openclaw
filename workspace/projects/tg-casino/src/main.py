"""TG Casino - Main Entry Point"""
import os
import logging
from dotenv import load_dotenv

# 必須在 import handlers 之前載入環境變量！
load_dotenv()

from telegram.ext import Application, CommandHandler, CallbackQueryHandler

from .db import init_db
from .bot.handlers import (
    start_handler,
    balance_handler,
    deposit_handler,
    withdraw_handler,
    dice_handler,
    button_callback,
    help_handler,
    pending_withdrawals_handler,
    approve_withdrawal_handler,
    reject_withdrawal_handler,
)
from .config import BOT_TOKEN

# 設置日誌
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


def main():
    """啟動 Bot"""
    # 獲取 Token
    token = BOT_TOKEN
    if not token:
        logger.error("BOT_TOKEN not set!")
        return
    
    # 初始化數據庫
    logger.info("Initializing database...")
    init_db()
    
    # 創建 Application
    logger.info("Starting bot...")
    app = Application.builder().token(token).build()
    
    # 註冊 handlers
    app.add_handler(CommandHandler("start", start_handler))
    app.add_handler(CommandHandler("balance", balance_handler))
    app.add_handler(CommandHandler("deposit", deposit_handler))
    app.add_handler(CommandHandler("withdraw", withdraw_handler))
    app.add_handler(CommandHandler("dice", dice_handler))
    app.add_handler(CommandHandler("help", help_handler))

    # Admin commands
    app.add_handler(CommandHandler("withdraws", pending_withdrawals_handler))
    app.add_handler(CommandHandler("approve", approve_withdrawal_handler))
    app.add_handler(CommandHandler("reject", reject_withdrawal_handler))
    
    # 按鈕回調
    app.add_handler(CallbackQueryHandler(button_callback))
    
    # 啟動
    logger.info("Bot is running!")
    app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == '__main__':
    main()
