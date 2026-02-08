---
summary: "用於 `openclaw setup` 的 CLI 參考（初始化設定 + 工作區）"
read_when:
  - 你在未使用完整入門引導精靈的情況下進行首次執行設定
  - 你想要設定預設的工作區路徑
title: "設定"
x-i18n:
  source_path: cli/setup.md
  source_hash: 7f3fc8b246924edf
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:41Z
---

# `openclaw setup`

初始化 `~/.openclaw/openclaw.json` 與代理程式工作區。

相關：

- 入門指南：[入門指南](/start/getting-started)
- 精靈：[入門引導](/start/onboarding)

## 範例

```bash
openclaw setup
openclaw setup --workspace ~/.openclaw/workspace
```

透過 setup 執行精靈：

```bash
openclaw setup --wizard
```
