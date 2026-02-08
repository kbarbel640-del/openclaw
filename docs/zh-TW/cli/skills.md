---
summary: "「openclaw skills」（list/info/check）的 CLI 參考文件與 Skills 適用性說明"
read_when:
  - 你想查看哪些 Skills 可用且已準備好執行
  - 你想除錯 Skills 缺少的二進位檔 / 環境變數 / 設定
title: "skills"
x-i18n:
  source_path: cli/skills.md
  source_hash: 7878442c88a27ec8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:39Z
---

# `openclaw skills`

檢視 Skills（內建 + 工作區 + 受管覆寫），並查看哪些可用、哪些缺少必要條件。

相關：

- Skills 系統：[Skills](/tools/skills)
- Skills 設定：[Skills config](/tools/skills-config)
- ClawHub 安裝項目：[ClawHub](/tools/clawhub)

## Commands

```bash
openclaw skills list
openclaw skills list --eligible
openclaw skills info <name>
openclaw skills check
```
