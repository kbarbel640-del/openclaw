---
summary: 「安裝器腳本（install.sh + install-cli.sh）的運作方式、旗標與自動化」
read_when:
  - 「你想了解 `openclaw.ai/install.sh`」
  - 「你想要自動化安裝（CI / 無頭）」
  - 「你想從 GitHub 檢出進行安裝」
title: 「安裝器內部機制」
x-i18n:
  source_path: install/installer.md
  source_hash: 9e0a19ecb5da0a39
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:48Z
---

# 安裝器內部機制

OpenClaw 隨附兩個安裝器腳本（由 `openclaw.ai` 提供）：

- `https://openclaw.ai/install.sh` — 「推薦」安裝器（預設為全域 npm 安裝；也可從 GitHub 檢出安裝）
- `https://openclaw.ai/install-cli.sh` — 非 root 友善的 CLI 安裝器（安裝到具有自有 Node 的前置路徑）
- `https://openclaw.ai/install.ps1` — Windows PowerShell 安裝器（預設 npm；可選 git 安裝）

要查看目前的旗標／行為，請執行：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Windows（PowerShell）說明：

```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -?
```

如果安裝器完成但在新終端機中找不到 `openclaw`，通常是 Node / npm 的 PATH 問題。請參閱：[Install](/install#nodejs--npm-path-sanity)。

## install.sh（推薦）

它會做什麼（高層次）：

- 偵測作業系統（macOS / Linux / WSL）。
- 確保 Node.js **22+**（macOS 透過 Homebrew；Linux 透過 NodeSource）。
- 選擇安裝方式：
  - `npm`（預設）：`npm install -g openclaw@latest`
  - `git`：複製／建置原始碼檢出並安裝包裝腳本
- 在 Linux 上：必要時將 npm 的前置路徑切換為 `~/.npm-global`，以避免全域 npm 權限錯誤。
- 若升級既有安裝：執行 `openclaw doctor --non-interactive`（盡力而為）。
- 對於 git 安裝：在安裝／更新後執行 `openclaw doctor --non-interactive`（盡力而為）。
- 透過預設 `SHARP_IGNORE_GLOBAL_LIBVIPS=1` 來緩解 `sharp` 的原生安裝陷阱（避免對系統 libvips 進行建置）。

如果你「想要」讓 `sharp` 連結到全域安裝的 libvips（或你正在除錯），請設定：

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=0 curl -fsSL https://openclaw.ai/install.sh | bash
```

### 可發現性／「git 安裝」提示

如果你在**已位於 OpenClaw 原始碼檢出內**執行安裝器（透過 `package.json` + `pnpm-workspace.yaml` 偵測），它會提示：

- 更新並使用此檢出（`git`）
- 或遷移到全域 npm 安裝（`npm`）

在非互動式情境（沒有 TTY / `--no-prompt`）下，你必須傳入 `--install-method git|npm`（或設定 `OPENCLAW_INSTALL_METHOD`），否則腳本會以代碼 `2` 結束。

### 為什麼需要 Git

`--install-method git` 路徑（複製／拉取）需要 Git。

對於 `npm` 安裝，通常不需要 Git，但某些環境仍可能需要（例如套件或相依性透過 git URL 取得）。目前安裝器會確保 Git 存在，以避免在全新發行版上出現 `spawn git ENOENT` 的意外狀況。

### 為什麼 npm 在全新 Linux 上會遇到 `EACCES`

在某些 Linux 設定中（特別是透過系統套件管理員或 NodeSource 安裝 Node 之後），npm 的全域前置路徑指向由 root 擁有的位置。此時 `npm install -g ...` 會因 `EACCES`／`mkdir` 權限錯誤而失敗。

`install.sh` 透過將前置路徑切換為以下位置來緩解：

- `~/.npm-global`（並在存在時，將其加入 `~/.bashrc`／`~/.zshrc` 中的 `PATH`）

## install-cli.sh（非 root 的 CLI 安裝器）

此腳本會將 `openclaw` 安裝到一個前置路徑（預設：`~/.openclaw`），並在該前置路徑下同時安裝專用的 Node 執行階段，因此可在不想動到系統 Node / npm 的機器上運作。

說明：

```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash -s -- --help
```

## install.ps1（Windows PowerShell）

它會做什麼（高層次）：

- 確保 Node.js **22+**（winget / Chocolatey / Scoop 或手動）。
- 選擇安裝方式：
  - `npm`（預設）：`npm install -g openclaw@latest`
  - `git`：複製／建置原始碼檢出並安裝包裝腳本
- 在升級與 git 安裝時執行 `openclaw doctor --non-interactive`（盡力而為）。

範例：

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git -GitDir "C:\\openclaw"
```

環境變數：

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`

Git 需求：

如果你選擇 `-InstallMethod git` 且缺少 Git，安裝器會印出
Git for Windows 連結（`https://git-scm.com/download/win`）並結束。

常見 Windows 問題：

- **npm error spawn git / ENOENT**：安裝 Git for Windows，重新開啟 PowerShell，然後再次執行安裝器。
- **「openclaw」無法辨識**：你的 npm 全域 bin 資料夾未在 PATH 上。多數系統使用
  `%AppData%\\npm`。你也可以執行 `npm config get prefix`，並將 `\\bin` 加入 PATH，然後重新開啟 PowerShell。
