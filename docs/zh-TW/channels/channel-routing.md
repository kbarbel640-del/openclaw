---
summary: 「每個頻道（WhatsApp、Telegram、Discord、Slack）的路由規則與共享上下文」
read_when:
  - 變更頻道路由或收件匣行為時
title: 「頻道路由」
x-i18n:
  source_path: channels/channel-routing.md
  source_hash: cfc2cade2984225d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:00Z
---

# 頻道與路由

OpenClaw 會將回覆 **送回訊息來源的同一個頻道**。  
模型不會選擇頻道；路由是確定性的，並由主機設定控制。

## 關鍵術語

- **Channel**：`whatsapp`、`telegram`、`discord`、`slack`、`signal`、`imessage`、`webchat`。
- **AccountId**：每個頻道的帳號實例（若支援）。
- **AgentId**：隔離的工作區 + 工作階段儲存（「大腦」）。
- **SessionKey**：用於儲存上下文並控制併發的分桶金鑰。

## Session key 形狀（範例）

私訊會合併到代理程式的 **main** 工作階段：

- `agent:<agentId>:<mainKey>`（預設：`agent:main:main`）

群組與頻道會依頻道各自隔離：

- 群組：`agent:<agentId>:<channel>:group:<id>`
- 頻道／房間：`agent:<agentId>:<channel>:channel:<id>`

執行緒：

- Slack／Discord 執行緒會在基礎金鑰後附加 `:thread:<threadId>`。
- Telegram 論壇主題會將 `:topic:<topicId>` 嵌入群組金鑰中。

範例：

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## 路由規則（如何選擇代理程式）

路由會為每一則入站訊息選擇 **一個代理程式**：

1. **精確對等比對**（`bindings`，搭配 `peer.kind` + `peer.id`）。
2. **公會比對**（Discord），透過 `guildId`。
3. **團隊比對**（Slack），透過 `teamId`。
4. **帳號比對**（該頻道上的 `accountId`）。
5. **頻道比對**（該頻道上的任何帳號）。
6. **預設代理程式**（`agents.list[].default`，否則使用清單中的第一個項目，最後回退至 `main`）。

被比對到的代理程式決定使用哪個工作區與工作階段儲存。

## 廣播群組（執行多個代理程式）

廣播群組可讓你在 **OpenClaw 通常會回覆** 的情況下，為同一個對等端 **同時執行多個代理程式**（例如：在 WhatsApp 群組中，經過提及／啟用閘門之後）。

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

請參閱：[Broadcast Groups](/channels/broadcast-groups)。

## 設定總覽

- `agents.list`：具名代理程式定義（工作區、模型等）。
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

## 工作階段儲存

工作階段儲存在狀態目錄下（預設為 `~/.openclaw`）：

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL 逐行轉錄檔與儲存並存

你可以透過 `session.store` 與 `{agentId}` 的樣板化來覆寫儲存路徑。

## WebChat 行為

WebChat 會附掛到 **所選代理程式**，並預設使用該代理程式的 main 工作階段。  
因此，WebChat 可讓你在同一個地方查看該代理程式的跨頻道上下文。

## 回覆上下文

入站回覆包含：

- 視可用性提供 `ReplyToId`、`ReplyToBody` 與 `ReplyToSender`。
- 引用的上下文會以 `[Replying to ...]` 區塊的形式附加到 `Body`。

此行為在各個頻道中保持一致。
