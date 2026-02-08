---
summary: "OpenClaw における OAuth：トークン交換、保存、および複数アカウントのパターン"
read_when:
  - OpenClaw の OAuth をエンドツーエンドで理解したい場合
  - トークン無効化 / ログアウトの問題に遭遇した場合
  - setup-token または OAuth の認証フローが必要な場合
  - 複数アカウントまたはプロファイルルーティングが必要な場合
title: "OAuth"
x-i18n:
  source_path: concepts/oauth.md
  source_hash: af714bdadc4a8929
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:06:51Z
---

# OAuth

OpenClaw は、対応しているプロバイダー（特に **OpenAI Codex（ChatGPT OAuth）**）に対して、OAuth による「サブスクリプション認証」をサポートします。Anthropic のサブスクリプションについては、**setup-token** フローを使用してください。このページでは、次を説明します。

- OAuth の **トークン交換**（PKCE）の仕組み
- トークンが **保存** される場所（およびその理由）
- **複数アカウント** の扱い方（プロファイル + セッションごとの上書き）

OpenClaw は、独自の OAuth または API キーのフローを同梱する **プロバイダープラグイン** もサポートします。次で実行します。

```bash
openclaw models auth login --provider <id>
```

## トークンシンク（存在理由）

OAuth プロバイダーは、ログイン/リフレッシュフロー中に **新しいリフレッシュトークン** を発行することが一般的です。一部のプロバイダー（または OAuth クライアント）では、同一ユーザー/アプリに対して新しいトークンが発行されると、古いリフレッシュトークンが無効化される場合があります。

実際の症状:

- OpenClaw _と_ Claude Code / Codex CLI の両方でログインすると → どちらかが後でランダムに「ログアウト」される

これを軽減するために、OpenClaw は `auth-profiles.json` を **トークンシンク** として扱います。

- ランタイムは **1 か所** から認証情報を読み取ります
- 複数プロファイルを保持し、それらを決定的にルーティングできます

## 保存（トークンの保存場所）

シークレットは **エージェントごと** に保存されます。

- 認証プロファイル（OAuth + API キー）: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- ランタイムキャッシュ（自動管理。編集しないでください）: `~/.openclaw/agents/<agentId>/agent/auth.json`

レガシーのインポート専用ファイル（引き続きサポートされますが、メインの保存先ではありません）:

- `~/.openclaw/credentials/oauth.json`（初回使用時に `auth-profiles.json` にインポートされます）

上記はすべて `$OPENCLAW_STATE_DIR`（state ディレクトリ上書き）も尊重します。完全なリファレンス: [/gateway/configuration](/gateway/configuration#auth-storage-oauth--api-keys)

## Anthropic setup-token（サブスクリプション認証）

任意のマシンで `claude setup-token` を実行し、その後 OpenClaw に貼り付けます。

```bash
openclaw models auth setup-token --provider anthropic
```

別の場所でトークンを生成した場合は、手動で貼り付けてください。

```bash
openclaw models auth paste-token --provider anthropic
```

検証:

```bash
openclaw models status
```

## OAuth 交換（ログインの仕組み）

OpenClaw の対話型ログインフローは `@mariozechner/pi-ai` に実装され、ウィザード/コマンドに接続されています。

### Anthropic（Claude Pro/Max）setup-token

フローの形:

1. `claude setup-token` を実行します
2. トークンを OpenClaw に貼り付けます
3. トークン認証プロファイルとして保存します（リフレッシュなし）

ウィザードのパスは `openclaw onboard` → 認証の選択 `setup-token`（Anthropic）です。

### OpenAI Codex（ChatGPT OAuth）

フローの形（PKCE）:

1. PKCE の verifier/challenge + ランダムな `state` を生成します
2. `https://auth.openai.com/oauth/authorize?...` を開きます
3. `http://127.0.0.1:1455/auth/callback` でコールバックを捕捉しようとします
4. コールバックをバインドできない場合（またはリモート/ヘッドレスの場合）、リダイレクト URL/コードを貼り付けます
5. `https://auth.openai.com/oauth/token` で交換します
6. アクセストークンから `accountId` を抽出し、`{ access, refresh, expires, accountId }` を保存します

ウィザードのパスは `openclaw onboard` → 認証の選択 `openai-codex` です。

## リフレッシュ + 有効期限

プロファイルには `expires` タイムスタンプが保存されます。

実行時:

- `expires` が未来の場合 → 保存済みのアクセストークンを使用します
- 期限切れの場合 →（ファイルロック下で）リフレッシュし、保存済みの認証情報を上書きします

リフレッシュフローは自動です。通常、トークンを手動で管理する必要はありません。

## 複数アカウント（プロファイル）+ ルーティング

2 つのパターンがあります。

### 1) 推奨: エージェントを分ける

「個人」と「仕事」を決して相互作用させたくない場合は、分離されたエージェント（別々のセッション + 認証情報 + ワークスペース）を使用してください。

```bash
openclaw agents add work
openclaw agents add personal
```

その後、エージェントごとに認証を設定（ウィザード）し、適切なエージェントへチャットをルーティングします。

### 2) 上級: 1 つのエージェント内で複数プロファイル

`auth-profiles.json` は、同一プロバイダーに対して複数のプロファイル ID をサポートします。

使用するプロファイルの選択方法:

- 設定の順序によるグローバル指定（`auth.order`）
- `/model ...@<profileId>` によるセッション単位指定

例（セッション上書き）:

- `/model Opus@anthropic:work`

存在するプロファイル ID の確認方法:

- `openclaw channels list --json`（`auth[]` を表示します）

関連ドキュメント:

- [/concepts/model-failover](/concepts/model-failover)（ローテーション + クールダウンルール）
- [/tools/slash-commands](/tools/slash-commands)（コマンドサーフェス）
