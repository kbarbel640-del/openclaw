---
summary: "將 Claude Max/Pro 訂閱作為與 OpenAI 相容的 API 端點使用"
read_when:
  - 你想要以與 OpenAI 相容的工具使用 Claude Max 訂閱
  - 你想要一個封裝 Claude Code CLI 的本地 API 伺服器
  - 你想透過訂閱而非 API 金鑰來節省成本
title: "Claude Max API Proxy"
x-i18n:
  source_path: providers/claude-max-api-proxy.md
  source_hash: 63b61096b96b720c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:15Z
---

# Claude Max API Proxy

**claude-max-api-proxy** 是一個社群工具，能將你的 Claude Max/Pro 訂閱公開為與 OpenAI 相容的 API 端點。這讓你可以用任何支援 OpenAI API 格式的工具來使用你的訂閱。

## 為什麼要使用？

| 方法            | 成本                                            | 最適合                     |
| --------------- | ----------------------------------------------- | -------------------------- |
| Anthropic API   | 依 token 計費（Opus：輸入約 $15/M，輸出 $75/M） | 正式產品、高流量           |
| Claude Max 訂閱 | 每月 $200 固定費                                | 個人使用、開發、無限制用量 |

如果你擁有 Claude Max 訂閱，並希望搭配與 OpenAI 相容的工具使用，這個 Proxy 可以為你節省可觀的費用。

## 運作方式

```
Your App → claude-max-api-proxy → Claude Code CLI → Anthropic (via subscription)
     (OpenAI format)              (converts format)      (uses your login)
```

此 Proxy 會：

1. 在 `http://localhost:3456/v1/chat/completions` 接收 OpenAI 格式的請求
2. 將請求轉換為 Claude Code CLI 指令
3. 以 OpenAI 格式回傳回應（支援串流）

## 安裝

```bash
# Requires Node.js 20+ and Claude Code CLI
npm install -g claude-max-api-proxy

# Verify Claude CLI is authenticated
claude --version
```

## 使用方式

### 啟動伺服器

```bash
claude-max-api
# Server runs at http://localhost:3456
```

### 測試

```bash
# Health check
curl http://localhost:3456/health

# List models
curl http://localhost:3456/v1/models

# Chat completion
curl http://localhost:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 搭配 OpenClaw

你可以將 OpenClaw 指向此 Proxy，作為自訂的與 OpenAI 相容端點：

```json5
{
  env: {
    OPENAI_API_KEY: "not-needed",
    OPENAI_BASE_URL: "http://localhost:3456/v1",
  },
  agents: {
    defaults: {
      model: { primary: "openai/claude-opus-4" },
    },
  },
}
```

## 可用模型

| 模型 ID           | 對應至          |
| ----------------- | --------------- |
| `claude-opus-4`   | Claude Opus 4   |
| `claude-sonnet-4` | Claude Sonnet 4 |
| `claude-haiku-4`  | Claude Haiku 4  |

## 在 macOS 上自動啟動

建立一個 LaunchAgent 以自動執行此 Proxy：

```bash
cat > ~/Library/LaunchAgents/com.claude-max-api.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude-max-api</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/usr/local/lib/node_modules/claude-max-api-proxy/dist/server/standalone.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:~/.local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-max-api.plist
```

## 連結

- **npm：** https://www.npmjs.com/package/claude-max-api-proxy
- **GitHub：** https://github.com/atalovesyou/claude-max-api-proxy
- **Issues：** https://github.com/atalovesyou/claude-max-api-proxy/issues

## 注意事項

- 這是一個**社群工具**，並非由 Anthropic 或 OpenClaw 官方支援
- 需要有效的 Claude Max/Pro 訂閱，且已完成 Claude Code CLI 驗證
- 此 Proxy 於本機執行，不會將資料傳送至任何第三方伺服器
- 完整支援串流回應

## 另請參閱

- [Anthropic provider](/providers/anthropic) - 使用 setup-token 或 API 金鑰的原生 OpenClaw Claude 整合
- [OpenAI provider](/providers/openai) - 適用於 OpenAI/Codex 訂閱
