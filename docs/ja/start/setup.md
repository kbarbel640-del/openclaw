---
summary: "OpenClaw の高度なセットアップと開発ワークフロー"
read_when:
  - 新しいマシンをセットアップするとき
  - 個人のセットアップを壊さずに「最新 + 最高」を使いたいとき
title: "セットアップ"
x-i18n:
  source_path: start/setup.md
  source_hash: 6620daddff099dc0
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:20Z
---

# セットアップ

<Note>
初めてセットアップする場合は、[Getting Started](/start/getting-started) から始めてください。
ウィザードの詳細は、[Onboarding Wizard](/start/wizard) を参照してください。
</Note>

最終更新日: 2026-01-01

## TL;DR

- **調整はリポジトリ外に置きます:** `~/.openclaw/workspace`（workspace）+ `~/.openclaw/openclaw.json`（config）。
- **安定ワークフロー:** macOS アプリをインストールし、同梱の Gateway（ゲートウェイ）を実行させます。
- **最先端ワークフロー:** `pnpm gateway:watch` 経由で自分で Gateway（ゲートウェイ）を実行し、その後 macOS アプリを Local モードでアタッチさせます。

## 前提条件（ソースから）

- Node `>=22`
- `pnpm`
- Docker（任意。コンテナ化されたセットアップ/e2e のみ — [Docker](/install/docker) を参照）

## 調整戦略（更新で困らないように）

「自分向けに 100% 調整したい」_かつ_ 更新も簡単にしたい場合は、カスタマイズを以下に保持してください:

- **Config:** `~/.openclaw/openclaw.json`（JSON/JSON5 風）
- **Workspace:** `~/.openclaw/workspace`（skills、prompts、memories。プライベートの git リポジトリにしてください）

初回だけブートストラップします:

```bash
openclaw setup
```

このリポジトリ内からは、ローカルの CLI エントリを使います:

```bash
openclaw setup
```

まだグローバルインストールがない場合は、`pnpm openclaw setup` 経由で実行してください。

## このリポジトリから Gateway（ゲートウェイ）を実行する

`pnpm build` の後、パッケージされた CLI を直接実行できます:

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

## 安定ワークフロー（macOS アプリ優先）

1. **OpenClaw.app**（メニューバー）をインストールして起動します。
2. オンボーディング/権限チェックリスト（TCC プロンプト）を完了します。
3. Gateway（ゲートウェイ）が **Local** で実行中であることを確認します（アプリが管理します）。
4. サーフェスをリンクします（例: WhatsApp）:

```bash
openclaw channels login
```

5. 動作確認:

```bash
openclaw health
```

ビルドでオンボーディングが利用できない場合:

- `openclaw setup` を実行し、その後 `openclaw channels login` を実行し、最後に Gateway（ゲートウェイ）を手動で起動します（`openclaw gateway`）。

## 最先端ワークフロー（ターミナルで Gateway（ゲートウェイ））

目的: TypeScript の Gateway（ゲートウェイ）で作業し、ホットリロードを得つつ、macOS アプリ UI をアタッチしたままにします。

### 0)（任意）macOS アプリもソースから実行する

macOS アプリも最先端にしたい場合:

```bash
./scripts/restart-mac.sh
```

### 1) 開発用 Gateway（ゲートウェイ）を起動する

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` は gateway を watch モードで実行し、TypeScript の変更に応じてリロードします。

### 2) macOS アプリを実行中の Gateway（ゲートウェイ）に向ける

**OpenClaw.app** で:

- Connection Mode: **Local**
  アプリは、設定されたポート上で実行中の gateway にアタッチします。

### 3) 検証

- アプリ内の Gateway（ゲートウェイ）ステータスは **「Using existing gateway …」** と表示されるはずです
- もしくは CLI で:

```bash
openclaw health
```

### よくある落とし穴

- **ポート違い:** Gateway（ゲートウェイ）の WS はデフォルトで `ws://127.0.0.1:18789` です。アプリ + CLI を同じポートに合わせてください。
- **状態の保存場所:**
  - 認証情報: `~/.openclaw/credentials/`
  - セッション: `~/.openclaw/agents/<agentId>/sessions/`
  - ログ: `/tmp/openclaw/`

## 認証情報ストレージのマップ

認証のデバッグ時や、何をバックアップするかを決める際に使用してください:

- **WhatsApp**: `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`
- **Telegram bot token**: config/env または `channels.telegram.tokenFile`
- **Discord bot token**: config/env（トークンファイルは未対応）
- **Slack tokens**: config/env（`channels.slack.*`）
- **Pairing allowlists**: `~/.openclaw/credentials/<channel>-allowFrom.json`
- **Model auth profiles**: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- **Legacy OAuth import**: `~/.openclaw/credentials/oauth.json`
  詳細: [Security](/gateway/security#credential-storage-map)。

## 更新（セットアップを壊さずに）

- `~/.openclaw/workspace` と `~/.openclaw/` を「自分のもの」として保持し、個人用のプロンプト/config を `openclaw` リポジトリに入れないでください。
- ソースの更新: `git pull` + `pnpm install`（lockfile が変更されたとき）+ 引き続き `pnpm gateway:watch` を使用します。

## Linux（systemd ユーザーサービス）

Linux のインストールは systemd の **user** サービスを使用します。デフォルトでは、systemd はログアウト/アイドル時にユーザーサービスを停止し、Gateway（ゲートウェイ）が終了します。オンボーディングは lingering を有効化しようとします（sudo を求められる場合があります）。それでも無効な場合は、次を実行してください:

```bash
sudo loginctl enable-linger $USER
```

常時稼働やマルチユーザーのサーバーでは、ユーザーサービスではなく **system** サービスを検討してください（lingering は不要）。systemd の注意点については、[Gateway runbook](/gateway) を参照してください。

## 関連ドキュメント

- [Gateway runbook](/gateway)（フラグ、監督、ポート）
- [Gateway configuration](/gateway/configuration)（config スキーマ + 例）
- [Discord](/channels/discord) と [Telegram](/channels/telegram)（返信タグ + replyToMode 設定）
- [OpenClaw assistant setup](/start/openclaw)
- [macOS app](/platforms/macos)（gateway ライフサイクル）
