---
summary: "跨平台（WhatsApp/Telegram/Discord/Slack/Signal/iMessage/Microsoft Teams）的群組聊天行為"
read_when:
  - 變更群組聊天行為或提及門檻時
title: "群組"
x-i18n:
  source_path: channels/groups.md
  source_hash: 5380e07ea01f4a8f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:24Z
---

# 群組

OpenClaw 會在各平台上一致地處理群組聊天：WhatsApp、Telegram、Discord、Slack、Signal、iMessage、Microsoft Teams。

## 新手入門（2 分鐘）

OpenClaw「存在」於你自己的訊息帳號中。沒有獨立的 WhatsApp 機器人使用者。
只要**你**在某個群組裡，OpenClaw 就能看到該群組並在其中回覆。

預設行為：

- 群組預設為受限制（`groupPolicy: "allowlist"`）。
- 回覆需要被提及，除非你明確停用提及門檻。

翻譯：在允許清單中的傳送者，透過提及 OpenClaw 即可觸發。

> TL;DR
>
> - **DM 存取** 由 `*.allowFrom` 控制。
> - **群組存取** 由 `*.groupPolicy` + 允許清單（`*.groups`、`*.groupAllowFrom`）控制。
> - **回覆觸發** 由提及門檻（`requireMention`、`/activation`）控制。

快速流程（群組訊息會發生什麼事）：

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

![群組訊息流程](/images/groups-flow.svg)

如果你想要……

| 目標                              | 要設定的項目                                               |
| --------------------------------- | ---------------------------------------------------------- |
| 允許所有群組，但只在 @ 提及時回覆 | `groups: { "*": { requireMention: true } }`                |
| 停用所有群組回覆                  | `groupPolicy: "disabled"`                                  |
| 只允許特定群組                    | `groups: { "<group-id>": { ... } }`（沒有 `"*"` 金鑰）     |
| 只有你能在群組中觸發              | `groupPolicy: "allowlist"`、`groupAllowFrom: ["+1555..."]` |

## 工作階段金鑰

- 群組工作階段使用 `agent:<agentId>:<channel>:group:<id>` 工作階段金鑰（房間／頻道使用 `agent:<agentId>:<channel>:channel:<id>`）。
- Telegram 論壇主題會將 `:topic:<threadId>` 加到群組 id，使每個主題都有自己的工作階段。
- 私聊使用主要工作階段（或在有設定時為每位傳送者各自一個）。
- 群組工作階段會略過心跳。

## 模式：個人私訊 + 公開群組（單一代理程式）

可以——如果你的「個人」流量是 **DMs**，而「公開」流量是 **群組**，這個模式運作良好。

原因：在單一代理程式模式中，DM 通常落在 **主要** 工作階段金鑰（`agent:main:main`），而群組一律使用 **非主要** 工作階段金鑰（`agent:main:<channel>:group:<id>`）。如果你使用 `mode: "non-main"` 啟用沙箱隔離，這些群組工作階段會在 Docker 中執行，而你的主要 DM 工作階段則留在主機上。

這樣你會有一個代理程式「大腦」（共享工作空間 + 記憶），但有兩種執行姿態：

- **DMs**：完整工具（主機）
- **群組**：沙箱 + 受限制的工具（Docker）

> 如果你需要真正分離的工作空間／人格（「個人」與「公開」絕不能混用），請使用第二個代理程式 + 繫結。請參閱 [Multi-Agent Routing](/concepts/multi-agent)。

範例（DM 在主機上，群組為沙箱 + 僅限訊息工具）：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // groups/channels are non-main -> sandboxed
        scope: "session", // strongest isolation (one container per group/channel)
        workspaceAccess: "none",
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        // If allow is non-empty, everything else is blocked (deny still wins).
        allow: ["group:messaging", "group:sessions"],
        deny: ["group:runtime", "group:fs", "group:ui", "nodes", "cron", "gateway"],
      },
    },
  },
}
```

想要「群組只能看到資料夾 X」，而不是「沒有主機存取權」？保留 `workspaceAccess: "none"`，並只將允許清單中的路徑掛載到沙箱中：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
        docker: {
          binds: [
            // hostPath:containerPath:mode
            "~/FriendsShared:/data:ro",
          ],
        },
      },
    },
  },
}
```

