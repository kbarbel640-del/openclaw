---
summary: 「ClawHub 指南：公開 Skills 登錄中心 + CLI 工作流程」
read_when:
  - 向新使用者介紹 ClawHub
  - 安裝、搜尋或發佈 Skills
  - 說明 ClawHub CLI 旗標與同步行為
title: 「ClawHub」
x-i18n:
  source_path: tools/clawhub.md
  source_hash: b572473a11246357
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:07Z
---

# ClawHub

ClawHub 是 **OpenClaw 的公開 Skills 登錄中心**。這是一項免費服務：所有 Skills 都是公開、開放，並對所有人可見，以便分享與重複使用。Skill 本質上只是一個資料夾，內含一個 `SKILL.md` 檔案（以及支援用的文字檔）。你可以在網頁應用程式中瀏覽 Skills，或使用 CLI 來搜尋、安裝、更新與發佈 Skills。

網站：[clawhub.ai](https://clawhub.ai)

## ClawHub 是什麼

- OpenClaw Skills 的公開登錄中心。
- Skills 套件與中繼資料的版本化儲存庫。
- 用於搜尋、標籤與使用訊號的探索介面。

## 運作方式

1. 使用者發佈一個 Skill 套件（檔案 + 中繼資料）。
2. ClawHub 儲存套件、解析中繼資料，並指派一個版本。
3. 登錄中心將 Skill 編入索引，以供搜尋與探索。
4. 使用者在 OpenClaw 中瀏覽、下載並安裝 Skills。

## 你可以做什麼

- 發佈新 Skills 以及既有 Skills 的新版本。
- 依名稱、標籤或搜尋來探索 Skills。
- 下載 Skill 套件並檢視其檔案內容。
- 回報具有濫用或不安全風險的 Skills。
- 若你是管理員，可隱藏、取消隱藏、刪除或封鎖。

## 適合對象（新手友善）

如果你想為 OpenClaw 代理程式加入新能力，ClawHub 是尋找並安裝 Skills 最簡單的方式。你不需要了解後端如何運作。你可以：

- 以自然語言搜尋 Skills。
- 將 Skill 安裝到你的工作空間。
- 之後用一個指令更新 Skills。
- 透過發佈來備份你自己的 Skills。

## 快速開始（非技術）

1. 安裝 CLI（見下一節）。
2. 搜尋你需要的內容：
   - `clawhub search "calendar"`
3. 安裝一個 Skill：
   - `clawhub install <skill-slug>`
4. 啟動新的 OpenClaw 工作階段，讓它載入新的 Skill。

## 安裝 CLI

選擇一種方式：

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## 它如何融入 OpenClaw

預設情況下，CLI 會將 Skills 安裝到目前工作目錄下的 `./skills`。如果已設定 OpenClaw 工作空間，`clawhub` 會回退到該工作空間，除非你覆寫 `--workdir`（或 `CLAWHUB_WORKDIR`）。OpenClaw 會從 `<workspace>/skills` 載入工作空間 Skills，並在 **下一個** 工作階段中生效。如果你已使用 `~/.openclaw/skills` 或隨附的 Skills，工作空間 Skills 具有較高優先順序。

關於 Skills 如何載入、共享與受限的更多細節，請參閱
[Skills](/tools/skills)。

## Skill 系統概覽

Skill 是一組具版本的檔案套件，用於教導 OpenClaw 如何執行特定任務。每次發佈都會建立一個新版本，而登錄中心會保留版本歷史，讓使用者可以稽核變更。

一個典型的 Skill 包含：

- 一個 `SKILL.md` 檔案，內含主要說明與使用方式。
- 技能所使用的選用設定、腳本或支援檔案。
- 標籤、摘要與安裝需求等中繼資料。

ClawHub 使用中繼資料來支援探索，並安全地揭露 Skill 能力。登錄中心也會追蹤使用訊號（例如星號與下載次數），以改善排序與可見度。

## 服務提供的內容（功能）

- **公開瀏覽** Skills 及其 `SKILL.md` 內容。
- **搜尋** 採用向量搜尋（embeddings），不僅限於關鍵字。
- **版本管理**，支援 semver、變更記錄與標籤（包含 `latest`）。
- **下載**，每個版本提供一個 zip。
- **星號與留言**，用於社群回饋。
- **管理** 機制，用於審核與稽核。
- **CLI 友善 API**，便於自動化與腳本使用。

## 安全性與管理

ClawHub 預設為開放。任何人都可以上傳 Skills，但 GitHub 帳號必須至少存在一週才能發佈。這能在不阻擋正當貢獻者的前提下，降低濫用行為。

回報與管理：

- 任何已登入使用者都可以回報 Skill。
- 回報原因為必填，且會被記錄。
- 每位使用者同時最多可有 20 個有效回報。
- 超過 3 個不同使用者回報的 Skill，預設會自動隱藏。
- 管理員可以檢視已隱藏的 Skills、取消隱藏、刪除或封鎖使用者。
- 濫用回報功能可能導致帳號被封鎖。

有興趣成為管理員嗎？請在 OpenClaw Discord 中詢問，並聯絡管理員或維護者。

## CLI 指令與參數

全域選項（套用於所有指令）：

- `--workdir <dir>`：工作目錄（預設：目前目錄；回退到 OpenClaw 工作空間）。
- `--dir <dir>`：Skills 目錄，相對於工作目錄（預設：`skills`）。
- `--site <url>`：網站基底 URL（瀏覽器登入）。
- `--registry <url>`：登錄中心 API 基底 URL。
- `--no-input`：停用提示（非互動模式）。
- `-V, --cli-version`：輸出 CLI 版本。

驗證：

- `clawhub login`（瀏覽器流程）或 `clawhub login --token <token>`
- `clawhub logout`
- `clawhub whoami`

選項：

- `--token <token>`：貼上 API token。
- `--label <label>`：儲存用於瀏覽器登入 token 的標籤（預設：`CLI token`）。
- `--no-browser`：不要開啟瀏覽器（需要 `--token`）。

搜尋：

- `clawhub search "query"`
- `--limit <n>`：最大結果數。

安裝：

- `clawhub install <slug>`
- `--version <version>`：安裝指定版本。
- `--force`：若資料夾已存在則覆寫。

更新：

- `clawhub update <slug>`
- `clawhub update --all`
- `--version <version>`：更新到指定版本（僅限單一 slug）。
- `--force`：當本地檔案不符合任何已發佈版本時覆寫。

列表：

- `clawhub list`（讀取 `.clawhub/lock.json`）

發佈：

- `clawhub publish <path>`
- `--slug <slug>`：Skill slug。
- `--name <name>`：顯示名稱。
- `--version <version>`：Semver 版本。
- `--changelog <text>`：變更記錄文字（可為空）。
- `--tags <tags>`：以逗號分隔的標籤（預設：`latest`）。

刪除 / 取消刪除（僅限擁有者 / 管理員）：

- `clawhub delete <slug> --yes`
- `clawhub undelete <slug> --yes`

同步（掃描本地 Skills + 發佈新增 / 更新）：

- `clawhub sync`
- `--root <dir...>`：額外掃描根目錄。
- `--all`：不經提示直接上傳全部。
- `--dry-run`：顯示將會上傳的內容。
- `--bump <type>`：更新時的 `patch|minor|major`（預設：`patch`）。
- `--changelog <text>`：非互動更新的變更記錄。
- `--tags <tags>`：以逗號分隔的標籤（預設：`latest`）。
- `--concurrency <n>`：登錄中心檢查次數（預設：4）。

## 代理程式的常見工作流程

### 搜尋 Skills

```bash
clawhub search "postgres backups"
```

### 下載新 Skills

```bash
clawhub install my-skill-pack
```

### 更新已安裝的 Skills

```bash
clawhub update --all
```

### 備份你的 Skills（發佈或同步）

針對單一 Skill 資料夾：

```bash
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

一次掃描並備份多個 Skills：

```bash
clawhub sync --all
```

## 進階細節（技術）

### 版本與標籤

- 每次發佈都會建立一個新的 **semver** `SkillVersion`。
- 標籤（例如 `latest`）會指向某個版本；移動標籤可讓你回滾。
- 變更記錄會附加在每個版本上，在同步或發佈更新時可以為空。

### 本地變更與登錄中心版本

更新時會使用內容雜湊來比較本地 Skill 與登錄中心版本。如果本地檔案不符合任何已發佈版本，CLI 會在覆寫前詢問（或在非互動執行時需要 `--force`）。

### 同步掃描與回退根目錄

`clawhub sync` 會先掃描目前的工作目錄。如果未找到 Skills，則會回退到已知的舊版位置（例如 `~/openclaw/skills` 與 `~/.openclaw/skills`）。此設計可在不使用額外旗標的情況下，找到較舊的 Skill 安裝。

### 儲存與鎖定檔

- 已安裝的 Skills 會記錄在工作目錄下的 `.clawhub/lock.json`。
- 驗證 token 會儲存在 ClawHub CLI 設定檔中（可透過 `CLAWHUB_CONFIG_PATH` 覆寫）。

### 遙測（安裝計數）

當你登入後執行 `clawhub sync`，CLI 會傳送最小化的快照以計算安裝次數。你可以完全停用此功能：

```bash
export CLAWHUB_DISABLE_TELEMETRY=1
```

## 環境變數

- `CLAWHUB_SITE`：覆寫網站 URL。
- `CLAWHUB_REGISTRY`：覆寫登錄中心 API URL。
- `CLAWHUB_CONFIG_PATH`：覆寫 CLI 儲存 token / 設定的位置。
- `CLAWHUB_WORKDIR`：覆寫預設工作目錄。
- `CLAWHUB_DISABLE_TELEMETRY=1`：在 `sync` 上停用遙測。
