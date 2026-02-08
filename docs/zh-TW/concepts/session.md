---
summary: 「聊天的工作階段管理規則、金鑰與持久化」
read_when:
  - 修改工作階段處理或儲存
title: 「工作階段管理」
x-i18n:
  source_path: concepts/session.md
  source_hash: 1486759a5c2fdced
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:26Z
---

# 工作階段管理

OpenClaw 將 **每個代理程式的一個直接聊天工作階段** 視為主要。直接聊天會折疊到 `agent:<agentId>:<mainKey>`（預設為 `main`），而群組／頻道聊天則有各自的金鑰。`session.mainKey` 會被遵循。

使用 `session.dmScope` 來控制 **私訊** 的分組方式：

- `main`（預設）：所有私訊共用主要工作階段以維持連續性。
- `per-peer`：依傳送者 id 跨頻道隔離。
- `per-channel-peer`：依頻道 + 傳送者隔離（建議用於多使用者收件匣）。
- `per-account-channel-peer`：依帳號 + 頻道 + 傳送者隔離（建議用於多帳號收件匣）。
  使用 `session.identityLinks`，可將帶有提供者前綴的對等 id 映射到標準化身分，讓同一個人在使用 `per-peer`、`per-channel-peer` 或 `per-account-channel-peer` 時，跨頻道共用同一個私訊工作階段。

### 安全私訊模式（建議用於多使用者設定）

> **安全性警告：** 如果你的代理程式可以接收來自 **多個人** 的私訊，強烈建議啟用安全私訊模式。若未啟用，所有使用者會共用相同的對話脈絡，可能導致使用者之間的私人資訊外洩。

**預設設定的問題示例：**

- Alice（`<SENDER_A>`）就私人主題（例如醫療預約）傳訊給你的代理程式
- Bob（`<SENDER_B>`）傳訊給你的代理程式並詢問「我們剛剛在聊什麼？」
- 由於兩個私訊共用同一個工作階段，模型可能會使用 Alice 先前的脈絡來回覆 Bob。

