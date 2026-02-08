---
summary: "どの要素が費用を発生させ得るか、どのキーが使用されているか、使用状況の確認方法を監査します"
read_when:
  - 有料 API を呼び出す可能性のある機能を理解したい場合
  - キー、コスト、使用状況の可視性を監査する必要がある場合
  - /status や /usage のコストレポートについて説明する場合
title: "API の使用状況とコスト"
x-i18n:
  source_path: reference/api-usage-costs.md
  source_hash: 807d0d88801e919a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:52Z
---

# API の使用状況とコスト

このドキュメントでは、**API キーを呼び出す可能性のある機能** と、そのコストがどこに表示されるかを一覧で示します。主に、
プロバイダーの使用量や有料 API 呼び出しを生成し得る OpenClaw の機能に焦点を当てます。

## コストが表示される場所（チャット + CLI）

**セッションごとのコストスナップショット**

- `/status` は、現在のセッションモデル、コンテキスト使用量、直近の応答トークンを表示します。
- モデルが **API キー認証** を使用している場合、`/status` は直近の返信の **推定コスト** も表示します。

**メッセージごとのコストフッター**

- `/usage full` は、**推定コスト**（API キー使用時のみ）を含む使用量フッターを各返信に追加します。
- `/usage tokens` はトークン数のみを表示します。OAuth フローでは金額コストは非表示になります。

**CLI の使用状況ウィンドウ（プロバイダーのクォータ）**

- `openclaw status --usage` と `openclaw channels list` は、プロバイダーの **使用状況ウィンドウ** を表示します
  （メッセージ単位のコストではなく、クォータのスナップショット）。

詳細と例については、[Token use & costs](/token-use) を参照してください。

## キーの検出方法

OpenClaw は、次の場所から認証情報を取得できます。

- **認証プロファイル**（エージェントごと。`auth-profiles.json` に保存）。
- **環境変数**（例：`OPENAI_API_KEY`、`BRAVE_API_KEY`、`FIRECRAWL_API_KEY`）。
- **設定**（`models.providers.*.apiKey`、`tools.web.search.*`、`tools.web.fetch.firecrawl.*`、
  `memorySearch.*`、`talk.apiKey`）。
- **Skills**（`skills.entries.<name>.apiKey`）。スキルのプロセス環境にキーをエクスポートする場合があります。

## キーを消費し得る機能

### 1) コアモデルの応答（チャット + ツール）

各返信やツール呼び出しは、**現在のモデルプロバイダー**（OpenAI、Anthropic など）を使用します。これは、
使用量とコストの主な発生源です。

価格設定については [Models](/providers/models)、表示については [Token use & costs](/token-use) を参照してください。

### 2) メディア理解（音声 / 画像 / 動画）

受信したメディアは、返信の実行前に要約や文字起こしが行われる場合があります。これはモデル / プロバイダー API を使用します。

- 音声：OpenAI / Groq / Deepgram（キーが存在する場合 **自動有効**）。
- 画像：OpenAI / Anthropic / Google。
- 動画：Google。

[Media understanding](/nodes/media-understanding) を参照してください。

### 3) メモリ埋め込み + セマンティック検索

セマンティックなメモリ検索は、リモートプロバイダー向けに設定されている場合 **埋め込み API** を使用します。

- `memorySearch.provider = "openai"` → OpenAI の埋め込み
- `memorySearch.provider = "gemini"` → Gemini の埋め込み
- ローカル埋め込みが失敗した場合の OpenAI への任意フォールバック

`memorySearch.provider = "local"` を使用するとローカルのままにできます（API 使用なし）。

[Memory](/concepts/memory) を参照してください。

### 4) Web 検索ツール（Brave / Perplexity via OpenRouter）

`web_search` は API キーを使用し、使用量課金が発生する場合があります。

- **Brave Search API**：`BRAVE_API_KEY` または `tools.web.search.apiKey`
- **Perplexity**（OpenRouter 経由）：`PERPLEXITY_API_KEY` または `OPENROUTER_API_KEY`

**Brave の無料枠（寛大）：**

- **月 2,000 リクエスト**
- **毎秒 1 リクエスト**
- 検証のため **クレジットカード必須**（アップグレードしない限り課金なし）

[Web tools](/tools/web) を参照してください。

### 5) Web 取得ツール（Firecrawl）

`web_fetch` は、API キーが存在する場合 **Firecrawl** を呼び出すことがあります。

- `FIRECRAWL_API_KEY` または `tools.web.fetch.firecrawl.apiKey`

Firecrawl が設定されていない場合、このツールは直接取得 + 可読化にフォールバックします（有料 API なし）。

[Web tools](/tools/web) を参照してください。

### 6) プロバイダー使用量スナップショット（ステータス / ヘルス）

一部のステータスコマンドは、クォータウィンドウや認証の健全性を表示するために **プロバイダーの使用量エンドポイント** を呼び出します。
通常は低頻度の呼び出しですが、プロバイダー API には到達します。

- `openclaw status --usage`
- `openclaw models status --json`

[Models CLI](/cli/models) を参照してください。

### 7) 圧縮セーフガードの要約

圧縮セーフガードは、**現在のモデル** を使用してセッション履歴を要約することがあり、
実行時にはプロバイダー API を呼び出します。

[Session management + compaction](/reference/session-management-compaction) を参照してください。

### 8) モデルスキャン / プローブ

`openclaw models scan` は OpenRouter のモデルをプローブでき、プローブが有効な場合は
`OPENROUTER_API_KEY` を使用します。

[Models CLI](/cli/models) を参照してください。

### 9) Talk（音声）

Talk モードは、設定されている場合 **ElevenLabs** を呼び出すことがあります。

- `ELEVENLABS_API_KEY` または `talk.apiKey`

[Talk mode](/nodes/talk) を参照してください。

### 10) Skills（サードパーティ API）

Skills は `apiKey` を `skills.entries.<name>.apiKey` に保存できます。スキルがそのキーを外部
API に使用する場合、スキルのプロバイダーに応じてコストが発生する可能性があります。

[Skills](/tools/skills) を参照してください。
