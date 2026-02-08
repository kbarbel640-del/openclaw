---
summary: "モデル認証: OAuth、API キー、setup-token"
read_when:
  - モデル認証または OAuth の有効期限切れをデバッグしているとき
  - 認証または認証情報の保存を文書化するとき
title: "認証"
x-i18n:
  source_path: gateway/authentication.md
  source_hash: 66fa2c64ff374c9c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:20:12Z
---

# 認証

OpenClaw は、モデルプロバイダー向けに OAuth と API キーをサポートしています。Anthropic アカウントについては、**API キー**の使用を推奨します。Claude サブスクリプションでのアクセスには、`claude setup-token` によって作成される長期有効トークンを使用してください。

OAuth の完全なフローと保存レイアウトについては、[/concepts/oauth](/concepts/oauth) を参照してください。

## 推奨される Anthropic のセットアップ（API キー）

Anthropic を直接使用している場合は、API キーを使用します。

1. Anthropic Console で API キーを作成します。
2. **Gateway（ゲートウェイ）ホスト**（`openclaw gateway` を実行しているマシン）に設定します。

```bash
export ANTHROPIC_API_KEY="..."
openclaw models status
```

3. Gateway（ゲートウェイ）が systemd/launchd 配下で動作している場合は、デーモンが読み取れるように、キーを `~/.openclaw/.env` に置くことを優先してください。

```bash
cat >> ~/.openclaw/.env <<'EOF'
ANTHROPIC_API_KEY=...
EOF
```

その後、デーモン（または Gateway（ゲートウェイ）プロセス）を再起動して、再確認します。

```bash
openclaw models status
openclaw doctor
```

環境変数を自分で管理したくない場合、オンボーディングウィザードでデーモン利用向けに API キーを保存できます: `openclaw onboard`。

環境変数の継承（`env.shellEnv`、`~/.openclaw/.env`、systemd/launchd）の詳細は、[Help](/help) を参照してください。

## Anthropic: setup-token（サブスクリプション認証）

Anthropic では、推奨される経路は **API キー**です。Claude サブスクリプションを使用している場合は、setup-token フローもサポートされています。**Gateway（ゲートウェイ）ホスト**で実行してください。

```bash
claude setup-token
```

次に、それを OpenClaw に貼り付けます。

```bash
openclaw models auth setup-token --provider anthropic
```

トークンが別のマシンで作成された場合は、手動で貼り付けてください。

```bash
openclaw models auth paste-token --provider anthropic
```

次のような Anthropic エラーが表示される場合:

```
This credential is only authorized for use with Claude Code and cannot be used for other API requests.
```

…代わりに Anthropic の API キーを使用してください。

手動トークン入力（任意のプロバイダー; `auth-profiles.json` に書き込み + 設定を更新）:

```bash
openclaw models auth paste-token --provider anthropic
openclaw models auth paste-token --provider openrouter
```

自動化に適したチェック（期限切れ/欠落時は `1` で終了、期限が近い場合は `2`）:

```bash
openclaw models status --check
```

任意の ops スクリプト（systemd/Termux）はこちらに文書化されています:
[/automation/auth-monitoring](/automation/auth-monitoring)

> `claude setup-token` には対話的な TTY が必要です。

## モデル認証ステータスの確認

```bash
openclaw models status
openclaw doctor
```

## 使用する認証情報の制御

### セッションごと（チャットコマンド）

現在のセッションに対して特定のプロバイダー認証情報を固定するには、`/model <alias-or-id>@<profileId>` を使用します（プロファイル id の例: `anthropic:default`、`anthropic:work`）。

コンパクトなピッカーには `/model`（または `/model list`）を使用し、完全表示には `/model status` を使用します（候補 + 次の認証プロファイル。さらに、設定されている場合はプロバイダーのエンドポイント詳細も表示します）。

### エージェントごと（CLI オーバーライド）

エージェントに対して明示的な認証プロファイル順序のオーバーライドを設定します（そのエージェントの `auth-profiles.json` に保存されます）。

```bash
openclaw models auth order get --provider anthropic
openclaw models auth order set --provider anthropic anthropic:default
openclaw models auth order clear --provider anthropic
```

特定のエージェントを対象にするには `--agent <id>` を使用します。省略すると、設定済みのデフォルトエージェントが使用されます。

## トラブルシューティング

### 「認証情報が見つかりません」

Anthropic のトークンプロファイルが欠落している場合は、**Gateway（ゲートウェイ）ホスト**で `claude setup-token` を実行し、その後に再確認してください。

```bash
openclaw models status
```

### トークンの期限が近い/期限切れ

どのプロファイルの期限が近いかを確認するために、`openclaw models status` を実行します。プロファイルが欠落している場合は、`claude setup-token` を再実行して、トークンをもう一度貼り付けてください。

## 要件

- Claude Max または Pro サブスクリプション（`claude setup-token` 向け）
- Claude Code CLI がインストールされていること（`claude` コマンドが利用可能）
