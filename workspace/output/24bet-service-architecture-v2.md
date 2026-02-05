# 24Bet 服務化框架設計 v2 — 模組拆分方案

> Week1 Day1 交付物 | 2026-02-03

---

## 📍 現狀（已完成的東西）

### 報表體系（Phase 0–3，全部在跑）

| Phase | 報表 | 數據源 | 說明 |
|-------|------|--------|------|
| Phase 0 | Funnel 日報 | TiDB | 註冊/首投/首充/復充 + Matomo 行為漏斗 |
| Phase 1 | Cohort 日報 | TiDB | D7 留存追蹤 + Matomo 設備分佈 |
| Phase 2.0 | 渠道週報 | TiDB | TOP10 渠道 P&L 四區塊 |
| Phase 2.1 | 用戶價值日報 | TiDB | 高/中/低/沉默分層 + Matomo 行為活躍 |

### 現有代碼結構

```
release_candidates/telegram_daily/src/
├── main.py                 # v3.0 統一入口（四報表 + CLI 參數）
├── fetchers/               # 數據獲取層
│   ├── base.py             # 基類
│   ├── tidb_funnel.py      # Phase 0 數據
│   ├── tidb_cohort.py      # Phase 1 數據
│   ├── tidb_channel_pnl.py # Phase 2.0 數據
│   ├── tidb_user_ltv.py    # Phase 2.1 數據
│   └── matomo_behavior.py  # Matomo 行為數據（SSH 隧道）
├── formatters/             # 格式化層
│   ├── telegram_funnel.py
│   ├── telegram_cohort.py
│   ├── telegram_channel_pnl.py
│   └── telegram_user_ltv.py
└── bot/
    └── sender.py           # Telegram 發送
```

### ✅ 已有的好設計
1. **Fetcher/Formatter 分離** — 數據獲取和格式化已解耦
2. **錯誤隔離** — Phase 間互不影響
3. **Matomo 降級處理** — 獲取失敗不影響主報告
4. **CLI 靈活** — `--report`、`--date`、`--dry-run`、`--simple`

### ⚠️ 需要重構的點
1. **數據源只有兩個**：TiDB + Matomo（沒用 Clarity）
2. **fetchers 直接連資料庫** — 每個 fetcher 各自建連線，無連線池
3. **main.py 串行執行** — 四個報表依序跑，Matomo SSH 隧道每次重建
4. **無法按需查詢** — 只能定時推送，Week2 要做 Telegram 按鈕需要改架構

---

## 🏗️ 服務化重構方案

### 設計原則
- **不重寫，只重組** — fetchers/formatters 邏輯不動，改組織方式
- **為 Week2 鋪路** — 按鈕查詢需要「隨時調用任意報表」的能力
- **連線複用** — TiDB 和 Matomo SSH 隧道只建一次

### 目標架構

```
services/
├── core/
│   ├── config.py              # 統一配置（從 .env 讀取）
│   ├── connections.py         # 連線管理（TiDB pool + Matomo SSH 隧道）
│   └── models.py              # 共用數據模型
│
├── fetchers/                   # 搬過來，改用 connections.py 的共享連線
│   ├── base.py                # BaseFetcher（注入 connection）
│   ├── funnel.py              # ← tidb_funnel.py
│   ├── cohort.py              # ← tidb_cohort.py
│   ├── channel_pnl.py         # ← tidb_channel_pnl.py
│   ├── user_ltv.py            # ← tidb_user_ltv.py
│   └── matomo_behavior.py     # ← matomo_behavior.py
│
├── formatters/                 # 搬過來，不改
│   ├── telegram.py            # 合併四個 formatter（按 report_type 分派）
│   └── markdown.py            # （未來）生成 .md 文件
│
├── delivery/                   # 送達層
│   ├── telegram_push.py       # 定時推送（現有 cron 模式）
│   └── telegram_interactive.py # Week2: 按鈕按需查詢
│
└── app.py                      # 新入口（取代 main.py）
    # 模式 1: CLI（向後兼容）
    #   python app.py --report funnel --date 2026-02-01
    # 模式 2: 服務模式（Week2 用）
    #   python app.py serve  ← 長駐，監聽 Telegram callback
```

