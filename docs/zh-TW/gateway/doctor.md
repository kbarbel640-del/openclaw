---
summary: 「Doctor 指令：健康檢查、設定遷移與修復步驟」
read_when:
  - 新增或修改 Doctor 遷移
  - 引入破壞性設定變更
title: 「Doctor」
x-i18n:
  source_path: gateway/doctor.md
  source_hash: df7b25f60fd08d50
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:49Z
---

# Doctor

`openclaw doctor` 是 OpenClaw 的修復 + 遷移工具。它會修復過期的
設定／狀態、進行健康檢查，並提供可執行的修復步驟。

## 快速開始

```bash
openclaw doctor
```

### 無頭模式／自動化

```bash
openclaw doctor --yes
```

在不提示的情況下接受預設值（包含在適用時的重新啟動／服務／沙箱修復步驟）。

```bash
openclaw doctor --repair
```

在不提示的情況下套用建議的修復（在安全時進行修復 + 重新啟動）。

```bash
openclaw doctor --repair --force
```

也套用激進修復（會覆寫自訂的 supervisor 設定）。

```bash
openclaw doctor --non-interactive
```

在無提示下執行，且僅套用安全的遷移（設定正規化 + 磁碟上的狀態移動）。會跳過需要人工確認的重新啟動／服務／沙箱動作。
偵測到時，舊版狀態遷移會自動執行。

```bash
openclaw doctor --deep
```

掃描系統服務以找出額外的 gateway 安裝（launchd/systemd/schtasks）。

若你想在寫入前先檢視變更，請先開啟設定檔：

```bash
cat ~/.openclaw/openclaw.json
```

## 功能說明（摘要）

- git 安裝的可選預檢更新（僅互動模式）。
- UI 通訊協定新鮮度檢查（當通訊協定結構較新時，重建 Control UI）。
- 健康檢查 + 重新啟動提示。
- Skills 狀態摘要（可用／缺失／被封鎖）。
- 舊版數值的設定正規化。
- OpenCode Zen 提供者覆寫警告（`models.providers.opencode`）。
- 舊版磁碟狀態遷移（sessions／agent 目錄／WhatsApp 驗證）。
- 狀態完整性與權限檢查（sessions、transcripts、state 目錄）。
- 本機執行時的設定檔權限檢查（chmod 600）。
- 模型驗證健康度：檢查 OAuth 到期、可重新整理即將到期的權杖，並回報驗證設定檔的冷卻／停用狀態。
- 額外工作區目錄偵測（`~/openclaw`）。
- 啟用沙箱隔離時的沙箱映像修復。
- 舊版服務遷移與額外 gateway 偵測。
- Gateway 執行期檢查（服務已安裝但未執行；快取的 launchd 標籤）。
- 頻道狀態警告（由執行中的 gateway 探測）。
- Supervisor 設定稽核（launchd/systemd/schtasks），可選擇修復。
- Gateway 執行期最佳實務檢查（Node vs Bun、版本管理器路徑）。
- Gateway 連接埠衝突診斷（預設 `18789`）。
- 開放私訊政策的安全警告。
- 本機模式下未設定 `gateway.auth.token` 的 Gateway 驗證警告（提供權杖產生）。
- Linux 上的 systemd linger 檢查。
- 原始碼安裝檢查（pnpm 工作區不相符、缺少 UI 資產、缺少 tsx 二進位）。
- 寫入更新後的設定 + 精靈中繼資料。

## 詳細行為與設計理由

### 0) 可選更新（git 安裝）

若為 git 檢出且 doctor 以互動方式執行，會在執行 doctor 前提供
更新（fetch/rebase/build）。

### 1) 設定正規化

若設定包含舊版數值形態（例如 `messages.ackReaction`
且沒有頻道專屬覆寫），doctor 會將其正規化為目前的
結構。

### 2) 舊版設定鍵遷移

當設定包含已淘汰的鍵時，其他指令會拒絕執行並要求
你執行 `openclaw doctor`。

Doctor 將會：

- 說明找到哪些舊版鍵。
- 顯示其套用的遷移。
- 以更新後的結構重寫 `~/.openclaw/openclaw.json`。

當 Gateway 在啟動時偵測到舊版設定格式，也會自動執行 doctor 遷移，
因此過期設定能在無需人工介入下被修復。

