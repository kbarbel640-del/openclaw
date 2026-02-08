---
summary: 「代理程式工作區：位置、版面配置與備份策略」
read_when:
  - 你需要說明代理程式工作區或其檔案配置
  - 你想要備份或遷移代理程式工作區
title: 「代理程式工作區」
x-i18n:
  source_path: concepts/agent-workspace.md
  source_hash: 84c550fd89b5f247
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:03Z
---

# 代理程式工作區

工作區是代理程式的家。它是檔案工具與工作區脈絡唯一使用的工作目錄。請保持其私密，並將其視為記憶體。

這與 `~/.openclaw/` 不同，後者儲存設定、憑證與工作階段。

**重要事項：** 工作區是**預設 cwd**，而不是硬性沙箱。工具會以工作區作為相對路徑的解析基準，但除非啟用沙箱隔離，否則絕對路徑仍可存取主機上的其他位置。若需要隔離，請使用 [`agents.defaults.sandbox`](/gateway/sandboxing)（以及／或每個代理程式的沙箱設定）。啟用沙箱隔離且 `workspaceAccess` 不為 `"rw"` 時，工具會在 `~/.openclaw/sandboxes` 之下的沙箱工作區中運作，而非你的主機工作區。

## 預設位置

- 預設值：`~/.openclaw/workspace`
- 若設定了 `OPENCLAW_PROFILE` 且不為 `"default"`，則預設值會變為
  `~/.openclaw/workspace-<profile>`。
- 可在 `~/.openclaw/openclaw.json` 中覆寫：

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

`openclaw onboard`、`openclaw configure` 或 `openclaw setup` 會在工作區不存在時建立它，並填入啟動檔案。

如果你已自行管理工作區檔案，可以停用啟動檔案的建立：

```json5
{ agent: { skipBootstrap: true } }
```

## 額外的工作區資料夾

較舊的安裝可能建立了 `~/openclaw`。同時保留多個工作區目錄可能導致混淆的驗證或狀態漂移，因為任何時候只會有一個工作區是啟用的。

**建議：** 保留單一啟用中的工作區。若不再使用額外資料夾，請將其封存或移至垃圾桶（例如 `trash ~/openclaw`）。若你刻意保留多個工作區，請確保 `agents.defaults.workspace` 指向啟用中的那一個。

`openclaw doctor` 在偵測到額外的工作區目錄時會發出警告。

## 工作區檔案對照表（每個檔案的用途）

以下是 OpenClaw 在工作區內預期存在的標準檔案：

- `AGENTS.md`
  - 代理程式的操作指示，以及它應如何使用記憶體。
  - 每個工作階段開始時載入。
  - 適合放置規則、優先順序與「行為方式」的細節。

- `SOUL.md`
  - 人設、語氣與界線。
  - 每個工作階段載入。

- `USER.md`
  - 使用者是誰，以及該如何稱呼。
  - 每個工作階段載入。

- `IDENTITY.md`
  - 代理程式的名稱、氛圍與表情符號。
  - 在啟動儀式期間建立／更新。

- `TOOLS.md`
  - 關於你本地工具與慣例的備註。
  - 不會控制工具可用性，僅作為指引。

- `HEARTBEAT.md`
  - 心跳執行用的可選精簡檢查清單。
  - 請保持精簡以避免消耗過多 token。

- `BOOT.md`
  - 在啟用內部 hooks 時，於 Gateway 閘道器 重新啟動時執行的可選啟動檢查清單。
  - 請保持精簡；對外傳送請使用訊息工具。

- `BOOTSTRAP.md`
  - 一次性的首次執行儀式。
  - 僅在全新工作區中建立。
  - 儀式完成後請刪除。

- `memory/YYYY-MM-DD.md`
  - 每日記憶日誌（每天一個檔案）。
  - 建議在工作階段開始時讀取今天與昨天的檔案。