**解法：** 設定 `dmScope` 以依使用者隔離工作階段：

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    // Secure DM mode: isolate DM context per channel + sender.
    dmScope: "per-channel-peer",
  },
}
```

**何時應啟用：**

- 你為多於一位傳送者啟用了配對核准
- 你使用包含多個項目的私訊允許清單
- 你設定了 `dmPolicy: "open"`
- 多個電話號碼或帳號可以傳訊給你的代理程式

注意事項：

- 預設為 `dmScope: "main"` 以維持連續性（所有私訊共用主要工作階段）。這適合單一使用者設定。
- 對於同一頻道上的多帳號收件匣，建議使用 `per-account-channel-peer`。
- 若同一個人透過多個頻道聯絡你，使用 `session.identityLinks` 可將其私訊工作階段折疊為單一標準化身分。
- 你可以使用 `openclaw security audit` 來驗證你的私訊設定（參見 [security](/cli/security)）。

## Gateway 是事實來源

所有工作階段狀態皆 **由 Gateway 閘道器**（「主控」OpenClaw）所擁有。UI 用戶端（macOS app、WebChat 等）必須向 Gateway 閘道器查詢工作階段清單與 token 計數，而不是讀取本機檔案。

- 在 **遠端模式** 下，你關心的工作階段儲存位於遠端 Gateway 閘道器主機，而非你的 Mac。
- UI 中顯示的 token 計數來自 Gateway 閘道器的儲存欄位（`inputTokens`、`outputTokens`、`totalTokens`、`contextTokens`）。用戶端不會解析 JSONL 逐字稿來「修正」總數。

## 狀態儲存位置

- 在 **Gateway 閘道器主機** 上：
  - 儲存檔案：`~/.openclaw/agents/<agentId>/sessions/sessions.json`（每個代理程式）。
- 逐字稿：`~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`（Telegram 主題工作階段使用 `.../<SessionId>-topic-<threadId>.jsonl`）。
- 儲存內容是一個對映 `sessionKey -> { sessionId, updatedAt, ... }`。刪除項目是安全的；需要時會自動重建。
- 群組項目可能包含 `displayName`、`channel`、`subject`、`room` 與 `space`，以便在 UI 中標示工作階段。
- 工作階段項目包含 `origin` 中繼資料（標籤 + 路由提示），讓 UI 能說明工作階段的來源。
- OpenClaw **不會** 讀取舊版 Pi/Tau 的工作階段資料夾。

## 工作階段修剪

OpenClaw 會在呼叫 LLM 之前，預設從記憶體中的脈絡 **修剪舊的工具結果**。
這 **不會** 重寫 JSONL 歷史。請參見 [/concepts/session-pruning](/concepts/session-pruning)。

## 壓縮前的記憶體清空

當工作階段接近自動壓縮時，OpenClaw 可以執行 **無聲的記憶體清空**
回合，提醒模型將可持久化的筆記寫入磁碟。此動作僅在
工作區可寫入時執行。請參見 [Memory](/concepts/memory) 與
[Compaction](/concepts/compaction)。

## 傳輸對映 → 工作階段金鑰

- 直接聊天遵循 `session.dmScope`（預設為 `main`）。
  - `main`：`agent:<agentId>:<mainKey>`（跨裝置／頻道的連續性）。
    - 多個電話號碼與頻道可對映到相同的代理程式主要金鑰；它們作為進入同一對話的傳輸途徑。
  - `per-peer`：`agent:<agentId>:dm:<peerId>`。
  - `per-channel-peer`：`agent:<agentId>:<channel>:dm:<peerId>`。
  - `per-account-channel-peer`：`agent:<agentId>:<channel>:<accountId>:dm:<peerId>`（accountId 預設為 `default`）。
  - 若 `session.identityLinks` 符合帶有提供者前綴的對等 id（例如 `telegram:123`），標準化金鑰會取代 `<peerId>`，讓同一個人在跨頻道時共用同一個工作階段。
- 群組聊天會隔離狀態：`agent:<agentId>:<channel>:group:<id>`（房間／頻道使用 `agent:<agentId>:<channel>:channel:<id>`）。
  - Telegram 論壇主題會將 `:topic:<threadId>` 附加到群組 id 以達到隔離。
  - 舊版 `group:<id>` 金鑰仍可識別以供遷移。
- 進站脈絡仍可能使用 `group:<id>`；頻道會從 `Provider` 推斷，並正規化為標準的 `agent:<agentId>:<channel>:group:<id>` 形式。
- 其他來源：
  - Cron 工作：`cron:<job.id>`
  - Webhook：`hook:<uuid>`（除非由 hook 明確設定）
  - 節點執行：`node-<nodeId>`

## 生命週期

- 重設策略：工作階段會重用直到過期，過期會在下一則進站訊息時評估。
- 每日重設：預設為 **Gateway 閘道器主機的當地時間凌晨 4:00**。當工作階段最後一次更新早於最近一次每日重設時間時，即視為過期。
- 閒置重設（選用）：`idleMinutes` 會加入滑動式閒置視窗。當同時設定每日與閒置重設時，**先到期者** 會強制建立新工作階段。
- 舊版僅閒置：若你僅設定 `session.idleMinutes`，且未設定任何 `session.reset`/`resetByType`，OpenClaw 會為了向後相容而維持僅閒置模式。
- 依類型覆寫（選用）：`resetByType` 可讓你為 `dm`、`group` 與 `thread` 工作階段覆寫策略（thread = Slack/Discord 執行緒、Telegram 主題、Matrix 執行緒（當連接器提供時））。
- 依頻道覆寫（選用）：`resetByChannel` 會覆寫某個頻道的重設策略（適用於該頻道的所有工作階段類型，且優先於 `reset`/`resetByType`）。
- 重設觸發：精確的 `/new` 或 `/reset`（加上 `resetTriggers` 中的任何附加項）會啟動全新的工作階段 id，並將訊息剩餘內容傳遞下去。`/new <model>` 可接受模型別名、`provider/model` 或提供者名稱（模糊比對）以設定新的工作階段模型。若單獨傳送 `/new` 或 `/reset`，OpenClaw 會執行一個簡短的「hello」問候回合以確認重設。
- 手動重設：從儲存中刪除特定金鑰或移除 JSONL 逐字稿；下一則訊息會重新建立。
- 隔離的 cron 工作每次執行都會產生全新的 `sessionId`（不會進行閒置重用）。

## 傳送策略（選用）

在不列出個別 id 的情況下，封鎖特定工作階段類型的傳送。

```json5
{
  session: {
    sendPolicy: {
      rules: [
        { action: "deny", match: { channel: "discord", chatType: "group" } },
        { action: "deny", match: { keyPrefix: "cron:" } },
      ],
      default: "allow",
    },
  },
}
```

執行時期覆寫（僅限擁有者）：

- `/send on` → 允許此工作階段
- `/send off` → 拒絕此工作階段
- `/send inherit` → 清除覆寫並使用設定規則
  請將這些指令作為獨立訊息傳送，以確保被登錄。

## 設定（選用重新命名範例）

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    scope: "per-sender", // keep group keys separate
    dmScope: "main", // DM continuity (set per-channel-peer/per-account-channel-peer for shared inboxes)
    identityLinks: {
      alice: ["telegram:123456789", "discord:987654321012345678"],
    },
    reset: {
      // Defaults: mode=daily, atHour=4 (gateway host local time).
      // If you also set idleMinutes, whichever expires first wins.
      mode: "daily",
      atHour: 4,
      idleMinutes: 120,
    },
    resetByType: {
      thread: { mode: "daily", atHour: 4 },
      dm: { mode: "idle", idleMinutes: 240 },
      group: { mode: "idle", idleMinutes: 120 },
    },
    resetByChannel: {
      discord: { mode: "idle", idleMinutes: 10080 },
    },
    resetTriggers: ["/new", "/reset"],
    store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
    mainKey: "main",
  },
}
```

