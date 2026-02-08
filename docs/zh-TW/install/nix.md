---
summary: "使用 Nix 以宣告式方式安裝 OpenClaw"
read_when:
  - 你想要可重現、可回滾的安裝
  - 你已經在使用 Nix / NixOS / Home Manager
  - 你希望一切都被固定並以宣告式方式管理
title: "Nix"
x-i18n:
  source_path: install/nix.md
  source_hash: f1452194cfdd7461
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:45Z
---

# Nix 安裝

使用 Nix 執行 OpenClaw 的建議方式是透過 **[nix-openclaw](https://github.com/openclaw/nix-openclaw)** —— 一個電池內建的 Home Manager 模組。

## 快速開始

將這段貼給你的 AI 代理程式（Claude、Cursor 等）：

```text
I want to set up nix-openclaw on my Mac.
Repository: github:openclaw/nix-openclaw

What I need you to do:
1. Check if Determinate Nix is installed (if not, install it)
2. Create a local flake at ~/code/openclaw-local using templates/agent-first/flake.nix
3. Help me create a Telegram bot (@BotFather) and get my chat ID (@userinfobot)
4. Set up secrets (bot token, Anthropic key) - plain files at ~/.secrets/ is fine
5. Fill in the template placeholders and run home-manager switch
6. Verify: launchd running, bot responds to messages

Reference the nix-openclaw README for module options.
```

> **📦 完整指南：[github.com/openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)**
>
> nix-openclaw 儲存庫是 Nix 安裝的權威來源。本頁僅提供快速概覽。

## 你會得到什麼

- Gateway 閘道器 + macOS 應用程式 + 工具（whisper、spotify、cameras）— 全部已固定版本
- 可在重新開機後持續運作的 Launchd 服務
- 具備宣告式設定的外掛系統
- 即時回滾：`home-manager switch --rollback`

---

## Nix 模式的執行階段行為

當設定 `OPENCLAW_NIX_MODE=1`（使用 nix-openclaw 時會自動設定）：

OpenClaw 支援 **Nix 模式**，使設定具備確定性並停用自動安裝流程。
可透過匯出以下內容來啟用：

```bash
OPENCLAW_NIX_MODE=1
```

在 macOS 上，GUI 應用程式不會自動繼承 shell 的環境變數。你也可以
透過 defaults 來啟用 Nix 模式：

```bash
defaults write bot.molt.mac openclaw.nixMode -bool true
```

### 設定 + 狀態路徑

OpenClaw 會從 `OPENCLAW_CONFIG_PATH` 讀取 JSON5 設定，並將可變資料儲存在 `OPENCLAW_STATE_DIR`。

- `OPENCLAW_STATE_DIR`（預設：`~/.openclaw`）
- `OPENCLAW_CONFIG_PATH`（預設：`$OPENCLAW_STATE_DIR/openclaw.json`）

在 Nix 下執行時，請將這些路徑明確設定為由 Nix 管理的位置，以確保執行階段狀態與設定
不會進入不可變的 store。

### Nix 模式下的執行階段行為

- 停用自動安裝與自我變更流程
- 缺少相依項目時會顯示 Nix 專屬的修復訊息
- UI 在存在時會顯示唯讀的 Nix 模式橫幅

## 封裝說明（macOS）

macOS 的封裝流程預期在以下位置有穩定的 Info.plist 範本：

```
apps/macos/Sources/OpenClaw/Resources/Info.plist
```

[`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) 會將此範本複製到應用程式套件中，並修補動態欄位
（bundle ID、版本／建置、Git SHA、Sparkle 金鑰）。這能讓 plist 對 SwiftPM
封裝與 Nix 建置保持確定性（不依賴完整的 Xcode 工具鏈）。

## 相關

- [nix-openclaw](https://github.com/openclaw/nix-openclaw) — 完整設定指南
- [Wizard](/start/wizard) — 非 Nix 的 CLI 設定
- [Docker](/install/docker) — 容器化設定
