"""Provably Fair implementation for all games"""
import hashlib
import hmac
import secrets


def generate_server_seed() -> str:
    """生成 server seed"""
    return secrets.token_hex(32)


def generate_client_seed() -> str:
    """生成默認 client seed"""
    return secrets.token_hex(16)


def hash_seed(seed: str) -> str:
    """計算 seed 的 SHA256 hash"""
    return hashlib.sha256(seed.encode()).hexdigest()


def generate_result(server_seed: str, client_seed: str, nonce: int) -> str:
    """
    生成可驗證的隨機結果
    
    使用 HMAC-SHA256 確保結果可驗證且不可預測
    """
    message = f"{client_seed}:{nonce}"
    result = hmac.new(
        server_seed.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return result


def result_to_number(result: str, max_value: int = 100) -> int:
    """
    將 hash 結果轉換為數字
    
    取前 8 位 hex（32 bits）轉為整數，再 mod max_value
    """
    hex_part = result[:8]
    int_value = int(hex_part, 16)
    return int_value % max_value


def result_to_float(result: str) -> float:
    """
    將 hash 結果轉換為 0-1 之間的浮點數
    
    用於 Crash 等需要連續值的遊戲
    """
    hex_part = result[:13]  # 52 bits，接近 double 精度
    int_value = int(hex_part, 16)
    max_value = 16 ** 13
    return int_value / max_value


def verify_result(server_seed: str, client_seed: str, nonce: int, expected_result: str) -> bool:
    """驗證結果是否正確"""
    actual_result = generate_result(server_seed, client_seed, nonce)
    return actual_result == expected_result


# === Dice 專用 ===

def dice_roll(server_seed: str, client_seed: str, nonce: int) -> int:
    """
    骰子遊戲：返回 0-99 的數字
    
    用戶猜 over/under 某個值
    """
    result = generate_result(server_seed, client_seed, nonce)
    return result_to_number(result, 100)


# === Crash 專用 ===

def crash_point(server_seed: str, client_seed: str, round_id: int) -> float:
    """
    Crash 遊戲：計算本輪崩潰點
    
    使用 round_id 作為 nonce
    返回值 >= 1.00，理論上無上限
    
    算法：
    1. 生成 0-1 的隨機數 r
    2. 如果 r < 0.01，立即崩潰（1.00x）
    3. 否則，crash_point = 1 / (1 - r)
    
    這樣 house edge 約 1%
    """
    result = generate_result(server_seed, client_seed, round_id)
    r = result_to_float(result)
    
    # 1% 機率立即崩潰
    if r < 0.01:
        return 1.00
    
    # 計算崩潰點
    crash = 1 / (1 - r)
    
    # 限制最大值（防止極端情況）
    return min(crash, 1000000.0)


# === Hi-Lo 專用 ===

def hilo_card(server_seed: str, client_seed: str, nonce: int) -> dict:
    """
    Hi-Lo 遊戲：發一張牌
    
    返回 {'rank': 1-13, 'suit': 0-3}
    rank: 1=A, 2-10, 11=J, 12=Q, 13=K
    suit: 0=♠, 1=♥, 2=♦, 3=♣
    """
    result = generate_result(server_seed, client_seed, nonce)
    
    # 用不同部分的 hash 決定 rank 和 suit
    rank = result_to_number(result[:16], 13) + 1
    suit = result_to_number(result[16:24], 4)
    
    return {'rank': rank, 'suit': suit}


# === Slots 專用 ===

def slots_spin(server_seed: str, client_seed: str, nonce: int, reels: int = 3, symbols: int = 7) -> list:
    """
    老虎機：返回每個捲軸的符號
    
    reels: 捲軸數量
    symbols: 符號種類數量（0 到 symbols-1）
    """
    result = generate_result(server_seed, client_seed, nonce)
    
    outcome = []
    for i in range(reels):
        # 每個捲軸用 hash 的不同部分
        part = result[i*8:(i+1)*8]
        symbol = int(part, 16) % symbols
        outcome.append(symbol)
    
    return outcome
