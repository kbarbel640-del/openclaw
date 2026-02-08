---
summary: 「WhatsApp 群組訊息處理的行為與設定（mentionPatterns 會在各個介面共用）」」
read_when:
  - 「變更群組訊息規則或提及設定時」
title: 「群組訊息」
x-i18n:
  source_path: concepts/group-messages.md
  source_hash: 181a72f12f5021af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:04Z
---

# 群組訊息（WhatsApp Web 頻道）

目標：讓 Clawd 常駐於 WhatsApp 群組中，僅在被點名時喚醒，並將該討論串與個人私訊（DM）工作階段分離。

注意：`agents.list[].groupChat.mentionPatterns` 現在也由 Telegram / Discord / Slack / iMessage 使用；本文件聚焦於 WhatsApp 特定行為。對於多代理程式的設定，請為每個代理程式設定 `agents.list[].groupChat.mentionPatterns`（或使用 `messages.groupChat.mentionPatterns` 作為全域後備）。

## 已實作項目（2025-12-03）

- 啟用模式：`mention`（預設）或 `always`。`mention` 需要被點名（真正的 WhatsApp @ 提及，透過 `mentionedJids`、正則表示式，或在文字中任意位置出現機器人的 E.164）。`always` 會在每則訊息時喚醒代理程式，但僅在能提供實質價值時才回覆；否則會回傳靜默權杖 `NO_REPLY`。預設值可在設定中指定（`channels.whatsapp.groups`），並可透過 `/activation` 針對各群組覆寫。當設定 `channels.whatsapp.groups` 時，它也會作為群組允許清單（加入 `"*"` 以允許全部）。
- 群組政策：`channels.whatsapp.groupPolicy` 控制是否接受群組訊息（`open|disabled|allowlist`）。`allowlist` 使用 `channels.whatsapp.groupAllowFrom`（後備：明確的 `channels.whatsapp.allowFrom`）。預設為 `allowlist`（在你新增傳送者之前會被封鎖）。
- 每群組工作階段：工作階段金鑰看起來像 `agent:<agentId>:whatsapp:group:<jid>`，因此像 `/verbose on` 或 `/think high`（以獨立訊息傳送）的指令只會作用於該群組；個人 DM 狀態不受影響。群組討論串會略過心跳。
- 脈絡注入：**僅限待處理** 的群組訊息（預設 50 則），且 _未_ 觸發執行的內容，會在 `[Chat messages since your last reply - for context]` 之下加上前綴，而觸發的那一行會放在 `[Current message - respond to this]` 之下。已存在於工作階段中的訊息不會再次注入。
- 傳送者顯示：每個群組批次現在都會以 `[from: Sender Name (+E164)]` 結尾，讓 Pi 知道是誰在說話。
- 即焚／僅檢視一次：在擷取文字／提及之前會先解包，因此其中的點名仍可觸發。
- 群組系統提示：在群組工作階段的第一回合（以及每當 `/activation` 變更模式時），我們會在系統提示中注入一段簡短說明，例如 `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.`。若無法取得中繼資料，仍會告知代理程式這是群組聊天。

## 設定範例（WhatsApp）

在 `~/.openclaw/openclaw.json` 中加入一個 `groupChat` 區塊，讓顯示名稱的點名即使在 WhatsApp 於文字本文中移除可視的 `@` 時仍可運作：

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

- 正則表示式不區分大小寫；它們涵蓋像 `@openclaw` 這樣的顯示名稱點名，以及含或不含 `+`／空白的原始號碼。
- 當有人點選聯絡人時，WhatsApp 仍會透過 `mentionedJids` 傳送標準化的提及，因此號碼後備很少需要，但作為安全網相當實用。

### 啟用指令（僅限擁有者）

使用群組聊天指令：

- `/activation mention`
- `/activation always`

只有擁有者號碼（來自 `channels.whatsapp.allowFrom`，或在未設定時使用機器人自身的 E.164）可以變更此設定。以獨立訊息在群組中傳送 `/status` 可查看目前的啟用模式。

## 使用方式

1. 將你的 WhatsApp 帳號（執行 OpenClaw 的那個）加入群組。
2. 說 `@openclaw …`（或包含該號碼）。除非你設定 `groupPolicy: "open"`，否則只有在允許清單中的傳送者可以觸發。
3. 代理程式提示將包含最近的群組脈絡，以及尾端的 `[from: …]` 標記，以便回應正確的人。
4. 工作階段層級的指令（`/verbose on`、`/think high`、`/new` 或 `/reset`、`/compact`）只會套用到該群組的工作階段；請以獨立訊息傳送以確保註冊。你的個人 DM 工作階段仍保持獨立。

## 測試／驗證

- 手動冒煙測試：
  - 在群組中傳送一個 `@openclaw` 點名，並確認回覆中有提及傳送者名稱。
  - 再傳送第二個點名，確認歷史區塊被包含，並在下一回合被清除。
- 檢查 Gateway 閘道器 記錄（以 `--verbose` 執行），查看顯示 `from: <groupJid>` 與 `[from: …]` 尾碼的 `inbound web message` 項目。

## 已知考量

- 群組刻意略過心跳，以避免嘈雜的廣播。
- 回聲抑制使用合併後的批次字串；若你在沒有提及的情況下傳送相同文字兩次，只有第一次會收到回覆。
- 工作階段儲存項目會以 `agent:<agentId>:whatsapp:group:<jid>` 的形式出現在工作階段儲存庫中（預設為 `~/.openclaw/agents/<agentId>/sessions/sessions.json`）；缺少項目僅表示該群組尚未觸發執行。
- 群組中的輸入中指示器遵循 `agents.defaults.typingMode`（預設：未被提及時為 `message`）。