目前的遷移：

- `routing.allowFrom` → `channels.whatsapp.allowFrom`
- `routing.groupChat.requireMention` → `channels.whatsapp/telegram/imessage.groups."*".requireMention`
- `routing.groupChat.historyLimit` → `messages.groupChat.historyLimit`
- `routing.groupChat.mentionPatterns` → `messages.groupChat.mentionPatterns`
- `routing.queue` → `messages.queue`
- `routing.bindings` → 最上層 `bindings`
- `routing.agents`/`routing.defaultAgentId` → `agents.list` + `agents.list[].default`
- `routing.agentToAgent` → `tools.agentToAgent`
- `routing.transcribeAudio` → `tools.media.audio.models`
- `bindings[].match.accountID` → `bindings[].match.accountId`
- `identity` → `agents.list[].identity`
- `agent.*` → `agents.defaults` + `tools.*`（tools/elevated/exec/sandbox/subagents）
- `agent.model`/`allowedModels`/`modelAliases`/`modelFallbacks`/`imageModelFallbacks`
  → `agents.defaults.models` + `agents.defaults.model.primary/fallbacks` + `agents.defaults.imageModel.primary/fallbacks`

### 2b) OpenCode Zen 提供者覆寫

若你手動新增了 `models.providers.opencode`（或 `opencode-zen`），
它會覆寫內建的 OpenCode Zen 目錄（來自 `@mariozechner/pi-ai`）。
這可能會將所有模型強制走同一個 API，或將成本歸零。Doctor 會提出警告，
讓你移除覆寫並恢復各模型的 API 路由 + 成本。

### 3) 舊版狀態遷移（磁碟配置）

Doctor 可將較舊的磁碟配置遷移到目前的結構：

- Sessions 儲存 + transcripts：
  - 從 `~/.openclaw/sessions/` 到 `~/.openclaw/agents/<agentId>/sessions/`
- Agent 目錄：
  - 從 `~/.openclaw/agent/` 到 `~/.openclaw/agents/<agentId>/agent/`
- WhatsApp 驗證狀態（Baileys）：
  - 從舊版 `~/.openclaw/credentials/*.json`（不含 `oauth.json`）
  - 到 `~/.openclaw/credentials/whatsapp/<accountId>/...`（預設帳號 id：`default`）

這些遷移為盡力而為且具冪等性；當留下任何舊版資料夾作為備份時，
doctor 會發出警告。Gateway／CLI 也會在啟動時自動遷移
舊版 sessions + agent 目錄，讓歷史／驗證／模型落在
每個 agent 的路徑下，而無需手動執行 doctor。WhatsApp 驗證則刻意只透過
`openclaw doctor` 進行遷移。

### 4) 狀態完整性檢查（工作階段持久化、路由與安全）

狀態目錄是運作的中樞。若它消失，你將失去
工作階段、憑證、記錄與設定（除非你在其他地方有備份）。

Doctor 檢查項目：

- **狀態目錄缺失**：警告災難性的狀態遺失，提示重新建立
  目錄，並提醒無法復原遺失的資料。
- **狀態目錄權限**：驗證可寫性；提供修復權限的選項
  （當偵測到擁有者／群組不相符時，會提示 `chown`）。
- **工作階段目錄缺失**：`sessions/` 與工作階段儲存目錄
  是持久化歷史並避免 `ENOENT` 當機所必需。
- **Transcript 不一致**：當近期工作階段項目缺少
  transcript 檔案時發出警告。
- **主要工作階段「單行 JSONL」**：當主要 transcript 只有一行時標示
  （歷史未累積）。
- **多個狀態目錄**：當不同家目錄下存在多個 `~/.openclaw` 資料夾，
  或 `OPENCLAW_STATE_DIR` 指向其他位置時發出警告（歷史可能在不同安裝間分裂）。
- **遠端模式提醒**：若為 `gateway.mode=remote`，doctor 會提醒你在
  遠端主機上執行（狀態存在於該處）。
- **設定檔權限**：若 `~/.openclaw/openclaw.json` 可被群組／世界讀取則警告，
  並提供收緊至 `600` 的選項。

### 5) 模型驗證健康度（OAuth 到期）

