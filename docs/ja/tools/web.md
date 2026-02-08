---
summary: "Web 検索 + fetch ツール（Brave Search API、Perplexity direct/OpenRouter）"
read_when:
  - web_search または web_fetch を有効化したい場合
  - Brave Search API キーのセットアップが必要な場合
  - Web 検索に Perplexity Sonar を使用したい場合
title: "Web ツール"
x-i18n:
  source_path: tools/web.md
  source_hash: f5f25d2b40ccf1e5
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:33Z
---

# Web ツール

OpenClaw には、軽量な Web ツールが 2 つ同梱されています。

- `web_search` — Brave Search API（デフォルト）または Perplexity Sonar（direct または OpenRouter 経由）で Web を検索します。
- `web_fetch` — HTTP fetch + 可読性の高い抽出（HTML → markdown/text）。

これらはブラウザ自動化では**ありません**。JS 比率が高いサイトやログインが必要な場合は、
[Browser ツール](/tools/browser)を使用してください。

## 仕組み

- `web_search` は設定済みのプロバイダーを呼び出し、結果を返します。
  - **Brave**（デフォルト）: 構造化された結果（タイトル、URL、スニペット）を返します。
  - **Perplexity**: リアルタイム Web 検索に基づく、引用付きの AI 生成回答を返します。
- 結果はクエリ単位で 15 分間キャッシュされます（設定可能）。
- `web_fetch` は通常の HTTP GET を実行し、可読なコンテンツを抽出します
  （HTML → markdown/text）。JavaScript は**実行しません**。
- `web_fetch` はデフォルトで有効です（明示的に無効化しない限り）。

## 検索プロバイダーの選択

| プロバイダー            | 長所                               | 短所                                            | API キー                                         |
| ----------------------- | ---------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| **Brave**（デフォルト） | 高速、構造化された結果、無料枠あり | 従来型の検索結果                                | `BRAVE_API_KEY`                                  |
| **Perplexity**          | AI 生成回答、引用、リアルタイム    | Perplexity または OpenRouter へのアクセスが必要 | `OPENROUTER_API_KEY` または `PERPLEXITY_API_KEY` |

プロバイダー固有の詳細については、[Brave Search セットアップ](/brave-search)および [Perplexity Sonar](/perplexity) を参照してください。

設定でプロバイダーを指定します。

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave", // or "perplexity"
      },
    },
  },
}
```

例: Perplexity Sonar（direct API）に切り替える場合:

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

## Brave API キーの取得

1. https://brave.com/search/api/ で Brave Search API アカウントを作成します
2. ダッシュボードで **Data for Search** プラン（「Data for AI」ではない方）を選び、API キーを生成します。
3. 推奨として `openclaw configure --section web` を実行してキーを設定に保存するか、環境で `BRAVE_API_KEY` を設定します。

Brave には無料枠と有料プランがあります。現在の制限と料金は Brave API ポータルで確認してください。

### キーの設定先（推奨）

**推奨:** `openclaw configure --section web` を実行します。これによりキーが
`~/.openclaw/openclaw.json` の `tools.web.search.apiKey` 配下に保存されます。

**環境変数の代替:** Gateway（ゲートウェイ）プロセスの環境に `BRAVE_API_KEY` を設定します。
ゲートウェイのインストールの場合は `~/.openclaw/.env`（またはサービス環境）に入れてください。[環境変数](/help/faq#how-does-openclaw-load-environment-variables) を参照してください。

## Perplexity（direct または OpenRouter 経由）の使用

Perplexity Sonar モデルには Web 検索機能が組み込まれており、引用付きの AI 生成回答を返します。OpenRouter 経由でも使用できます（クレジットカード不要 - crypto/prepaid をサポート）。

### OpenRouter API キーの取得

1. https://openrouter.ai/ でアカウントを作成します
2. クレジットを追加します（crypto、prepaid、またはクレジットカードをサポート）
3. アカウント設定で API キーを生成します

### Perplexity 検索のセットアップ

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "perplexity",
        perplexity: {
          // API key (optional if OPENROUTER_API_KEY or PERPLEXITY_API_KEY is set)
          apiKey: "sk-or-v1-...",
          // Base URL (key-aware default if omitted)
          baseUrl: "https://openrouter.ai/api/v1",
          // Model (defaults to perplexity/sonar-pro)
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

**環境変数の代替:** Gateway（ゲートウェイ）環境で `OPENROUTER_API_KEY` または `PERPLEXITY_API_KEY` を設定します。
ゲートウェイのインストールの場合は `~/.openclaw/.env` に入れてください。

base URL が設定されていない場合、OpenClaw は API キーの提供元に基づいてデフォルトを選択します。

- `PERPLEXITY_API_KEY` または `pplx-...` → `https://api.perplexity.ai`
- `OPENROUTER_API_KEY` または `sk-or-...` → `https://openrouter.ai/api/v1`
- 不明なキー形式 → OpenRouter（安全なフォールバック）

