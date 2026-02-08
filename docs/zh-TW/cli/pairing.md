---
summary: "用於 `openclaw pairing` 的 CLI 參考（核准／列出配對請求）"
read_when:
  - "你正在使用配對模式的 私訊，並需要核准傳送者"
title: "配對"
x-i18n:
  source_path: cli/pairing.md
  source_hash: e0bc9707294463c9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:39Z
---

# `openclaw pairing`

核准或檢視 私訊 配對請求（適用於支援配對的 頻道）。

相關：

- 配對流程：[Pairing](/start/pairing)

## 指令

```bash
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <code> --notify
```
