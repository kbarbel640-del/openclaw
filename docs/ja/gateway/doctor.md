---
summary: "Doctor コマンド：ヘルスチェック、設定移行、修復手順"
read_when:
  - Doctor の移行を追加または変更する場合
  - 破壊的な設定変更を導入する場合
title: "Doctor"
x-i18n:
  source_path: gateway/doctor.md
  source_hash: df7b25f60fd08d50
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:32:07Z
---

# Doctor

`openclaw doctor` は OpenClaw の修復 + 移行ツールです。古くなった
設定／状態を修正し、ヘルスチェックを行い、実行可能な修復手順を提供します。

## クイックスタート

```bash
openclaw doctor
```

### ヘッドレス／自動化

```bash
openclaw doctor --yes
```

（該当する場合）再起動／サービス／サンドボックスの修復手順を含め、既定値を確認なしで受け入れます。

```bash
openclaw doctor --repair
```

確認なしで推奨される修復を適用します（安全な場合の修復 + 再起動）。

```bash
openclaw doctor --repair --force
```

積極的な修復も適用します（カスタムのスーパーバイザー設定を上書きします）。

```bash
openclaw doctor --non-interactive
```

プロンプトなしで実行し、安全な移行のみを適用します（設定の正規化 + ディスク上の状態移動）。人の確認が必要な再起動／サービス／サンドボックスの操作はスキップします。
レガシー状態の移行は検出時に自動実行されます。

```bash
openclaw doctor --deep
```

システムサービスをスキャンし、追加の Gateway（ゲートウェイ）インストールを検出します（launchd/systemd/schtasks）。

書き込み前に変更内容を確認したい場合は、まず設定ファイルを開いてください：

```bash
cat ~/.openclaw/openclaw.json
```

## 実行内容（概要）

- git インストール向けの任意の事前更新（対話実行のみ）。
- UI プロトコルの新しさチェック（プロトコルスキーマが新しい場合は Control UI を再ビルド）。
- ヘルスチェック + 再起動の提案。
- Skills の状態サマリー（対象／不足／ブロック）。
- レガシー値に対する設定の正規化。
- OpenCode Zen プロバイダーのオーバーライド警告（`models.providers.opencode`）。
- レガシーなディスク上の状態移行（セッション／エージェントディレクトリ／WhatsApp 認証）。
- 状態の整合性と権限チェック（セッション、トランスクリプト、状態ディレクトリ）。
- ローカル実行時の設定ファイル権限チェック（chmod 600）。
- モデル認証の健全性：OAuth の有効期限を確認し、期限切れ間近のトークンを更新可能、認証プロファイルのクールダウン／無効化状態を報告。
- 追加のワークスペースディレクトリ検出（`~/openclaw`）。
- サンドボックス化が有効な場合のサンドボックスイメージ修復。
- レガシーサービスの移行と追加 Gateway 検出。
- Gateway（ゲートウェイ）実行時チェック（サービスはインストール済みだが未実行、キャッシュされた launchd ラベル）。
- チャンネル状態の警告（実行中の Gateway からプローブ）。
- スーパーバイザー設定の監査（launchd/systemd/schtasks）と任意の修復。
- Gateway 実行時のベストプラクティスチェック（Node vs Bun、バージョンマネージャーのパス）。
- Gateway ポート衝突の診断（既定 `18789`）。
- 開放的なダイレクトメッセージ（DM）ポリシーに対するセキュリティ警告。
- `gateway.auth.token` が未設定の場合の Gateway 認証警告（ローカルモード；トークン生成を提案）。
- Linux における systemd linger チェック。
- ソースインストールのチェック（pnpm ワークスペース不一致、UI アセット欠落、tsx バイナリ欠落）。
- 更新された設定 + ウィザードメタデータを書き込み。

## 詳細な動作と理由

### 0) 任意の更新（git インストール）

git チェックアウトで Doctor を対話的に実行している場合、Doctor 実行前に
更新（fetch/rebase/build）を提案します。

### 1) 設定の正規化

設定にレガシーな値の形（例：チャンネル固有のオーバーライドがない `messages.ackReaction`）が含まれている場合、Doctor は現在のスキーマに正規化します。

### 2) レガシー設定キーの移行

設定に非推奨キーが含まれている場合、他のコマンドは実行を拒否し、
`openclaw doctor` を実行するよう求めます。

Doctor は次を行います：

- 検出されたレガシーキーを説明します。
- 適用した移行内容を表示します。
- 更新されたスキーマで `~/.openclaw/openclaw.json` を書き換えます。

Gateway（ゲートウェイ）は、レガシーな設定形式を検出すると起動時に Doctor の移行を自動実行します。そのため、手動介入なしで古い設定が修復されます。

