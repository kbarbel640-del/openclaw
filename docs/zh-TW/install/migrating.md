---
summary: 「將 OpenClaw 安裝從一台機器移動（遷移）到另一台」
read_when:
  - 你要將 OpenClaw 移動到新的筆電／伺服器
  - 你想要保留工作階段、驗證，以及頻道登入（WhatsApp 等）
title: 「遷移指南」
x-i18n:
  source_path: install/migrating.md
  source_hash: 604d862c4bf86e79
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:52Z
---

# 將 OpenClaw 遷移到新機器

本指南說明如何在 **不重新進行入門引導** 的情況下，將一個 OpenClaw Gateway 閘道器 從一台機器遷移到另一台。

在概念上，遷移很簡單：

- 複製 **state 目錄**（`$OPENCLAW_STATE_DIR`，預設為：`~/.openclaw/`）— 其中包含設定、驗證、工作階段，以及頻道狀態。
- 複製你的 **workspace**（預設為 `~/.openclaw/workspace/`）— 其中包含你的代理程式檔案（記憶、提示詞等）。

但在 **profiles**、**權限** 與 **不完整複製** 方面，有一些常見的地雷。

## 開始之前（你要遷移的內容）

### 1) 找出你的 state 目錄

大多數安裝使用預設值：

- **State dir：** `~/.openclaw/`

但如果你使用以下方式，可能會不同：

- `--profile <name>`（通常會變成 `~/.openclaw-<profile>/`）
- `OPENCLAW_STATE_DIR=/some/path`

如果你不確定，請在 **舊** 機器上執行：

```bash
openclaw status
```

在輸出中尋找提到 `OPENCLAW_STATE_DIR`／profile 的內容。如果你執行多個 gateway，請針對每個 profile 重複此步驟。

### 2) 找出你的 workspace

常見的預設值：

- `~/.openclaw/workspace/`（建議的 workspace）
- 你自行建立的自訂資料夾

你的 workspace 是像 `MEMORY.md`、`USER.md`、以及 `memory/*.md` 這類檔案所在的位置。

### 3) 了解你會保留哪些內容

如果你同時複製 **state 目錄** 與 **workspace**，你將保留：

- Gateway 設定（`openclaw.json`）
- 驗證 profiles／API 金鑰／OAuth token
- 工作階段歷史 + 代理程式狀態
- 頻道狀態（例如 WhatsApp 登入／工作階段）
- 你的 workspace 檔案（記憶、Skills 筆記等）

如果你 **只** 複製 workspace（例如透過 Git），你 **不會** 保留：

- 工作階段
- 憑證
- 頻道登入

這些內容位於 `$OPENCLAW_STATE_DIR` 之下。

## 遷移步驟（建議）

### Step 0 — 建立備份（舊機器）

在 **舊** 機器上，請先停止 gateway，避免在複製過程中檔案發生變動：

```bash
openclaw gateway stop
```

（選用但建議）將 state 目錄與 workspace 封存：

```bash
# Adjust paths if you use a profile or custom locations
cd ~
tar -czf openclaw-state.tgz .openclaw

tar -czf openclaw-workspace.tgz .openclaw/workspace
```

如果你有多個 profiles／state 目錄（例如 `~/.openclaw-main`、`~/.openclaw-work`），請分別封存每一個。

### Step 1 — 在新機器上安裝 OpenClaw

在 **新** 機器上，安裝 CLI（必要時也安裝 Node）：

- 參見：[Install](/install)

在這個階段，如果入門引導建立了一個全新的 `~/.openclaw/` 也沒關係 — 你會在下一步覆寫它。

### Step 2 — 將 state 目錄 + workspace 複製到新機器

請同時複製 **兩者**：

- `$OPENCLAW_STATE_DIR`（預設 `~/.openclaw/`）
- 你的 workspace（預設 `~/.openclaw/workspace/`）

常見做法：

- `scp` 這些 tarball 並解壓縮
- 透過 SSH 使用 `rsync -a`
- 使用外接硬碟

複製完成後，請確認：

- 已包含隱藏目錄（例如 `.openclaw/`）
- 檔案擁有權正確，屬於執行 gateway 的使用者

### Step 3 — 執行 Doctor（遷移 + 服務修復）

在 **新** 機器上：

```bash
openclaw doctor
```

Doctor 是「安全且穩定」的指令。它會修復服務、套用設定遷移，並對不相符之處提出警告。

接著執行：

```bash
openclaw gateway restart
openclaw status
```

## 常見地雷（以及避免方式）

### 地雷：profile／state-dir 不一致

如果你在舊 gateway 中使用了某個 profile（或 `OPENCLAW_STATE_DIR`），而新 gateway 使用的是不同的設定，你可能會看到以下症狀：

- 設定變更沒有生效
- 頻道遺失／被登出
- 空白的工作階段歷史

解法：使用你所遷移的 **相同** profile／state 目錄來執行 gateway／服務，然後重新執行：

```bash
openclaw doctor
```

### 地雷：只複製 `openclaw.json`

僅有 `openclaw.json` 並不足夠。許多提供者會將狀態儲存在以下位置：

- `$OPENCLAW_STATE_DIR/credentials/`
- `$OPENCLAW_STATE_DIR/agents/<agentId>/...`

請務必遷移整個 `$OPENCLAW_STATE_DIR` 資料夾。

### 地雷：權限／擁有權

如果你以 root 身分複製，或是變更了使用者，gateway 可能會無法讀取憑證／工作階段。

解法：確保 state 目錄與 workspace 的擁有者是執行 gateway 的使用者。

### 地雷：在遠端／本機模式之間遷移

- 如果你的 UI（WebUI／TUI）指向 **遠端** gateway，則工作階段儲存與 workspace 都屬於遠端主機。
- 遷移你的筆電不會移動遠端 gateway 的狀態。

如果你使用的是遠端模式，請遷移 **gateway 主機**。

### 地雷：備份中的秘密資料

`$OPENCLAW_STATE_DIR` 包含秘密資料（API 金鑰、OAuth token、WhatsApp 憑證）。請將備份視同正式環境的秘密資料：

- 以加密方式儲存
- 避免透過不安全的管道分享
- 若懷疑外洩，請輪替金鑰

## 驗證清單

在新機器上，請確認：

- `openclaw status` 顯示 gateway 正在執行
- 你的頻道仍然保持連線（例如 WhatsApp 不需要重新配對）
- 儀表板可以開啟並顯示既有的工作階段
- 你的 workspace 檔案（記憶、設定）都存在

## 相關

- [Doctor](/gateway/doctor)
- [Gateway 疑難排解](/gateway/troubleshooting)
- [OpenClaw 的資料儲存在哪裡？](/help/faq#where-does-openclaw-store-its-data)
