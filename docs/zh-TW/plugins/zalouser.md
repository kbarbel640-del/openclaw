---
summary: 「Zalo 個人版外掛：透過 zca-cli 進行 QR 登入 + 訊息傳送（外掛安裝 + 頻道設定 + CLI + 工具）」
read_when:
  - 「你想在 OpenClaw 中使用 Zalo 個人版（非官方）支援」
  - 「你正在設定或開發 zalouser 外掛」
title: 「Zalo 個人版外掛」
x-i18n:
  source_path: plugins/zalouser.md
  source_hash: b29b788b023cd507
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:14Z
---

# Zalo 個人版（外掛）

透過外掛為 OpenClaw 提供 Zalo 個人版支援，使用 `zca-cli` 來自動化一般的 Zalo 使用者帳號。

> **警告：** 非官方自動化可能導致帳號被停權或封鎖。請自行承擔風險。

## 命名

頻道 id 為 `zalouser`，以明確表示這是自動化 **Zalo 個人使用者帳號**（非官方）。我們保留 `zalo`，以供未來可能的官方 Zalo API 整合。

## 執行位置

此外掛會 **在 Gateway 閘道器 程序內** 執行。

如果你使用遠端 Gateway 閘道器，請在 **執行 Gateway 閘道器 的機器** 上安裝與設定，然後重新啟動 Gateway 閘道器。

## 安裝

### 選項 A：從 npm 安裝

```bash
openclaw plugins install @openclaw/zalouser
```

之後請重新啟動 Gateway 閘道器。

### 選項 B：從本機資料夾安裝（開發）

```bash
openclaw plugins install ./extensions/zalouser
cd ./extensions/zalouser && pnpm install
```

之後請重新啟動 Gateway 閘道器。

## 先決條件：zca-cli

Gateway 閘道器 所在的機器必須在 `PATH` 上安裝 `zca`：

```bash
zca --version
```

## 設定

頻道設定位於 `channels.zalouser`（不是 `plugins.entries.*`）：

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

## CLI

```bash
openclaw channels login --channel zalouser
openclaw channels logout --channel zalouser
openclaw channels status --probe
openclaw message send --channel zalouser --target <threadId> --message "Hello from OpenClaw"
openclaw directory peers list --channel zalouser --query "name"
```

## 代理程式工具

工具名稱：`zalouser`

動作：`send`、`image`、`link`、`friends`、`groups`、`me`、`status`
