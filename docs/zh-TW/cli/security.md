---
summary: 「`openclaw security` 的 CLI 參考（稽核並修復常見的安全性陷阱）」
read_when:
  - 你想要對設定／狀態執行快速的安全性稽核
  - 你想要套用安全的「修復」建議（chmod、收緊預設值）
title: 「security」
x-i18n:
  source_path: cli/security.md
  source_hash: 96542b4784e53933
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:46Z
---

# `openclaw security`

安全性工具（稽核 + 可選修復）。

相關：

- 安全性指南：[Security](/gateway/security)

## 稽核

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

當多個 私訊（DM） 發送者共用主要工作階段時，稽核會發出警告，並建議在共用收件匣中使用 **安全私訊模式**：`session.dmScope="per-channel-peer"`（或針對多帳號頻道使用 `per-account-channel-peer`）。
此外，當未啟用沙箱隔離且啟用了網頁／瀏覽器工具時使用小型模型（`<=300B`），也會發出警告。