Doctor 會檢視驗證儲存中的 OAuth 設定檔，當權杖即將到期／已到期時發出警告，
並在安全時可重新整理。若 Anthropic Claude Code
設定檔已過期，會建議執行 `claude setup-token`（或貼上設定權杖）。
重新整理提示僅在互動模式（TTY）下出現；`--non-interactive`
會跳過重新整理嘗試。

Doctor 也會回報暫時不可用的驗證設定檔，原因包括：

- 短暫冷卻（速率限制／逾時／驗證失敗）
- 較長期停用（帳單／額度失敗）

### 6) Hooks 模型驗證

若設定了 `hooks.gmail.model`，doctor 會依目錄與允許清單
驗證模型參照，並在無法解析或不被允許時發出警告。

### 7) 沙箱映像修復

啟用沙箱隔離時，doctor 會檢查 Docker 映像，並在目前映像缺失時
提供建置或切換至舊版名稱的選項。

### 8) Gateway 服務遷移與清理提示

Doctor 會偵測舊版 gateway 服務（launchd/systemd/schtasks），
並提供移除與以目前 gateway 連接埠安裝 OpenClaw 服務的選項。
它也能掃描額外的類 gateway 服務並列印清理提示。
以設定檔命名的 OpenClaw gateway 服務被視為一等公民，不會被標示為「額外」。

### 9) 安全警告

當提供者對私訊開放且未設定允許清單，或政策以危險方式設定時，
doctor 會發出警告。

### 10) systemd linger（Linux）

若以 systemd 使用者服務執行，doctor 會確保啟用 linger，
讓 gateway 在登出後仍能持續運作。

### 11) Skills 狀態

Doctor 會為目前工作區列印可用／缺失／被封鎖的 Skills 快速摘要。

### 12) Gateway 驗證檢查（本機權杖）

當本機 gateway 缺少 `gateway.auth` 時，doctor 會發出警告並提供
產生權杖的選項。使用 `openclaw doctor --generate-gateway-token` 可在自動化中強制建立權杖。

### 13) Gateway 健康檢查 + 重新啟動

Doctor 會執行健康檢查，當看起來不健康時提供重新啟動的選項。

### 14) 頻道狀態警告

若 gateway 健康，doctor 會執行頻道狀態探測，
並回報警告與建議的修正方式。

### 15) Supervisor 設定稽核 + 修復

Doctor 會檢查已安裝的 supervisor 設定（launchd/systemd/schtasks），
是否缺少或過期的預設值（例如 systemd 的 network-online 相依性與
重新啟動延遲）。當發現不一致時，會建議更新，並可
將服務檔／工作重寫為目前的預設值。

備註：

- `openclaw doctor` 會在重寫 supervisor 設定前提示。
- `openclaw doctor --yes` 接受預設的修復提示。
- `openclaw doctor --repair` 在無提示下套用建議修正。
- `openclaw doctor --repair --force` 會覆寫自訂的 supervisor 設定。
- 你也可以透過 `openclaw gateway install --force` 強制完整重寫。

### 16) Gateway 執行期 + 連接埠診斷

Doctor 會檢視服務執行期（PID、最後一次結束狀態），
並在服務已安裝但實際未執行時發出警告。
它也會檢查 gateway 連接埠（預設 `18789`）的衝突，
並回報可能原因（gateway 已在執行、SSH 通道）。

### 17) Gateway 執行期最佳實務

當 gateway 服務在 Bun 或版本管理器的 Node 路徑上執行時，
doctor 會發出警告（`nvm`、`fnm`、`volta`、`asdf` 等）。
WhatsApp + Telegram 頻道需要 Node，
而版本管理器路徑可能在升級後失效，因為服務不會載入你的 shell 初始化。
當可用時，doctor 會提供遷移到系統 Node 安裝的選項
（Homebrew／apt／choco）。

### 18) 設定寫入 + 精靈中繼資料

Doctor 會保存任何設定變更，並蓋上精靈中繼資料以記錄本次 doctor 執行。

### 19) 工作區提示（備份 + 記憶系統）

當缺少時，doctor 會建議工作區記憶系統，並在工作區尚未納入 git 時
列印備份提示。

請參閱 [/concepts/agent-workspace](/concepts/agent-workspace) 以取得
工作區結構與 git 備份的完整指南（建議使用私有 GitHub 或 GitLab）。