相關內容：

- 設定金鑰與預設值：[Gateway configuration](/gateway/configuration#agentsdefaultssandbox)
- 偵錯為何工具被封鎖：[Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)
- 繫結掛載細節：[Sandboxing](/gateway/sandboxing#custom-bind-mounts)

## 顯示標籤

- UI 標籤在可用時使用 `displayName`，格式為 `<channel>:<token>`。
- `#room` 保留給房間／頻道；群組聊天使用 `g-<slug>`（小寫，空白轉為 `-`，保留 `#@+._-`）。

## 群組政策

控制各頻道如何處理群組／房間訊息：

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "disabled", // "open" | "disabled" | "allowlist"
      groupAllowFrom: ["+15551234567"],
    },
    telegram: {
      groupPolicy: "disabled",
      groupAllowFrom: ["123456789", "@username"],
    },
    signal: {
      groupPolicy: "disabled",
      groupAllowFrom: ["+15551234567"],
    },
    imessage: {
      groupPolicy: "disabled",
      groupAllowFrom: ["chat_id:123"],
    },
    msteams: {
      groupPolicy: "disabled",
      groupAllowFrom: ["user@org.com"],
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        GUILD_ID: { channels: { help: { allow: true } } },
      },
    },
    slack: {
      groupPolicy: "allowlist",
      channels: { "#general": { allow: true } },
    },
    matrix: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["@owner:example.org"],
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
    },
  },
}
```

| 政策          | 行為                                   |
| ------------- | -------------------------------------- |
| `"open"`      | 群組略過允許清單；仍套用提及門檻。     |
| `"disabled"`  | 完全封鎖所有群組訊息。                 |
| `"allowlist"` | 只允許符合設定之允許清單的群組／房間。 |

注意事項：

- `groupPolicy` 與提及門檻是分開的（提及門檻需要 @ 提及）。
- WhatsApp／Telegram／Signal／iMessage／Microsoft Teams：使用 `groupAllowFrom`（後備：明確的 `allowFrom`）。
- Discord：允許清單使用 `channels.discord.guilds.<id>.channels`。
- Slack：允許清單使用 `channels.slack.channels`。
- Matrix：允許清單使用 `channels.matrix.groups`（房間 ID、別名或名稱）。使用 `channels.matrix.groupAllowFrom` 以限制傳送者；也支援每個房間的 `users` 允許清單。
- 群組 DM 另行控制（`channels.discord.dm.*`、`channels.slack.dm.*`）。
- Telegram 允許清單可比對使用者 ID（`"123456789"`、`"telegram:123456789"`、`"tg:123456789"`）或使用者名稱（`"@alice"` 或 `"alice"`）；前綴不分大小寫。
- 預設為 `groupPolicy: "allowlist"`；若你的群組允許清單為空，群組訊息會被封鎖。

快速心智模型（群組訊息的評估順序）：

1. `groupPolicy`（開放／停用／允許清單）
2. 群組允許清單（`*.groups`、`*.groupAllowFrom`、各頻道專屬允許清單）
3. 提及門檻（`requireMention`、`/activation`）

## 提及門檻（預設）

除非針對個別群組覆寫，否則群組訊息需要被提及。預設值位於各子系統的 `*.groups."*"` 之下。

回覆機器人訊息在支援回覆中繼資料的頻道中，會視為隱式提及。這適用於 Telegram、WhatsApp、Slack、Discord 與 Microsoft Teams。

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
        "123@g.us": { requireMention: false },
      },
    },
    telegram: {
      groups: {
        "*": { requireMention: true },
        "123456789": { requireMention: false },
      },
    },
    imessage: {
      groups: {
        "*": { requireMention: true },
        "123": { requireMention: false },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw", "\\+15555550123"],
          historyLimit: 50,
        },
      },
    ],
  },
}
```

注意事項：

