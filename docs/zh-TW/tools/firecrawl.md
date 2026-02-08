---
summary: 「用於 web_fetch 的 Firecrawl 後備方案（反機器人 + 快取擷取）」
read_when:
  - 「你想要由 Firecrawl 支援的網頁擷取」
  - 「你需要一把 Firecrawl API 金鑰」
  - 「你想要為 web_fetch 提供反機器人擷取」
title: 「Firecrawl」
x-i18n:
  source_path: tools/firecrawl.md
  source_hash: 08a7ad45b41af412
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:53Z
---

# Firecrawl

OpenClaw 可使用 **Firecrawl** 作為 `web_fetch` 的後備擷取器。它是一項託管的
內容擷取服務，支援繞過機器人防護與快取，對於
JS 密集型網站或封鎖純 HTTP 擷取的頁面特別有幫助。

## 取得 API 金鑰

1. 建立 Firecrawl 帳戶並產生一把 API 金鑰。
2. 將其儲存在設定中，或在 Gateway 閘道器 環境中設定 `FIRECRAWL_API_KEY`。

## 設定 Firecrawl

```json5
{
  tools: {
    web: {
      fetch: {
        firecrawl: {
          apiKey: "FIRECRAWL_API_KEY_HERE",
          baseUrl: "https://api.firecrawl.dev",
          onlyMainContent: true,
          maxAgeMs: 172800000,
          timeoutSeconds: 60,
        },
      },
    },
  },
}
```

備註：

- 當存在 API 金鑰時，`firecrawl.enabled` 預設為 true。
- `maxAgeMs` 控制可接受的快取結果最久時間（毫秒）。預設為 2 天。

## 隱身／繞過機器人

Firecrawl 提供 **proxy mode** 參數以進行繞過機器人（`basic`、`stealth` 或 `auto`）。
OpenClaw 一律在 Firecrawl 請求中使用 `proxy: "auto"` 加上 `storeInCache: true`。
若未指定 proxy，Firecrawl 會預設為 `auto`。`auto` 會在基本嘗試失敗時以隱身代理重試，
這可能會比僅使用基本擷取消耗更多額度。

## `web_fetch` 如何使用 Firecrawl

`web_fetch` 的擷取順序：

1. Readability（本機）
2. Firecrawl（若已設定）
3. 基本 HTML 清理（最後後備）

完整的網頁工具設定請參閱 [Web tools](/tools/web)。