現在の移行内容：

- `routing.allowFrom` → `channels.whatsapp.allowFrom`
- `routing.groupChat.requireMention` → `channels.whatsapp/telegram/imessage.groups."*".requireMention`
- `routing.groupChat.historyLimit` → `messages.groupChat.historyLimit`
- `routing.groupChat.mentionPatterns` → `messages.groupChat.mentionPatterns`
- `routing.queue` → `messages.queue`
- `routing.bindings` → トップレベルの `bindings`
- `routing.agents`/`routing.defaultAgentId` → `agents.list` + `agents.list[].default`
- `routing.agentToAgent` → `tools.agentToAgent`
- `routing.transcribeAudio` → `tools.media.audio.models`
- `bindings[].match.accountID` → `bindings[].match.accountId`
- `identity` → `agents.list[].identity`
- `agent.*` → `agents.defaults` + `tools.*`（tools/elevated/exec/sandbox/subagents）
- `agent.model`/`allowedModels`/`modelAliases`/`modelFallbacks`/`imageModelFallbacks`
  → `agents.defaults.models` + `agents.defaults.model.primary/fallbacks` + `agents.defaults.imageModel.primary/fallbacks`

### 2b) OpenCode Zen プロバイダーのオーバーライド

`models.providers.opencode`（または `opencode-zen`）を手動で追加している場合、
`@mariozechner/pi-ai` にある組み込みの OpenCode Zen カタログを上書きします。
これにより、すべてのモデルが単一の API に強制されたり、コストが 0 になったりする可能性があります。Doctor は、オーバーライドを削除してモデルごとの API ルーティング + コストを復元できるよう警告します。

### 3) レガシー状態の移行（ディスクレイアウト）

Doctor は、古いディスク上のレイアウトを現在の構造に移行できます：

- セッションストア + トランスクリプト：
  - `~/.openclaw/sessions/` から `~/.openclaw/agents/<agentId>/sessions/` へ
- エージェントディレクトリ：
  - `~/.openclaw/agent/` から `~/.openclaw/agents/<agentId>/agent/` へ
- WhatsApp 認証状態（Baileys）：
  - レガシーな `~/.openclaw/credentials/*.json` から（`oauth.json` を除く）
  - `~/.openclaw/credentials/whatsapp/<accountId>/...` へ（既定のアカウント ID：`default`）

これらの移行はベストエフォートかつ冪等です。Doctor は、バックアップとしてレガシーフォルダーを残した場合に警告を出します。Gateway／CLI も起動時にレガシーなセッション + エージェントディレクトリを自動移行し、履歴／認証／モデルがエージェントごとのパスに配置されるようにします。WhatsApp 認証は、意図的に `openclaw doctor` 経由でのみ移行されます。

### 4) 状態の整合性チェック（セッション永続化、ルーティング、安全性）

状態ディレクトリは運用上の中枢です。消失すると、セッション、資格情報、ログ、設定（他にバックアップがない場合）を失います。

Doctor のチェック内容：

- **状態ディレクトリ欠落**：致命的な状態損失について警告し、ディレクトリの再作成を促し、失われたデータは復元できないことを注意喚起します。
- **状態ディレクトリの権限**：書き込み可能かを検証し、権限修復を提案します（所有者／グループ不一致が検出された場合は `chown` のヒントを表示）。
- **セッションディレクトリ欠落**：`sessions/` とセッションストアディレクトリは、履歴の永続化と `ENOENT` クラッシュ回避に必須です。
- **トランスクリプト不一致**：最近のセッションエントリにトランスクリプトファイルが欠落している場合に警告します。
- **メインセッションの「1 行 JSONL」**：メインのトランスクリプトが 1 行のみの場合（履歴が蓄積されていない）に警告します。
- **複数の状態ディレクトリ**：複数の `~/.openclaw` フォルダーがホームディレクトリ間に存在する場合、または `OPENCLAW_STATE_DIR` が別の場所を指している場合に警告します（履歴がインストール間で分断される可能性）。
- **リモートモードの注意**：`gateway.mode=remote` の場合、Doctor はリモートホストで実行するよう注意喚起します（状態はそこにあります）。
- **設定ファイル権限**：`~/.openclaw/openclaw.json` がグループ／ワールド可読の場合に警告し、`600` への厳格化を提案します。

### 5) モデル認証の健全性（OAuth の有効期限）

Doctor は認証ストア内の OAuth プロファイルを検査し、期限切れ間近／期限切れのトークンを警告し、安全な場合は更新できます。Anthropic Claude Code のプロファイルが古い場合、`claude setup-token` の実行（またはセットアップトークンの貼り付け）を提案します。更新のプロンプトは対話実行（TTY）の場合にのみ表示され、`--non-interactive` は更新試行をスキップします。

