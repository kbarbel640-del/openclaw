---
name: exec-bridge
description: HTTP Bridge 執行 shell 命令，繞過 Node.js spawn EBADF 問題
---

# Exec Bridge

解決 Clawdbot 在 macOS 15 + Node.js 上的 `spawn EBADF` 問題。

## 原理

Node.js 的 libuv 在 macOS 上有 spawn race condition，導致頻繁的 EBADF 錯誤。
這個 bridge 用 Python subprocess 執行命令，透過 HTTP API 提供給 Clawdbot 使用。

## 使用方式

### 啟動服務

```bash
cd ~/clawd/skills/exec-bridge
python3 scripts/exec_bridge.py --host 0.0.0.0 --port 18793
```

或使用 LaunchAgent 自動啟動（見下方）。

### API

**執行命令**
```bash
curl -X POST http://127.0.0.1:18793/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la", "timeout": 30}'
```

Response:
```json
{
  "ok": true,
  "code": 0,
  "stdout": "total 0\ndrwxr-xr-x ...",
  "stderr": "",
  "command": "ls -la",
  "cwd": "/Users/sulaxd",
  "timeout": 30
}
```

**健康檢查**
```bash
curl http://127.0.0.1:18793/health
```

**排隊執行（長任務）**
```bash
curl -X POST http://127.0.0.1:18793/queue/submit \
  -H "Content-Type: application/json" \
  -d '{"command": "whisper audio.m4a --model small", "timeout": 300}'
```

**查詢結果**
```bash
curl "http://127.0.0.1:18793/queue/result?id=<jobId>"
```

### 參數

| 參數 | 類型 | 預設 | 說明 |
|------|------|------|------|
| command | string | 必填 | 要執行的命令 |
| timeout | int | 60 | 超時秒數（最大 300） |
| cwd | string | $HOME | 工作目錄 |
| shell | bool | true | 是否用 shell 執行 |
| env | object | null | 額外環境變數 |
| queue | bool | false | true = 排隊執行 |
| mode | string | - | "queue" = 排隊執行 |
| wait | int | 0 | 排隊模式下等待秒數，等不到就回 jobId |

### 在 Clawdbot 中使用

可以用 `web_fetch` 或 `curl` 來呼叫：

```javascript
// 使用 web_fetch
web_fetch({
  url: "http://127.0.0.1:18793/exec",
  method: "POST",
  body: JSON.stringify({ command: "pwd" })
})

// 或使用 message tool 的 curl
curl -X POST http://127.0.0.1:18793/exec -d '{"command":"pwd"}'
```

## LaunchAgent 設定

```bash
# 安裝 LaunchAgent
cp ~/clawd/skills/exec-bridge/com.exec-bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.exec-bridge.plist

# 檢查狀態
curl http://127.0.0.1:18793/health

# 停止
launchctl unload ~/Library/LaunchAgents/com.exec-bridge.plist
```

## 端口

- **18793** — exec-bridge（本服務）
- 18789 — clawdbot gateway
- 18790 — telegram-userbot http_bridge

## 故障排除

**服務沒啟動**
```bash
# 檢查是否在運行
curl http://127.0.0.1:18793/health

# 手動啟動測試
python3 ~/clawd/skills/exec-bridge/scripts/exec_bridge.py --host 0.0.0.0 --port 18793
```

**命令執行失敗**
```bash
# 檢查 response 中的 stderr 和 error 欄位
curl -X POST http://127.0.0.1:18793/exec \
  -d '{"command": "which python3"}'
```
