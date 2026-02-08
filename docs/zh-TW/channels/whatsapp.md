---
summary: "WhatsApp（Web 頻道）整合：登入、收件匣、回覆、媒體與營運"
read_when:
  - 進行 WhatsApp／Web 頻道行為或收件匣路由相關工作時
title: "WhatsApp"
x-i18n:
  source_path: channels/whatsapp.md
  source_hash: 44fd88f8e2692849
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:57Z
---

# WhatsApp（Web 頻道）

狀態：僅支援透過 Baileys 的 WhatsApp Web。Gateway 閘道器擁有工作階段。

## 快速設定（新手）

1. 盡可能使用**獨立的電話號碼**（建議）。
2. 在 `~/.openclaw/openclaw.json` 中設定 WhatsApp。
3. 執行 `openclaw channels login` 掃描 QR Code（已連結的裝置）。
4. 啟動 Gateway 閘道器。

最小設定：

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551234567"],
    },
  },
}
```

## 目標

- 在單一 Gateway 閘道器行程中支援多個 WhatsApp 帳號（多帳號）。
- 決定性路由：回覆一律回到 WhatsApp，不進行模型路由。
- 模型可取得足夠上下文以理解引用回覆。

## 設定寫入

預設情況下，WhatsApp 允許寫入由 `/config set|unset` 觸發的設定更新（需要 `commands.config: true`）。

停用方式：

```json5
{
  channels: { whatsapp: { configWrites: false } },
}
```

## 架構（誰擁有什麼）

- **Gateway 閘道器** 擁有 Baileys socket 與收件匣迴圈。
- **CLI／macOS 應用程式** 與 Gateway 閘道器通訊；不直接使用 Baileys。
- **主動監聽器** 為外送傳送所必需；否則傳送會快速失敗。

## 取得電話號碼（兩種模式）

WhatsApp 需要真實的行動電話號碼進行驗證。VoIP 與虛擬號碼通常會被封鎖。以下是執行 OpenClaw 於 WhatsApp 的兩種支援方式：

### 專用號碼（建議）

為 OpenClaw 使用**獨立的電話號碼**。最佳使用體驗、乾淨的路由、沒有自我聊天的怪異行為。理想配置：**備用／舊的 Android 手機 + eSIM**。保持連上 Wi‑Fi 與電源，並透過 QR 連結。

**WhatsApp Business：** 你可以在同一裝置上使用不同號碼的 WhatsApp Business。非常適合將個人 WhatsApp 與 OpenClaw 分開——安裝 WhatsApp Business 並在那裡註冊 OpenClaw 的號碼。

**範例設定（專用號碼，單使用者 allowlist）：**

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551234567"],
    },
  },
}
```

**配對模式（選用）：**  
若你想使用配對而非 allowlist，請將 `channels.whatsapp.dmPolicy` 設為 `pairing`。未知寄件者會收到配對碼；核准方式：
`openclaw pairing approve whatsapp <code>`

### 個人號碼（備援）

快速備援方案：在**你自己的號碼**上執行 OpenClaw。為測試請對自己傳訊（WhatsApp「對自己傳訊」），以免打擾聯絡人。設定與實驗期間，請預期需要在主手機上讀取驗證碼。**必須啟用自我聊天模式。**  
當精靈要求你的個人 WhatsApp 號碼時，請輸入你將用來傳訊的手機（擁有者／寄件者），而不是助理號碼。

**範例設定（個人號碼，自我聊天）：**

```json
{
  "whatsapp": {
    "selfChatMode": true,
    "dmPolicy": "allowlist",
    "allowFrom": ["+15551234567"]
  }
}
```

當設定 `[{identity.name}]` 時，自我聊天回覆的預設值為 `[{identity.name}]`（否則為 `[openclaw]`），  
若 `messages.responsePrefix` 未設定。請明確設定以自訂或停用  
此前綴（使用 `""` 以移除）。

### 號碼來源建議

