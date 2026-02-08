---
summary: "「openclaw plugins」的 CLI 參考（清單、安裝、啟用/停用、doctor）"
read_when:
  - 你想要安裝或管理行程內的 Gateway 閘道器 外掛
  - 你想要除錯外掛載入失敗
title: "plugins"
x-i18n:
  source_path: cli/plugins.md
  source_hash: c6bf76b1e766b912
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:42Z
---

# `openclaw plugins`

管理 Gateway 閘道器 外掛／擴充功能（於行程內載入）。

相關內容：

- 外掛系統：[Plugins](/plugin)
- 外掛資訊清單 + 結構描述：[Plugin manifest](/plugins/manifest)
- 安全性強化：[Security](/gateway/security)

## Commands

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
openclaw plugins update <id>
openclaw plugins update --all
```

隨 OpenClaw 提供的內建外掛預設為停用。使用 `plugins enable` 來
啟用它們。

所有外掛都必須提供一個 `openclaw.plugin.json` 檔案，並包含內嵌的 JSON Schema
（`configSchema`，即使為空）。缺少或無效的資訊清單或結構描述會阻止
外掛載入，並導致設定驗證失敗。

### Install

```bash
openclaw plugins install <path-or-spec>
```

安全性注意事項：將外掛安裝視同執行程式碼。建議使用固定版本。

支援的封存格式：`.zip`、`.tgz`、`.tar.gz`、`.tar`。

使用 `--link` 以避免複製本機目錄（會加入到 `plugins.load.paths`）：

```bash
openclaw plugins install -l ./my-plugin
```

### Update

```bash
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins update <id> --dry-run
```

更新僅適用於從 npm 安裝的外掛（追蹤於 `plugins.installs`）。
