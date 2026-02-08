---
summary: "web_fetch 向けの Firecrawl フォールバック（アンチボット + キャッシュ抽出）"
read_when:
  - Firecrawl をバックエンドにした Web 抽出が必要な場合
  - Firecrawl API キーが必要な場合
  - web_fetch 向けにアンチボット抽出が必要な場合
title: "Firecrawl"
x-i18n:
  source_path: tools/firecrawl.md
  source_hash: 08a7ad45b41af412
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:46Z
---

# Firecrawl

OpenClaw は、`web_fetch` のフォールバック抽出器として **Firecrawl** を使用できます。これはホスト型のコンテンツ抽出サービスで、ボット回避とキャッシュをサポートしており、JS 依存度の高いサイトや、単純な HTTP フェッチをブロックするページに有効です。

## API キーを取得する

1. Firecrawl アカウントを作成し、API キーを生成します。
2. 設定に保存するか、Gateway（ゲートウェイ）の環境で `FIRECRAWL_API_KEY` を設定します。

## Firecrawl を設定する

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

注記:

- API キーが存在する場合、`firecrawl.enabled` はデフォルトで true になります。
- `maxAgeMs` は、キャッシュされた結果をどれくらい古いものまで許容するか（ms）を制御します。デフォルトは 2 日です。

## ステルス / ボット回避

Firecrawl は、ボット回避用の **proxy mode** パラメータを公開しています（`basic`、`stealth`、または `auto`）。
OpenClaw は Firecrawl リクエストに対して常に `proxy: "auto"` と `storeInCache: true` を使用します。
proxy が省略された場合、Firecrawl はデフォルトで `auto` になります。`auto` は、基本的な試行が失敗した場合にステルスプロキシでリトライします。これは basic のみのスクレイピングよりも多くのクレジットを使用する可能性があります。

## `web_fetch` が Firecrawl を使用する方法

`web_fetch` の抽出順序:

1. Readability（ローカル）
2. Firecrawl（設定されている場合）
3. 基本的な HTML クリーンアップ（最終フォールバック）

Web ツールのセットアップ全体については、[Web tools](/tools/web) を参照してください。
