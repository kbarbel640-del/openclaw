---
summary: 「穩定版、beta 與 dev 頻道：語意、切換與標記」
read_when:
  - 「你想在 stable/beta/dev 之間切換」
  - 「你正在為預先發佈版本加上標記或發佈」
title: 「開發頻道」
x-i18n:
  source_path: install/development-channels.md
  source_hash: 2b01219b7e705044
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:37Z
---

# 開發頻道

最後更新：2026-01-21

OpenClaw 提供三種更新頻道：

- **stable**：npm dist-tag `latest`。
- **beta**：npm dist-tag `beta`（測試中的組建）。
- **dev**：`main`（git）的移動中的最新狀態。npm dist-tag：`dev`（發佈時）。

我們會先將組建發佈到 **beta**、進行測試，然後**將通過審核的組建提升到 `latest`**
而不更改版本號——對於 npm 安裝而言，dist-tag 才是真實來源。

## 切換頻道

Git 取出：

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

- `stable`/`beta` 取出最新符合的標記（通常是同一個標記）。
- `dev` 會切換到 `main` 並在上游之上重新基底化。

npm/pnpm 全域安裝：

```bash
openclaw update --channel stable
openclaw update --channel beta
openclaw update --channel dev
```

這會透過對應的 npm dist-tag（`latest`、`beta`、`dev`）進行更新。

當你使用 `--channel` **明確** 切換頻道時，OpenClaw 也會對齊
安裝方式：

- `dev` 會確保使用 git 取出（預設為 `~/openclaw`，可用 `OPENCLAW_GIT_DIR` 覆寫），
  更新後並從該取出內容安裝全域 CLI。
- `stable`/`beta` 會使用對應的 dist-tag 從 npm 安裝。

提示：如果你想同時使用 stable + dev，可保留兩個複本，並將你的 Gateway 閘道器 指向 stable 的那一個。

## 外掛與頻道

當你使用 `openclaw update` 切換頻道時，OpenClaw 也會同步外掛來源：

- `dev` 會優先使用來自 git 取出的隨附外掛。
- `stable` 與 `beta` 會還原以 npm 安裝的外掛套件。

## 標記最佳實務

- 為你希望 git 取出落點的版本加上標記（`vYYYY.M.D` 或 `vYYYY.M.D-<patch>`）。
- 保持標記不可變：切勿移動或重複使用標記。
- npm dist-tag 仍是 npm 安裝的真實來源：
  - `latest` → stable
  - `beta` → 候選組建
  - `dev` → main 快照（選用）

## macOS 應用程式可用性

Beta 與 dev 組建**可能**不包含 macOS 應用程式版本。這是可以接受的：

- 仍可發佈 git 標記與 npm dist-tag。
- 在發佈說明或變更記錄中註明「此 beta 沒有 macOS 組建」。
