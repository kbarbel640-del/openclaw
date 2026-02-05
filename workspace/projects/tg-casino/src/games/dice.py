"""Dice Game - 骰子遊戲"""
from dataclasses import dataclass
from typing import Literal
from .provably_fair import dice_roll, hash_seed


@dataclass
class DiceResult:
    """骰子結果"""
    roll: int  # 0-99
    target: int  # 用戶選擇的目標
    bet_type: Literal['over', 'under']  # 賭大或小
    is_win: bool
    multiplier: float
    payout: float
    profit: float
    
    # Provably Fair
    server_seed_hash: str
    client_seed: str
    nonce: int


def calculate_multiplier(target: int, bet_type: Literal['over', 'under']) -> float:
    """
    計算賠率
    
    House edge: 1%
    
    over: 贏的條件是 roll > target
    under: 贏的條件是 roll < target
    """
    if bet_type == 'over':
        win_chance = (99 - target) / 100  # roll > target 的機率
    else:  # under
        win_chance = target / 100  # roll < target 的機率
    
    if win_chance <= 0:
        return 0.0
    
    # 賠率 = (1 - house_edge) / win_chance
    house_edge = 0.01
    multiplier = (1 - house_edge) / win_chance
    
    return round(multiplier, 4)


def play_dice(
    amount: float,
    target: int,
    bet_type: Literal['over', 'under'],
    server_seed: str,
    client_seed: str,
    nonce: int
) -> DiceResult:
    """
    玩骰子遊戲
    
    Args:
        amount: 下注金額
        target: 目標數字 (1-98)
        bet_type: 'over' 或 'under'
        server_seed: 服務器種子
        client_seed: 客戶端種子
        nonce: 計數器
    
    Returns:
        DiceResult 結果對象
    """
    # 驗證參數
    if target < 1 or target > 98:
        raise ValueError("Target must be between 1 and 98")
    
    if amount <= 0:
        raise ValueError("Amount must be positive")
    
    # 計算賠率
    multiplier = calculate_multiplier(target, bet_type)
    if multiplier <= 0:
        raise ValueError("Invalid bet - win chance is 0")
    
    # 擲骰子
    roll = dice_roll(server_seed, client_seed, nonce)
    
    # 判斷輸贏
    if bet_type == 'over':
        is_win = roll > target
    else:
        is_win = roll < target
    
    # 計算派彩
    payout = amount * multiplier if is_win else 0
    profit = payout - amount
    
    return DiceResult(
        roll=roll,
        target=target,
        bet_type=bet_type,
        is_win=is_win,
        multiplier=multiplier,
        payout=round(payout, 2),
        profit=round(profit, 2),
        server_seed_hash=hash_seed(server_seed),
        client_seed=client_seed,
        nonce=nonce
    )


# 預設目標選項
DICE_PRESETS = {
    'easy': {'target': 50, 'type': 'over', 'chance': 49, 'multiplier': 2.02},
    'medium': {'target': 75, 'type': 'over', 'chance': 24, 'multiplier': 4.12},
    'hard': {'target': 90, 'type': 'over', 'chance': 9, 'multiplier': 11.0},
    'safe': {'target': 25, 'type': 'over', 'chance': 74, 'multiplier': 1.34},
}


def format_dice_result(result: DiceResult, lang: str = 'zh') -> str:
    """格式化骰子結果為消息"""
    
    if lang == 'zh':
        win_text = "🎉 贏了！" if result.is_win else "😢 輸了"
        bet_text = f"{'大於' if result.bet_type == 'over' else '小於'} {result.target}"
        
        return f"""
🎲 **骰子結果**

擲出: **{result.roll}**
目標: {bet_text}

{win_text}

{'💰 獲得: ' + str(result.payout) + ' USDT' if result.is_win else ''}
賠率: {result.multiplier}x

---
🔐 Server Seed Hash: `{result.server_seed_hash[:16]}...`
🌱 Client Seed: `{result.client_seed[:8]}...`
🔢 Nonce: {result.nonce}
"""
    else:  # English
        win_text = "🎉 You Won!" if result.is_win else "😢 You Lost"
        bet_text = f"{'Over' if result.bet_type == 'over' else 'Under'} {result.target}"
        
        return f"""
🎲 **Dice Result**

Roll: **{result.roll}**
Target: {bet_text}

{win_text}

{'💰 Payout: ' + str(result.payout) + ' USDT' if result.is_win else ''}
Multiplier: {result.multiplier}x

---
🔐 Server Seed Hash: `{result.server_seed_hash[:16]}...`
🌱 Client Seed: `{result.client_seed[:8]}...`
🔢 Nonce: {result.nonce}
"""