Doctor はまた、次の理由で一時的に使用不能な認証プロファイルを報告します：

- 短いクールダウン（レート制限／タイムアウト／認証失敗）
- 長期の無効化（請求／クレジット失敗）

### 6) Hooks モデル検証

`hooks.gmail.model` が設定されている場合、Doctor はモデル参照をカタログおよび許可リストに対して検証し、解決できない、または許可されていない場合に警告します。

### 7) サンドボックスイメージの修復

サンドボックス化が有効な場合、Doctor は Docker イメージをチェックし、現在のイメージが欠落している場合にビルドまたはレガシー名への切り替えを提案します。

### 8) Gateway サービスの移行とクリーンアップのヒント

Doctor はレガシーな Gateway サービス（launchd/systemd/schtasks）を検出し、削除して現在の Gateway ポートを使用する OpenClaw サービスをインストールすることを提案します。追加の Gateway らしきサービスをスキャンし、クリーンアップのヒントを表示することもできます。プロファイル名付きの OpenClaw Gateway サービスは第一級として扱われ、「追加」としてはフラグされません。

### 9) セキュリティ警告

Doctor は、プロバイダーが許可リストなしでダイレクトメッセージに開放されている場合、または危険な方法でポリシーが設定されている場合に警告を出します。

### 10) systemd linger（Linux）

systemd ユーザーサービスとして実行している場合、Doctor はログアウト後も Gateway が稼働し続けるよう linger が有効であることを確認します。

### 11) Skills の状態

Doctor は、現在のワークスペースに対する対象／不足／ブロックされた Skills の簡易サマリーを表示します。

### 12) Gateway 認証チェック（ローカルトークン）

Doctor は、ローカル Gateway で `gateway.auth` が欠落している場合に警告し、トークン生成を提案します。自動化では `openclaw doctor --generate-gateway-token` を使用してトークン作成を強制できます。

### 13) Gateway ヘルスチェック + 再起動

Doctor はヘルスチェックを実行し、不健全に見える場合は Gateway の再起動を提案します。

### 14) チャンネル状態の警告

Gateway が健全な場合、Doctor はチャンネル状態のプローブを実行し、推奨される修正とともに警告を報告します。

### 15) スーパーバイザー設定の監査 + 修復

Doctor は、インストール済みのスーパーバイザー設定（launchd/systemd/schtasks）をチェックし、欠落または古い既定値（例：systemd の network-online 依存関係や再起動遅延）を検出します。不一致が見つかった場合、更新を推奨し、サービスファイル／タスクを現在の既定値に書き換えることができます。

注意：

- `openclaw doctor` は、スーパーバイザー設定を書き換える前に確認します。
- `openclaw doctor --yes` は、既定の修復プロンプトを受け入れます。
- `openclaw doctor --repair` は、確認なしで推奨修正を適用します。
- `openclaw doctor --repair --force` は、カスタムのスーパーバイザー設定を上書きします。
- `openclaw gateway install --force` を使用して、いつでも完全な書き換えを強制できます。

### 16) Gateway 実行時 + ポート診断

Doctor はサービスの実行時情報（PID、最終終了ステータス）を検査し、サービスがインストールされているが実際には実行されていない場合に警告します。また、Gateway ポート（既定 `18789`）の衝突をチェックし、考えられる原因（Gateway が既に実行中、SSH トンネル）を報告します。

### 17) Gateway 実行時のベストプラクティス

Doctor は、Gateway サービスが Bun またはバージョンマネージャー管理の Node パス（`nvm`、`fnm`、`volta`、`asdf` など）で実行されている場合に警告します。WhatsApp + Telegram チャンネルには Node が必要で、バージョンマネージャーのパスは、サービスがシェル初期化を読み込まないため、アップグレード後に破損する可能性があります。Doctor は、利用可能な場合にシステム Node インストール（Homebrew/apt/choco）への移行を提案します。

### 18) 設定の書き込み + ウィザードメタデータ

Doctor は、設定変更を永続化し、Doctor 実行を記録するためにウィザードメタデータをスタンプします。

### 19) ワークスペースのヒント（バックアップ + メモリシステム）

Doctor は、欠落している場合にワークスペースのメモリシステムを提案し、ワークスペースがまだ git 管理下にない場合はバックアップのヒントを表示します。

ワークスペース構造と git バックアップ（推奨：非公開の GitHub または GitLab）についての完全なガイドは、[/concepts/agent-workspace](/concepts/agent-workspace) を参照してください。
