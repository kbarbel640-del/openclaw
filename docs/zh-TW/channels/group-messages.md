---
summary: "WhatsApp 群組訊息處理的行為與設定（mentionPatterns 於各介面間共用）"
read_when:
  - 變更群組訊息規則或提及設定時
title: "群組訊息"
x-i18n:
  source_path: channels/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:11Z
---

# 群組訊息（WhatsApp 網頁頻道）

目標：讓 Clawd 待在 WhatsApp 群組中，僅在被點名時喚醒，並將該對話串與個人私訊工作階段分離。

注意：`agents.list[].groupChat.mentionPatterns` 現已同時用於 Telegram／Discord／Slack／iMessage；本文著重於 WhatsApp 特有行為。多代理程式設定時，請為每個代理程式設定 `agents.list[].groupChat.mentionPatterns`（或使用 `messages.groupChat.mentionPatterns` 作為全域備援）。

## 已實作項目（2025-12-03）

- 啟用模式：`mention`（預設）或 `always`。`mention` 需要被點名（真正的 WhatsApp @ 提及，透過 `mentionedJids`、正則表達式，或文字中任意位置出現機器人的 E.164）。`always` 會在每則訊息喚醒代理程式，但僅在能提供實質價值時回覆；否則回傳靜默權杖 `NO_REPLY`。預設值可於設定（`channels.whatsapp.groups`）中指定，並可透過 `/activation` 針對各群組覆寫。設定 `channels.whatsapp.groups` 時，也會作為群組允許清單（加入 `"*"` 以允許全部）。
- 群組政策：`channels.whatsapp.groupPolicy` 控制是否接受群組訊息（`open|disabled|allowlist`）。`allowlist` 使用 `channels.whatsapp.groupAllowFrom`（備援：明確的 `channels.whatsapp.allowFrom`）。預設為 `allowlist`（在你加入發送者之前皆封鎖）。
- 各群組工作階段：工作階段金鑰外觀如 `agent:<agentId>:whatsapp:group:<jid>`，因此像 `/verbose on` 或 `/think high`（以獨立訊息傳送）的指令僅限該群組；個人私訊狀態不受影響。群組對話會略過心跳。
- 情境注入：**僅限待處理** 的群組訊息（預設 50 則）且 _未_ 觸發執行者，會以前綴 `[Chat messages since your last reply - for context]` 注入，觸發行則置於 `[Current message - respond to this]`。已在工作階段中的訊息不會再次注入。
- 發送者呈現：每個群組批次現在都以 `[from: Sender Name (+E164)]` 結尾，讓 Pi 知道誰在說話。
- 暫時／檢視一次：在擷取文字／提及前先解包，因此其中的點名仍可觸發。
- 群組系統提示：在群組工作階段的第一輪（以及每當 `/activation` 變更模式時）會在系統提示中注入一段簡短說明，如 `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.`。若無法取得中繼資料，仍會告知代理程式這是群組聊天。

## 設定範例（WhatsApp）

在 `~/.openclaw/openclaw.json` 中新增一個 `groupChat` 區塊，讓顯示名稱的點名在 WhatsApp 於文字本文中移除視覺化 `@` 時仍可運作：

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@?openclaw", "\\+?15555550123"],
        },
      },
    ],
  },
}
```

備註：

- 正則表達式不分大小寫；可涵蓋如 `@openclaw` 的顯示名稱點名，以及含或不含 `+`/空白的原始號碼。
- 當有人點擊聯絡人時，WhatsApp 仍會透過 `mentionedJids` 傳送標準化提及，因此號碼備援很少需要，但作為安全網很有用。

### 啟用指令（僅限擁有者）

使用群組聊天指令：

- `/activation mention`
- `/activation always`

僅擁有者號碼（來自 `channels.whatsapp.allowFrom`，或未設定時使用機器人的 E.164）可變更此設定。在群組中以獨立訊息傳送 `/status` 以查看目前的啟用模式。

## 使用方式

1. 將你的 WhatsApp 帳號（執行 OpenClaw 的那個）加入群組。
2. 說 `@openclaw …`（或包含號碼）。除非你設定 `groupPolicy: "open"`，否則只有在允許清單中的發送者才能觸發。
3. 代理程式提示將包含近期的群組情境，以及尾端的 `[from: …]` 標記，以便回應正確的人。
4. 工作階段層級的指令（`/verbose on`、`/think high`、`/new` 或 `/reset`、`/compact`）僅適用於該群組的工作階段；請以獨立訊息傳送以確實註冊。你的個人私訊工作階段保持獨立。

## 測試／驗證

- 手動冒煙測試：
  - 在群組中傳送一個 `@openclaw` 點名，確認回覆有參照發送者名稱。
  - 再傳送第二次點名，確認包含歷史區塊，並在下一輪被清除。
- 檢查 Gateway 閘道器 記錄（以 `--verbose` 執行），查看顯示 `from: <groupJid>` 與 `[from: …]` 尾碼的 `inbound web message` 項目。

## 已知注意事項

- 群組刻意略過心跳，以避免吵雜的廣播。
- 回音抑制使用合併後的批次字串；若你在沒有提及的情況下連續傳送相同文字兩次，只有第一次會得到回應。
- 工作階段儲存項目將以 `agent:<agentId>:whatsapp:group:<jid>` 顯示於工作階段儲存庫中（預設為 `~/.openclaw/agents/<agentId>/sessions/sessions.json`）；缺少項目僅表示該群組尚未觸發執行。
- 群組中的輸入中指示遵循 `agents.defaults.typingMode`（預設：未被提及時為 `message`）。
