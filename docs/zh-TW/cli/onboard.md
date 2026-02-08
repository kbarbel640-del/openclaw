---
summary: "「openclaw onboard」的 CLI 參考（互動式入門引導精靈）"
read_when:
  - 您想要為 Gateway 閘道器、工作區、驗證、頻道與 Skills 進行引導式設定
title: "onboard"
x-i18n:
  source_path: cli/onboard.md
  source_hash: 69a96accb2d571ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:37Z
---

# `openclaw onboard`

互動式入門引導精靈（本機或遠端 Gateway 閘道器設定）。

## 相關指南

- CLI 入門引導總覽：[入門引導精靈（CLI）](/start/wizard)
- CLI 入門引導參考：[CLI 入門引導參考](/start/wizard-cli-reference)
- CLI 自動化：[CLI 自動化](/start/wizard-cli-automation)
- macOS 入門引導：[入門引導（macOS App）](/start/onboarding)

## 範例

```bash
openclaw onboard
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --mode remote --remote-url ws://gateway-host:18789
```

流程說明：

- `quickstart`：最少提示，會自動產生 Gateway 閘道器權杖。
- `manual`：提供連接埠／繫結／驗證的完整提示（`advanced` 的別名）。
- 最快的首次聊天：`openclaw dashboard`（控制 UI，不進行頻道設定）。

## 常見後續指令

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` 不代表非互動模式。用於腳本請使用 `--non-interactive`。
</Note>
