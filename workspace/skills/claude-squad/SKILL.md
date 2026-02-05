# Claude Squad

HTTP 服務（port 18794），遠端控制多個 Claude Code 實例。
每個任務跑在獨立的 git worktree 裡，互不干擾。

## 安裝

```bash
cd ~/clawd/skills/claude-squad
bash setup.sh
```

## 啟動 / 停止

```bash
bash start.sh   # 啟動（背景執行）
bash stop.sh     # 停止
```

開機自動啟動（macOS）：
```bash
cp com.claude-squad.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.claude-squad.plist
```

## API

### 健康檢查
```bash
curl http://127.0.0.1:18794/health
```

### 建立任務
```bash
curl -X POST http://127.0.0.1:18794/task \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "修復 auth bug",
    "repo": "/Users/sulaxd/clawd",
    "branch": "squad/fix-auth",
    "model": "sonnet",
    "budget": 1
  }'
```

參數：
- `prompt`（必填）：任務描述
- `repo`（選填，預設 ~/clawd）：git repo 路徑
- `branch`（選填）：分支名，不填自動產生
- `model`（選填，預設 sonnet）
- `budget`（選填，預設 1 USD）
- `allowed_tools`（選填）：覆蓋預設工具清單
- `system_prompt`（選填）：額外 system prompt

### 列出任務
```bash
curl http://127.0.0.1:18794/tasks
curl "http://127.0.0.1:18794/tasks?status=running"
```

### 查看任務
```bash
curl http://127.0.0.1:18794/task/sq-20260129-143022
curl "http://127.0.0.1:18794/task/sq-20260129-143022?lines=50"
```

### 查看 diff
```bash
curl http://127.0.0.1:18794/task/sq-20260129-143022/diff
```

### 取消任務
```bash
curl -X POST http://127.0.0.1:18794/task/sq-20260129-143022/cancel
```

### 清理任務（刪除 worktree）
```bash
curl -X DELETE http://127.0.0.1:18794/task/sq-20260129-143022
```

## 限制

- 最多同時 3 個任務（可在 config.json 調整）
- 每個任務預設最高 $1 USD
- 超時 600 秒
