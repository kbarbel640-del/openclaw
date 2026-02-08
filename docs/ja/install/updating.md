---
summary: "OpenClaw を安全に更新する方法（グローバルインストールまたはソース）、およびロールバック戦略"
read_when:
  - OpenClaw を更新する場合
  - 更新後に問題が発生した場合
title: "更新"
x-i18n:
  source_path: install/updating.md
  source_hash: 38cccac0839f0f22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:16Z
---

# 更新

OpenClaw は高速に進化しています（プレ「1.0」）。更新はインフラをデプロイするのと同様に扱ってください：更新 → チェック実行 → 再起動（または再起動を行う `openclaw update` を使用） → 検証。

## 推奨：Web サイトのインストーラーを再実行（インプレースアップグレード）

**推奨** の更新手順は、Web サイトのインストーラーを再実行することです。既存のインストールを検出し、インプレースでアップグレードし、必要に応じて `openclaw doctor` を実行します。

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

注記：

- オンボーディングウィザードを再度実行したくない場合は、`--no-onboard` を追加してください。
- **ソースインストール** の場合は、次を使用します：
  ```bash
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
  ```
  リポジトリがクリーンな場合 **のみ**、インストーラーは `git pull --rebase` を実行します。
- **グローバルインストール** の場合、スクリプトは内部的に `npm install -g openclaw@latest` を使用します。
- レガシー注記：`clawdbot` は互換性用のシムとして引き続き利用可能です。

## 更新前に

- インストール方法を把握してください：**グローバル**（npm/pnpm）か **ソースから**（git clone）。
- Gateway（ゲートウェイ）の実行方法を把握してください：**フォアグラウンド端末** か **監督付きサービス**（launchd/systemd）。
- カスタマイズのスナップショットを取得してください：
  - 設定：`~/.openclaw/openclaw.json`
  - 資格情報：`~/.openclaw/credentials/`
  - ワークスペース：`~/.openclaw/workspace`

## 更新（グローバルインストール）

グローバルインストール（いずれかを選択）：

```bash
npm i -g openclaw@latest
```

```bash
pnpm add -g openclaw@latest
```

Gateway（ゲートウェイ）のランタイムに Bun は **推奨しません**（WhatsApp / Telegram の不具合）。

更新チャンネルを切り替える場合（git + npm インストール）：

```bash
openclaw update --channel beta
openclaw update --channel dev
openclaw update --channel stable
```

一度限りのインストールタグ／バージョンには `--tag <dist-tag|version>` を使用してください。

チャンネルの意味とリリースノートについては、[Development channels](/install/development-channels) を参照してください。

注記：npm インストールでは、起動時にゲートウェイが更新ヒントをログ出力します（現在のチャンネルタグを確認します）。`update.checkOnStart: false` で無効化できます。

次に：

```bash
openclaw doctor
openclaw gateway restart
openclaw health
```

注記：

- Gateway（ゲートウェイ）がサービスとして実行されている場合、PID を kill するよりも `openclaw gateway restart` を推奨します。
- 特定のバージョンに固定している場合は、下記の「ロールバック / ピン留め」を参照してください。

## 更新（`openclaw update`）

**ソースインストール**（git checkout）の場合、次を推奨します：

```bash
openclaw update
```

これは比較的安全な更新フローを実行します：

- クリーンな worktree が必要です。
- 選択したチャンネル（タグまたはブランチ）に切り替えます。
- 設定された upstream（dev チャンネル）に対して fetch + rebase を行います。
- 依存関係をインストールし、ビルドし、Control UI をビルドし、`openclaw doctor` を実行します。
- 既定でゲートウェイを再起動します（スキップするには `--no-restart` を使用）。

**npm/pnpm** でインストールした場合（git メタデータなし）、`openclaw update` はパッケージマネージャー経由での更新を試みます。インストールを検出できない場合は、「更新（グローバルインストール）」を使用してください。

## 更新（Control UI / RPC）

Control UI には **Update & Restart**（RPC：`update.run`）があります。これは次を行います：

