---
summary: "用於 web_search 的 Brave Search API 設定"
read_when:
  - 你想要使用 Brave Search 進行 web_search
  - 你需要 BRAVE_API_KEY 或方案詳細資訊
title: "Brave Search"
x-i18n:
  source_path: brave-search.md
  source_hash: cdcb037b092b8a10
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:14Z
---

# Brave Search API

OpenClaw 使用 Brave Search 作為 `web_search` 的預設提供者。

## 取得 API 金鑰

1. 前往 https://brave.com/search/api/ 建立 Brave Search API 帳戶。
2. 在控制台中，選擇 **Data for Search** 方案並產生 API 金鑰。
3. 將金鑰儲存在設定檔中（建議），或在 Gateway 閘道器 的環境中設定 `BRAVE_API_KEY`。

## 設定範例

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave",
        apiKey: "BRAVE_API_KEY_HERE",
        maxResults: 5,
        timeoutSeconds: 30,
      },
    },
  },
}
```

## 注意事項

- Data for AI 方案與 `web_search` **不相容**。
- Brave 提供免費層級與付費方案；請至 Brave API 入口網站查看目前的使用限制。

請參閱 [Web tools](/tools/web) 以了解完整的 web_search 設定。
