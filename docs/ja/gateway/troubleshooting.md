---
summary: "一般的な OpenClaw の障害に対するクイックトラブルシューティングガイド"
read_when:
  - 実行時の問題や障害を調査しているとき
title: "トラブルシューティング"
x-i18n:
  source_path: gateway/troubleshooting.md
  source_hash: a07bb06f0b5ef568
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:04Z
---

# トラブルシューティング 🔧

OpenClaw の動作がおかしい場合の対処方法をまとめています。

手早く切り分けたい場合は、FAQ の [最初の60秒](/help/faq#first-60-seconds-if-somethings-broken) から始めてください。このページでは、実行時の障害や診断について、より詳しく説明します。

プロバイダー別のショートカット: [/channels/troubleshooting](/channels/troubleshooting)

## ステータス & 診断

クイックトリアージ用コマンド（順番に実行）:

| Command                            | 何が分かるか                                                                                                                     | 使用するタイミング                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `openclaw status`                  | ローカル要約: OS + 更新状況、Gateway（ゲートウェイ）の到達性 / モード、サービス、エージェント / セッション、プロバイダー設定状態 | 最初の確認、全体像の把握                                     |
| `openclaw status --all`            | 完全なローカル診断（読み取り専用、貼り付け可能、比較的安全）＋ ログ末尾                                                          | デバッグレポートを共有する必要があるとき                     |
| `openclaw status --deep`           | Gateway（ゲートウェイ）のヘルスチェックを実行（プロバイダープローブを含む。到達可能な Gateway が必要）                           | 「設定済み」だが「動作していない」とき                       |
| `openclaw gateway probe`           | Gateway 検出 + 到達性（ローカル + リモートターゲット）                                                                           | 間違った Gateway をプローブしている疑いがあるとき            |
| `openclaw channels status --probe` | 実行中の Gateway にチャンネル状態を問い合わせ（任意でプローブ）                                                                  | Gateway には到達できるがチャンネルが不調なとき               |
| `openclaw gateway status`          | スーパーバイザー状態（launchd/systemd/schtasks）、実行時 PID / 終了コード、最後の Gateway エラー                                 | サービスが「読み込まれている」ように見えるが何も動かないとき |
| `openclaw logs --follow`           | ライブログ（実行時問題の最良のシグナル）                                                                                         | 実際の失敗理由が必要なとき                                   |

**出力を共有する場合:** トークンをマスクする `openclaw status --all` を推奨します。`openclaw status` を貼り付ける場合は、事前に `OPENCLAW_SHOW_SECRETS=0`（トークンプレビュー）を設定してください。

関連情報: [Health checks](/gateway/health)、[Logging](/logging)

## 一般的な問題

### プロバイダー「anthropic」の API キーが見つかりません

これは **エージェントの認証ストアが空**、または Anthropic の認証情報が欠落していることを意味します。  
認証は **エージェントごと** なので、新しいエージェントはメインエージェントのキーを継承しません。

対処方法:

- オンボーディングを再実行し、そのエージェントで **Anthropic** を選択する。
- または、**Gateway ホスト** 上でセットアップトークンを貼り付ける:
  ```bash
  openclaw models auth setup-token --provider anthropic
  ```
- または、メインエージェントのディレクトリから新しいエージェントのディレクトリへ `auth-profiles.json` をコピーする。

確認:

```bash
openclaw models status
```

### OAuth トークンの更新に失敗しました（Anthropic Claude サブスクリプション）

保存されている Anthropic の OAuth トークンが期限切れとなり、更新に失敗したことを意味します。  
Claude サブスクリプション（API キーなし）を使用している場合、最も確実な対処は **Claude Code のセットアップトークン** に切り替え、**Gateway ホスト** に貼り付けることです。

**推奨（セットアップトークン）:**

```bash
# Run on the gateway host (paste the setup-token)
openclaw models auth setup-token --provider anthropic
openclaw models status
```

別の場所でトークンを生成した場合:

```bash
openclaw models auth paste-token --provider anthropic
openclaw models status
```

詳細: [Anthropic](/providers/anthropic)、[OAuth](/concepts/oauth)

### Control UI が HTTP で失敗する（「device identity required」/「connect failed」）

ダッシュボードを平文 HTTP（例: `http://<lan-ip>:18789/` や  
`http://<tailscale-ip>:18789/`）で開くと、ブラウザは **非セキュアコンテキスト** で動作し、WebCrypto がブロックされるため、デバイス ID を生成できません。

**対処方法:**

- [Tailscale Serve](/gateway/tailscale) による HTTPS を使用する。
- または、Gateway ホスト上でローカルに開く: `http://127.0.0.1:18789/`。
- HTTP のままにする必要がある場合は、`gateway.controlUi.allowInsecureAuth: true` を有効化し、
  Gateway トークン（トークンのみ。デバイス ID / ペアリングなし）を使用してください。  
  詳細は [Control UI](/web/control-ui#insecure-http) を参照してください。

### CI Secrets Scan Failed

`detect-secrets` が、まだベースラインに含まれていない新しい候補を検出したことを意味します。  
[Secret scanning](/gateway/security#secret-scanning-detect-secrets) に従って対応してください。

### サービスはインストールされているが、何も実行されていない

Gateway サービスがインストールされていても、プロセスが即座に終了すると、サービスが「ロード済み」に見えても実際には何も動作していない場合があります。

**確認:**

```bash
openclaw gateway status
openclaw doctor
```

Doctor / サービス情報に、実行時状態（PID / 最後の終了）やログのヒントが表示されます。

**ログ:**

- 推奨: `openclaw logs --follow`
- ファイルログ（常に有効）: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`（または設定済みの `logging.file`）
- macOS LaunchAgent（インストール済みの場合）: `$OPENCLAW_STATE_DIR/logs/gateway.log` および `gateway.err.log`
- Linux systemd（インストール済みの場合）: `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`
- Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST`

**ログ量を増やす:**

- ファイルログ詳細度を上げる（永続化された JSONL）:
  ```json
  { "logging": { "level": "debug" } }
  ```
- コンソールの冗長度を上げる（TTY 出力のみ）:
  ```json
  { "logging": { "consoleLevel": "debug", "consoleStyle": "pretty" } }
  ```
- ヒント: `--verbose` は **コンソール** 出力のみに影響します。ファイルログは引き続き `logging.level` で制御されます。

形式、設定、アクセス方法の全体像は [/logging](/logging) を参照してください。

### 「Gateway start blocked: set gateway.mode=local」

設定ファイルは存在しますが、`gateway.mode` が未設定（または `local` ではない）ため、Gateway が起動を拒否しています。

**対処（推奨）:**

- ウィザードを実行し、Gateway の実行モードを **Local** に設定する:
  ```bash
  openclaw configure
  ```
- または、直接設定する:
  ```bash
  openclaw config set gateway.mode local
  ```

**リモート Gateway を実行する意図だった場合:**

- リモート URL を設定し、`gateway.mode=remote` を維持する:
  ```bash
  openclaw config set gateway.mode remote
  openclaw config set gateway.remote.url "wss://gateway.example.com"
  ```

**アドホック / 開発用途のみ:**  
`--allow-unconfigured` を渡して、`gateway.mode=local` なしで Gateway を起動します。

**まだ設定ファイルがない場合:**  
`openclaw setup` を実行してスターター設定を作成し、その後 Gateway を再実行してください。

### サービス環境（PATH + ランタイム）

Gateway サービスは、シェルやマネージャー由来の不要要素を避けるため、**最小限の PATH** で実行されます。

- macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
- Linux: `/usr/local/bin`, `/usr/bin`, `/bin`

これは意図的なもので、サービスはシェル初期化を読み込まないため、バージョンマネージャー（nvm/fnm/volta/asdf）やパッケージマネージャー（pnpm/npm）は含まれません。  
`DISPLAY` のようなランタイム変数は、`~/.openclaw/.env` に配置してください（Gateway により早期に読み込まれます）。

Exec は `host=gateway` 上で実行され、ログインシェルの `PATH` を実行環境にマージします。そのため、ツールが見つからない場合は、シェル初期化で export されていない（または `tools.exec.pathPrepend` を設定していない）ことが原因です。  
詳細は [/tools/exec](/tools/exec) を参照してください。

WhatsApp + Telegram チャンネルは **Node** を必要とします。Bun は未対応です。  
サービスが Bun やバージョン管理された Node パスでインストールされている場合は、`openclaw doctor` を実行してシステム Node インストールへ移行してください。

### サンドボックスで Skill の API キーが見つからない

**症状:** ホストでは Skill が動作するが、サンドボックスでは API キー不足で失敗する。

**理由:** サンドボックス化された exec は Docker 内で実行され、ホストの `process.env` を継承しません。

**対処:**

- `agents.defaults.sandbox.docker.env`（またはエージェントごとの `agents.list[].sandbox.docker.env`）を設定する。
- または、カスタムサンドボックスイメージにキーを組み込む。
- その後、`openclaw sandbox recreate --agent <id>`（または `--all`）を実行する。

### サービスは実行中だが、ポートがリッスンしていない

サービスが **実行中** と表示されているのに Gateway ポートで待ち受けていない場合、Gateway がバインドを拒否している可能性があります。

**ここでの「実行中」の意味**

- `Runtime: running` は、スーパーバイザー（launchd/systemd/schtasks）がプロセスを生存と判断していることを意味します。
- `RPC probe` は、CLI が実際に Gateway WebSocket に接続し、`status` を呼び出せたことを意味します。
- 常に `Probe target:` + `Config (service):` の行を信頼してください。これらが「実際に何を試みたか」を示します。

**確認:**

- `gateway.mode` は、`openclaw gateway` およびサービスに対して `local` である必要があります。
- `gateway.mode=remote` を設定している場合、**CLI のデフォルト** はリモート URL になります。サービスはローカルで動作していても、CLI が誤った場所をプローブしている可能性があります。`openclaw gateway status` を使用して、サービスの解決済みポート + プローブ先を確認してください（または `--url` を指定します）。
- `openclaw gateway status` と `openclaw doctor` は、サービスが実行中に見えるがポートが閉じている場合の **最後の Gateway エラー** をログから表示します。
- 非ループバックでのバインド（`lan`/`tailnet`/`custom`、または loopback が利用不可の場合の `auto`）には認証が必要です:
  `gateway.auth.token`（または `OPENCLAW_GATEWAY_TOKEN`）。
- `gateway.remote.token` はリモート CLI 呼び出し専用で、ローカル認証は有効化しません。
- `gateway.token` は無視されます。`gateway.auth.token` を使用してください。

**`openclaw gateway status` が設定不一致を示す場合**

- 通常、`Config (cli): ...` と `Config (service): ...` は一致しているべきです。
- 一致しない場合、ほぼ確実に、サービスが使用している設定とは別の設定を編集しています。
- 対処: サービスに使用させたい同じ `--profile` / `OPENCLAW_STATE_DIR` から `openclaw gateway install --force` を再実行してください。

**`openclaw gateway status` がサービス設定の問題を報告する場合**

- スーパーバイザー設定（launchd/systemd/schtasks）に、最新のデフォルトが反映されていません。
- 対処: `openclaw doctor` を実行して更新します（または完全に書き直す場合は `openclaw gateway install --force`）。

**`Last gateway error:` に「refusing to bind … without auth」と表示される場合**

- `gateway.bind` を非ループバックモード（`lan`/`tailnet`/`custom`、または loopback が利用不可時の `auto`）に設定したが、認証を構成していません。
- 対処: `gateway.auth.mode` + `gateway.auth.token` を設定する（または `OPENCLAW_GATEWAY_TOKEN` を export する）うえで、サービスを再起動してください。

**`openclaw gateway status` が `bind=tailnet` と表示するが、tailnet インターフェースが見つからない場合**

- Gateway が Tailscale IP（100.64.0.0/10）にバインドしようとしましたが、ホスト上で検出されませんでした。
- 対処: そのマシンで Tailscale を起動するか、`gateway.bind` を `loopback`/`lan` に変更してください。

**`Probe note:` がプローブが loopback を使用していると示す場合**

- `bind=lan` では想定どおりです。Gateway は `0.0.0.0`（全インターフェース）で待ち受け、ローカルでは loopback 接続が可能です。
- リモートクライアントでは、実際の LAN IP（`0.0.0.0` ではない）とポートを使用し、認証が設定されていることを確認してください。

### アドレスは既に使用中です（ポート 18789）

Gateway ポートで既に何かが待ち受けています。

**確認:**

```bash
openclaw gateway status
```

リスナーと考えられる原因（Gateway が既に実行中、SSH トンネルなど）が表示されます。必要に応じて、サービスを停止するか、別のポートを選択してください。

### 余分なワークスペースフォルダーが検出されました

古いインストールからアップグレードした場合、ディスク上に `~/openclaw` が残っていることがあります。  
複数のワークスペースディレクトリがあると、認証や状態が混乱する原因になります（アクティブなのは 1 つだけです）。

**対処:** 単一のアクティブなワークスペースのみを残し、他はアーカイブまたは削除してください。  
[Agent workspace](/concepts/agent-workspace#extra-workspace-folders) を参照してください。

### メインチャットがサンドボックスワークスペースで実行されている

症状: `pwd` やファイルツールが、ホストワークスペースを想定しているにもかかわらず `~/.openclaw/sandboxes/...` を表示します。

**理由:** `agents.defaults.sandbox.mode: "non-main"` は `session.mainKey`（デフォルト `"main"`）を基準にします。  
グループ / チャンネルセッションは独自のキーを使用するため、メインではないと扱われ、サンドボックスワークスペースが割り当てられます。

**対処オプション:**

- エージェントでホストワークスペースを使用したい場合: `agents.list[].sandbox.mode: "off"` を設定する。
- サンドボックス内でホストワークスペースにアクセスしたい場合: そのエージェントに `workspaceAccess: "rw"` を設定する。

### 「Agent was aborted」

エージェントが応答途中で中断されました。

**原因:**

- ユーザーが `stop`、`abort`、`esc`、`wait`、または `exit` を送信した。
- タイムアウト超過。
- プロセスがクラッシュした。

**対処:** もう一度メッセージを送信してください。セッションは継続しています。

### 「Agent failed before reply: Unknown model: anthropic/claude-haiku-3-5」

OpenClaw は、**古い / 安全でないモデル**（特にプロンプトインジェクションに脆弱なもの）を意図的に拒否します。  
このエラーが表示される場合、そのモデル名はサポートされなくなっています。

**対処:**

- プロバイダーの **最新** モデルを選択し、設定またはモデルエイリアスを更新してください。
- 利用可能なモデルが不明な場合は、`openclaw models list` または
  `openclaw models scan` を実行し、サポートされているものを選択してください。
- 詳細な失敗理由については Gateway ログを確認してください。

関連情報: [Models CLI](/cli/models)、[Model providers](/concepts/model-providers)

### メッセージがトリガーされない

**チェック 1:** 送信者は allowlist に含まれていますか？

```bash
openclaw status
```

出力内の `AllowFrom: ...` を確認してください。

**チェック 2:** グループチャットではメンションが必須ですか？

```bash
# The message must match mentionPatterns or explicit mentions; defaults live in channel groups/guilds.
# Multi-agent: `agents.list[].groupChat.mentionPatterns` overrides global patterns.
grep -n "agents\\|groupChat\\|mentionPatterns\\|channels\\.whatsapp\\.groups\\|channels\\.telegram\\.groups\\|channels\\.imessage\\.groups\\|channels\\.discord\\.guilds" \
  "${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
```

**チェック 3:** ログを確認する

```bash
openclaw logs --follow
# or if you want quick filters:
tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | grep "blocked\\|skip\\|unauthorized"
```

### ペアリングコードが届かない

`dmPolicy` が `pairing` の場合、未承認の送信者にはコードが送信され、承認されるまでメッセージは無視されます。

**チェック 1:** 既に保留中のリクエストはありませんか？

```bash
openclaw pairing list <channel>
```

保留中の DM ペアリングリクエストは、デフォルトで **チャンネルあたり 3 件** に制限されています。リストが満杯の場合、いずれかが承認または期限切れになるまで、新しいコードは生成されません。

**チェック 2:** リクエストは作成されたが、返信が送信されていませんか？

```bash
openclaw logs --follow | grep "pairing request"
```

**チェック 3:** そのチャンネルで `dmPolicy` が `open`/`allowlist` になっていないことを確認してください。

### 画像 + メンションが機能しない

既知の問題: テキストなしで **メンションのみ** を付けて画像を送信すると、WhatsApp がメンションのメタデータを含めない場合があります。

**回避策:** メンションと一緒にテキストを追加してください。

- ❌ `@openclaw` + 画像
- ✅ `@openclaw check this` + 画像

### セッションが再開されない

**チェック 1:** セッションファイルは存在しますか？

```bash
ls -la ~/.openclaw/agents/<agentId>/sessions/
```

**チェック 2:** リセットウィンドウが短すぎませんか？

```json
{
  "session": {
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080 // 7 days
    }
  }
}
```

**チェック 3:** 誰かが `/new`、`/reset`、またはリセットトリガーを送信していませんか？

### エージェントがタイムアウトする

デフォルトのタイムアウトは 30 分です。長時間タスクの場合:

```json
{
  "reply": {
    "timeoutSeconds": 3600 // 1 hour
  }
}
```

または、`process` ツールを使用して長いコマンドをバックグラウンド実行してください。

### WhatsApp が切断される

```bash
# Check local status (creds, sessions, queued events)
openclaw status
# Probe the running gateway + channels (WA connect + Telegram + Discord APIs)
openclaw status --deep

# View recent connection events
openclaw logs --limit 200 | grep "connection\\|disconnect\\|logout"
```

**対処:** 通常は Gateway が起動していれば自動的に再接続されます。解消しない場合は、Gateway プロセスを再起動（使用しているスーパーバイザーに応じて）するか、詳細出力付きで手動実行してください。

```bash
openclaw gateway --verbose
```

ログアウト / 連携解除されている場合:

```bash
openclaw channels logout
trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/credentials" # if logout can't cleanly remove everything
openclaw channels login --verbose       # re-scan QR
```

### メディア送信が失敗する

**チェック 1:** ファイルパスは有効ですか？

```bash
ls -la /path/to/your/image.jpg
```

**チェック 2:** サイズが大きすぎませんか？

- 画像: 最大 6MB
- 音声 / 動画: 最大 16MB
- ドキュメント: 最大 100MB

**チェック 3:** メディアログを確認する

```bash
grep "media\\|fetch\\|download" "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | tail -20
```

### メモリ使用量が高い

OpenClaw は会話履歴をメモリに保持します。

**対処:** 定期的に再起動するか、セッション制限を設定してください。

```json
{
  "session": {
    "historyLimit": 100 // Max messages to keep
  }
}
```

## 一般的なトラブルシューティング

### 「Gateway が起動しない — 設定が無効」

現在の OpenClaw は、設定に未知のキー、不正な値、または無効な型が含まれている場合、起動を拒否します。  
これは安全性のための意図的な挙動です。

Doctor で修正してください:

```bash
openclaw doctor
openclaw doctor --fix
```

補足:

- `openclaw doctor` は、すべての無効なエントリを報告します。
- `openclaw doctor --fix` は、マイグレーション / 修復を適用し、設定を書き換えます。
- `openclaw logs`、`openclaw health`、`openclaw status`、`openclaw gateway status`、`openclaw gateway probe` のような診断コマンドは、設定が無効でも実行可能です。

### 「All models failed」— 最初に確認すべきこと

- 試行しているプロバイダーの **認証情報** が存在するか（認証プロファイル + 環境変数）。
- **モデルルーティング**: `agents.defaults.model.primary` とフォールバックが、アクセス可能なモデルか確認する。
- **Gateway ログ**（`/tmp/openclaw/…`）で、正確なプロバイダーエラーを確認する。
- **モデル状態**: `/model status`（チャット）または `openclaw models status`（CLI）を使用する。

### 個人の WhatsApp 番号で実行している — セルフチャットが変なのはなぜ？

セルフチャットモードを有効化し、自分の番号を allowlist に追加してください。

```json5
{
  channels: {
    whatsapp: {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: ["+15555550123"],
    },
  },
}
```

詳細は [WhatsApp setup](/channels/whatsapp) を参照してください。

### WhatsApp からログアウトされました。再認証するには？

ログインコマンドを再実行し、QR コードをスキャンしてください。

```bash
openclaw channels login
```

### `main` でのビルドエラー — 標準的な解決手順は？

1. `git pull origin main && pnpm install`
2. `openclaw doctor`
3. GitHub の issues や Discord を確認する
4. 一時的な回避策: 古いコミットをチェックアウトする

### npm install が失敗する（allow-build-scripts / tar や yargs がない）。どうすれば？

ソースから実行している場合は、リポジトリ指定のパッケージマネージャー **pnpm**（推奨）を使用してください。  
このリポジトリは `packageManager: "pnpm@…"` を宣言しています。

一般的な復旧手順:

```bash
git status   # ensure you’re in the repo root
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

理由: pnpm はこのリポジトリで設定されているパッケージマネージャーです。

### git インストールと npm インストールを切り替えるには？

**Web サイトインストーラー** を使用し、フラグでインストール方法を選択します。  
既存環境をそのままアップグレードし、Gateway サービスを新しいインストール先に書き換えます。

**git インストールへ切り替え:**

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
```

**npm グローバルへ切り替え:**

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

補足:

- git フローは、リポジトリがクリーンな場合のみ rebase します。事前に commit または stash してください。
- 切り替え後、次を実行してください:
  ```bash
  openclaw doctor
  openclaw gateway restart
  ```

### Telegram のブロックストリーミングで、ツール呼び出し間にテキストが分割されないのはなぜ？

ブロックストリーミングは、**完了したテキストブロックのみ** を送信します。単一メッセージになる一般的な理由:

- `agents.defaults.blockStreamingDefault` がまだ `"off"`。
- `channels.telegram.blockStreaming` が `false` に設定されている。
- `channels.telegram.streamMode` が `partial` または `block` で、**ドラフトストリーミングが有効**  
  （プライベートチャット + トピック）。この場合、ドラフトストリーミングはブロックストリーミングを無効化します。
- `minChars` / coalesce 設定が高すぎて、チャンクが結合されている。
- モデルが 1 つの大きなテキストブロックを出力している（途中フラッシュポイントがない）。

対処チェックリスト:

1. ブロックストリーミング設定は、ルートではなく `agents.defaults` 配下に配置する。
2. 実際に複数メッセージのブロック返信が必要な場合は `channels.telegram.streamMode: "off"` を設定する。
3. デバッグ中は、チャンク / coalesce のしきい値を小さくする。

関連情報: [Streaming](/concepts/streaming)

### `requireMention: false` を設定しているのに、Discord サーバーで返信しないのはなぜ？

`requireMention` は、チャンネルが allowlist を通過した **後** のメンション制御のみを行います。  
デフォルトでは `channels.discord.groupPolicy` は **allowlist** のため、ギルドは明示的に有効化する必要があります。  
`channels.discord.guilds.<guildId>.channels` を設定すると、リストされたチャンネルのみが許可されます。ギルド内のすべてのチャンネルを許可する場合は省略してください。

対処チェックリスト:

1. `channels.discord.groupPolicy: "open"` を設定する **または** ギルドの allowlist エントリを追加する（必要に応じてチャンネル allowlist も）。
2. `channels.discord.guilds.<guildId>.channels` には **数値のチャンネル ID** を使用する。
3. `requireMention: false` は、`channels.discord.guilds` 配下（グローバルまたはチャンネルごと）に配置する。  
   トップレベルの `channels.discord.requireMention` はサポートされていません。
4. Bot に **Message Content Intent** とチャンネル権限があることを確認する。
5. 監査ヒントとして `openclaw channels status --probe` を実行する。

ドキュメント: [Discord](/channels/discord)、[Channels troubleshooting](/channels/troubleshooting)

### Cloud Code Assist API エラー: 無効なツールスキーマ（400）。どうすれば？

これはほぼ常に **ツールスキーマの互換性** の問題です。  
Cloud Code Assist エンドポイントは JSON Schema の厳密なサブセットのみを受け付けます。OpenClaw は現行の `main` でツールスキーマのスクラブ / 正規化を行いますが、この修正はまだ最新リリースには含まれていません（2026 年 1 月 13 日時点）。

対処チェックリスト:

1. **OpenClaw を更新する**:
   - ソースから実行できる場合は、`main` を pull して Gateway を再起動する。
   - そうでない場合は、スキーマスクラバーを含む次回リリースを待つ。
2. `anyOf/oneOf/allOf`、`patternProperties`、`additionalProperties`、`minLength`、`maxLength`、`format` など、未対応のキーワードを避ける。
3. カスタムツールを定義する場合は、トップレベルのスキーマを `type: "object"` とし、`properties` とシンプルな enum を使用する。

関連情報: [Tools](/tools)、[TypeBox schemas](/concepts/typebox)

## macOS 固有の問題

### 権限付与時にアプリがクラッシュする（音声 / マイク）

プライバシーの許可ダイアログで「許可」をクリックした際に、アプリが消える、または「Abort trap 6」が表示される場合:

**対処 1: TCC キャッシュをリセット**

```bash
tccutil reset All bot.molt.mac.debug
```

**対処 2: 新しい Bundle ID を強制する**  
リセットしても解消しない場合は、[`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) 内の `BUNDLE_ID` を変更（例: `.test` のサフィックスを追加）して再ビルドしてください。これにより macOS は新しいアプリとして扱います。

### Gateway が「Starting...」のままになる

アプリはローカルの Gateway（ポート `18789`）に接続します。停止したままの場合:

**対処 1: スーパーバイザーを停止する（推奨）**  
Gateway が launchd により管理されている場合、PID を kill しても自動的に再起動されます。先にスーパーバイザーを停止してください。

```bash
openclaw gateway status
openclaw gateway stop
# Or: launchctl bootout gui/$UID/bot.molt.gateway (replace with bot.molt.<profile>; legacy com.openclaw.* still works)
```

**対処 2: ポートが使用中（リスナーを特定）**

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

非管理プロセスの場合は、まず正常停止を試み、それでもだめなら強制します。

```bash
kill -TERM <PID>
sleep 1
kill -9 <PID> # last resort
```

**対処 3: CLI インストールを確認する**  
グローバルの `openclaw` CLI がインストールされており、アプリのバージョンと一致していることを確認してください。

```bash
openclaw --version
npm install -g openclaw@<version>
```

## デバッグモード

詳細ログを取得します:

```bash
# Turn on trace logging in config:
#   ${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json} -> { logging: { level: "trace" } }
#
# Then run verbose commands to mirror debug output to stdout:
openclaw gateway --verbose
openclaw channels login --verbose
```

## ログの場所

| ログ                                     | 場所                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway ファイルログ（構造化）           | `/tmp/openclaw/openclaw-YYYY-MM-DD.log`（または `logging.file`）                                                                                                                                                                                                                                                                    |
| Gateway サービスログ（スーパーバイザー） | macOS: `$OPENCLAW_STATE_DIR/logs/gateway.log` + `gateway.err.log`（デフォルト: `~/.openclaw/logs/...`。プロファイルでは `~/.openclaw-<profile>/logs/...`）<br />Linux: `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`<br />Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST` |
| セッションファイル                       | `$OPENCLAW_STATE_DIR/agents/<agentId>/sessions/`                                                                                                                                                                                                                                                                                    |
| メディアキャッシュ                       | `$OPENCLAW_STATE_DIR/media/`                                                                                                                                                                                                                                                                                                        |
| 認証情報                                 | `$OPENCLAW_STATE_DIR/credentials/`                                                                                                                                                                                                                                                                                                  |

## ヘルスチェック

```bash
# Supervisor + probe target + config paths
openclaw gateway status
# Include system-level scans (legacy/extra services, port listeners)
openclaw gateway status --deep

# Is the gateway reachable?
openclaw health --json
# If it fails, rerun with connection details:
openclaw health --verbose

# Is something listening on the default port?
lsof -nP -iTCP:18789 -sTCP:LISTEN

# Recent activity (RPC log tail)
openclaw logs --follow
# Fallback if RPC is down
tail -20 /tmp/openclaw/openclaw-*.log
```

## すべてをリセット

最終手段:

```bash
openclaw gateway stop
# If you installed a service and want a clean install:
# openclaw gateway uninstall

trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
openclaw channels login         # re-pair WhatsApp
openclaw gateway restart           # or: openclaw gateway
```

⚠️ すべてのセッションが失われ、WhatsApp の再ペアリングが必要になります。

## サポートを受けるには

1. まずログを確認: `/tmp/openclaw/`（デフォルト: `openclaw-YYYY-MM-DD.log`、または設定済みの `logging.file`）
2. GitHub の既存 issue を検索する
3. 新しい issue を作成し、以下を含める:
   - OpenClaw のバージョン
   - 関連するログ抜粋
   - 再現手順
   - 設定ファイル（機密情報はマスクしてください）

---

_「電源を切って入れ直しましたか？」_ — すべての IT 担当者より

🦞🔧

### ブラウザーが起動しない（Linux）

`"Failed to start Chrome CDP on port 18800"` が表示される場合:

**最も可能性の高い原因:** Ubuntu 上の Snap 版 Chromium。

**クイック対処:** Google Chrome をインストールしてください。

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

その後、設定で次を指定します:

```json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

**完全ガイド:** [browser-linux-troubleshooting](/tools/browser-linux-troubleshooting) を参照してください。