- `mentionPatterns` 為不分大小寫的正則表達式。
- 提供明確提及的介面仍會通過；樣式僅作為後備。
- 每個代理程式的覆寫：`agents.list[].groupChat.mentionPatterns`（多個代理程式共用同一群組時很有用）。
- 僅在可進行提及偵測時才會強制提及門檻（原生提及或已設定 `mentionPatterns`）。
- Discord 的預設值位於 `channels.discord.guilds."*"`（可依伺服器／頻道覆寫）。
- 群組歷史脈絡在各頻道中會以一致方式包裝，且為**僅待處理**（因提及門檻而略過的訊息）；全域預設使用 `messages.groupChat.historyLimit`，覆寫使用 `channels.<channel>.historyLimit`（或 `channels.<channel>.accounts.*.historyLimit`）。設定 `0` 可停用。

## 群組／頻道工具限制（選用）

部分頻道設定支援限制**特定群組／房間／頻道內**可用的工具。

- `tools`：為整個群組允許／拒絕工具。
- `toolsBySender`：群組內依傳送者覆寫（鍵值為傳送者 ID／使用者名稱／電子郵件／電話號碼，視頻道而定）。使用 `"*"` 作為萬用字元。

解析順序（越具體者優先）：

1. 群組／頻道 `toolsBySender` 比對
2. 群組／頻道 `tools`
3. 預設（`"*"`）`toolsBySender` 比對
4. 預設（`"*"`）`tools`

範例（Telegram）：

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { tools: { deny: ["exec"] } },
        "-1001234567890": {
          tools: { deny: ["exec", "read", "write"] },
          toolsBySender: {
            "123456789": { alsoAllow: ["exec"] },
          },
        },
      },
    },
  },
}
```

注意事項：

- 群組／頻道工具限制會在全域／代理程式工具政策之外套用（拒絕仍然優先）。
- 部分頻道對房間／頻道使用不同的巢狀結構（例如 Discord `guilds.*.channels.*`、Slack `channels.*`、MS Teams `teams.*.channels.*`）。

## 群組允許清單

當設定了 `channels.whatsapp.groups`、`channels.telegram.groups` 或 `channels.imessage.groups` 時，這些鍵會作為群組允許清單。使用 `"*"` 可在仍設定預設提及行為的同時允許所有群組。

常見意圖（可直接複製貼上）：

1. 停用所有群組回覆

```json5
{
  channels: { whatsapp: { groupPolicy: "disabled" } },
}
```

2. 只允許特定群組（WhatsApp）

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "123@g.us": { requireMention: true },
        "456@g.us": { requireMention: false },
      },
    },
  },
}
```

3. 允許所有群組，但需要提及（明確）

```json5
{
  channels: {
    whatsapp: {
      groups: { "*": { requireMention: true } },
    },
  },
}
```

4. 只有擁有者能在群組中觸發（WhatsApp）

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## 啟用（僅限擁有者）

群組擁有者可以切換每個群組的啟用狀態：

- `/activation mention`
- `/activation always`

擁有者由 `channels.whatsapp.allowFrom` 判定（未設定時為機器人的自身 E.164）。請將指令作為獨立訊息送出。其他平台目前會忽略 `/activation`。

## 脈絡欄位

群組的傳入負載會設定：

- `ChatType=group`
- `GroupSubject`（若已知）
- `GroupMembers`（若已知）
- `WasMentioned`（提及門檻結果）
- Telegram 論壇主題也會包含 `MessageThreadId` 與 `IsForum`。

在新的群組工作階段的第一回合，代理程式系統提示會包含群組導言。它會提醒模型像人類一樣回應、避免 Markdown 表格，並避免輸入字面上的 `\n` 序列。

## iMessage 細節

- 在路由或允許清單時，優先使用 `chat_id:<id>`。
- 列出聊天：`imsg chats --limit 20`。
- 群組回覆一律回到相同的 `chat_id`。

## WhatsApp 細節

WhatsApp 專屬行為（歷史注入、提及處理細節）請參閱 [Group messages](/channels/group-messages)。
