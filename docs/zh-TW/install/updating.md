---
summary: 「安全地更新 OpenClaw（全域安裝或原始碼），以及回滾策略」
read_when:
  - 更新 OpenClaw
  - 更新後發生問題
title: 「更新」
x-i18n:
  source_path: install/updating.md
  source_hash: 38cccac0839f0f22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:56Z
---

# 更新

OpenClaw 正在快速演進（1.0 之前）。請像對待基礎設施上線一樣對待更新：更新 → 執行檢查 → 重新啟動（或使用 `openclaw update`，其會重新啟動）→ 驗證。

## 建議作法：重新執行網站安裝程式（就地升級）

**首選** 的更新方式是重新執行網站上的安裝程式。它會
偵測既有安裝、就地升級，並在需要時執行 `openclaw doctor`。

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

注意事項：

- 若不想再次執行入門引導精靈，請加入 `--no-onboard`。
- 對於 **原始碼安裝**，請使用：
  ```bash
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
  ```
  安裝程式 **僅會** 在儲存庫乾淨時才 `git pull --rebase`。
- 對於 **全域安裝**，腳本底層會使用 `npm install -g openclaw@latest`。
- 舊版說明：`clawdbot` 仍可作為相容性墊片使用。

## 更新前準備

- 了解你的安裝方式：**全域**（npm/pnpm）或 **從原始碼**（git clone）。
- 了解你的 Gateway 閘道器 如何執行：**前景終端機** 或 **受監管服務**（launchd/systemd）。
- 為你的客製化內容建立快照：
  - 設定：`~/.openclaw/openclaw.json`
  - 憑證：`~/.openclaw/credentials/`
  - 工作區：`~/.openclaw/workspace`

## 更新（全域安裝）

全域安裝（擇一）：

```bash
npm i -g openclaw@latest
```

```bash
pnpm add -g openclaw@latest
```

我們 **不** 建議在 Gateway 閘道器 執行環境中使用 Bun（WhatsApp/Telegram 有問題）。

切換更新頻道（git + npm 安裝）：

```bash
openclaw update --channel beta
openclaw update --channel dev
openclaw update --channel stable
```

需要一次性指定安裝標籤／版本時，使用 `--tag <dist-tag|version>`。

頻道語意與發行說明請見 [Development channels](/install/development-channels)。

注意：在 npm 安裝中，Gateway 閘道器 會在啟動時記錄更新提示（檢查目前頻道標籤）。可透過 `update.checkOnStart: false` 停用。

接著：

```bash
openclaw doctor
openclaw gateway restart
openclaw health
```

注意事項：

- 若你的 Gateway 閘道器 以服務方式執行，建議使用 `openclaw gateway restart`，不要直接殺 PID。
- 若你固定在特定版本，請參考下方「回滾／固定版本」。

## 更新（`openclaw update`）

對於 **原始碼安裝**（git checkout），建議使用：

```bash
openclaw update
```

它會執行一個相對安全的更新流程：

- 需要乾淨的工作樹。
- 切換到選定的頻道（標籤或分支）。
- 依設定的上游（dev 頻道）抓取並 rebase。
- 安裝相依套件、建置、建置 Control UI，並執行 `openclaw doctor`。
- 預設會重新啟動 Gateway 閘道器（使用 `--no-restart` 可略過）。

若你是透過 **npm/pnpm** 安裝（沒有 git 中繼資料），`openclaw update` 會嘗試透過你的套件管理器更新。若無法偵測安裝，請改用「更新（全域安裝）」。

## 更新（Control UI / RPC）

Control UI 提供 **Update & Restart**（RPC：`update.run`）。它會：

1. 執行與 `openclaw update` 相同的原始碼更新流程（僅限 git checkout）。
2. 寫入包含結構化報告（stdout/stderr 尾端）的重新啟動哨兵。
3. 重新啟動 Gateway 閘道器，並將報告傳送給最後一個作用中的工作階段。

若 rebase 失敗，Gateway 閘道器 會中止並在未套用更新的情況下重新啟動。

## 更新（從原始碼）

在儲存庫 checkout 中：

建議：

```bash
openclaw update
```

手動（大致等效）：

```bash
git pull
pnpm install
pnpm build
pnpm ui:build # auto-installs UI deps on first run
openclaw doctor
openclaw health
```

注意事項：

- 當你執行已封裝的 `openclaw` 二進位檔（[`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs)）或使用 Node 執行 `dist/` 時，`pnpm build` 很重要。
- 若你從儲存庫 checkout 執行且沒有全域安裝，CLI 指令請使用 `pnpm openclaw ...`。
- 若你直接從 TypeScript 執行（`pnpm openclaw ...`），通常不需要重新建置，但 **設定遷移仍然適用** → 請執行 doctor。
- 在全域與 git 安裝之間切換很容易：安裝另一種形式後，執行 `openclaw doctor`，讓 Gateway 閘道器 的服務進入點改寫為目前的安裝。

## 務必執行：`openclaw doctor`

Doctor 是「安全更新」指令。它刻意保持單純：修復 + 遷移 + 警告。

注意：若你使用 **原始碼安裝**（git checkout），`openclaw doctor` 會先提議執行 `openclaw update`。

它通常會做的事情：

- 遷移已淘汰的設定金鑰／舊版設定檔位置。
- 稽核私訊政策，並對風險較高的「開放」設定提出警告。
- 檢查 Gateway 閘道器 健康狀態，並可提議重新啟動。
- 偵測並遷移舊版的 Gateway 閘道器 服務（launchd/systemd；舊 schtasks）至目前的 OpenClaw 服務。
- 在 Linux 上，確保 systemd 使用者 lingering（讓 Gateway 閘道器 在登出後仍可存活）。

詳情：[Doctor](/gateway/doctor)

## 啟動／停止／重新啟動 Gateway 閘道器

CLI（不分作業系統皆可）：

```bash
openclaw gateway status
openclaw gateway stop
openclaw gateway restart
openclaw gateway --port 18789
openclaw logs --follow
```

若你是受監管執行：

- macOS launchd（App 封裝的 LaunchAgent）：`launchctl kickstart -k gui/$UID/bot.molt.gateway`（使用 `bot.molt.<profile>`；舊版 `com.openclaw.*` 仍可用）
- Linux systemd 使用者服務：`systemctl --user restart openclaw-gateway[-<profile>].service`
- Windows（WSL2）：`systemctl --user restart openclaw-gateway[-<profile>].service`
  - `launchctl`/`systemctl` 僅在服務已安裝時可用；否則請執行 `openclaw gateway install`。

操作手冊與確切的服務標籤：[Gateway runbook](/gateway)

## 回滾／固定版本（當出問題時）

### 固定（全域安裝）

安裝一個已知可用的版本（將 `<version>` 換成最後可運作的版本）：

```bash
npm i -g openclaw@<version>
```

```bash
pnpm add -g openclaw@<version>
```

提示：查看目前已發佈版本，請執行 `npm view openclaw version`。

接著重新啟動並再次執行 doctor：

```bash
openclaw doctor
openclaw gateway restart
```

### 依日期固定（原始碼）

從某個日期挑選提交（例如：「截至 2026-01-01 的 main 狀態」）：

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
```

接著重新安裝相依套件並重新啟動：

```bash
pnpm install
pnpm build
openclaw gateway restart
```

之後若要回到最新版本：

```bash
git checkout main
git pull
```

## 如果卡關了

- 再次執行 `openclaw doctor` 並仔細閱讀輸出（通常會告訴你修正方式）。
- 查看：[Troubleshooting](/gateway/troubleshooting)
- 在 Discord 提問：https://discord.gg/clawd
