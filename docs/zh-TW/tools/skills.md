---
summary: 「Skills：受管理與工作區的差異、閘道規則，以及設定／環境變數的串接」
read_when:
  - 新增或修改 skills
  - 變更 skill 的閘道或載入規則
title: 「Skills」
x-i18n:
  source_path: tools/skills.md
  source_hash: 54685da5885600b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:25Z
---

# Skills（OpenClaw）

OpenClaw 使用 **[AgentSkills](https://agentskills.io) 相容**的 skill 資料夾，來教導代理程式如何使用工具。每個 skill 都是一個目錄，內含一個具有 YAML frontmatter 與指示說明的 `SKILL.md`。OpenClaw 會載入**內建 skills**，以及可選的本機覆寫，並在載入時依據環境、設定與二進位檔是否存在來進行篩選。

## 位置與優先順序

Skills 會從**三個**位置載入：

1. **內建 skills**：隨安裝一同提供（npm 套件或 OpenClaw.app）
2. **受管理／本機 skills**：`~/.openclaw/skills`
3. **工作區 skills**：`<workspace>/skills`

若 skill 名稱發生衝突，優先順序為：

`<workspace>/skills`（最高）→ `~/.openclaw/skills` → 內建 skills（最低）

此外，你也可以透過
`skills.load.extraDirs` 於 `~/.openclaw/openclaw.json` 中設定額外的 skill 資料夾（最低優先順序）。

## 每代理程式 vs 共用 skills

在**多代理程式**設定中，每個代理程式都有自己的工作區。這表示：

- **每代理程式 skills** 僅存在於該代理程式的 `<workspace>/skills` 中。
- **共用 skills** 位於 `~/.openclaw/skills`（受管理／本機），並對同一台機器上的**所有代理程式**可見。
- **共用資料夾** 也可以透過 `skills.load.extraDirs` 新增（最低優先順序），若你希望多個代理程式共用同一套 skills。

若同名 skill 存在於多個位置，仍適用一般的優先順序規則：工作區優先，其次為受管理／本機，最後為內建。

## 外掛程式 + skills

外掛程式可以在 `openclaw.plugin.json` 中列出 `skills` 目錄（相對於外掛程式根目錄的路徑），以隨附其自有的 skills。當外掛程式啟用時，這些 plugin skills 會載入，並參與一般的 skill 優先順序規則。你可以在外掛程式的設定項目上透過 `metadata.openclaw.requires.config` 來進行閘道控制。關於探索與設定，請參閱 [Plugins](/plugin)；關於這些 skills 所教導的工具介面，請參閱 [Tools](/tools)。

## ClawHub（安裝 + 同步）

ClawHub 是 OpenClaw 的公開 skills 登錄中心。瀏覽網址：
https://clawhub.com。你可以用它來探索、安裝、更新與備份 skills。
完整指南請見：[ClawHub](/tools/clawhub)。

常見流程：

- 將 skill 安裝到你的工作區：
  - `clawhub install <skill-slug>`
- 更新所有已安裝的 skills：
  - `clawhub update --all`
- 同步（掃描 + 發佈更新）：
  - `clawhub sync --all`

預設情況下，`clawhub` 會安裝到你目前工作目錄下的 `./skills`（或回退至已設定的 OpenClaw 工作區）。OpenClaw 會在下一個工作階段中，將其視為 `<workspace>/skills`。

## 安全性注意事項

- 將第三方 skills 視為**不受信任的程式碼**。啟用前請先閱讀。
- 對於不受信任的輸入與高風險工具，請優先使用沙箱化執行。請參閱 [Sandboxing](/gateway/sandboxing)。
- `skills.entries.*.env` 與 `skills.entries.*.apiKey` 會在該代理程式回合中，將祕密注入**主機**行程（非沙箱）。請將祕密排除於提示與記錄之外。
- 更完整的威脅模型與檢查清單，請參閱 [Security](/gateway/security)。

## 格式（AgentSkills + Pi 相容）

`SKILL.md` 至少必須包含：

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
---
```

注意事項：

- 我們遵循 AgentSkills 規格的版面配置與意圖。
- 內嵌代理程式使用的解析器僅支援**單行** frontmatter 鍵。
- `metadata` 應為**單行 JSON 物件**。
- 在指示說明中使用 `{baseDir}` 來參照 skill 資料夾路徑。
- 可選的 frontmatter 鍵：
  - `homepage` — 在 macOS Skills UI 中顯示為「Website」的 URL（亦可透過 `metadata.openclaw.homepage` 支援）。
  - `user-invocable` — `true|false`（預設：`true`）。當為 `true` 時，skill 會以使用者斜線指令的形式提供。
  - `disable-model-invocation` — `true|false`（預設：`false`）。當為 `true` 時，skill 會從模型提示中排除（仍可由使用者呼叫）。
  - `command-dispatch` — `tool`（選用）。當設定為 `tool` 時，斜線指令會略過模型，直接派送到工具。
  - `command-tool` — 當設定 `command-dispatch: tool` 時要呼叫的工具名稱。
  - `command-arg-mode` — `raw`（預設）。在工具派送時，會將原始參數字串直接轉送給工具（不進行核心解析）。

    工具會以以下參數呼叫：
    `{ command: "<raw args>", commandName: "<slash command>", skillName: "<skill name>" }`。

## 閘道（載入時篩選）

OpenClaw 會在**載入時**使用 `metadata`（單行 JSON）來**篩選 skills**：

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"], "config": ["browser.enabled"] },
        "primaryEnv": "GEMINI_API_KEY",
      },
  }
---
```

`metadata.openclaw` 之下的欄位：

- `always: true` — 永遠包含該 skill（略過其他閘道）。
- `emoji` — macOS Skills UI 使用的選用表情符號。
- `homepage` — 在 macOS Skills UI 中顯示為「Website」的選用 URL。
- `os` — 選用的作業系統清單（`darwin`、`linux`、`win32`）。若設定，skill 僅在這些 OS 上符合資格。
- `requires.bins` — 清單；每一項都必須存在於 `PATH`。
- `requires.anyBins` — 清單；至少一項必須存在於 `PATH`。
- `requires.env` — 清單；環境變數必須存在**或**在設定中提供。
- `requires.config` — 必須為 truthy 的 `openclaw.json` 路徑清單。
- `primaryEnv` — 與 `skills.entries.<name>.apiKey` 關聯的環境變數名稱。
- `install` — macOS Skills UI 使用的選用安裝器規格陣列（brew/node/go/uv/download）。

關於沙箱隔離的注意事項：

- `requires.bins` 會在 skill 載入時於**主機**上檢查。
- 若代理程式在沙箱中執行，該二進位檔也必須存在於**容器內**。
  請透過 `agents.defaults.sandbox.docker.setupCommand`（或自訂映像）進行安裝。
  `setupCommand` 會在容器建立後執行一次。
  套件安裝也需要網路對外連線、可寫入的根檔案系統，以及沙箱中的 root 使用者。
  例如：`summarize` skill（`skills/summarize/SKILL.md`）需要在沙箱容器中具備 `summarize` CLI 才能執行。

安裝器範例：

```markdown
---
name: gemini
description: Use Gemini CLI for coding assistance and Google search lookups.
metadata:
  {
    "openclaw":
      {
        "emoji": "♊️",
        "requires": { "bins": ["gemini"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gemini-cli",
              "bins": ["gemini"],
              "label": "Install Gemini CLI (brew)",
            },
          ],
      },
  }
---
```

注意事項：

- 若列出多個安裝器，Gateway 閘道器會選擇**單一**偏好的選項（可用時優先使用 brew，否則使用 node）。
- 若所有安裝器皆為 `download`，OpenClaw 會列出每個項目，讓你查看可用的構件。
- 安裝器規格可以包含 `os: ["darwin"|"linux"|"win32"]`，用於依平台篩選選項。
- Node 安裝會遵循 `skills.install.nodeManager` 於 `openclaw.json` 中的設定（預設：npm；選項：npm/pnpm/yarn/bun）。
  這僅影響 **skill 安裝**；Gateway 閘道器的執行環境仍應為 Node
  （不建議在 WhatsApp／Telegram 使用 Bun）。
- Go 安裝：若缺少 `go` 且可取得 `brew`，Gateway 閘道器會先透過 Homebrew 安裝 Go，並在可能時將 `GOBIN` 設為 Homebrew 的 `bin`。
- 下載安裝：`url`（必填）、`archive`（`tar.gz` | `tar.bz2` | `zip`）、`extract`（預設：偵測到封存檔時自動）、`stripComponents`、`targetDir`（預設：`~/.openclaw/tools/<skillKey>`）。

若未提供 `metadata.openclaw`，該 skill 永遠符合資格（除非在設定中停用，或因內建 skills 的 `skills.allowBundled` 而被封鎖）。

## 設定覆寫（`~/.openclaw/openclaw.json`）

內建／受管理 skills 可被切換啟用狀態，並可提供環境變數值：

```json5
{
  skills: {
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
        config: {
          endpoint: "https://example.invalid",
          model: "nano-pro",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

注意：若 skill 名稱包含連字號，請將鍵加上引號（JSON5 允許加引號的鍵）。

設定鍵預設會對應到**skill 名稱**。若某個 skill 定義了
`metadata.openclaw.skillKey`，請在 `skills.entries` 下使用該鍵。

規則：

- `enabled: false` 即使是內建／已安裝的 skill 也會被停用。
- `env`：僅在該變數尚未於行程中設定時才會注入。
- `apiKey`：為宣告 `metadata.openclaw.primaryEnv` 的 skills 提供的便利設定。
- `config`：選用的每 skill 自訂欄位容器；自訂鍵必須放在此處。
- `allowBundled`：僅適用於**內建** skills 的選用允許清單。若設定，僅清單中的內建 skills 符合資格（不影響受管理／工作區 skills）。

## 環境注入（每次代理程式執行）

當代理程式執行開始時，OpenClaw 會：

1. 讀取 skill 中繼資料。
2. 將任何 `skills.entries.<key>.env` 或 `skills.entries.<key>.apiKey` 套用到
   `process.env`。
3. 以**符合資格**的 skills 建立系統提示。
4. 在執行結束後還原原始環境。

此行為**僅限於該次代理程式執行範圍**，並非全域 shell 環境。

## 工作階段快照（效能）

OpenClaw 會在**工作階段開始時**快照符合資格的 skills，並在同一工作階段的後續回合中重複使用該清單。對 skills 或設定的變更，會在下一個新工作階段生效。

當啟用 skills 監看器，或出現新的符合資格的遠端節點時，skills 也可能在工作階段中途重新整理（見下文）。可將其視為一種**熱重新載入**：更新後的清單會在下一個代理程式回合中生效。

## 遠端 macOS 節點（Linux Gateway 閘道器）

若 Gateway 閘道器執行於 Linux，但連線了一個**macOS 節點**，且**允許 `system.run`**（Exec approvals 安全性未設為 `deny`），當該節點上存在所需的二進位檔時，OpenClaw 可以將僅限 macOS 的 skills 視為符合資格。代理程式應透過 `nodes` 工具（通常為 `nodes.run`）來執行這些 skills。

此機制仰賴節點回報其指令支援情況，並透過 `system.run` 進行二進位檔探測。若該 macOS 節點之後離線，skills 仍會保持可見；直到節點重新連線前，呼叫可能會失敗。

## Skills 監看器（自動重新整理）

預設情況下，OpenClaw 會監看 skill 資料夾，並在 `SKILL.md` 檔案變更時更新 skills 快照。可在 `skills.load` 下進行設定：

```json5
{
  skills: {
    load: {
      watch: true,
      watchDebounceMs: 250,
    },
  },
}
```

## Token 影響（skills 清單）

當 skills 符合資格時，OpenClaw 會透過 `formatSkillsForPrompt` 於 `pi-coding-agent` 中，將一份精簡的可用 skills XML 清單注入系統提示。其成本是可預期的：

- **基礎額外負擔（僅在 ≥1 個 skill 時）：**195 個字元。
- **每個 skill：**97 個字元 + XML 轉義後的 `<name>`、`<description>` 與 `<location>` 值的長度。

公式（字元）：

```
total = 195 + Σ (97 + len(name_escaped) + len(description_escaped) + len(location_escaped))
```

注意事項：

- XML 轉義會將 `& < > " '` 擴展為實體（`&amp;`、`&lt;` 等），增加長度。
- Token 數量會依模型的 tokenizer 而異。以類 OpenAI 的粗略估算約為 4 字元／token，因此 **97 字元 ≈ 24 tokens**（每個 skill），再加上實際欄位長度。

## 受管理 skills 的生命週期

OpenClaw 會在安裝時（npm 套件或 OpenClaw.app）隨附一組基準 skills，作為**內建 skills**。`~/.openclaw/skills` 用於本機覆寫（例如在不變更內建副本的情況下，釘選／修補某個 skill）。工作區 skills 由使用者擁有，且在名稱衝突時會覆寫前兩者。

## 設定參考

完整的設定結構描述，請參閱 [Skills 設定](/tools/skills-config)。

## 想找更多 skills？

瀏覽 https://clawhub.com。

---
