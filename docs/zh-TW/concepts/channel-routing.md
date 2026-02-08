---
summary: 「每個頻道（WhatsApp、Telegram、Discord、Slack）的路由規則與共享內容」
read_when:
  - 變更頻道路由或收件匣行為時
title: 「頻道路由」
x-i18n:
  source_path: concepts/channel-routing.md
  source_hash: 1a322b5187e32c82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:53Z
---

# Channels & routing

OpenClaw 會將回覆 **送回訊息來源的同一個頻道**。  
模型不會選擇頻道；路由是具決定性的，並由主機設定所控制。

## Key terms

- **Channel**：`whatsapp`、`telegram`、`discord`、`slack`、`signal`、`imessage`、`webchat`。
- **AccountId**：每個頻道的帳號實例（若支援）。
- **AgentId**：隔離的工作區 + 工作階段儲存（「大腦」）。
- **SessionKey**：用於儲存內容並控制併發的桶鍵。

## Session key shapes（範例）

私訊會合併到代理程式的 **main** 工作階段：

- `agent:<agentId>:<mainKey>`（預設：`agent:main:main`）

群組與頻道會依頻道各自隔離：

- 群組：`agent:<agentId>:<channel>:group:<id>`
- 頻道／房間：`agent:<agentId>:<channel>:channel:<id>`

執行緒：

- Slack／Discord 執行緒會在基礎鍵後附加 `:thread:<threadId>`。
- Telegram 論壇主題會將 `:topic:<topicId>` 嵌入群組鍵中。

範例：

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Routing rules（如何選擇代理程式）

路由會為每則入站訊息選擇 **一個代理程式**：

1. **精確對等比對**（`bindings` 搭配 `peer.kind` + `peer.id`）。
2. **Guild 比對**（Discord），透過 `guildId`。
3. **Team 比對**（Slack），透過 `teamId`。
4. **帳號比對**（該頻道上的 `accountId`）。
5. **頻道比對**（該頻道上的任何帳號）。
6. **預設代理程式**（`agents.list[].default`；否則使用清單中的第一個項目，回退到 `main`）。

比對到的代理程式會決定使用哪個工作區與工作階段儲存。

## Broadcast groups（同時執行多個代理程式）

Broadcast groups 讓你在 **OpenClaw 正常會回覆** 的情況下，針對同一個對等端 **同時執行多個代理程式**（例如：在 WhatsApp 群組中，於提及／啟用門檻之後）。

設定：

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

參見：[Broadcast Groups](/broadcast-groups)。

## Config overview

- `agents.list`：具名的代理程式定義（工作區、模型等）。
- `bindings`：將入站的頻道／帳號／對等端對應到代理程式。

範例：

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## Session storage

工作階段儲存位於狀態目錄之下（預設為 `~/.openclaw`）：

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL 逐行轉錄與儲存並列存在

你可以透過 `session.store` 與 `{agentId}` 範本化來覆寫儲存路徑。

## WebChat behavior

WebChat 會附加到 **所選代理程式**，並預設使用該代理程式的 main 工作階段。  
因此，WebChat 讓你能在同一個地方查看該代理程式的跨頻道內容。

## Reply context

入站回覆包含：

- 視可用性包含 `ReplyToId`、`ReplyToBody` 與 `ReplyToSender`。
- 被引用的內容會以 `[Replying to ...]` 區塊的形式附加到 `Body`。

各頻道之間的行為一致。