1. `openclaw update` と同じソース更新フローを実行します（git checkout のみ）。
2. 構造化レポート（stdout / stderr の末尾）付きで再起動用センチネルを書き込みます。
3. ゲートウェイを再起動し、最後にアクティブだったセッションへレポートを送信します。

rebase が失敗した場合、ゲートウェイは更新を適用せずに中断し、再起動します。

## 更新（ソースから）

リポジトリの checkout から：

推奨：

```bash
openclaw update
```

手動（ほぼ同等）：

```bash
git pull
pnpm install
pnpm build
pnpm ui:build # auto-installs UI deps on first run
openclaw doctor
openclaw health
```

注記：

- パッケージ化された `openclaw` バイナリ（[`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs)）を実行する場合や、Node で `dist/` を実行する場合、`pnpm build` が重要です。
- グローバルインストールなしでリポジトリ checkout から実行する場合、CLI コマンドには `pnpm openclaw ...` を使用してください。
- TypeScript から直接実行する場合（`pnpm openclaw ...`）、通常は再ビルドは不要ですが、**設定マイグレーションは引き続き適用されます** → doctor を実行してください。
- グローバルと git インストールの切り替えは簡単です。別の方式をインストールしてから、`openclaw doctor` を実行すると、ゲートウェイのサービスエントリポイントが現在のインストールに書き換えられます。

## 常に実行：`openclaw doctor`

Doctor は「安全な更新」コマンドです。意図的に地味で、修復 + マイグレーション + 警告を行います。

注記：**ソースインストール**（git checkout）の場合、`openclaw doctor` は最初に `openclaw update` を実行する提案を行います。

典型的に行うこと：

- 非推奨の設定キー／レガシー設定ファイルの場所をマイグレーション。
- DM ポリシーを監査し、リスクのある「open」設定について警告。
- Gateway（ゲートウェイ）の健全性を確認し、再起動を提案可能。
- 旧来のゲートウェイサービス（launchd / systemd；レガシー schtasks）を検出し、現在の OpenClaw サービスへ移行。
- Linux では、systemd の user lingering を有効化（ログアウト後も Gateway（ゲートウェイ）が存続するように）。

詳細：[Doctor](/gateway/doctor)

## Gateway（ゲートウェイ）の起動 / 停止 / 再起動

CLI（OS に依存せず動作）：

```bash
openclaw gateway status
openclaw gateway stop
openclaw gateway restart
openclaw gateway --port 18789
openclaw logs --follow
```

監督付きの場合：

- macOS launchd（アプリ同梱の LaunchAgent）：`launchctl kickstart -k gui/$UID/bot.molt.gateway`（`bot.molt.<profile>` を使用；レガシーの `com.openclaw.*` も引き続き使用可）
- Linux systemd ユーザーサービス：`systemctl --user restart openclaw-gateway[-<profile>].service`
- Windows（WSL2）：`systemctl --user restart openclaw-gateway[-<profile>].service`
  - `launchctl` / `systemctl` は、サービスがインストールされている場合のみ動作します。そうでない場合は `openclaw gateway install` を実行してください。

運用手順書 + 正確なサービスラベル：[Gateway runbook](/gateway)

## ロールバック / ピン留め（問題が発生した場合）

### ピン留め（グローバルインストール）

既知の安定版をインストールします（`<version>` を最後に正常動作していたものに置き換えてください）：

```bash
npm i -g openclaw@<version>
```

```bash
pnpm add -g openclaw@<version>
```

ヒント：現在公開されているバージョンを確認するには、`npm view openclaw version` を実行します。

その後、再起動して doctor を再実行します：

```bash
openclaw doctor
openclaw gateway restart
```

### ピン留め（ソース）日付指定

日付からコミットを選択します（例：「2026-01-01 時点の main の状態」）：

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
```

その後、依存関係を再インストールして再起動します：

```bash
pnpm install
pnpm build
openclaw gateway restart
```

後で最新に戻したい場合：

```bash
git checkout main
git pull
```

## 困った場合

- `openclaw doctor` を再度実行し、出力を注意深く読んでください（多くの場合、解決策が示されています）。
- 確認先：[トラブルシューティング](/gateway/troubleshooting)
- Discord で質問： https://discord.gg/clawd