## 檢視

- `openclaw status` — 顯示儲存路徑與最近的工作階段。
- `openclaw sessions --json` — 傾印所有項目（可用 `--active <minutes>` 篩選）。
- `openclaw gateway call sessions.list --params '{}'` — 從執行中的 Gateway 閘道器擷取工作階段（遠端 Gateway 閘道器存取請使用 `--url`/`--token`）。
- 在聊天中以獨立訊息傳送 `/status`，可查看代理程式是否可達、使用了多少工作階段脈絡、目前的思考／詳細模式切換，以及你的 WhatsApp Web 憑證上次重新整理的時間（有助於辨識是否需要重新連結）。
- 傳送 `/context list` 或 `/context detail`，可查看系統提示與注入的工作區檔案（以及最大的脈絡貢獻者）。
- 以獨立訊息傳送 `/stop` 可中止目前的執行、清除該工作階段排隊中的後續動作，並停止由其衍生的任何子代理程式執行（回覆會包含停止的數量）。
- 以獨立訊息傳送 `/compact`（可選指示）可摘要較舊的脈絡並釋放視窗空間。請參見 [/concepts/compaction](/concepts/compaction)。
- JSONL 逐字稿可直接開啟以檢視完整回合。

## 小技巧

- 將主要金鑰專用於 1:1 流量；讓群組保留各自的金鑰。
- 自動化清理時，請刪除個別金鑰而非整個儲存，以保留其他地方的脈絡。

## 工作階段來源中繼資料

每個工作階段項目都會在 `origin` 中記錄其來源（盡力而為）：

- `label`：人類可讀標籤（由對話標籤 + 群組主題／頻道解析）
- `provider`：正規化的頻道 id（包含延伸）
- `from`/`to`：來自進站封包的原始路由 id
- `accountId`：提供者帳號 id（多帳號時）
- `threadId`：當頻道支援時的執行緒／主題 id
  來源欄位會為私訊、頻道與群組填入。若某個連接器僅更新傳送路由（例如用來保持私訊主要工作階段的新鮮度），仍應提供進站脈絡，讓工作階段保有其說明性中繼資料。延伸可透過在進站脈絡中傳送 `ConversationLabel`、`GroupSubject`、`GroupChannel`、`GroupSpace` 與 `SenderName`，並呼叫 `recordSessionMetaFromInbound`（或將相同脈絡傳遞給 `updateLastRoute`）來達成。