- `MEMORY.md`（選用）
  - 精選的長期記憶。
  - 僅在主要的私人工作階段中載入（不適用於共享／群組情境）。

請參閱 [Memory](/concepts/memory) 以了解工作流程與自動記憶清空機制。

- `skills/`（選用）
  - 工作區專屬的 Skills。
  - 當名稱衝突時，會覆寫受管／內建的 Skills。

- `canvas/`（選用）
  - 節點顯示用的 Canvas UI 檔案（例如 `canvas/index.html`）。

若任何啟動檔案缺失，OpenClaw 會在工作階段中注入「缺少檔案」的標記並繼續執行。注入時，大型啟動檔案會被截斷；可透過 `agents.defaults.bootstrapMaxChars` 調整限制（預設：20000）。`openclaw setup` 可在不覆寫既有檔案的情況下重新建立缺失的預設值。

## 不屬於工作區的內容

以下項目位於 `~/.openclaw/` 之下，**不應**提交到工作區的儲存庫：

- `~/.openclaw/openclaw.json`（設定）
- `~/.openclaw/credentials/`（OAuth 權杖、API 金鑰）
- `~/.openclaw/agents/<agentId>/sessions/`（工作階段逐字稿與中繼資料）
- `~/.openclaw/skills/`（受管 Skills）

若需要遷移工作階段或設定，請另行複製，並避免納入版本控制。

## Git 備份（建議，私有）

請將工作區視為私密記憶。將其放入**私有**的 git 儲存庫，以利備份與復原。

請在執行 Gateway 閘道器 的機器上執行以下步驟（工作區位於該機器）。

### 1) 初始化儲存庫

若已安裝 git，全新的工作區會自動初始化。若此工作區尚未成為儲存庫，請執行：

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md memory/
git commit -m "Add agent workspace"
```

### 2) 新增私有遠端（新手友善選項）

選項 A：GitHub 網頁介面

1. 在 GitHub 建立新的**私有**儲存庫。
2. 不要使用 README 初始化（避免合併衝突）。
3. 複製 HTTPS 遠端 URL。
4. 新增遠端並推送：

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

選項 B：GitHub CLI（`gh`）

```bash
gh auth login
gh repo create openclaw-workspace --private --source . --remote origin --push
```

選項 C：GitLab 網頁介面

1. 在 GitLab 建立新的**私有**儲存庫。
2. 不要使用 README 初始化（避免合併衝突）。
3. 複製 HTTPS 遠端 URL。
4. 新增遠端並推送：

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

### 3) 持續更新

```bash
git status
git add .
git commit -m "Update memory"
git push
```

## 不要提交祕密資訊

即使在私有儲存庫中，也請避免在工作區儲存祕密：

- API 金鑰、OAuth 權杖、密碼或私有憑證。
- `~/.openclaw/` 之下的任何內容。
- 原始聊天轉存或敏感附件。

若必須儲存敏感參考，請使用佔位符，並將真正的祕密存放在其他地方（密碼管理器、環境變數，或 `~/.openclaw/`）。

建議的 `.gitignore` 起始範本：

```gitignore
.DS_Store
.env
**/*.key
**/*.pem
**/secrets*
```

## 將工作區移動到新機器

1. 將儲存庫複製到目標路徑（預設為 `~/.openclaw/workspace`）。
2. 在 `~/.openclaw/openclaw.json` 中將 `agents.defaults.workspace` 設定為該路徑。
3. 執行 `openclaw setup --workspace <path>` 以補齊缺失的檔案。
4. 若需要工作階段，請從舊機器另行複製 `~/.openclaw/agents/<agentId>/sessions/`。

## 進階說明

- 多代理程式路由可為每個代理程式使用不同的工作區。路由設定請參閱
  [Channel routing](/concepts/channel-routing)。
- 若啟用 `agents.defaults.sandbox`，非主要工作階段可在 `agents.defaults.sandbox.workspaceRoot` 之下使用每個工作階段的沙箱工作區。
