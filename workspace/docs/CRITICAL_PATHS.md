# 關鍵路徑文檔 (Critical Paths)

> 這份文檔記錄系統中的關鍵資料路徑。
> **任何涉及這些路徑的操作都需要特別小心。**

---

## 危險等級定義

| 等級          | 說明               | 操作前必須           |
| ------------- | ------------------ | -------------------- |
| **P0 - 致命** | 資料丟失無法恢復   | 備份 + 確認 + 再備份 |
| **P1 - 嚴重** | 服務中斷或配置遺失 | 備份 + 確認          |
| **P2 - 中等** | 需要重新配置       | 確認                 |

---

## 記憶層 (Memory Layer) - P0

### 主資料庫

```
Host: ~/.openclaw/persistent/data/timeline.db
Container: /app/persistent/data/timeline.db
```

**包含內容:**

- 所有對話歷史（時光隧道）
- 知識庫、學習日誌
- 思考過程記錄（Level 103）
- 報酬追蹤、對話狀態

**保護機制:**

- WAL 模式（crash recovery）
- 自動備份（hourly/daily）
- 啟動時完整性檢查
- 自動從備份恢復

### 備份目錄

```
Host: ~/.openclaw/backups/
├── hourly/   # 每小時備份（保留 24 份）
├── daily/    # 每日備份（保留 30 份）
└── manual/   # 手動備份（保留 10 份）
```

**備份時機:**

- Cron: 每小時、每日凌晨 3 點
- 部署前自動備份
- 危險 docker 操作前

---

## 配置層 (Configuration) - P1

### Gateway 配置

```
Host Gateway: ~/.openclaw/openclaw.json
Container: ~/.openclaw/core.router.wuji.01/stg/openclaw.json
```

**注意:** 兩個配置是獨立的！

- Host Gateway: LINE, Discord, Browser control
- Container: Telegram (唯一 instance)

### API 金鑰

```
Host: ~/.env.soul
Container env: DEEPSEEK_API_KEY, ZAI_API_KEY, etc.
```

---

## 工作區 (Workspace) - P1

### Hook 系統

```
Host: ~/clawd/workspace/hooks/
Container: /app/workspace/hooks/
```

**重要 Hooks:**

- `time-tunnel/` - 對話記錄
- `smart-router/` - 模型路由
- `cost-tracker/` - 成本追蹤
- `failover-monitor/` - 失敗監控

### 腳本

```
Host: ~/clawd/workspace/scripts/
├── backup-memory.sh     # 備份腳本
├── check-memory-integrity.sh  # 完整性檢查
├── safe-docker.sh       # 安全 docker wrapper
└── tunnel               # Time Tunnel CLI
```

---

## Docker Volume 映射

```yaml
# docker-compose.soul.yml 關鍵映射
volumes:
  # 配置（P1）
  - ${CLAWDBOT_CONFIG_DIR}:/home/node/.openclaw

  # 工作區（P1）
  - ${CLAWDBOT_WORKSPACE_DIR}/workspace:/app/workspace

  # 記憶層（P0 - 最重要！）
  - ${HOME}/.openclaw/persistent/data:/app/persistent/data
  - ${HOME}/.openclaw/backups:/app/persistent/backups

  # 媒體（P2）
  - ${CLAWDBOT_WORKSPACE_DIR}/workspace/skills/telegram-userbot/downloads:/app/media/telegram
  - ${HOME}/.openclaw/media/line:/app/media/line
```

---

## 危險操作清單

### 永遠不要直接執行

| 命令                            | 風險                    | 替代方案                      |
| ------------------------------- | ----------------------- | ----------------------------- |
| `docker rm moltbot*`            | 可能刪除未 mount 的資料 | `safe-docker.sh rm`           |
| `docker-compose down`           | 停止 + 移除容器         | `safe-docker.sh compose down` |
| `rm -rf ~/.openclaw/persistent` | 刪除所有記憶            | 不要執行                      |

### 安全操作流程

1. **部署前**

   ```bash
   ./scripts/deploy-check.sh  # 檢查狀態 + 備份狀態
   ```

2. **部署**

   ```bash
   ./scripts/zero-downtime-deploy.sh  # 自動備份 + 部署
   ```

3. **危險 docker 操作**
   ```bash
   ./workspace/scripts/safe-docker.sh rm <container>
   ```

---

## 恢復程序

### 從備份恢復

```bash
# 1. 找到最新備份
ls -lt ~/.openclaw/backups/*/

# 2. 恢復
cp ~/.openclaw/backups/manual/timeline_YYYYMMDD_HHMMSS.db \
   ~/.openclaw/persistent/data/timeline.db

# 3. 驗證
./workspace/scripts/check-memory-integrity.sh
```

### 自動恢復

Time Tunnel 在啟動時會：

1. 檢查資料庫是否存在
2. 驗證完整性
3. 如損壞，自動從備份恢復

---

## 監控檢查

```bash
# 完整性檢查
./workspace/scripts/check-memory-integrity.sh

# 備份狀態
ls -lht ~/.openclaw/backups/*/ | head -10

# 資料庫大小
du -h ~/.openclaw/persistent/data/timeline.db
```

---

_最後更新: 2026-02-06_
_經驗教訓: docker rm 導致所有對話歷史丟失_
