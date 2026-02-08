---
summary: "「openclaw agent」的 CLI 參考（透過 Gateway 閘道器 傳送一次代理程式 回合）"
read_when:
  - "你想從指令碼執行一次代理程式 回合（可選擇傳遞回覆）"
title: "代理程式"
x-i18n:
  source_path: cli/agent.md
  source_hash: dcf12fb94e207c68
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:25Z
---

# `openclaw agent`

透過 Gateway 閘道器 執行一次代理程式 回合（內嵌使用請用 `--local`）。
使用 `--agent <id>` 以直接指定已設定的代理程式。

相關：

- Agent send 工具：[Agent send](/tools/agent-send)

## 範例

```bash
openclaw agent --to +15555550123 --message "status update" --deliver
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```
