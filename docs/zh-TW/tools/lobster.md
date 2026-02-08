---
title: Lobster
summary: 「適用於 OpenClaw 的具型別工作流程執行階段，具備可恢復的核准關卡。」
description: 適用於 OpenClaw 的具型別工作流程執行階段 — 具有核准關卡的可組合管線。
read_when:
  - 你需要具有明確核准的確定性多步驟工作流程
  - 你需要在不重新執行先前步驟的情況下恢復工作流程
x-i18n:
  source_path: tools/lobster.md
  source_hash: ff84e65f4be162ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:19Z
---

# Lobster

Lobster 是一個工作流程 shell，讓 OpenClaw 能以單一、確定性的操作執行多步驟工具序列，並提供明確的核准檢查點。

## Hook

你的助理可以打造管理自己的工具。只要要求一個工作流程，30 分鐘後你就會得到一個 CLI 加上可一次呼叫執行的管線。Lobster 正是缺失的關鍵：確定性的管線、明確的核准，以及可恢復的狀態。

## Why

如今，複雜的工作流程需要多次來回的工具呼叫。每一次呼叫都會消耗 token，而且 LLM 必須協調每個步驟。Lobster 將這種協調移入具型別的執行階段：

- **一次呼叫取代多次**：OpenClaw 執行一次 Lobster 工具呼叫即可取得結構化結果。
- **內建核准**：副作用（寄送電子郵件、發佈留言）會在明確核准前暫停工作流程。
- **可恢復**：暫停的工作流程會回傳一個 token；核准後即可恢復，無需重新執行全部步驟。

## Why a DSL instead of plain programs?

Lobster 刻意保持精簡。目標不是「一種新語言」，而是一個可預測、對 AI 友善的管線規格，具備一等公民的核准與恢復 token。

- **內建核准／恢復**：一般程式可以提示人類，但無法在不自行發明執行階段的情況下，使用耐久 token 進行「暫停與恢復」。
- **確定性 + 可稽核性**：管線是資料，因此容易記錄、比對、重播與審查。
- **對 AI 受限的介面**：精簡語法 + JSON 管道可減少「創意」程式路徑，讓驗證更實際。
- **安全政策內建**：逾時、輸出上限、沙箱檢查與 allowlist 由執行階段強制，而非每個腳本各自處理。
- **仍可程式化**：每個步驟都能呼叫任何 CLI 或腳本。若需要 JS/TS，可由程式碼產生 `.lobster` 檔案。

## How it works

OpenClaw 以 **tool mode** 啟動本機的 `lobster` CLI，並從 stdout 解析 JSON 封裝。
若管線因核准而暫停，工具會回傳一個 `resumeToken`，讓你稍後繼續。

## Pattern: small CLI + JSON pipes + approvals

建立能以 JSON 溝通的小型命令，然後將它們串接成一次 Lobster 呼叫。（以下為示例命令名稱 — 請替換成你自己的。）

```bash
inbox list --json
inbox categorize --json
inbox apply --json
```

```json
{
  "action": "run",
  "pipeline": "exec --json --shell 'inbox list --json' | exec --stdin json --shell 'inbox categorize --json' | exec --stdin json --shell 'inbox apply --json' | approve --preview-from-stdin --limit 5 --prompt 'Apply changes?'",
  "timeoutMs": 30000
}
```

若管線請求核准，使用 token 恢復：

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

AI 觸發工作流程；Lobster 執行各步驟。核准關卡讓副作用保持明確且可稽核。

範例：將輸入項目對映成工具呼叫：

```bash
gog.gmail.search --query 'newer_than:1d' \
  | openclaw.invoke --tool message --action send --each --item-key message --args-json '{"provider":"telegram","to":"..."}'
```

## JSON-only LLM steps (llm-task)

對於需要 **結構化 LLM 步驟** 的工作流程，啟用可選的
`llm-task` 外掛工具，並從 Lobster 呼叫它。這能在保持工作流程確定性的同時，仍允許你使用模型進行分類／摘要／草擬。

啟用工具：

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

在管線中使用：

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": { "subject": "Hello", "body": "Can you help?" },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

詳情與設定選項請參閱 [LLM Task](/tools/llm-task)。

## Workflow files (.lobster)

Lobster 可執行含有 `name`、`args`、`steps`、`env`、`condition` 與 `approval` 欄位的 YAML/JSON 工作流程檔案。在 OpenClaw 工具呼叫中，將 `pipeline` 設為檔案路徑。

```yaml
name: inbox-triage
args:
  tag:
    default: "family"
steps:
  - id: collect
    command: inbox list --json
  - id: categorize
    command: inbox categorize --json
    stdin: $collect.stdout
  - id: approve
    command: inbox apply --approve
    stdin: $categorize.stdout
    approval: required
  - id: execute
    command: inbox apply --execute
    stdin: $categorize.stdout
    condition: $approve.approved
```

Notes：

- `stdin: $step.stdout` 與 `stdin: $step.json` 會傳遞前一個步驟的輸出。
- `condition`（或 `when`）可依據 `$step.approved` 對步驟設置關卡。

## Install Lobster