### 利用可能な Perplexity モデル

| モデル                           | 説明                   | 最適な用途   |
| -------------------------------- | ---------------------- | ------------ |
| `perplexity/sonar`               | Web 検索付きの高速 Q&A | すばやい調査 |
| `perplexity/sonar-pro` (default) | Web 検索付きの多段推論 | 複雑な質問   |
| `perplexity/sonar-reasoning-pro` | Chain-of-thought 分析  | 深いリサーチ |

## web_search

設定済みのプロバイダーを使って Web を検索します。

### 要件

- `tools.web.search.enabled` は `false` であってはなりません（デフォルト: 有効）
- 選択したプロバイダーの API キー:
  - **Brave**: `BRAVE_API_KEY` または `tools.web.search.apiKey`
  - **Perplexity**: `OPENROUTER_API_KEY`、`PERPLEXITY_API_KEY`、または `tools.web.search.perplexity.apiKey`

### 設定

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        apiKey: "BRAVE_API_KEY_HERE", // optional if BRAVE_API_KEY is set
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
      },
    },
  },
}
```

### ツールパラメーター

- `query`（必須）
- `count`（1–10; デフォルトは設定から）
- `country`（任意）: 地域別結果のための 2 文字の国コード（例: "DE"、"US"、"ALL"）。省略した場合、Brave はデフォルト地域を選びます。
- `search_lang`（任意）: 検索結果の ISO 言語コード（例: "de"、"en"、"fr"）
- `ui_lang`（任意）: UI 要素の ISO 言語コード
- `freshness`（任意、Brave のみ）: 検出時刻でフィルター（`pd`、`pw`、`pm`、`py`、または `YYYY-MM-DDtoYYYY-MM-DD`）

**例:**

```javascript
// German-specific search
await web_search({
  query: "TV online schauen",
  count: 10,
  country: "DE",
  search_lang: "de",
});

// French search with French UI
await web_search({
  query: "actualités",
  country: "FR",
  search_lang: "fr",
  ui_lang: "fr",
});

// Recent results (past week)
await web_search({
  query: "TMBG interview",
  freshness: "pw",
});
```

## web_fetch

URL を取得し、可読なコンテンツを抽出します。

### 要件

- `tools.web.fetch.enabled` は `false` であってはなりません（デフォルト: 有効）
- 任意の Firecrawl フォールバック: `tools.web.fetch.firecrawl.apiKey` または `FIRECRAWL_API_KEY` を設定します。

### 設定

```json5
{
  tools: {
    web: {
      fetch: {
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 50000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        readability: true,
        firecrawl: {
          enabled: true,
          apiKey: "FIRECRAWL_API_KEY_HERE", // optional if FIRECRAWL_API_KEY is set
          baseUrl: "https://api.firecrawl.dev",
          onlyMainContent: true,
          maxAgeMs: 86400000, // ms (1 day)
          timeoutSeconds: 60,
        },
      },
    },
  },
}
```

### ツールパラメーター

- `url`（必須、http/https のみ）
- `extractMode`（`markdown` | `text`）
- `maxChars`（長いページを切り詰める）

注記:

- `web_fetch` は最初に Readability（主コンテンツ抽出）を使用し、その後 Firecrawl（設定されている場合）を使用します。両方が失敗した場合、ツールはエラーを返します。
- Firecrawl のリクエストは bot 回避モードを使用し、デフォルトで結果をキャッシュします。
- `web_fetch` は Chrome 風の User-Agent と `Accept-Language` をデフォルトで送信します。必要に応じて `userAgent` を上書きしてください。
- `web_fetch` はプライベート/内部ホスト名をブロックし、リダイレクトも再チェックします（`maxRedirects` で制限します）。
- `maxChars` は `tools.web.fetch.maxCharsCap` にクランプされます。
- `web_fetch` はベストエフォートの抽出です。サイトによってはブラウザツールが必要になります。
- キー設定とサービス詳細については、[Firecrawl](/tools/firecrawl) を参照してください。
- 繰り返しの fetch を減らすため、レスポンスはキャッシュされます（デフォルト 15 分）。
- ツールプロファイル/許可リストを使用している場合は、`web_search`/`web_fetch` または `group:web` を追加してください。
- Brave キーがない場合、`web_search` はドキュメントリンク付きの短いセットアップヒントを返します。
