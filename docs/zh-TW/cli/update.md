---
summary: "「openclaw update」的 CLI 參考（安全性較高的原始碼更新 + Gateway 閘道器 自動重新啟動）"
read_when:
  - 你想要安全地更新原始碼檢出
  - 你需要了解「--update」的速記行為
title: "更新"
x-i18n:
  source_path: cli/update.md
  source_hash: 3a08e8ac797612c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:53Z
---

# `openclaw update`

安全地更新 OpenClaw，並在 stable / beta / dev 頻道之間切換。

如果你是透過 **npm/pnpm** 安裝（全域安裝，沒有 git 中繼資料），更新會依照套件管理員流程進行，請參閱 [Updating](/install/updating)。

## Usage

```bash
openclaw update
openclaw update status
openclaw update wizard
openclaw update --channel beta
openclaw update --channel dev
openclaw update --tag beta
openclaw update --no-restart
openclaw update --json
openclaw --update
```

## Options

- `--no-restart`：更新成功後略過重新啟動 Gateway 閘道器 服務。
- `--channel <stable|beta|dev>`：設定更新頻道（git + npm；會持久化到設定中）。
- `--tag <dist-tag|version>`：僅針對此次更新覆寫 npm 的 dist-tag 或版本。
- `--json`：輸出機器可讀的 `UpdateRunResult` JSON。
- `--timeout <seconds>`：每個步驟的逾時時間（預設為 1200 秒）。

注意：降版需要確認，因為較舊的版本可能會破壞設定。

## `update status`

顯示目前啟用的更新頻道，以及 git 標籤／分支／SHA（僅限原始碼檢出），並顯示是否有可用更新。

```bash
openclaw update status
openclaw update status --json
openclaw update status --timeout 10
```

Options：

- `--json`：輸出機器可讀的狀態 JSON。
- `--timeout <seconds>`：檢查的逾時時間（預設為 3 秒）。

## `update wizard`

互動式流程，用來選擇更新頻道並確認是否在更新後重新啟動 Gateway
（預設會重新啟動）。如果在沒有 git 檢出的情況下選擇 `dev`，會提示建立一個。

## What it does

當你明確切換頻道（`--channel ...`）時，OpenClaw 也會保持
安裝方式的一致性：

- `dev` → 確保有一個 git 檢出（預設：`~/openclaw`，可用 `OPENCLAW_GIT_DIR` 覆寫），
  更新它，並從該檢出安裝全域 CLI。
- `stable`/`beta` → 使用相符的 dist-tag 從 npm 安裝。

## Git checkout flow

Channels：

- `stable`：檢出最新的非 beta 標籤，然後 build + doctor。
- `beta`：檢出最新的 `-beta` 標籤，然後 build + doctor。
- `dev`：檢出 `main`，然後 fetch + rebase。

High-level：

1. 需要乾淨的工作樹（沒有未提交的變更）。
2. 切換到選定的頻道（標籤或分支）。
3. 擷取上游（僅 dev）。
4. 僅 dev：在暫存工作樹中進行預檢 lint + TypeScript build；如果目前提交失敗，會最多回溯 10 個提交以找到最新可成功建置的版本。
5. 僅 dev：rebase 到選定的提交。
6. 安裝相依套件（優先使用 pnpm；備援為 npm）。
7. 建置並建置 Control UI。
8. 執行 `openclaw doctor` 作為最終的「安全更新」檢查。
9. 將外掛同步到啟用中的頻道（dev 使用隨附的擴充功能；stable/beta 使用 npm），並更新以 npm 安裝的外掛。

## `--update` shorthand

`openclaw --update` 會重寫為 `openclaw update`（對於 shell 與啟動器腳本很有用）。

## See also

- `openclaw doctor`（在 git 檢出時會提供先執行更新）
- [Development channels](/install/development-channels)
- [Updating](/install/updating)
- [CLI reference](/cli)
