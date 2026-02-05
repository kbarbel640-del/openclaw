"""Database models for TG Casino"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """用戶表"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(Integer, unique=True, nullable=False, index=True)
    username = Column(String(100))
    language = Column(String(10), default='en')  # 自動檢測
    
    # 錢包
    usdt_address = Column(String(100))  # TRC20 地址
    usdt_private_key_encrypted = Column(Text)  # 加密存儲
    balance = Column(Float, default=0.0)  # USDT 餘額
    frozen_balance = Column(Float, default=0.0)  # 提款凍結餘額
    
    # Provably Fair
    server_seed = Column(String(64))
    client_seed = Column(String(64))
    nonce = Column(Integer, default=0)
    
    # 統計
    total_wagered = Column(Float, default=0.0)
    total_won = Column(Float, default=0.0)
    total_deposited = Column(Float, default=0.0)
    total_withdrawn = Column(Float, default=0.0)
    
    # 狀態
    is_banned = Column(Boolean, default=False)
    ban_reason = Column(String(200))
    vip_level = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    bets = relationship('Bet', back_populates='user')
    transactions = relationship('Transaction', back_populates='user')


class Bet(Base):
    """下注記錄"""
    __tablename__ = 'bets'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    game = Column(String(20), nullable=False)  # dice, crash, hilo, slots
    amount = Column(Float, nullable=False)
    
    # 遊戲數據
    bet_data = Column(Text)  # JSON: 下注內容
    result_data = Column(Text)  # JSON: 結果
    
    # Provably Fair
    server_seed_hash = Column(String(64))  # 下注時公開的 hash
    client_seed = Column(String(64))
    nonce = Column(Integer)
    
    # 結果
    multiplier = Column(Float)  # 賠率
    payout = Column(Float)  # 派彩金額
    profit = Column(Float)  # 盈虧
    is_win = Column(Boolean)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship('User', back_populates='bets')


class Transaction(Base):
    """交易記錄"""
    __tablename__ = 'transactions'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    type = Column(String(20), nullable=False)  # deposit, withdraw, bet, win
    amount = Column(Float, nullable=False)
    
    # 鏈上信息
    tx_hash = Column(String(100))
    from_address = Column(String(100))
    to_address = Column(String(100))
    
    status = Column(String(20), default='pending')  # pending, confirmed, failed
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime)
    
    # Relationships
    user = relationship('User', back_populates='transactions')


class GameState(Base):
    """遊戲狀態（用於 Crash 等需要共享狀態的遊戲）"""
    __tablename__ = 'game_states'
    
    id = Column(Integer, primary_key=True)
    game = Column(String(20), nullable=False)
    round_id = Column(Integer, nullable=False)
    
    state = Column(Text)  # JSON: 遊戲狀態
    server_seed = Column(String(64))
    server_seed_hash = Column(String(64))
    
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    result = Column(Text)  # JSON: 結果


class WithdrawalRequest(Base):
    """提款請求"""
    __tablename__ = 'withdrawal_requests'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    amount = Column(Float, nullable=False)
    to_address = Column(String(100), nullable=False)
    status = Column(String(20), default='pending')  # pending, approved, processing, completed, rejected, failed

    tx_hash = Column(String(100))
    reject_reason = Column(String(200))

    requested_at = Column(DateTime, default=datetime.utcnow)
    approved_at = Column(DateTime)
    processed_at = Column(DateTime)
    completed_at = Column(DateTime)
