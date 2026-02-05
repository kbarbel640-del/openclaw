# TG Casino - AI Native Gambling Platform

Telegram 上的 AI 原生博弈平台

## 架構

```
TG Bot (我)
├── 用戶系統（註冊、KYC-lite）
├── 錢包系統（USDT 充提）
├── 遊戲引擎
│   ├── Dice（骰子）
│   ├── Crash（火箭）
│   ├── Hi-Lo（猜大小）
│   └── Mini Slots（老虎機）
├── 風控系統
└── 多語言 AI 客服
```

## MVP 功能

- [ ] /start - 註冊 + 生成 USDT 地址
- [ ] /deposit - 顯示充值地址
- [ ] /balance - 查餘額
- [ ] /dice [金額] [大/小] - 骰子遊戲
- [ ] /crash - Crash 遊戲
- [ ] /withdraw [地址] [金額] - 提款

## 技術棧

- Python 3.11+
- python-telegram-bot
- SQLite (dev) → PostgreSQL (prod)
- TronPy (USDT-TRC20 地址生成)
- Redis (提款隊列/冪等/緩存)

## 運行

```bash
cp .env.example .env
# 填入 BOT_TOKEN
pip install -r requirements.txt
python src/main.py
```

### 服務拆分（v1）

```bash
# Bot
python -m src.main

# 充值監控
python -m src.payment.deposit_monitor

# 提款 worker
python -m src.payment.withdrawal_worker
```

### Docker Compose（建議）

```bash
docker compose up --build
```

### SQLite → PostgreSQL 資料遷移

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/casino
export SQLITE_PATH=./casino.db
python scripts/migrate_sqlite_to_postgres.py
```

## 公平性

所有遊戲使用 provably fair 算法：
- Server seed (hash 公開)
- Client seed (用戶可提供)
- Nonce (遞增)
- 結果 = SHA256(server_seed + client_seed + nonce)

用戶可驗證每一局結果。
