# TG Casino v1.0 技術架構文檔

> **版本**：v1.0  
> **目標**：從 MVP（假錢包）升級為可收真錢的生產系統  
> **基於**：v0.1 已跑通的 Dice 遊戲 + Provably Fair 機制

---

## 目錄

1. [系統架構概覽](#1-系統架構概覽)
2. [支付系統設計](#2-支付系統設計)
3. [數據庫 Schema](#3-數據庫-schema)
4. [新增遊戲設計](#4-新增遊戲設計)
5. [風控規則](#5-風控規則)
6. [API 端點設計](#6-api-端點設計)
7. [部署架構](#7-部署架構)

---

## 1. 系統架構概覽

### 1.1 整體架構圖（ASCII）

```
                                    ┌─────────────────────────────────────────────────────────┐
                                    │                    TRON Blockchain                       │
                                    │                    (TRC20 USDT)                          │
                                    └─────────────────────────────────────────────────────────┘
                                                │                           ▲
                                                │ 監聽充值                   │ 廣播提款
                                                ▼                           │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Telegram   │◄──►│   Bot Core   │◄──►│   Payment    │◄──►│   Wallet     │
│   Users      │    │   (Python    │    │   Service    │    │   Service    │
│              │    │   python-    │    │              │    │              │
│  - 玩遊戲     │    │   telegram-  │    │  - 充值監聽   │    │  - 地址池     │
│  - 充值提款   │    │   bot)       │    │  - 提款處理   │    │  - 簽名服務   │
│  - 查餘額     │    │              │    │  - 餘額同步   │    │  - 冷熱分離   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                           │                   │                   │
                           │                   │                   │
                           ▼                   ▼                   ▼
                    ┌─────────────────────────────────────────────────────┐
                    │                    PostgreSQL                        │
                    │                                                      │
                    │  ┌─────────┐ ┌─────────────┐ ┌───────────────────┐  │
                    │  │  users  │ │transactions │ │ wallet_addresses  │  │
                    │  └─────────┘ └─────────────┘ └───────────────────┘  │
                    │  ┌─────────┐ ┌─────────────┐ ┌───────────────────┐  │
                    │  │  bets   │ │game_states  │ │withdrawal_requests│  │
                    │  └─────────┘ └─────────────┘ └───────────────────┘  │
                    └─────────────────────────────────────────────────────┘
                                          │
                                          ▼
                    ┌─────────────────────────────────────────────────────┐
                    │                     Redis                            │
                    │  - Session 緩存                                      │
                    │  - 遊戲狀態（Crash 實時數據）                          │
                    │  - 限流計數器                                         │
                    │  - 分布式鎖                                          │
                    └─────────────────────────────────────────────────────┘
```

### 1.2 服務組件說明

| 組件 | 職責 | 技術棧 |
|------|------|--------|
| **Bot Core** | 處理 Telegram 消息、遊戲邏輯、用戶交互 | Python 3.11 + python-telegram-bot |
| **Payment Service** | 充值監聽、提款處理、餘額同步 | Python + tronpy + asyncio |
| **Wallet Service** | 地址生成、私鑰管理、交易簽名 | Python + tronpy + HSM(可選) |
| **PostgreSQL** | 持久化存儲 | PostgreSQL 15+ |
| **Redis** | 緩存、實時狀態、限流 | Redis 7+ |

### 1.3 數據流

```
充值流程：
User -> Bot: /deposit
Bot -> DB: 查詢/分配地址
Bot -> User: 顯示充值地址
...用戶轉賬...
PaymentService -> TronGrid: 監聽 TRC20 Transfer 事件
PaymentService -> DB: 記錄交易、更新餘額
Bot -> User: 通知到賬

提款流程：
User -> Bot: /withdraw <amount> <address>
Bot -> DB: 創建提款請求（pending）
Bot -> User: 提款已提交
...審核（自動/人工）...
WalletService -> Tron: 簽名並廣播
PaymentService -> DB: 更新狀態（confirmed）
Bot -> User: 通知到賬
```

---

## 2. 支付系統設計

### 2.1 USDT-TRC20 充值監聽

#### 技術選型
- **tronpy**: 官方 Python SDK，用於與 TRON 區塊鏈交互
- **TronGrid API**: 免費的區塊瀏覽器 API，用於查詢交易和事件

#### 充值監聽實現

```python
# src/payment/deposit_monitor.py
import asyncio
from datetime import datetime
from tronpy import Tron
from tronpy.providers import HTTPProvider
import httpx

# USDT-TRC20 合約地址
USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

# TronGrid API
TRONGRID_API = "https://api.trongrid.io"


class DepositMonitor:
    """充值監聯服務"""
    
    def __init__(self, db_session, redis_client):
        self.db = db_session
        self.redis = redis_client
        self.client = Tron(HTTPProvider(TRONGRID_API))
        self.http = httpx.AsyncClient()
        
        # 監控的地址集合（從 Redis 加載）
        self.watched_addresses = set()
        
    async def start(self):
        """啟動監控循環"""
        await self._load_watched_addresses()
        
        while True:
            try:
                await self._poll_deposits()
            except Exception as e:
                print(f"Monitor error: {e}")
            
            await asyncio.sleep(10)  # 每 10 秒輪詢一次
    
    async def _load_watched_addresses(self):
        """從 DB 加載所有已分配的地址"""
        addresses = await self.db.execute(
            "SELECT address FROM wallet_addresses WHERE status = 'assigned'"
        )
        self.watched_addresses = {row.address for row in addresses}
    
    async def _poll_deposits(self):
        """輪詢所有監控地址的 TRC20 轉入"""
        for address in self.watched_addresses:
            await self._check_address_deposits(address)
    
    async def _check_address_deposits(self, address: str):
        """檢查單個地址的充值"""
        # 獲取上次檢查的時間戳
        last_check_key = f"deposit:last_check:{address}"
        last_check = await self.redis.get(last_check_key) or 0
        
        # 查詢 TRC20 轉賬事件
        url = f"{TRONGRID_API}/v1/accounts/{address}/transactions/trc20"
        params = {
            "only_to": True,  # 只看轉入
            "contract_address": USDT_CONTRACT,
            "min_timestamp": int(last_check) + 1,
            "limit": 50,
        }
        
        resp = await self.http.get(url, params=params)
        data = resp.json()
        
        for tx in data.get("data", []):
            await self._process_deposit(address, tx)
        
        # 更新檢查時間
        await self.redis.set(last_check_key, int(datetime.utcnow().timestamp() * 1000))
    
    async def _process_deposit(self, to_address: str, tx: dict):
        """處理單筆充值"""
        tx_hash = tx["transaction_id"]
        
        # 冪等性檢查：是否已處理
        if await self.redis.sismember("deposit:processed", tx_hash):
            return
        
        # 檢查區塊確認數
        block_number = tx["block_timestamp"] // 1000  # 近似
        current_block = self.client.get_latest_block_number()
        confirmations = current_block - block_number
        
        if confirmations < 19:  # TRON 推薦 19 個確認
            return
        
        # 解析金額（USDT 精度 6）
        amount = int(tx["value"]) / 1_000_000
        from_address = tx["from"]
        
        # 查找用戶
        user = await self.db.execute(
            "SELECT user_id FROM wallet_addresses WHERE address = :addr",
            {"addr": to_address}
        ).fetchone()
        
        if not user:
            print(f"Orphan deposit: {tx_hash}")
            return
        
        # 記錄交易
        await self.db.execute("""
            INSERT INTO transactions 
            (user_id, type, amount, tx_hash, from_address, to_address, status, confirmed_at)
            VALUES (:user_id, 'deposit', :amount, :tx_hash, :from_addr, :to_addr, 'confirmed', NOW())
        """, {
            "user_id": user.user_id,
            "amount": amount,
            "tx_hash": tx_hash,
            "from_addr": from_address,
            "to_addr": to_address,
        })
        
        # 更新餘額
        await self.db.execute("""
            UPDATE users 
            SET balance = balance + :amount,
                total_deposited = total_deposited + :amount
            WHERE id = :user_id
        """, {"amount": amount, "user_id": user.user_id})
        
        await self.db.commit()
        
        # 標記已處理
        await self.redis.sadd("deposit:processed", tx_hash)
        
        # 發送通知（通過消息隊列）
        await self.redis.publish("deposit:confirmed", json.dumps({
            "user_id": user.user_id,
            "amount": amount,
            "tx_hash": tx_hash,
        }))
```

### 2.2 地址池管理

#### 設計原則
- **預生成**：提前生成一批地址，用戶請求時直接分配
- **一對一**：每個用戶分配唯一地址，便於追蹤
- **回收機制**：長期無充值的地址回收重用

```python
# src/wallet/address_pool.py
from tronpy import Tron
from tronpy.keys import PrivateKey
from cryptography.fernet import Fernet
import os

class AddressPool:
    """地址池管理"""
    
    def __init__(self, db_session):
        self.db = db_session
        self.client = Tron()
        self.encryption_key = os.environ["WALLET_ENCRYPTION_KEY"]
        self.fernet = Fernet(self.encryption_key)
        
        # 池配置
        self.POOL_MIN_SIZE = 100  # 最小可用地址數
        self.POOL_BATCH_SIZE = 50  # 每次生成數量
    
    async def ensure_pool_size(self):
        """確保地址池有足夠可用地址"""
        count = await self.db.execute(
            "SELECT COUNT(*) FROM wallet_addresses WHERE status = 'available'"
        ).scalar()
        
        if count < self.POOL_MIN_SIZE:
            await self._generate_addresses(self.POOL_BATCH_SIZE)
    
    async def _generate_addresses(self, count: int):
        """批量生成地址"""
        for _ in range(count):
            # 生成真正的 TRON 地址
            priv_key = PrivateKey.random()
            address = priv_key.public_key.to_base58check_address()
            
            # 加密私鑰
            encrypted = self.fernet.encrypt(priv_key.hex().encode()).decode()
            
            await self.db.execute("""
                INSERT INTO wallet_addresses (address, private_key_encrypted, status)
                VALUES (:address, :encrypted, 'available')
            """, {"address": address, "encrypted": encrypted})
        
        await self.db.commit()
    
    async def assign_address(self, user_id: int) -> str:
        """分配地址給用戶"""
        # 先檢查用戶是否已有地址
        existing = await self.db.execute(
            "SELECT address FROM wallet_addresses WHERE user_id = :uid",
            {"uid": user_id}
        ).fetchone()
        
        if existing:
            return existing.address
        
        # 從池中分配
        # 使用 FOR UPDATE SKIP LOCKED 避免競爭
        addr = await self.db.execute("""
            UPDATE wallet_addresses
            SET status = 'assigned', user_id = :uid, assigned_at = NOW()
            WHERE id = (
                SELECT id FROM wallet_addresses 
                WHERE status = 'available'
                ORDER BY id
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING address
        """, {"uid": user_id}).fetchone()
        
        if not addr:
            # 地址池耗盡，緊急生成
            await self._generate_addresses(10)
            return await self.assign_address(user_id)
        
        await self.db.commit()
        return addr.address
    
    async def recycle_inactive(self, days: int = 90):
        """回收長期無充值的地址"""
        await self.db.execute("""
            UPDATE wallet_addresses
            SET status = 'available', user_id = NULL, assigned_at = NULL
            WHERE status = 'assigned'
            AND assigned_at < NOW() - INTERVAL ':days days'
            AND NOT EXISTS (
                SELECT 1 FROM transactions 
                WHERE to_address = wallet_addresses.address
            )
        """, {"days": days})
        await self.db.commit()
```

### 2.3 到賬確認邏輯

| 參數 | 值 | 說明 |
|------|-----|------|
| 確認數 | 19 | TRON 官方推薦值 |
| 最小充值 | 1 USDT | 低於此金額不處理 |
| 輪詢間隔 | 10 秒 | 平衡實時性和 API 限制 |

```python
# 確認邏輯
REQUIRED_CONFIRMATIONS = 19

async def is_confirmed(tx_hash: str) -> bool:
    """檢查交易是否已確認"""
    tx_info = await client.get_transaction_info(tx_hash)
    
    if not tx_info:
        return False
    
    block_number = tx_info.get("blockNumber", 0)
    current_block = await client.get_latest_block_number()
    
    return (current_block - block_number) >= REQUIRED_CONFIRMATIONS
```

### 2.4 提款流程

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  用戶請求   │────►│  風控檢查   │────►│  審核隊列   │────►│  簽名廣播   │
│  /withdraw │     │            │     │            │     │            │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
                         │                  │                  │
                         ▼                  ▼                  ▼
                   ┌──────────┐       ┌──────────┐       ┌──────────┐
                   │ 拒絕/限流 │       │ 人工審核  │       │ 鏈上確認  │
                   │          │       │ (大額)   │       │          │
                   └──────────┘       └──────────┘       └──────────┘
```

```python
# src/payment/withdrawal.py
from dataclasses import dataclass
from enum import Enum
from tronpy import Tron
from tronpy.keys import PrivateKey

class WithdrawalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    REJECTED = "rejected"
    FAILED = "failed"


@dataclass
class WithdrawalLimits:
    """提款限制配置"""
    MIN_AMOUNT: float = 10.0  # 最小提款
    MAX_AMOUNT: float = 10000.0  # 單筆最大
    DAILY_LIMIT: float = 50000.0  # 日限額
    AUTO_APPROVE_MAX: float = 500.0  # 自動審核上限


class WithdrawalService:
    """提款服務"""
    
    def __init__(self, db, redis, wallet_service):
        self.db = db
        self.redis = redis
        self.wallet = wallet_service
        self.limits = WithdrawalLimits()
    
    async def request_withdrawal(
        self, 
        user_id: int, 
        amount: float, 
        to_address: str
    ) -> dict:
        """
        創建提款請求
        
        Returns:
            {
                "success": bool,
                "request_id": int | None,
                "error": str | None,
                "estimated_time": str
            }
        """
        # 1. 驗證地址格式
        if not self._validate_tron_address(to_address):
            return {"success": False, "error": "Invalid TRON address"}
        
        # 2. 檢查餘額
        user = await self.db.get_user(user_id)
        if user.balance < amount:
            return {"success": False, "error": "Insufficient balance"}
        
        # 3. 檢查限額
        limit_check = await self._check_limits(user_id, amount)
        if not limit_check["ok"]:
            return {"success": False, "error": limit_check["reason"]}
        
        # 4. 凍結餘額
        await self.db.execute("""
            UPDATE users 
            SET balance = balance - :amount,
                frozen_balance = frozen_balance + :amount
            WHERE id = :user_id AND balance >= :amount
        """, {"amount": amount, "user_id": user_id})
        
        # 5. 創建請求記錄
        request_id = await self.db.execute("""
            INSERT INTO withdrawal_requests 
            (user_id, amount, to_address, status, created_at)
            VALUES (:user_id, :amount, :to_addr, 'pending', NOW())
            RETURNING id
        """, {
            "user_id": user_id,
            "amount": amount,
            "to_addr": to_address,
        }).scalar()
        
        await self.db.commit()
        
        # 6. 判斷是否自動審核
        if amount <= self.limits.AUTO_APPROVE_MAX:
            await self._auto_approve(request_id)
            return {
                "success": True,
                "request_id": request_id,
                "estimated_time": "5-10 minutes"
            }
        else:
            return {
                "success": True,
                "request_id": request_id,
                "estimated_time": "1-24 hours (manual review)"
            }
    
    async def _check_limits(self, user_id: int, amount: float) -> dict:
        """檢查提款限制"""
        if amount < self.limits.MIN_AMOUNT:
            return {"ok": False, "reason": f"Minimum withdrawal: {self.limits.MIN_AMOUNT} USDT"}
        
        if amount > self.limits.MAX_AMOUNT:
            return {"ok": False, "reason": f"Maximum withdrawal: {self.limits.MAX_AMOUNT} USDT"}
        
        # 檢查日限額
        daily_total = await self.db.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests
            WHERE user_id = :uid 
            AND created_at > NOW() - INTERVAL '24 hours'
            AND status NOT IN ('rejected', 'failed')
        """, {"uid": user_id}).scalar()
        
        if daily_total + amount > self.limits.DAILY_LIMIT:
            remaining = self.limits.DAILY_LIMIT - daily_total
            return {"ok": False, "reason": f"Daily limit exceeded. Remaining: {remaining} USDT"}
        
        return {"ok": True}
    
    async def _auto_approve(self, request_id: int):
        """自動審核並處理"""
        await self.db.execute("""
            UPDATE withdrawal_requests
            SET status = 'approved', approved_at = NOW()
            WHERE id = :rid
        """, {"rid": request_id})
        await self.db.commit()
        
        # 推送到處理隊列
        await self.redis.lpush("withdrawal:queue", request_id)
    
    async def process_withdrawal(self, request_id: int):
        """執行提款（由後台 worker 調用）"""
        request = await self.db.get_withdrawal_request(request_id)
        
        if request.status != WithdrawalStatus.APPROVED.value:
            return
        
        try:
            # 更新狀態
            await self.db.execute("""
                UPDATE withdrawal_requests SET status = 'processing' WHERE id = :rid
            """, {"rid": request_id})
            
            # 從熱錢包發送
            tx_hash = await self.wallet.send_usdt(
                to_address=request.to_address,
                amount=request.amount
            )
            
            # 記錄交易
            await self.db.execute("""
                INSERT INTO transactions 
                (user_id, type, amount, tx_hash, to_address, status)
                VALUES (:uid, 'withdrawal', :amount, :tx_hash, :to_addr, 'confirmed')
            """, {
                "uid": request.user_id,
                "amount": request.amount,
                "tx_hash": tx_hash,
                "to_addr": request.to_address,
            })
            
            # 更新提款請求
            await self.db.execute("""
                UPDATE withdrawal_requests 
                SET status = 'completed', tx_hash = :tx_hash, completed_at = NOW()
                WHERE id = :rid
            """, {"rid": request_id, "tx_hash": tx_hash})
            
            # 釋放凍結餘額
            await self.db.execute("""
                UPDATE users 
                SET frozen_balance = frozen_balance - :amount,
                    total_withdrawn = total_withdrawn + :amount
                WHERE id = :uid
            """, {"amount": request.amount, "uid": request.user_id})
            
            await self.db.commit()
            
        except Exception as e:
            # 提款失敗，退回餘額
            await self.db.execute("""
                UPDATE users 
                SET balance = balance + :amount,
                    frozen_balance = frozen_balance - :amount
                WHERE id = :uid
            """, {"amount": request.amount, "uid": request.user_id})
            
            await self.db.execute("""
                UPDATE withdrawal_requests 
                SET status = 'failed', error_message = :error
                WHERE id = :rid
            """, {"rid": request_id, "error": str(e)})
            
            await self.db.commit()
            raise
```

### 2.5 冷熱錢包分離

```
┌─────────────────────────────────────────────────────────────────┐
│                        錢包架構                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用戶充值 ──────────►  收款地址池                               │
│                              │                                  │
│                              │ 定時歸集                         │
│                              ▼                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │             │      │             │      │             │    │
│   │   冷錢包    │◄────►│   熱錢包     │◄────►│   收款池    │    │
│   │             │      │             │      │             │    │
│   │  離線存儲   │      │  在線服務    │      │  自動監控   │    │
│   │  大額存儲   │      │  自動提款    │      │  自動歸集   │    │
│   │  人工操作   │      │  餘額 < 10K  │      │             │    │
│   │             │      │             │      │             │    │
│   └─────────────┘      └─────────────┘      └─────────────┘    │
│         │                    │                                  │
│         │                    │                                  │
│         │ 大額補充            │ 自動提款                         │
│         │ (人工)             │                                  │
│         ▼                    ▼                                  │
│                         用戶提款                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**資金流轉規則**：

| 操作 | 觸發條件 | 自動化程度 |
|------|---------|-----------|
| 收款歸集 | 單地址餘額 > 100 USDT | 自動 |
| 熱錢包補充 | 熱錢包餘額 < 5000 USDT | 人工審核 |
| 冷錢包存入 | 熱錢包餘額 > 20000 USDT | 人工操作 |
| 提款 | 用戶請求 | 自動（<500）/ 人工（≥500）|

```python
# src/wallet/hot_wallet.py
import os
from tronpy import Tron
from tronpy.keys import PrivateKey

class HotWallet:
    """熱錢包服務"""
    
    # USDT 合約
    USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
    
    def __init__(self):
        self.client = Tron()
        
        # 熱錢包私鑰從環境變量加載
        # 生產環境建議使用 HSM
        self._private_key = PrivateKey(bytes.fromhex(
            os.environ["HOT_WALLET_PRIVATE_KEY"]
        ))
        self.address = self._private_key.public_key.to_base58check_address()
    
    async def get_balance(self) -> float:
        """獲取熱錢包 USDT 餘額"""
        contract = self.client.get_contract(self.USDT_CONTRACT)
        balance = contract.functions.balanceOf(self.address)
        return balance / 1_000_000  # USDT 精度 6
    
    async def send_usdt(self, to_address: str, amount: float) -> str:
        """
        發送 USDT
        
        Returns:
            交易 hash
        """
        contract = self.client.get_contract(self.USDT_CONTRACT)
        
        # 金額轉換（精度 6）
        amount_sun = int(amount * 1_000_000)
        
        # 構建交易
        txn = (
            contract.functions.transfer(to_address, amount_sun)
            .with_owner(self.address)
            .fee_limit(10_000_000)  # 10 TRX fee limit
            .build()
            .sign(self._private_key)
        )
        
        # 廣播
        result = txn.broadcast()
        
        if not result.get("result"):
            raise Exception(f"Broadcast failed: {result}")
        
        return result["txid"]
    
    async def collect_from_pool(self, from_address: str, encrypted_key: str, amount: float):
        """從收款地址歸集到熱錢包"""
        # 解密私鑰
        fernet = Fernet(os.environ["WALLET_ENCRYPTION_KEY"])
        private_key = PrivateKey(bytes.fromhex(
            fernet.decrypt(encrypted_key.encode()).decode()
        ))
        
        contract = self.client.get_contract(self.USDT_CONTRACT)
        amount_sun = int(amount * 1_000_000)
        
        txn = (
            contract.functions.transfer(self.address, amount_sun)
            .with_owner(from_address)
            .fee_limit(10_000_000)
            .build()
            .sign(private_key)
        )
        
        return txn.broadcast()
```

---

## 3. 數據庫 Schema

### 3.1 完整 Schema（擴展現有結構）

```sql
-- 用戶表（在現有基礎上新增字段）
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    
    -- 餘額（移除錢包地址，改用地址池）
    balance DECIMAL(18, 6) DEFAULT 0,
    frozen_balance DECIMAL(18, 6) DEFAULT 0,  -- 新增：凍結餘額
    
    -- Provably Fair
    server_seed VARCHAR(64),
    server_seed_hash VARCHAR(64),  -- 新增：公開的 hash
    client_seed VARCHAR(64),
    nonce INTEGER DEFAULT 0,
    
    -- 統計
    total_wagered DECIMAL(18, 6) DEFAULT 0,
    total_won DECIMAL(18, 6) DEFAULT 0,
    total_deposited DECIMAL(18, 6) DEFAULT 0,
    total_withdrawn DECIMAL(18, 6) DEFAULT 0,
    
    -- 狀態
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason VARCHAR(200),
    vip_level INTEGER DEFAULT 0,
    
    -- 風控字段
    risk_level VARCHAR(20) DEFAULT 'normal',  -- normal, suspicious, blocked
    last_deposit_at TIMESTAMP,
    last_withdrawal_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_risk_level ON users(risk_level);


-- 地址池表（新增）
CREATE TABLE wallet_addresses (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,  -- TBase58 地址
    private_key_encrypted TEXT NOT NULL,
    
    status VARCHAR(20) DEFAULT 'available',  -- available, assigned, recycled
    user_id INTEGER REFERENCES users(id),
    
    assigned_at TIMESTAMP,
    last_deposit_at TIMESTAMP,
    total_received DECIMAL(18, 6) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wallet_addresses_status ON wallet_addresses(status);
CREATE INDEX idx_wallet_addresses_user_id ON wallet_addresses(user_id);


-- 交易記錄表（擴展）
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    type VARCHAR(20) NOT NULL,  -- deposit, withdrawal, bet, win, refund, bonus
    amount DECIMAL(18, 6) NOT NULL,
    
    -- 鏈上信息
    tx_hash VARCHAR(100),
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    block_number BIGINT,
    
    -- 狀態追蹤
    status VARCHAR(20) DEFAULT 'pending',  -- pending, confirming, confirmed, failed
    confirmations INTEGER DEFAULT 0,
    
    -- 關聯
    withdrawal_request_id INTEGER REFERENCES withdrawal_requests(id),
    bet_id INTEGER REFERENCES bets(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    
    -- 審計
    notes TEXT
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);


-- 提款請求表（新增）
CREATE TABLE withdrawal_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    amount DECIMAL(18, 6) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, processing, completed, rejected, failed
    
    -- 審核
    auto_approved BOOLEAN DEFAULT FALSE,
    approved_by INTEGER,  -- admin user id
    approved_at TIMESTAMP,
    reject_reason VARCHAR(200),
    
    -- 執行
    tx_hash VARCHAR(100),
    completed_at TIMESTAMP,
    error_message TEXT,
    
    -- 風控快照
    user_balance_snapshot DECIMAL(18, 6),
    user_total_deposited_snapshot DECIMAL(18, 6),
    user_total_wagered_snapshot DECIMAL(18, 6),
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);


-- 下注記錄（擴展）
CREATE TABLE bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    game VARCHAR(20) NOT NULL,  -- dice, crash, limbo, mines, hilo, slots
    amount DECIMAL(18, 6) NOT NULL,
    
    -- 遊戲數據
    bet_data JSONB,  -- 下注參數
    result_data JSONB,  -- 結果詳情
    
    -- Provably Fair
    server_seed_hash VARCHAR(64),
    client_seed VARCHAR(64),
    nonce INTEGER,
    server_seed VARCHAR(64),  -- 結算後可公開
    
    -- 結果
    multiplier DECIMAL(10, 4),
    payout DECIMAL(18, 6),
    profit DECIMAL(18, 6),
    is_win BOOLEAN,
    
    -- 關聯的 Crash 輪次（如適用）
    game_round_id INTEGER REFERENCES game_rounds(id),
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_game ON bets(game);
CREATE INDEX idx_bets_created_at ON bets(created_at);


-- 遊戲輪次（用於 Crash 等多人遊戲）
CREATE TABLE game_rounds (
    id SERIAL PRIMARY KEY,
    game VARCHAR(20) NOT NULL,
    
    -- Provably Fair
    server_seed VARCHAR(64) NOT NULL,
    server_seed_hash VARCHAR(64) NOT NULL,
    public_seed VARCHAR(64),  -- 所有玩家的 client_seed 組合 hash
    
    -- 結果
    result DECIMAL(10, 4),  -- crash point
    result_data JSONB,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'waiting',  -- waiting, betting, running, crashed
    
    -- 統計
    total_bets DECIMAL(18, 6) DEFAULT 0,
    total_payouts DECIMAL(18, 6) DEFAULT 0,
    player_count INTEGER DEFAULT 0,
    
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_game_rounds_game ON game_rounds(game);
CREATE INDEX idx_game_rounds_status ON game_rounds(status);


-- 風控日誌（新增）
CREATE TABLE risk_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    
    event_type VARCHAR(50) NOT NULL,  -- large_withdrawal, rapid_betting, suspicious_pattern
    severity VARCHAR(20) NOT NULL,  -- info, warning, critical
    
    details JSONB,
    action_taken VARCHAR(100),  -- none, rate_limited, manual_review, blocked
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_risk_logs_user_id ON risk_logs(user_id);
CREATE INDEX idx_risk_logs_event_type ON risk_logs(event_type);
CREATE INDEX idx_risk_logs_created_at ON risk_logs(created_at);
```

### 3.2 數據庫遷移腳本

```python
# migrations/v1_0_0.py
"""v1.0.0 - 支付系統升級"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    # 1. 新增 wallet_addresses 表
    op.create_table(
        'wallet_addresses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('address', sa.String(42), unique=True, nullable=False),
        sa.Column('private_key_encrypted', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), default='available'),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('assigned_at', sa.DateTime()),
        sa.Column('last_deposit_at', sa.DateTime()),
        sa.Column('total_received', sa.Numeric(18, 6), default=0),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
    )
    
    # 2. 新增 withdrawal_requests 表
    op.create_table(
        'withdrawal_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount', sa.Numeric(18, 6), nullable=False),
        sa.Column('to_address', sa.String(42), nullable=False),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('auto_approved', sa.Boolean(), default=False),
        sa.Column('tx_hash', sa.String(100)),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime()),
    )
    
    # 3. 擴展 users 表
    op.add_column('users', sa.Column('frozen_balance', sa.Numeric(18, 6), default=0))
    op.add_column('users', sa.Column('server_seed_hash', sa.String(64)))
    op.add_column('users', sa.Column('risk_level', sa.String(20), default='normal'))
    
    # 4. 擴展 transactions 表
    op.add_column('transactions', sa.Column('withdrawal_request_id', sa.Integer()))
    op.add_column('transactions', sa.Column('block_number', sa.BigInteger()))
    op.add_column('transactions', sa.Column('confirmations', sa.Integer(), default=0))
    
    # 5. 創建索引
    op.create_index('idx_wallet_addresses_status', 'wallet_addresses', ['status'])
    op.create_index('idx_withdrawal_requests_status', 'withdrawal_requests', ['status'])


def downgrade():
    op.drop_table('withdrawal_requests')
    op.drop_table('wallet_addresses')
    op.drop_column('users', 'frozen_balance')
    op.drop_column('users', 'server_seed_hash')
    op.drop_column('users', 'risk_level')
```

---

## 4. 新增遊戲設計

### 4.1 Crash 遊戲

#### 遊戲規則
1. 每輪開始前有下注時間（10秒）
2. 遊戲開始，乘數從 1.00x 開始上漲
3. 玩家需要在崩潰前點擊「Cash Out」
4. 崩潰時未 Cash Out 的玩家輸掉全部賭注

#### Provably Fair 實現

```python
# src/games/crash.py
import asyncio
import time
import json
import hashlib
from dataclasses import dataclass
from typing import Dict, List, Optional
from .provably_fair import generate_server_seed, hash_seed, crash_point


@dataclass
class CrashBet:
    """Crash 下注"""
    user_id: int
    amount: float
    auto_cashout: Optional[float] = None  # 自動 Cash Out 倍率
    cashed_out_at: Optional[float] = None  # 實際 Cash Out 倍率
    profit: float = 0


class CrashGame:
    """Crash 遊戲引擎"""
    
    # 遊戲配置
    BETTING_DURATION = 10.0  # 下注時間（秒）
    TICK_INTERVAL = 0.1  # 更新間隔（秒）
    
    def __init__(self, db, redis, bot):
        self.db = db
        self.redis = redis
        self.bot = bot
        
        # 當前輪次狀態
        self.current_round_id: Optional[int] = None
        self.server_seed: Optional[str] = None
        self.crash_point: Optional[float] = None
        self.bets: Dict[int, CrashBet] = {}  # user_id -> CrashBet
        self.status: str = "waiting"  # waiting, betting, running, crashed
        self.current_multiplier: float = 1.0
        self.start_time: float = 0
    
    async def start_new_round(self):
        """開始新一輪"""
        # 生成新的 server seed
        self.server_seed = generate_server_seed()
        server_seed_hash = hash_seed(self.server_seed)
        
        # 創建數據庫記錄
        self.current_round_id = await self.db.execute("""
            INSERT INTO game_rounds (game, server_seed, server_seed_hash, status)
            VALUES ('crash', :seed, :hash, 'betting')
            RETURNING id
        """, {"seed": self.server_seed, "hash": server_seed_hash}).scalar()
        await self.db.commit()
        
        # 重置狀態
        self.bets = {}
        self.status = "betting"
        self.current_multiplier = 1.0
        
        # 廣播：開始下注
        await self._broadcast({
            "type": "round_start",
            "round_id": self.current_round_id,
            "server_seed_hash": server_seed_hash,
            "betting_time": self.BETTING_DURATION,
        })
        
        # 等待下注時間
        await asyncio.sleep(self.BETTING_DURATION)
        
        # 計算崩潰點
        public_seed = await self._generate_public_seed()
        self.crash_point = crash_point(self.server_seed, public_seed, self.current_round_id)
        
        # 更新數據庫
        await self.db.execute("""
            UPDATE game_rounds 
            SET status = 'running', public_seed = :ps, result = :cp, started_at = NOW()
            WHERE id = :rid
        """, {"ps": public_seed, "cp": self.crash_point, "rid": self.current_round_id})
        await self.db.commit()
        
        # 開始遊戲
        self.status = "running"
        self.start_time = time.time()
        
        await self._run_game()
    
    async def _run_game(self):
        """運行遊戲主循環"""
        while self.status == "running":
            elapsed = time.time() - self.start_time
            
            # 計算當前乘數（指數增長）
            # multiplier = e^(0.06 * t)，約 12 秒到 2x
            self.current_multiplier = round(1.0 * (2.718 ** (0.06 * elapsed)), 2)
            
            # 檢查自動 Cash Out
            for user_id, bet in self.bets.items():
                if bet.cashed_out_at is None and bet.auto_cashout:
                    if self.current_multiplier >= bet.auto_cashout:
                        await self.cashout(user_id)
            
            # 檢查是否崩潰
            if self.current_multiplier >= self.crash_point:
                await self._crash()
                break
            
            # 廣播當前乘數
            await self._broadcast({
                "type": "tick",
                "multiplier": self.current_multiplier,
            })
            
            await asyncio.sleep(self.TICK_INTERVAL)
    
    async def _crash(self):
        """遊戲崩潰"""
        self.status = "crashed"
        
        # 結算所有未 Cash Out 的玩家
        for user_id, bet in self.bets.items():
            if bet.cashed_out_at is None:
                bet.profit = -bet.amount  # 輸掉全部
        
        # 更新數據庫
        await self.db.execute("""
            UPDATE game_rounds 
            SET status = 'crashed', ended_at = NOW(),
                total_bets = :total_bets,
                total_payouts = :total_payouts,
                player_count = :player_count
            WHERE id = :rid
        """, {
            "rid": self.current_round_id,
            "total_bets": sum(b.amount for b in self.bets.values()),
            "total_payouts": sum(max(0, b.profit) for b in self.bets.values()),
            "player_count": len(self.bets),
        })
        await self.db.commit()
        
        # 廣播結果
        await self._broadcast({
            "type": "crash",
            "crash_point": self.crash_point,
            "server_seed": self.server_seed,
        })
        
        # 等待幾秒，開始下一輪
        await asyncio.sleep(5)
        await self.start_new_round()
    
    async def place_bet(self, user_id: int, amount: float, auto_cashout: Optional[float] = None) -> dict:
        """下注"""
        if self.status != "betting":
            return {"success": False, "error": "Betting is closed"}
        
        if user_id in self.bets:
            return {"success": False, "error": "Already bet this round"}
        
        # 檢查餘額並扣款
        result = await self.db.execute("""
            UPDATE users SET balance = balance - :amount
            WHERE id = :uid AND balance >= :amount
            RETURNING balance
        """, {"uid": user_id, "amount": amount})
        
        if not result.fetchone():
            return {"success": False, "error": "Insufficient balance"}
        
        # 記錄下注
        self.bets[user_id] = CrashBet(
            user_id=user_id,
            amount=amount,
            auto_cashout=auto_cashout
        )
        
        await self.db.commit()
        
        return {"success": True, "round_id": self.current_round_id}
    
    async def cashout(self, user_id: int) -> dict:
        """Cash Out"""
        if self.status != "running":
            return {"success": False, "error": "Game not running"}
        
        bet = self.bets.get(user_id)
        if not bet:
            return {"success": False, "error": "No bet found"}
        
        if bet.cashed_out_at is not None:
            return {"success": False, "error": "Already cashed out"}
        
        # 記錄 Cash Out
        bet.cashed_out_at = self.current_multiplier
        payout = bet.amount * self.current_multiplier
        bet.profit = payout - bet.amount
        
        # 更新餘額
        await self.db.execute("""
            UPDATE users SET balance = balance + :payout,
                            total_won = total_won + :payout
            WHERE id = :uid
        """, {"uid": user_id, "payout": payout})
        
        # 記錄下注
        await self.db.execute("""
            INSERT INTO bets 
            (user_id, game, amount, multiplier, payout, profit, is_win, game_round_id,
             server_seed_hash, client_seed, nonce)
            VALUES (:uid, 'crash', :amount, :mult, :payout, :profit, TRUE, :rid,
                    :ssh, 'public', :rid)
        """, {
            "uid": user_id,
            "amount": bet.amount,
            "mult": self.current_multiplier,
            "payout": payout,
            "profit": bet.profit,
            "rid": self.current_round_id,
            "ssh": hash_seed(self.server_seed),
        })
        
        await self.db.commit()
        
        # 廣播
        await self._broadcast({
            "type": "cashout",
            "user_id": user_id,
            "multiplier": self.current_multiplier,
            "payout": payout,
        })
        
        return {
            "success": True,
            "multiplier": self.current_multiplier,
            "payout": payout,
        }
    
    async def _generate_public_seed(self) -> str:
        """生成公共種子（所有玩家的 client_seed 組合）"""
        # 收集所有玩家的 client_seed
        seeds = []
        for bet in self.bets.values():
            user = await self.db.get_user(bet.user_id)
            seeds.append(user.client_seed)
        
        # 如果沒有玩家，使用時間戳
        if not seeds:
            seeds.append(str(int(time.time())))
        
        # 組合並 hash
        combined = ":".join(sorted(seeds))
        return hashlib.sha256(combined.encode()).hexdigest()
    
    async def _broadcast(self, message: dict):
        """廣播消息給所有訂閱的用戶"""
        await self.redis.publish("crash:events", json.dumps(message))
```

#### Crash Provably Fair 驗證

```python
def verify_crash(server_seed: str, public_seed: str, round_id: int, claimed_crash: float) -> bool:
    """
    驗證 Crash 結果
    
    玩家可以在遊戲結束後使用公開的 server_seed 驗證
    """
    calculated = crash_point(server_seed, public_seed, round_id)
    return abs(calculated - claimed_crash) < 0.01  # 允許小誤差


# 用戶驗證腳本（可公開）
"""
import hashlib
import hmac

def crash_point(server_seed, public_seed, round_id):
    message = f"{public_seed}:{round_id}"
    result = hmac.new(
        server_seed.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # 取前 13 位 hex 轉浮點
    r = int(result[:13], 16) / (16 ** 13)
    
    if r < 0.01:
        return 1.00
    
    return min(1 / (1 - r), 1000000.0)

# 使用
server_seed = "your_server_seed"  # 遊戲結束後公開
public_seed = "public_seed_hash"  # 遊戲開始時公開
round_id = 12345

crash = crash_point(server_seed, public_seed, round_id)
print(f"Crash Point: {crash:.2f}x")
"""
```

### 4.2 Limbo 遊戲

#### 遊戲規則
1. 玩家選擇目標倍率（如 2.00x）
2. 系統生成結果倍率
3. 如果結果 ≥ 目標，玩家獲勝

```python
# src/games/limbo.py
from dataclasses import dataclass
from .provably_fair import generate_result, result_to_float, hash_seed


@dataclass  
class LimboResult:
    """Limbo 結果"""
    target_multiplier: float
    result_multiplier: float
    is_win: bool
    payout: float
    profit: float
    
    # Provably Fair
    server_seed_hash: str
    client_seed: str
    nonce: int


def limbo_multiplier(server_seed: str, client_seed: str, nonce: int) -> float:
    """
    計算 Limbo 結果倍率
    
    使用與 Crash 相同的公式，但立即計算
    """
    result = generate_result(server_seed, client_seed, nonce)
    r = result_to_float(result)
    
    if r < 0.01:
        return 1.00
    
    return min(round(1 / (1 - r), 2), 1000000.0)


def calculate_limbo_payout(target: float) -> float:
    """
    計算 Limbo 賠率
    
    win_chance = 1 / target
    payout = (1 - house_edge) * target
    house_edge = 1%
    """
    if target < 1.01:
        return 0
    
    return round(target * 0.99, 4)


def play_limbo(
    amount: float,
    target_multiplier: float,
    server_seed: str,
    client_seed: str,
    nonce: int
) -> LimboResult:
    """
    玩 Limbo 遊戲
    
    Args:
        amount: 下注金額
        target_multiplier: 目標倍率 (1.01 - 1000000)
        server_seed: 服務器種子
        client_seed: 客戶端種子
        nonce: 計數器
    """
    if target_multiplier < 1.01:
        raise ValueError("Target must be at least 1.01x")
    
    # 計算結果
    result_mult = limbo_multiplier(server_seed, client_seed, nonce)
    
    # 判斷輸贏
    is_win = result_mult >= target_multiplier
    
    # 計算派彩
    payout_mult = calculate_limbo_payout(target_multiplier)
    payout = amount * payout_mult if is_win else 0
    profit = payout - amount
    
    return LimboResult(
        target_multiplier=target_multiplier,
        result_multiplier=result_mult,
        is_win=is_win,
        payout=round(payout, 2),
        profit=round(profit, 2),
        server_seed_hash=hash_seed(server_seed),
        client_seed=client_seed,
        nonce=nonce,
    )
```

### 4.3 Mines 遊戲

#### 遊戲規則
1. 5x5 網格（25 格），玩家選擇炸彈數量（1-24）
2. 每點開一個安全格，乘數增加
3. 點到炸彈則遊戲結束，輸掉全部
4. 隨時可以 Cash Out

```python
# src/games/mines.py
import json
from dataclasses import dataclass, field
from typing import List, Set, Optional
from .provably_fair import generate_result, hash_seed


GRID_SIZE = 25  # 5x5


@dataclass
class MinesGame:
    """Mines 遊戲狀態"""
    user_id: int
    bet_amount: float
    mines_count: int
    
    # Provably Fair
    server_seed: str
    client_seed: str
    nonce: int
    
    # 遊戲狀態
    mine_positions: Set[int] = field(default_factory=set)  # 炸彈位置（0-24）
    revealed: Set[int] = field(default_factory=set)  # 已翻開的位置
    is_active: bool = True
    cashed_out: bool = False
    
    @property
    def current_multiplier(self) -> float:
        """當前乘數"""
        return calculate_mines_multiplier(
            self.mines_count, 
            len(self.revealed)
        )
    
    @property
    def next_multiplier(self) -> float:
        """下一步的乘數"""
        return calculate_mines_multiplier(
            self.mines_count,
            len(self.revealed) + 1
        )


def generate_mine_positions(
    server_seed: str, 
    client_seed: str, 
    nonce: int, 
    mines_count: int
) -> Set[int]:
    """
    生成炸彈位置
    
    使用 Fisher-Yates shuffle 的變體
    """
    positions = list(range(GRID_SIZE))
    result = generate_result(server_seed, client_seed, nonce)
    
    # 用 hash 的不同部分選擇炸彈位置
    mines = set()
    for i in range(mines_count):
        # 取 hash 的不同部分
        start = i * 4
        hex_part = result[start:start + 4] or result[:4]
        index = int(hex_part, 16) % (GRID_SIZE - i)
        
        # 從剩餘位置中選擇
        available = [p for p in positions if p not in mines]
        mines.add(available[index])
    
    return mines


def calculate_mines_multiplier(mines_count: int, revealed_count: int) -> float:
    """
    計算 Mines 賠率
    
    基於概率計算：
    每一步存活概率 = (safe_remaining) / (total_remaining)
    總賠率 = 1 / (所有步驟存活概率的乘積) * (1 - house_edge)
    """
    if revealed_count == 0:
        return 1.0
    
    safe_total = GRID_SIZE - mines_count
    
    # 計算存活概率
    survival_prob = 1.0
    for i in range(revealed_count):
        safe_remaining = safe_total - i
        total_remaining = GRID_SIZE - i
        survival_prob *= safe_remaining / total_remaining
    
    if survival_prob == 0:
        return 0
    
    # 賠率 = 1 / 存活概率 * (1 - house_edge)
    house_edge = 0.01
    multiplier = (1 / survival_prob) * (1 - house_edge)
    
    return round(multiplier, 4)


class MinesEngine:
    """Mines 遊戲引擎"""
    
    def __init__(self, db, redis):
        self.db = db
        self.redis = redis
        self.active_games: dict = {}  # user_id -> MinesGame
    
    async def start_game(
        self, 
        user_id: int, 
        amount: float, 
        mines_count: int
    ) -> dict:
        """開始新遊戲"""
        if user_id in self.active_games:
            return {"success": False, "error": "Game already in progress"}
        
        if mines_count < 1 or mines_count > 24:
            return {"success": False, "error": "Mines must be 1-24"}
        
        # 獲取用戶種子
        user = await self.db.get_user(user_id)
        
        # 扣款
        result = await self.db.execute("""
            UPDATE users SET balance = balance - :amount
            WHERE id = :uid AND balance >= :amount
            RETURNING balance
        """, {"uid": user_id, "amount": amount})
        
        if not result.fetchone():
            return {"success": False, "error": "Insufficient balance"}
        
        # 創建遊戲
        game = MinesGame(
            user_id=user_id,
            bet_amount=amount,
            mines_count=mines_count,
            server_seed=user.server_seed,
            client_seed=user.client_seed,
            nonce=user.nonce,
        )
        
        # 生成炸彈位置
        game.mine_positions = generate_mine_positions(
            game.server_seed,
            game.client_seed,
            game.nonce,
            mines_count
        )
        
        # 更新 nonce
        await self.db.execute(
            "UPDATE users SET nonce = nonce + 1 WHERE id = :uid",
            {"uid": user_id}
        )
        await self.db.commit()
        
        self.active_games[user_id] = game
        
        return {
            "success": True,
            "server_seed_hash": hash_seed(game.server_seed),
            "mines_count": mines_count,
            "multipliers": {
                "next": game.next_multiplier,
                "current": 1.0,
            }
        }
    
    async def reveal(self, user_id: int, position: int) -> dict:
        """翻開一個格子"""
        game = self.active_games.get(user_id)
        if not game or not game.is_active:
            return {"success": False, "error": "No active game"}
        
        if position < 0 or position >= GRID_SIZE:
            return {"success": False, "error": "Invalid position"}
        
        if position in game.revealed:
            return {"success": False, "error": "Already revealed"}
        
        game.revealed.add(position)
        
        if position in game.mine_positions:
            # 踩雷
            game.is_active = False
            
            # 記錄下注
            await self._record_bet(game, is_win=False)
            
            del self.active_games[user_id]
            
            return {
                "success": True,
                "is_mine": True,
                "mine_positions": list(game.mine_positions),
                "multiplier": 0,
                "profit": -game.bet_amount,
                "server_seed": game.server_seed,  # 遊戲結束公開
            }
        
        # 安全
        return {
            "success": True,
            "is_mine": False,
            "position": position,
            "multiplier": game.current_multiplier,
            "next_multiplier": game.next_multiplier,
            "revealed_count": len(game.revealed),
            "potential_payout": round(game.bet_amount * game.current_multiplier, 2),
        }
    
    async def cashout(self, user_id: int) -> dict:
        """Cash Out"""
        game = self.active_games.get(user_id)
        if not game or not game.is_active:
            return {"success": False, "error": "No active game"}
        
        if len(game.revealed) == 0:
            return {"success": False, "error": "Must reveal at least one tile"}
        
        game.is_active = False
        game.cashed_out = True
        
        payout = game.bet_amount * game.current_multiplier
        profit = payout - game.bet_amount
        
        # 更新餘額
        await self.db.execute("""
            UPDATE users SET balance = balance + :payout
            WHERE id = :uid
        """, {"uid": user_id, "payout": payout})
        
        # 記錄下注
        await self._record_bet(game, is_win=True, payout=payout)
        
        del self.active_games[user_id]
        
        return {
            "success": True,
            "multiplier": game.current_multiplier,
            "payout": round(payout, 2),
            "profit": round(profit, 2),
            "mine_positions": list(game.mine_positions),
            "server_seed": game.server_seed,
        }
    
    async def _record_bet(self, game: MinesGame, is_win: bool, payout: float = 0):
        """記錄下注"""
        await self.db.execute("""
            INSERT INTO bets 
            (user_id, game, amount, bet_data, result_data, 
             multiplier, payout, profit, is_win,
             server_seed_hash, client_seed, nonce, server_seed)
            VALUES (:uid, 'mines', :amount, :bet_data, :result_data,
                    :mult, :payout, :profit, :is_win,
                    :ssh, :cs, :nonce, :ss)
        """, {
            "uid": game.user_id,
            "amount": game.bet_amount,
            "bet_data": json.dumps({
                "mines_count": game.mines_count,
            }),
            "result_data": json.dumps({
                "revealed": list(game.revealed),
                "mine_positions": list(game.mine_positions),
            }),
            "mult": game.current_multiplier if is_win else 0,
            "payout": payout,
            "profit": payout - game.bet_amount,
            "is_win": is_win,
            "ssh": hash_seed(game.server_seed),
            "cs": game.client_seed,
            "nonce": game.nonce,
            "ss": game.server_seed,  # 遊戲結束可公開
        })
        await self.db.commit()
```

---

## 5. 風控規則

### 5.1 下注限制

```python
# src/risk/betting_limits.py
from dataclasses import dataclass
from typing import Optional


@dataclass
class BettingLimits:
    """下注限制配置"""
    
    # 全局限制
    MIN_BET: float = 0.1  # USDT
    MAX_BET: float = 1000.0  # USDT
    
    # 按 VIP 等級的限制
    VIP_LIMITS = {
        0: {"max_bet": 100, "daily_loss_limit": 500},
        1: {"max_bet": 500, "daily_loss_limit": 2000},
        2: {"max_bet": 1000, "daily_loss_limit": 5000},
        3: {"max_bet": 5000, "daily_loss_limit": 20000},
        4: {"max_bet": 10000, "daily_loss_limit": 50000},
    }
    
    # 按遊戲的限制
    GAME_LIMITS = {
        "dice": {"min": 0.1, "max": 1000},
        "crash": {"min": 0.1, "max": 500},
        "limbo": {"min": 0.1, "max": 1000},
        "mines": {"min": 0.1, "max": 500},
    }


class BettingRiskControl:
    """下注風控"""
    
    def __init__(self, db, redis):
        self.db = db
        self.redis = redis
        self.limits = BettingLimits()
    
    async def check_bet(
        self, 
        user_id: int, 
        game: str, 
        amount: float
    ) -> dict:
        """
        檢查下注是否允許
        
        Returns:
            {"allowed": bool, "reason": str | None}
        """
        user = await self.db.get_user(user_id)
        
        # 1. 檢查封禁狀態
        if user.is_banned:
            return {"allowed": False, "reason": f"Account banned: {user.ban_reason}"}
        
        if user.risk_level == "blocked":
            return {"allowed": False, "reason": "Account under review"}
        
        # 2. 檢查餘額
        if user.balance < amount:
            return {"allowed": False, "reason": "Insufficient balance"}
        
        # 3. 檢查全局最小/最大
        if amount < self.limits.MIN_BET:
            return {"allowed": False, "reason": f"Minimum bet: {self.limits.MIN_BET} USDT"}
        
        if amount > self.limits.MAX_BET:
            return {"allowed": False, "reason": f"Maximum bet: {self.limits.MAX_BET} USDT"}
        
        # 4. 檢查遊戲限制
        game_limits = self.limits.GAME_LIMITS.get(game, {})
        if amount > game_limits.get("max", self.limits.MAX_BET):
            return {"allowed": False, "reason": f"Maximum bet for {game}: {game_limits['max']} USDT"}
        
        # 5. 檢查 VIP 限制
        vip_limits = self.limits.VIP_LIMITS.get(user.vip_level, self.limits.VIP_LIMITS[0])
        if amount > vip_limits["max_bet"]:
            return {"allowed": False, "reason": f"Your max bet: {vip_limits['max_bet']} USDT"}
        
        # 6. 檢查日虧損限額
        daily_loss = await self._get_daily_loss(user_id)
        if daily_loss >= vip_limits["daily_loss_limit"]:
            return {"allowed": False, "reason": "Daily loss limit reached"}
        
        # 7. 限流（防止機器人刷）
        rate_ok = await self._check_rate_limit(user_id)
        if not rate_ok:
            return {"allowed": False, "reason": "Too many bets, please slow down"}
        
        return {"allowed": True, "reason": None}
    
    async def _get_daily_loss(self, user_id: int) -> float:
        """獲取今日虧損"""
        result = await self.db.execute("""
            SELECT COALESCE(SUM(CASE WHEN profit < 0 THEN -profit ELSE 0 END), 0)
            FROM bets
            WHERE user_id = :uid
            AND created_at > NOW() - INTERVAL '24 hours'
        """, {"uid": user_id})
        return result.scalar() or 0
    
    async def _check_rate_limit(self, user_id: int) -> bool:
        """檢查下注頻率"""
        key = f"bet:rate:{user_id}"
        count = await self.redis.incr(key)
        
        if count == 1:
            await self.redis.expire(key, 60)  # 1 分鐘窗口
        
        return count <= 60  # 最多 60 次/分鐘
```

### 5.2 提款限制

```python
# src/risk/withdrawal_limits.py

@dataclass
class WithdrawalRules:
    """提款規則"""
    
    # 基本限制
    MIN_WITHDRAWAL: float = 10.0
    MAX_WITHDRAWAL: float = 10000.0
    DAILY_LIMIT: float = 50000.0
    
    # 自動審核閾值
    AUTO_APPROVE_MAX: float = 500.0
    
    # 反洗錢規則
    MIN_WAGER_RATIO: float = 1.0  # 最少打碼 1 倍才能提款
    NEW_USER_LOCK_HOURS: int = 24  # 新用戶 24 小時內不能提款


class WithdrawalRiskControl:
    """提款風控"""
    
    async def check_withdrawal(
        self, 
        user_id: int, 
        amount: float
    ) -> dict:
        """檢查提款是否允許"""
        user = await self.db.get_user(user_id)
        rules = WithdrawalRules()
        
        # 1. 基本檢查
        if user.is_banned:
            return {"allowed": False, "reason": "Account banned"}
        
        if amount < rules.MIN_WITHDRAWAL:
            return {"allowed": False, "reason": f"Minimum: {rules.MIN_WITHDRAWAL} USDT"}
        
        if amount > rules.MAX_WITHDRAWAL:
            return {"allowed": False, "reason": f"Maximum: {rules.MAX_WITHDRAWAL} USDT"}
        
        # 2. 餘額檢查（包含凍結）
        available = user.balance - user.frozen_balance
        if amount > available:
            return {"allowed": False, "reason": "Insufficient available balance"}
        
        # 3. 新用戶鎖定期
        hours_since_signup = (datetime.utcnow() - user.created_at).total_seconds() / 3600
        if hours_since_signup < rules.NEW_USER_LOCK_HOURS:
            remaining = rules.NEW_USER_LOCK_HOURS - hours_since_signup
            return {"allowed": False, "reason": f"New accounts wait {int(remaining)}h before withdrawing"}
        
        # 4. 打碼量檢查（反洗錢）
        required_wager = user.total_deposited * rules.MIN_WAGER_RATIO
        if user.total_wagered < required_wager:
            remaining = required_wager - user.total_wagered
            return {"allowed": False, "reason": f"Wager {remaining:.2f} USDT more to withdraw"}
        
        # 5. 日限額
        daily_withdrawn = await self._get_daily_withdrawn(user_id)
        if daily_withdrawn + amount > rules.DAILY_LIMIT:
            remaining = rules.DAILY_LIMIT - daily_withdrawn
            return {"allowed": False, "reason": f"Daily limit. Remaining: {remaining:.2f} USDT"}
        
        # 6. 異常檢測
        anomaly = await self._detect_anomaly(user_id, amount)
        if anomaly:
            return {"allowed": False, "reason": "Manual review required", "review": True}
        
        return {"allowed": True, "auto_approve": amount <= rules.AUTO_APPROVE_MAX}
    
    async def _detect_anomaly(self, user_id: int, amount: float) -> bool:
        """檢測異常提款模式"""
        user = await self.db.get_user(user_id)
        
        # 規則 1: 提款金額 > 充值總額的 50%（首次大額提款）
        if user.total_withdrawn == 0 and amount > user.total_deposited * 0.5:
            await self._log_risk_event(user_id, "first_large_withdrawal", amount)
            return True
        
        # 規則 2: 短時間內多次小額提款（可能在測試）
        recent_count = await self.db.execute("""
            SELECT COUNT(*) FROM withdrawal_requests
            WHERE user_id = :uid AND created_at > NOW() - INTERVAL '1 hour'
        """, {"uid": user_id}).scalar()
        
        if recent_count >= 3:
            await self._log_risk_event(user_id, "frequent_withdrawals", recent_count)
            return True
        
        # 規則 3: 餘額清空式提款（可能要跑路）
        if amount > user.balance * 0.9:
            await self._log_risk_event(user_id, "balance_drain", amount)
            return True
        
        return False
```

### 5.3 異常檢測

```python
# src/risk/anomaly_detection.py
import statistics
from typing import List


class AnomalyDetector:
    """異常行為檢測"""
    
    async def analyze_user(self, user_id: int) -> dict:
        """分析用戶行為"""
        signals = []
        
        # 1. 下注模式分析
        bet_analysis = await self._analyze_betting_pattern(user_id)
        if bet_analysis["suspicious"]:
            signals.append(bet_analysis)
        
        # 2. 充提模式分析
        deposit_analysis = await self._analyze_deposit_pattern(user_id)
        if deposit_analysis["suspicious"]:
            signals.append(deposit_analysis)
        
        # 3. 遊戲選擇分析
        game_analysis = await self._analyze_game_selection(user_id)
        if game_analysis["suspicious"]:
            signals.append(game_analysis)
        
        # 計算風險分數
        risk_score = sum(s.get("score", 0) for s in signals)
        
        return {
            "user_id": user_id,
            "risk_score": risk_score,
            "risk_level": self._score_to_level(risk_score),
            "signals": signals,
        }
    
    async def _analyze_betting_pattern(self, user_id: int) -> dict:
        """分析下注模式"""
        # 獲取最近 100 次下注
        bets = await self.db.execute("""
            SELECT amount, is_win, profit, created_at
            FROM bets WHERE user_id = :uid
            ORDER BY created_at DESC LIMIT 100
        """, {"uid": user_id}).fetchall()
        
        if len(bets) < 10:
            return {"suspicious": False}
        
        amounts = [b.amount for b in bets]
        
        # 檢測：金額過於規律（可能是自動化）
        if len(set(amounts)) == 1:
            return {
                "suspicious": True,
                "type": "uniform_betting",
                "description": "All bets same amount",
                "score": 30,
            }
        
        # 檢測：Martingale 策略（輸了翻倍）
        martingale_count = 0
        for i in range(1, len(bets)):
            if not bets[i-1].is_win and bets[i].amount >= bets[i-1].amount * 1.9:
                martingale_count += 1
        
        if martingale_count > len(bets) * 0.3:
            return {
                "suspicious": True,
                "type": "martingale_detected",
                "description": "Possible Martingale strategy",
                "score": 20,
            }
        
        return {"suspicious": False}
    
    async def _analyze_deposit_pattern(self, user_id: int) -> dict:
        """分析充提模式"""
        user = await self.db.get_user(user_id)
        
        # 檢測：充值後快速提款（洗錢特徵）
        if user.total_deposited > 0:
            wager_ratio = user.total_wagered / user.total_deposited
            
            if wager_ratio < 0.5 and user.total_withdrawn > 0:
                return {
                    "suspicious": True,
                    "type": "quick_withdrawal",
                    "description": f"Low wager ratio: {wager_ratio:.2f}",
                    "score": 40,
                }
        
        return {"suspicious": False}
    
    def _score_to_level(self, score: int) -> str:
        """風險分數轉級別"""
        if score >= 60:
            return "high"
        elif score >= 30:
            return "medium"
        else:
            return "low"
```

---

## 6. API 端點設計

### 6.1 內部 API

```python
# src/api/internal.py
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel

app = FastAPI(title="TG Casino Internal API")


# === 用戶管理 ===

class UserBalance(BaseModel):
    user_id: int
    balance: float
    frozen: float


@app.get("/api/v1/users/{telegram_id}/balance")
async def get_balance(telegram_id: int, db=Depends(get_db)):
    """獲取用戶餘額"""
    user = await db.get_user_by_telegram(telegram_id)
    if not user:
        raise HTTPException(404, "User not found")
    
    return UserBalance(
        user_id=user.id,
        balance=user.balance,
        frozen=user.frozen_balance,
    )


@app.post("/api/v1/users/{telegram_id}/adjust")
async def adjust_balance(
    telegram_id: int, 
    amount: float, 
    reason: str,
    admin_id: int,
    db=Depends(get_db)
):
    """管理員調整餘額"""
    user = await db.get_user_by_telegram(telegram_id)
    if not user:
        raise HTTPException(404, "User not found")
    
    await db.execute("""
        UPDATE users SET balance = balance + :amount WHERE id = :uid
    """, {"amount": amount, "uid": user.id})
    
    # 記錄調整
    await db.execute("""
        INSERT INTO transactions 
        (user_id, type, amount, notes)
        VALUES (:uid, 'adjustment', :amount, :reason)
    """, {"uid": user.id, "amount": amount, "reason": f"Admin {admin_id}: {reason}"})
    
    await db.commit()
    return {"success": True, "new_balance": user.balance + amount}


# === 提款管理 ===

@app.get("/api/v1/withdrawals/pending")
async def list_pending_withdrawals(db=Depends(get_db)):
    """獲取待審核提款"""
    requests = await db.execute("""
        SELECT wr.*, u.telegram_id, u.username
        FROM withdrawal_requests wr
        JOIN users u ON wr.user_id = u.id
        WHERE wr.status = 'pending'
        ORDER BY wr.created_at
    """).fetchall()
    
    return {"requests": requests}


@app.post("/api/v1/withdrawals/{request_id}/approve")
async def approve_withdrawal(request_id: int, admin_id: int, db=Depends(get_db)):
    """審核通過提款"""
    await db.execute("""
        UPDATE withdrawal_requests
        SET status = 'approved', approved_by = :admin, approved_at = NOW()
        WHERE id = :rid AND status = 'pending'
    """, {"rid": request_id, "admin": admin_id})
    await db.commit()
    
    # 推送到處理隊列
    await redis.lpush("withdrawal:queue", request_id)
    
    return {"success": True}


@app.post("/api/v1/withdrawals/{request_id}/reject")
async def reject_withdrawal(request_id: int, admin_id: int, reason: str, db=Depends(get_db)):
    """拒絕提款"""
    request = await db.get_withdrawal_request(request_id)
    if not request:
        raise HTTPException(404, "Request not found")
    
    # 退回餘額
    await db.execute("""
        UPDATE users 
        SET balance = balance + :amount,
            frozen_balance = frozen_balance - :amount
        WHERE id = :uid
    """, {"amount": request.amount, "uid": request.user_id})
    
    await db.execute("""
        UPDATE withdrawal_requests
        SET status = 'rejected', reject_reason = :reason
        WHERE id = :rid
    """, {"rid": request_id, "reason": reason})
    
    await db.commit()
    return {"success": True}


# === 統計 ===

@app.get("/api/v1/stats/daily")
async def daily_stats(db=Depends(get_db)):
    """日統計"""
    today = await db.execute("""
        SELECT 
            COUNT(DISTINCT user_id) as active_users,
            SUM(amount) as total_bets,
            SUM(CASE WHEN is_win THEN payout ELSE 0 END) as total_payouts,
            SUM(amount) - SUM(CASE WHEN is_win THEN payout ELSE 0 END) as house_profit
        FROM bets
        WHERE created_at > NOW() - INTERVAL '24 hours'
    """).fetchone()
    
    return today
```

### 6.2 Webhook 接收

```python
# src/api/webhooks.py
from fastapi import FastAPI, Request, HTTPException
import hmac
import hashlib

app = FastAPI()


# TronGrid Webhook（如果使用付費服務）
@app.post("/webhooks/trongrid/deposit")
async def trongrid_deposit_webhook(request: Request):
    """
    接收 TronGrid 的充值通知
    
    注意：TronGrid 免費版不支持 webhook，需要付費或自己輪詢
    """
    # 驗證簽名
    signature = request.headers.get("X-Signature")
    body = await request.body()
    
    expected = hmac.new(
        TRONGRID_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature or "", expected):
        raise HTTPException(401, "Invalid signature")
    
    # 處理事件
    data = await request.json()
    event_type = data.get("type")
    
    if event_type == "trc20_transfer":
        await handle_deposit(data)
    
    return {"success": True}


async def handle_deposit(data: dict):
    """處理充值通知"""
    to_address = data["to"]
    amount = int(data["value"]) / 1_000_000
    tx_hash = data["transaction_id"]
    
    # 冪等性檢查
    if await redis.sismember("deposit:processed", tx_hash):
        return
    
    # 查找用戶
    user = await db.execute(
        "SELECT user_id FROM wallet_addresses WHERE address = :addr",
        {"addr": to_address}
    ).fetchone()
    
    if not user:
        # 未知地址，記錄但不處理
        await log_unknown_deposit(to_address, amount, tx_hash)
        return
    
    # 記錄交易
    await db.execute("""
        INSERT INTO transactions 
        (user_id, type, amount, tx_hash, to_address, status, confirmed_at)
        VALUES (:uid, 'deposit', :amount, :tx_hash, :addr, 'confirmed', NOW())
    """, {
        "uid": user.user_id,
        "amount": amount,
        "tx_hash": tx_hash,
        "addr": to_address,
    })
    
    # 更新餘額
    await db.execute("""
        UPDATE users 
        SET balance = balance + :amount,
            total_deposited = total_deposited + :amount
        WHERE id = :uid
    """, {"amount": amount, "uid": user.user_id})
    
    await db.commit()
    
    # 標記已處理
    await redis.sadd("deposit:processed", tx_hash)
    
    # 通知用戶
    await notify_deposit(user.user_id, amount, tx_hash)


# 健康檢查
@app.get("/webhooks/health")
async def health():
    return {"status": "ok"}
```

---

## 7. 部署架構

### 7.1 服務拆分

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Production Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │   Nginx     │────►│  Bot Core   │◄───►│   Redis     │          │
│   │   (LB)      │     │  (x2-3)     │     │  (Cluster)  │          │
│   └─────────────┘     └─────────────┘     └─────────────┘          │
│         │                   │                   │                   │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │  Internal   │     │  Payment    │     │ PostgreSQL  │          │
│   │    API      │     │  Worker     │     │  (Primary)  │          │
│   │             │     │  (x2)       │     │             │          │
│   └─────────────┘     └─────────────┘     └─────────────┘          │
│         │                   │                   │                   │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │  Webhook    │     │ Withdrawal  │     │ PostgreSQL  │          │
│   │  Receiver   │     │  Worker     │     │  (Replica)  │          │
│   └─────────────┘     └─────────────┘     └─────────────┘          │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                     Monitoring Stack                         │  │
│   │  Prometheus  │  Grafana  │  AlertManager  │  ELK Stack      │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  # === Bot ===
  bot:
    build: .
    command: python -m src.main
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/casino
      - REDIS_URL=redis://redis:6379
      - TELEGRAM_TOKEN=${TELEGRAM_TOKEN}
      - WALLET_ENCRYPTION_KEY=${WALLET_ENCRYPTION_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      replicas: 2

  # === Payment Monitor ===
  payment-monitor:
    build: .
    command: python -m src.payment.deposit_monitor
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/casino
      - REDIS_URL=redis://redis:6379
      - TRONGRID_API_KEY=${TRONGRID_API_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # === Withdrawal Worker ===
  withdrawal-worker:
    build: .
    command: python -m src.payment.withdrawal_worker
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/casino
      - REDIS_URL=redis://redis:6379
      - HOT_WALLET_PRIVATE_KEY=${HOT_WALLET_PRIVATE_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # === Internal API ===
  api:
    build: .
    command: uvicorn src.api.main:app --host 0.0.0.0 --port 8000
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/casino
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  # === Database ===
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=casino
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # === Cache ===
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  # === Monitoring ===
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana

volumes:
  postgres_data:
  redis_data:
  grafana_data:
```

### 7.3 監控要點

| 指標 | 閾值 | 動作 |
|------|------|------|
| **Bot 響應時間** | > 3s | 告警 |
| **充值處理延遲** | > 5min | 告警 |
| **提款隊列長度** | > 50 | 告警 + 擴容 |
| **熱錢包餘額** | < 5000 USDT | 告警（補充） |
| **熱錢包餘額** | > 20000 USDT | 告警（轉冷錢包）|
| **數據庫連接數** | > 80% | 告警 |
| **Redis 內存** | > 80% | 告警 |
| **每日利潤** | < 0 | 告警（可能被攻擊）|
| **單用戶大額輸贏** | > 10000 USDT | 人工審核 |

#### Prometheus 指標定義

```python
# src/metrics.py
from prometheus_client import Counter, Histogram, Gauge

# 下注指標
bets_total = Counter(
    'casino_bets_total', 
    'Total bets',
    ['game', 'result']  # game=dice/crash, result=win/lose
)

bet_amount = Histogram(
    'casino_bet_amount_usdt',
    'Bet amounts',
    ['game'],
    buckets=[1, 5, 10, 50, 100, 500, 1000]
)

# 支付指標
deposits_total = Counter('casino_deposits_total', 'Total deposits')
withdrawals_total = Counter('casino_withdrawals_total', 'Total withdrawals')

hot_wallet_balance = Gauge(
    'casino_hot_wallet_balance_usdt',
    'Hot wallet balance'
)

withdrawal_queue_length = Gauge(
    'casino_withdrawal_queue_length',
    'Pending withdrawals'
)

# 用戶指標
active_users = Gauge(
    'casino_active_users',
    'Currently active users'
)
```

#### Grafana Dashboard 建議

1. **概覽儀表板**
   - 實時在線人數
   - 24h 充值/提款總額
   - 24h 利潤
   - 熱錢包餘額

2. **遊戲儀表板**
   - 各遊戲下注量
   - 各遊戲 RTP（Return to Player）
   - Crash 平均崩潰點
   - 大額下注追蹤

3. **風控儀表板**
   - 異常用戶標記
   - 待審核提款
   - 風控事件時間線

---

## 附錄

### A. 環境變量清單

```bash
# .env.example

# Telegram
TELEGRAM_TOKEN=your_bot_token

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/casino

# Redis
REDIS_URL=redis://localhost:6379

# 加密
WALLET_ENCRYPTION_KEY=your_32_byte_key

# 熱錢包（僅提款 worker 需要）
HOT_WALLET_PRIVATE_KEY=your_private_key

# TronGrid（如果使用 webhook）
TRONGRID_API_KEY=your_api_key
TRONGRID_WEBHOOK_SECRET=your_secret

# 管理
ADMIN_TELEGRAM_IDS=123456,789012
```

### B. 安全檢查清單

- [ ] 私鑰加密存儲
- [ ] 數據庫連接使用 SSL
- [ ] 敏感 API 有認證
- [ ] 提款需人工審核（大額）
- [ ] 定期備份數據庫
- [ ] 監控異常登錄/下注
- [ ] 熱錢包有限額
- [ ] 冷錢包離線存儲

### C. 遷移路徑

1. **Phase 1**：部署新數據庫 Schema
2. **Phase 2**：部署充值監控（測試小額）
3. **Phase 3**：開放充值（限額）
4. **Phase 4**：部署提款功能（人工審核）
5. **Phase 5**：開放自動提款（小額）
6. **Phase 6**：上線新遊戲（Crash → Limbo → Mines）

---

*文檔版本：v1.0.0*  
*最後更新：2025-01*