請在執行 OpenClaw Gateway 閘道器的 **同一台主機** 上安裝 Lobster CLI（請見 [Lobster repo](https://github.com/openclaw/lobster)），並確保 `lobster` 位於 `PATH` 中。
若要使用自訂的二進位檔位置，請在工具呼叫中傳入 **絕對** 的 `lobsterPath`。

## Enable the tool

Lobster 是一個 **可選** 的外掛工具（預設未啟用）。

建議作法（可疊加、安全）：

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

或針對單一 agent：

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "alsoAllow": ["lobster"]
        }
      }
    ]
  }
}
```

除非你打算在限制性的 allowlist 模式下執行，否則請避免使用 `tools.allow: ["lobster"]`。

注意：allowlist 對可選外掛採用 opt-in。若你的 allowlist 只列出
外掛工具（例如 `lobster`），OpenClaw 仍會保持核心工具啟用。若要限制核心
工具，也必須將想要的核心工具或群組一併加入 allowlist。

## Example: Email triage

未使用 Lobster：

```
User: "Check my email and draft replies"
→ openclaw calls gmail.list
→ LLM summarizes
→ User: "draft replies to #2 and #5"
→ LLM drafts
→ User: "send #2"
→ openclaw calls gmail.send
(repeat daily, no memory of what was triaged)
```

使用 Lobster：

```json
{
  "action": "run",
  "pipeline": "email.triage --limit 20",
  "timeoutMs": 30000
}
```

回傳的 JSON 封裝（已截斷）：

```json
{
  "ok": true,
  "status": "needs_approval",
  "output": [{ "summary": "5 need replies, 2 need action" }],
  "requiresApproval": {
    "type": "approval_request",
    "prompt": "Send 2 draft replies?",
    "items": [],
    "resumeToken": "..."
  }
}
```

使用者核准 → 恢復：

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

一個工作流程。確定性。安全。

## Tool parameters

### `run`

以 tool mode 執行管線。

```json
{
  "action": "run",
  "pipeline": "gog.gmail.search --query 'newer_than:1d' | email.triage",
  "cwd": "/path/to/workspace",
  "timeoutMs": 30000,
  "maxStdoutBytes": 512000
}
```

以引數執行工作流程檔案：

```json
{
  "action": "run",
  "pipeline": "/path/to/inbox-triage.lobster",
  "argsJson": "{\"tag\":\"family\"}"
}
```

### `resume`

在核准後繼續已暫停的工作流程。

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

### Optional inputs

- `lobsterPath`：Lobster 二進位檔的絕對路徑（省略則使用 `PATH`）。
- `cwd`：管線的工作目錄（預設為目前行程的工作目錄）。
- `timeoutMs`：若子行程超過此時間則終止（預設：20000）。
- `maxStdoutBytes`：若 stdout 超過此大小則終止（預設：512000）。
- `argsJson`：傳遞給 `lobster run --args-json` 的 JSON 字串（僅限工作流程檔案）。

## Output envelope

Lobster 會回傳一個 JSON 封裝，具有三種狀態之一：

- `ok` → 成功完成
- `needs_approval` → 已暫停；需要 `requiresApproval.resumeToken` 才能恢復
- `cancelled` → 明確拒絕或取消

工具會同時在 `content`（美化後的 JSON）與 `details`（原始物件）中呈現該封裝。

## Approvals

若存在 `requiresApproval`，請檢視提示並決定：

- `approve: true` → 恢復並繼續副作用
- `approve: false` → 取消並結束工作流程

使用 `approve --preview-from-stdin --limit N` 可在核准請求中附加 JSON 預覽，而無需自訂 jq／heredoc 膠水。恢復 token 現已精簡：Lobster 會將工作流程恢復狀態儲存在其狀態目錄下，並回傳一個小型 token 金鑰。

## OpenProse

OpenProse 與 Lobster 搭配效果良好：使用 `/prose` 來協調多代理的前置準備，接著執行 Lobster 管線以進行確定性的核准。若某個 Prose 程式需要 Lobster，可透過 `tools.subagents.tools` 允許子代理使用 `lobster` 工具。請參閱 [OpenProse](/prose)。

## Safety

- **僅限本機子行程** — 外掛本身不進行任何網路呼叫。
- **不處理祕密** — Lobster 不管理 OAuth；它會呼叫負責此事的 OpenClaw 工具。
- **沙箱感知** — 當工具情境為沙箱時會停用。
- **強化** — 若指定 `lobsterPath` 則必須為絕對路徑；並強制執行逾時與輸出上限。

## Troubleshooting

- **`lobster subprocess timed out`** → 提高 `timeoutMs`，或拆分過長的管線。
- **`lobster output exceeded maxStdoutBytes`** → 提高 `maxStdoutBytes` 或減少輸出大小。
- **`lobster returned invalid JSON`** → 確保管線以 tool mode 執行，且僅輸出 JSON。
- **`lobster failed (code …)`** → 在終端機中執行相同的管線以檢視 stderr。

## Learn more

- [Plugins](/plugin)
- [Plugin tool authoring](/plugins/agent-tools)

## Case study: community workflows

一個公開範例：「第二大腦」CLI + Lobster 管線，用來管理三個 Markdown vault（個人、夥伴、共享）。該 CLI 會輸出統計資料、收件匣清單與過期掃描的 JSON；Lobster 將這些命令串接成如 `weekly-review`、`inbox-triage`、`memory-consolidation` 與 `shared-task-sync` 等工作流程，且每個都包含核准關卡。AI 在可用時負責判斷（分類），不可用時則回退至確定性的規則。

- Thread: https://x.com/plattenschieber/status/2014508656335770033
- Repo: https://github.com/bloomedai/brain-cli
