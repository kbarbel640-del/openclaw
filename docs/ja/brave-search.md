---
summary: "web_search のための Brave Search API 設定"
read_when:
  - web_search に Brave Search を使用したい場合
  - BRAVE_API_KEY またはプランの詳細が必要な場合
title: "Brave Search"
x-i18n:
  source_path: brave-search.md
  source_hash: cdcb037b092b8a10
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:41:49Z
---

# Brave Search API

OpenClaw は、`web_search` のデフォルトプロバイダーとして Brave Search を使用します。

## API キーを取得する

1. https://brave.com/search/api/ で Brave Search API アカウントを作成します。
2. ダッシュボードで **Data for Search** プランを選択し、API キーを生成します。
3. キーを設定に保存する（推奨）か、Gateway（ゲートウェイ）環境で `BRAVE_API_KEY` を設定します。

## 設定例

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

## 注記

- Data for AI プランは `web_search` と互換性が**ありません**。
- Brave は無料枠と有料プランを提供しています。現在の上限については Brave API ポータルを確認してください。

web_search の完全な設定については、[Web tools](/tools/web) を参照してください。