- **當地電信商的 eSIM**（最可靠）
  - 奧地利：[hot.at](https://www.hot.at)
  - 英國：[giffgaff](https://www.giffgaff.com) — 免費 SIM，無合約
- **預付卡 SIM** — 便宜，只需接收一次驗證簡訊

**避免：** TextNow、Google Voice、多數「免費簡訊」服務——WhatsApp 會積極封鎖。

**提示：** 號碼只需要接收一次驗證簡訊。之後，WhatsApp Web 工作階段會透過 `creds.json` 持續存在。

## 為什麼不用 Twilio？

- 早期的 OpenClaw 版本支援 Twilio 的 WhatsApp Business 整合。
- WhatsApp Business 號碼不適合個人助理。
- Meta 強制 24 小時回覆視窗；若過去 24 小時未回覆，商業號碼無法主動發送新訊息。
- 高頻或「健談」的使用會觸發嚴格封鎖，因為商業帳號並非設計用來發送數十則個人助理訊息。
- 結果：投遞不可靠且頻繁被封鎖，因此已移除支援。

## 登入與憑證

- 登入指令：`openclaw channels login`（透過已連結裝置顯示 QR）。
- 多帳號登入：`openclaw channels login --account <id>`（`<id>` = `accountId`）。
- 預設帳號（當省略 `--account`）：若存在則為 `default`，否則為第一個已設定的帳號 id（排序後）。
- 憑證儲存在 `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`。
- 備份副本位於 `creds.json.bak`（在損毀時還原）。
- 舊版相容性：較舊的安裝會將 Baileys 檔案直接存於 `~/.openclaw/credentials/`。
- 登出：`openclaw channels logout`（或 `--account <id>`）會刪除 WhatsApp 驗證狀態（但保留共用的 `oauth.json`）。
- 已登出 socket ⇒ 會出現要求重新連結的錯誤。

## 進站流程（私訊 + 群組）

- WhatsApp 事件來自 `messages.upsert`（Baileys）。
- 為避免測試／重啟時累積事件處理器，關機時會解除收件匣監聽器。
- 忽略狀態／廣播聊天。
- 私聊使用 E.164；群組使用群組 JID。
- **私訊政策**：`channels.whatsapp.dmPolicy` 控制私聊存取（預設：`pairing`）。
  - 配對：未知寄件者會收到配對碼（透過 `openclaw pairing approve whatsapp <code>` 核准；代碼 1 小時後過期）。
  - 開放：需要 `channels.whatsapp.allowFrom` 包含 `"*"`。
  - 你已連結的 WhatsApp 號碼會被隱含信任，因此自我訊息會略過 `channels.whatsapp.dmPolicy` 與 `channels.whatsapp.allowFrom` 檢查。

### 個人號碼模式（備援）

若你在**個人 WhatsApp 號碼**上執行 OpenClaw，請啟用 `channels.whatsapp.selfChatMode`（見上方範例）。

行為：

- 外送私訊不會觸發配對回覆（避免打擾聯絡人）。
- 進站未知寄件者仍遵循 `channels.whatsapp.dmPolicy`。
- 自我聊天模式（allowFrom 包含你的號碼）會避免自動已讀回條並忽略提及 JID。
- 非自我聊天的私訊會送出已讀回條。

## 已讀回條

預設情況下，Gateway 閘道器會在接受進站 WhatsApp 訊息後將其標記為已讀（藍勾）。

全域停用：

```json5
{
  channels: { whatsapp: { sendReadReceipts: false } },
}
```

依帳號停用：

```json5
{
  channels: {
    whatsapp: {
      accounts: {
        personal: { sendReadReceipts: false },
      },
    },
  },
}
```

備註：

- 自我聊天模式一律略過已讀回條。

## WhatsApp 常見問題：傳送訊息 + 配對

**連結 WhatsApp 後，OpenClaw 會主動傳訊給隨機聯絡人嗎？**  
不會。預設私訊政策是**配對**，因此未知寄件者只會收到配對碼，其訊息**不會被處理**。OpenClaw 只會回覆它收到的聊天，或你明確觸發的傳送（代理程式／CLI）。

**WhatsApp 的配對如何運作？**  
配對是針對未知寄件者的私訊閘門：

- 新寄件者的第一則私訊會回傳短碼（訊息不會被處理）。
- 核准方式：`openclaw pairing approve whatsapp <code>`（使用 `openclaw pairing list whatsapp` 列出）。
- 代碼 1 小時後過期；每個頻道的待處理請求上限為 3。

**多個人可以在同一個 WhatsApp 號碼上使用不同的 OpenClaw 實例嗎？**  
可以，透過 `bindings` 將每個寄件者路由到不同代理程式（peer `kind: "dm"`，寄件者 E.164 如 `+15551234567`）。回覆仍來自**同一個 WhatsApp 帳號**，且私聊會彙整到各代理程式的主要工作階段，因此請**每人使用一個代理程式**。私訊存取控制（`dmPolicy`/`allowFrom`）在每個 WhatsApp 帳號層級為全域。請參見 [Multi-Agent Routing](/concepts/multi-agent)。

**為什麼精靈會詢問我的電話號碼？**  
精靈會用它來設定你的 **allowlist／owner**，以允許你自己的私訊。它不會用於自動傳送。若你在個人 WhatsApp 號碼上執行，請使用同一個號碼並啟用 `channels.whatsapp.selfChatMode`。

## 訊息正規化（模型看到的內容）

- `Body` 是包含信封的目前訊息主體。
- 引用回覆的上下文**一律附加**：
  ```
  [Replying to +1555 id:ABC123]
  <quoted text or <media:...>>
  [/Replying]
  ```
- 同時設定回覆中繼資料：
  - `ReplyToId` = stanzaId
  - `ReplyToBody` = 引用的主體或媒體佔位符
  - `ReplyToSender` = 已知時為 E.164
- 僅含媒體的進站訊息使用佔位符：
  - `<media:image|video|audio|document|sticker>`

## 群組

- 群組對應到 `agent:<agentId>:whatsapp:group:<jid>` 工作階段。
- 群組政策：`channels.whatsapp.groupPolicy = open|disabled|allowlist`（預設 `allowlist`）。
- 啟用模式：
  - `mention`（預設）：需要 @mention 或正則比對。
  - `always`：一律觸發。
- `/activation mention|always` 僅限 owner，且必須以獨立訊息傳送。
- Owner = `channels.whatsapp.allowFrom`（若未設定則為自我 E.164）。
- **歷史注入**（僅待處理）：
  - 最近的 _未處理_ 訊息（預設 50 則）會插入至：
    `[Chat messages since your last reply - for context]`（已在工作階段中的訊息不會再次注入）
  - 目前訊息位於：
    `[Current message - respond to this]`
  - 會附加寄件者後綴：`[from: Name (+E164)]`
- 群組中繼資料快取 5 分鐘（主旨 + 參與者）。

## 回覆投遞（串接）

- WhatsApp Web 傳送標準訊息（目前 Gateway 閘道器不支援引用回覆串接）。
- 本頻道會忽略回覆標籤。

## 確認反應（收到即自動反應）

WhatsApp 可以在收到進站訊息後立即自動送出表情符號反應，於機器人產生回覆之前。這可向使用者提供即時回饋，表示訊息已收到。

**設定：**

```json
{
  "whatsapp": {
    "ackReaction": {
      "emoji": "👀",
      "direct": true,
      "group": "mentions"
    }
  }
}
```

**選項：**

- `emoji`（字串）：用於確認的表情符號（例如「👀」、「✅」、「📨」）。空白或省略＝停用功能。
- `direct`（布林，預設：`true`）：在私聊／私訊中送出反應。
- `group`（字串，預設：`"mentions"`）：群組聊天行為：
  - `"always"`：對所有群組訊息反應（即使未 @mention）
  - `"mentions"`：僅在機器人被 @mention 時反應
  - `"never"`：群組中永不反應

**依帳號覆寫：**

```json
{
  "whatsapp": {
    "accounts": {
      "work": {
        "ackReaction": {
          "emoji": "✅",
          "direct": false,
          "group": "always"
        }
      }
    }
  }
}
```

**行為說明：**

- 反應會在收到訊息後**立即**送出，先於輸入中指示或機器人回覆。
- 在設定為 `requireMention: false`（啟用：一律）的群組中，`group: "mentions"` 會對所有訊息反應（不僅限 @mentions）。
- Fire-and-forget：反應失敗會記錄日誌，但不會阻止機器人回覆。
- 群組反應會自動包含參與者 JID。
- WhatsApp 會忽略 `messages.ackReaction`；請改用 `channels.whatsapp.ackReaction`。

## 代理程式工具（反應）

- 工具：`whatsapp`，包含 `react` 動作（`chatJid`、`messageId`、`emoji`，選用 `remove`）。
- 選用：`participant`（群組寄件者）、`fromMe`（對你自己的訊息反應）、`accountId`（多帳號）。
- 反應移除語意：請見 [/tools/reactions](/tools/reactions)。
- 工具閘控：`channels.whatsapp.actions.reactions`（預設：啟用）。

## 限制

- 外送文字會分段至 `channels.whatsapp.textChunkLimit`（預設 4000）。
- 選用的換行分段：設定 `channels.whatsapp.chunkMode="newline"`，在長度分段前先依空白行（段落邊界）分割。
- 進站媒體儲存上限由 `channels.whatsapp.mediaMaxMb` 限制（預設 50 MB）。
- 外送媒體項目上限由 `agents.defaults.mediaMaxMb` 限制（預設 5 MB）。

## 外送傳送（文字 + 媒體）

- 使用主動 Web 監聽器；若 Gateway 閘道器未執行則回傳錯誤。
- 文字分段：每則最多 4k（可透過 `channels.whatsapp.textChunkLimit` 設定，選用 `channels.whatsapp.chunkMode`）。
- 媒體：
  - 支援圖片／影片／音訊／文件。
  - 音訊以 PTT 傳送；`audio/ogg` ⇒ `audio/ogg; codecs=opus`。
  - 僅第一個媒體項目可加上說明文字。
  - 媒體抓取支援 HTTP(S) 與本機路徑。
  - 動態 GIF：WhatsApp 期望使用具備 `gifPlayback: true` 的 MP4 以進行內嵌循環。
    - CLI：`openclaw message send --media <mp4> --gif-playback`
    - Gateway 閘道器：`send` 參數包含 `gifPlayback: true`

## 語音備忘（PTT 音訊）

WhatsApp 會將音訊以**語音備忘**（PTT 氣泡）傳送。

- 最佳效果：OGG／Opus。OpenClaw 會將 `audio/ogg` 重寫為 `audio/ogg; codecs=opus`。
- `[[audio_as_voice]]` 對 WhatsApp 會被忽略（音訊本就以語音備忘傳送）。

## 媒體限制 + 最佳化

- 預設外送上限：5 MB（每個媒體項目）。
- 覆寫：`agents.defaults.mediaMaxMb`。
- 圖片會自動最佳化為低於上限的 JPEG（縮放 + 品質掃描）。
- 超出大小的媒體 ⇒ 錯誤；媒體回覆會回退為文字警告。

## 心跳

- **Gateway 閘道器心跳** 會記錄連線健康狀態（`web.heartbeatSeconds`，預設 60 秒）。
- **代理程式心跳** 可依代理程式設定（`agents.list[].heartbeat`）或全域設定  
  透過 `agents.defaults.heartbeat`（當未設定每代理程式項目時的後備）。
  - 使用設定的心跳提示（預設：`Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`）+ `HEARTBEAT_OK` 的略過行為。
  - 投遞預設為最後使用的頻道（或設定的目標）。

## 重新連線行為

- 退避策略：`web.reconnect`：
  - `initialMs`、`maxMs`、`factor`、`jitter`、`maxAttempts`。
- 若達到 maxAttempts，Web 監控會停止（降級）。
- 已登出 ⇒ 停止並要求重新連結。

## 設定快速對照

- `channels.whatsapp.dmPolicy`（私訊政策：配對／allowlist／開放／停用）。
- `channels.whatsapp.selfChatMode`（同手機設定；機器人使用你的個人 WhatsApp 號碼）。
- `channels.whatsapp.allowFrom`（私訊 allowlist）。WhatsApp 使用 E.164 電話號碼（無使用者名稱）。
- `channels.whatsapp.mediaMaxMb`（進站媒體儲存上限）。
- `channels.whatsapp.ackReaction`（收到訊息即自動反應：`{emoji, direct, group}`）。
- `channels.whatsapp.accounts.<accountId>.*`（依帳號設定 + 選用 `authDir`）。
- `channels.whatsapp.accounts.<accountId>.mediaMaxMb`（依帳號的進站媒體上限）。
- `channels.whatsapp.accounts.<accountId>.ackReaction`（依帳號的確認反應覆寫）。
- `channels.whatsapp.groupAllowFrom`（群組寄件者 allowlist）。
- `channels.whatsapp.groupPolicy`（群組政策）。
- `channels.whatsapp.historyLimit` / `channels.whatsapp.accounts.<accountId>.historyLimit`（群組歷史上下文；`0` 停用）。
- `channels.whatsapp.dmHistoryLimit`（私訊歷史限制（以使用者回合計））。依使用者覆寫：`channels.whatsapp.dms["<phone>"].historyLimit`。
- `channels.whatsapp.groups`（群組 allowlist + 提及閘控預設；使用 `"*"` 以允許全部）
- `channels.whatsapp.actions.reactions`（WhatsApp 工具反應的閘控）。
- `agents.list[].groupChat.mentionPatterns`（或 `messages.groupChat.mentionPatterns`）
- `messages.groupChat.historyLimit`
- `channels.whatsapp.messagePrefix`（進站前綴；依帳號：`channels.whatsapp.accounts.<accountId>.messagePrefix`；已淘汰：`messages.messagePrefix`）
- `messages.responsePrefix`（外送前綴）
- `agents.defaults.mediaMaxMb`
- `agents.defaults.heartbeat.every`
- `agents.defaults.heartbeat.model`（選用覆寫）
- `agents.defaults.heartbeat.target`
- `agents.defaults.heartbeat.to`
- `agents.defaults.heartbeat.session`
- `agents.list[].heartbeat.*`（依代理程式覆寫）
- `session.*`（scope、idle、store、mainKey）
- `web.enabled`（為 false 時停用頻道啟動）
- `web.heartbeatSeconds`
- `web.reconnect.*`

## 日誌 + 疑難排解

- 子系統：`whatsapp/inbound`、`whatsapp/outbound`、`web-heartbeat`、`web-reconnect`。
- 日誌檔案：`/tmp/openclaw/openclaw-YYYY-MM-DD.log`（可設定）。
- 疑難排解指南：[Gateway troubleshooting](/gateway/troubleshooting)。

## 疑難排解（快速）

**未連結／需要 QR 登入**

- 症狀：`channels status` 顯示 `linked: false` 或警告「Not linked」。
- 修復：在 Gateway 閘道器主機上執行 `openclaw channels login` 並掃描 QR（WhatsApp → 設定 → 已連結的裝置）。

**已連結但已中斷／重新連線迴圈**

- 症狀：`channels status` 顯示 `running, disconnected` 或警告「Linked but disconnected」。
- 修復：`openclaw doctor`（或重新啟動 Gateway 閘道器）。若仍持續，請透過 `channels login` 重新連結並檢查 `openclaw logs --follow`。

**Bun 執行環境**

- **不建議** 使用 Bun。WhatsApp（Baileys）與 Telegram 在 Bun 上不可靠。  
  請使用 **Node** 執行 Gateway 閘道器。（請見入門指南的執行環境說明。）