### 核心改動：connections.py

```python
"""連線管理器 — 整個生命週期只建一次連線"""

class ConnectionManager:
    def __init__(self, config):
        self._tidb_pool = None
        self._matomo_tunnel = None
        self._matomo_conn = None

    def get_tidb(self) -> pymysql.Connection:
        """取得 TiDB 連線（帶簡易 pool）"""
        if not self._tidb_pool or not self._tidb_pool.open:
            self._tidb_pool = pymysql.connect(...)
        return self._tidb_pool

    def get_matomo(self) -> pymysql.Connection:
        """取得 Matomo 連線（SSH 隧道複用）"""
        if not self._matomo_tunnel:
            self._matomo_tunnel = SSHTunnelForwarder(...)
            self._matomo_tunnel.start()
            self._matomo_conn = pymysql.connect(...)
        return self._matomo_conn

    def close(self):
        """關閉所有連線"""
        ...
```

### 核心改動：app.py

```python
"""新入口 — 支援 CLI + 服務兩種模式"""

class ReportService:
    """報表服務：任意時間、任意報表、任意格式"""

    def __init__(self):
        self.config = Config()
        self.conn = ConnectionManager(self.config)
        self.fetchers = {
            'funnel': FunnelFetcher(self.conn),
            'cohort': CohortFetcher(self.conn),
            'channel_weekly': ChannelPnLFetcher(self.conn),
            'user_ltv': UserLTVFetcher(self.conn),
        }

    def generate(self, report_type: str, date: str, fmt='telegram') -> str:
        """生成任意報表 — Week2 按鈕查詢的核心介面"""
        data = self.fetchers[report_type].fetch(date)
        return format(data, fmt)

    def generate_all(self, date: str) -> list[str]:
        """生成全部報表（現有 cron 模式）"""
        return [self.generate(rt, date) for rt in self.fetchers]
```

---

## 🔀 遷移步驟（5 天）

| Day | 做什麼 | 風險 | 產出 |
|-----|--------|------|------|
| Mon | 模組拆分設計（本文件）| 零 | 設計文件 |
| Tue | 建 `services/core/`：config.py + connections.py | 零（新增） | 連線管理器 |
| Wed | 搬 fetchers，改用共享連線，跑測試對比輸出 | 低（A/B 驗證） | 重構後的 fetchers |
| Thu | 建 `app.py` + ReportService，CLI 模式向後兼容 | 低 | 新入口 |
| Fri | 驗證：`app.py` 輸出 = 舊 `main.py` 輸出 | 低 | 驗證報告 |

### 驗證方法
```bash
# 舊版
python main.py --report funnel --date 2026-02-01 --dry-run > old_output.txt

# 新版
python app.py --report funnel --date 2026-02-01 --dry-run > new_output.txt

# 比對
diff old_output.txt new_output.txt  # 應該完全一致
```

---

## 🔗 為 Week2 鋪路

Week2 目標：Telegram 按鈕按需查詢

有了 `ReportService.generate(report_type, date)`，Week2 只需要加：

```python
# telegram_interactive.py
@bot.callback_query_handler(func=lambda call: True)
def handle_button(call):
    report_type = call.data.split(':')[0]  # "funnel:2026-02-01"
    date = call.data.split(':')[1]
    result = service.generate(report_type, date)
    bot.send_message(call.message.chat.id, result)
```

按鈕 UI：
```
📊 查報表
[Funnel 日報] [Cohort 日報]
[渠道週報]   [用戶價值]
[選日期 📅]
```

---

## 📋 總結

| 項目 | 現狀 | 重構後 |
|------|------|--------|
| 數據源 | TiDB + Matomo | 不變 |
| 連線方式 | 每個 fetcher 各自連 | 共享 ConnectionManager |
| 執行方式 | 串行 | 可並發（共享連線） |
| 入口 | main.py（CLI only） | app.py（CLI + serve） |
| 按需查詢 | ❌ 不支援 | ✅ ReportService.generate() |
| 現有報表 | 完全保留 | 邏輯不動，只改組織 |
