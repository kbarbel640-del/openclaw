"""App configuration"""
import os
from typing import Optional


def _get_env(name: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    val = os.getenv(name, default)
    if required and not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


# Core
BOT_TOKEN = _get_env("BOT_TOKEN")
DATABASE_URL = _get_env("DATABASE_URL", "sqlite:///./casino.db")
REDIS_URL = _get_env("REDIS_URL", "redis://localhost:6379/0")

# Wallet / security
WALLET_ENCRYPTION_KEY = _get_env("WALLET_ENCRYPTION_KEY", required=True)
HOT_WALLET_PRIVATE_KEY = _get_env("HOT_WALLET_PRIVATE_KEY")
HOT_WALLET_ADDRESS = _get_env("HOT_WALLET_ADDRESS")

# TronGrid
TRONGRID_API_KEY = _get_env("TRONGRID_API_KEY")

# Admins
ADMIN_TELEGRAM_IDS = [
    int(x.strip()) for x in (_get_env("ADMIN_TELEGRAM_IDS", "") or "").split(",") if x.strip().isdigit()
]

# Withdrawal limits
MIN_WITHDRAWAL = float(_get_env("MIN_WITHDRAWAL", "10"))
MAX_WITHDRAWAL = float(_get_env("MAX_WITHDRAWAL", "10000"))
DAILY_WITHDRAWAL_LIMIT = float(_get_env("DAILY_WITHDRAWAL_LIMIT", "50000"))
AUTO_APPROVE_MAX = float(_get_env("AUTO_APPROVE_MAX", "500"))
