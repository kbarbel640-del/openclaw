---
summary: "安裝 OpenClaw（建議的安裝程式、全域安裝或從原始碼）"
read_when:
  - 安裝 OpenClaw
  - 你想要從 GitHub 安裝
title: "安裝總覽"
x-i18n:
  source_path: install/index.md
  source_hash: 228056bb0a2176b8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:46Z
---

# 安裝總覽

除非你有不使用的理由，否則請使用安裝程式。它會設定 CLI 並執行入門引導。

## 快速安裝（建議）

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows（PowerShell）：

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

下一步（若你略過了入門引導）：

```bash
openclaw onboard --install-daemon
```

## 系統需求

- **Node >=22**
- macOS、Linux，或透過 WSL2 的 Windows
- 僅在從原始碼建置時需要 `pnpm`

## 選擇你的安裝方式

### 1) 安裝程式腳本（建議）

透過 npm 全域安裝 `openclaw`，並執行入門引導。

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

安裝程式旗標：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

詳情：[安裝程式內部運作](/install/installer)。

非互動模式（略過入門引導）：

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### 2) 全域安裝（手動）

如果你已經有 Node：

```bash
npm install -g openclaw@latest
```

如果你已全域安裝 libvips（在 macOS 透過 Homebrew 很常見），且 `sharp` 安裝失敗，請強制使用預先建置的二進位檔：

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

如果你看到 `sharp: Please add node-gyp to your dependencies`，請安裝建置工具（macOS：Xcode CLT + `npm install -g node-gyp`），或使用上方的 `SHARP_IGNORE_GLOBAL_LIBVIPS=1` 變通方式來略過原生建置。

或使用 pnpm：

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

pnpm 需要對含有建置腳本的套件進行明確核准。第一次安裝顯示「Ignored build scripts」警告後，請執行 `pnpm approve-builds -g` 並選取列出的套件。

接著：

```bash
openclaw onboard --install-daemon
```

### 3) 從原始碼（貢獻者／開發者）

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

提示：如果你尚未進行全域安裝，可透過 `pnpm openclaw ...` 執行儲存庫指令。

更深入的開發工作流程，請參閱 [設定](/start/setup)。

### 4) 其他安裝選項

- Docker：[Docker](/install/docker)
- Nix：[Nix](/install/nix)
- Ansible：[Ansible](/install/ansible)
- Bun（僅 CLI）：[Bun](/install/bun)

## 安裝後

- 執行入門引導：`openclaw onboard --install-daemon`
- 快速檢查：`openclaw doctor`
- 檢查 Gateway 閘道器 健康狀態：`openclaw status` + `openclaw health`
- 開啟儀表板：`openclaw dashboard`

## 安裝方式：npm vs git（安裝程式）

安裝程式支援兩種方式：

- `npm`（預設）：`npm install -g openclaw@latest`
- `git`：從 GitHub 複製／建置，並從原始碼檢出執行

### CLI 旗標

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

常用旗標：

- `--install-method npm|git`
- `--git-dir <path>`（預設：`~/openclaw`）
- `--no-git-update`（使用既有檢出時略過 `git pull`）
- `--no-prompt`（停用提示；在 CI／自動化中必需）
- `--dry-run`（列印將會發生的事項；不做任何變更）
- `--no-onboard`（略過入門引導）

### 環境變數

等效的環境變數（適用於自動化）：

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1`（預設：`1`；避免 `sharp` 針對系統 libvips 進行建置）

## 疑難排解：找不到 `openclaw`（PATH）

快速診斷：

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

如果 `$(npm prefix -g)/bin`（macOS／Linux）或 `$(npm prefix -g)`（Windows）**不存在**於 `echo "$PATH"` 中，你的 shell 就無法找到全域 npm 二進位檔（包含 `openclaw`）。

修正方式：將其加入你的 shell 啟動檔（zsh：`~/.zshrc`，bash：`~/.bashrc`）：

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

在 Windows 上，請將 `npm prefix -g` 的輸出加入你的 PATH。

接著開啟新的終端機（或在 zsh 中執行 `rehash`／在 bash 中執行 `hash -r`）。

## 更新／解除安裝

- 更新：[Updating](/install/updating)
- 遷移到新機器：[Migrating](/install/migrating)
- 解除安裝：[Uninstall](/install/uninstall)
