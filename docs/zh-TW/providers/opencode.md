---
summary: 「使用 OpenCode Zen（精選模型）搭配 OpenClaw」
read_when:
  - 「你想要使用 OpenCode Zen 來存取模型」
  - 「你想要一份適合程式開發的精選模型清單」
title: 「OpenCode Zen」
x-i18n:
  source_path: providers/opencode.md
  source_hash: b3b5c640ac32f317
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:20Z
---

# OpenCode Zen

OpenCode Zen 是由 OpenCode 團隊為程式開發代理程式推薦的**精選模型清單**。
它是一條可選的、託管式的模型存取途徑，使用 API 金鑰與 `opencode` 提供者。
Zen 目前處於 Beta 版。

## CLI 設定

```bash
openclaw onboard --auth-choice opencode-zen
# or non-interactive
openclaw onboard --opencode-zen-api-key "$OPENCODE_API_KEY"
```

## 設定片段

```json5
{
  env: { OPENCODE_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

## 備註

- 也支援 `OPENCODE_ZEN_API_KEY`。
- 你需登入 Zen，新增帳務資訊，並複製你的 API 金鑰。
- OpenCode Zen 依請求計費；詳情請查看 OpenCode 儀表板。
