"""USDT Wallet Management (TRC20)"""
import os
from dataclasses import dataclass
from typing import Optional
from cryptography.fernet import Fernet
from tronpy.keys import PrivateKey

# 加密密鑰（必須從環境變量讀取）
ENCRYPTION_KEY = os.getenv('WALLET_ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    raise RuntimeError("WALLET_ENCRYPTION_KEY is required")


@dataclass
class Wallet:
    """用戶錢包"""
    address: str
    private_key_encrypted: str


def generate_wallet() -> Wallet:
    """
    生成 TRON 錢包地址
    """
    # 生成私鑰（TRON ECDSA）
    priv_key = PrivateKey.random()
    address = priv_key.public_key.to_base58check_address()

    # 加密私鑰
    fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
    private_key_encrypted = fernet.encrypt(priv_key.hex().encode()).decode()
    
    return Wallet(
        address=address,
        private_key_encrypted=private_key_encrypted
    )


def decrypt_private_key(encrypted: str) -> str:
    """解密私鑰"""
    fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
    return fernet.decrypt(encrypted.encode()).decode()


def validate_address(address: str) -> bool:
    """驗證 TRON 地址格式"""
    if not address:
        return False
    # TRON 地址以 T 開頭，34 字符
    if not address.startswith('T'):
        return False
    if len(address) != 34:
        return False
    return True


def format_balance(balance: float) -> str:
    """格式化餘額顯示"""
    return f"{balance:,.2f} USDT"


"""
充值監控與提款會在 payment 服務處理。
"""


# === 提款（MVP 版本：手動處理）===
