---
title: "Node.js + npm（PATH 健全性）"
summary: "Node.js + npm 安裝健全性：版本、PATH 與全域安裝"
read_when:
  - "你已安裝 OpenClaw，但 `openclaw` 顯示「command not found」"
  - "你正在新電腦上設定 Node.js / npm"
  - "npm install -g ... 因權限或 PATH 問題而失敗"
x-i18n:
  source_path: install/node.md
  source_hash: 9f6d83be362e3e14
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:44Z
---

# Node.js + npm（PATH 健全性）

OpenClaw 的執行環境基準是 **Node 22+**。

如果你可以執行 `npm install -g openclaw@latest`，但之後看到 `openclaw: command not found`，幾乎總是 **PATH** 問題：npm 放置全域二進位檔的目錄沒有加入你殼層的 PATH。

## 快速診斷

執行：

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

如果在 `echo "$PATH"` 內 **沒有** 出現 `$(npm prefix -g)/bin`（macOS / Linux）或 `$(npm prefix -g)`（Windows），你的殼層就無法找到 npm 的全域二進位檔（包含 `openclaw`）。

## 修復：將 npm 的全域 bin 目錄加入 PATH

1. 找出你的 npm 全域前綴：

```bash
npm prefix -g
```

2. 將 npm 的全域 bin 目錄加入你的殼層啟動檔：

- zsh：`~/.zshrc`
- bash：`~/.bashrc`

範例（請以你的 `npm prefix -g` 輸出取代路徑）：

```bash
# macOS / Linux
export PATH="/path/from/npm/prefix/bin:$PATH"
```

接著開啟 **新的終端機**（或在 zsh 執行 `rehash`／在 bash 執行 `hash -r`）。

在 Windows 上，請將 `npm prefix -g` 的輸出加入你的 PATH。

## 修復：避免 `sudo npm install -g`／權限錯誤（Linux）

如果 `npm install -g ...` 因 `EACCES` 而失敗，請將 npm 的全域前綴切換到使用者可寫入的目錄：

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

請在你的殼層啟動檔中持久化 `export PATH=...` 這一行。

## 建議的 Node 安裝選項

若要減少意外，建議以以下方式安裝 Node / npm：

- 讓 Node 保持更新（22+）
- 讓 npm 的全域 bin 目錄穩定，且在新殼層中位於 PATH

常見選擇：

- macOS：Homebrew（`brew install node`）或版本管理器
- Linux：你偏好的版本管理器，或提供 Node 22+ 的發行版安裝
- Windows：官方 Node 安裝程式、`winget`，或 Windows 的 Node 版本管理器

如果你使用版本管理器（nvm / fnm / asdf / 等），請確保它已在你日常使用的殼層（zsh vs bash）中完成初始化，這樣在你執行安裝器時，才會包含它所設定的 PATH。
