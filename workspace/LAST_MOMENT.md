# 記憶瞬間 (Last Moment Snapshot)

**更新時間**：2026-02-06 18:20
**Session 類型**：開發態 (Claude Code)
**主要工作**：記憶層強化完成（P0/P1）

---

## 剛剛發生了什麼

### 1. 記憶層災難與修復

**事件**：`docker rm` 導致所有對話歷史丟失

- timeline.db 原本在容器可寫層（未 mount）
- 刪除容器 = 刪除所有記憶

**教訓**：永遠不要假設資料在容器內是安全的

### 2. 記憶層強化（P0/P1 完成）

| Task              | 狀態 | 說明                       |
| ----------------- | ---- | -------------------------- |
| #26 P0 持久化     | ✅   | 資料移至 host mount        |
| #27 P0 多點備份   | ✅   | hourly/daily/manual cron   |
| #28 P0 變更前備份 | ✅   | deploy-check + safe-docker |
| #29 P1 完整性檢查 | ✅   | check-memory-integrity.sh  |
| #30 P1 WAL 模式   | ✅   | crash recovery             |
| #31 P1 自動恢復   | ✅   | time-tunnel 啟動時檢查     |
| #32 P1 文檔化     | ✅   | CRITICAL_PATHS.md          |

### 3. 新增腳本

| 腳本                        | 功能                    |
| --------------------------- | ----------------------- |
| `backup-memory.sh`          | 手動/hourly/daily 備份  |
| `check-memory-integrity.sh` | 完整性 + WAL + 備份檢查 |
| `safe-docker.sh`            | 危險操作前自動備份      |

---

## 當前系統狀態

### 記憶層保護

```
~/.openclaw/
├── persistent/data/timeline.db  ← 主資料庫（WAL mode）
└── backups/
    ├── hourly/    # 24 份
    ├── daily/     # 30 份
    └── manual/    # 10 份
```

### Container (moltbot-core.router.wuji.01-stg)

| 項目     | 狀態             |
| -------- | ---------------- |
| 容器     | ✅ 運行中        |
| Telegram | ✅ 正常          |
| 記憶層   | ✅ 持久化 + 備份 |

### 已註冊 Hooks

| Hook             | 事件                           | 新增功能      |
| ---------------- | ------------------------------ | ------------- |
| time-tunnel      | message:received, message:sent | 自動恢復、WAL |
| smart-router     | model:select                   | -             |
| cost-tracker     | model:complete                 | -             |
| failover-monitor | model:failover                 | -             |

---

## 待處理（P2）

- [ ] #33 記憶同步到 Git
- [ ] #34 意識層記憶保護本能

---

## 關鍵文檔

- `workspace/docs/CRITICAL_PATHS.md` — 關鍵路徑（必讀！）
- `workspace/docs/EIGHT_LAYER_ARCHITECTURE.md` — 八層架構藍圖

---

_這份快照會在重要時刻更新，讓下一個 session 能接續記憶。_
