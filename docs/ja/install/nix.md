---
summary: "Nix を使用して OpenClaw を宣言的にインストールします"
read_when:
  - 再現性があり、ロールバック可能なインストールを行いたい場合
  - すでに Nix / NixOS / Home Manager を使用している場合
  - すべてをピン留めし、宣言的に管理したい場合
title: "Nix"
x-i18n:
  source_path: install/nix.md
  source_hash: f1452194cfdd7461
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:02Z
---

# Nix インストール

Nix で OpenClaw を実行する推奨方法は、**[nix-openclaw](https://github.com/openclaw/nix-openclaw)** を利用することです。これは、必要なものがすべて揃った Home Manager モジュールです。

## クイックスタート

以下を AI エージェント（Claude、Cursor など）に貼り付けてください。

```text
I want to set up nix-openclaw on my Mac.
Repository: github:openclaw/nix-openclaw

What I need you to do:
1. Check if Determinate Nix is installed (if not, install it)
2. Create a local flake at ~/code/openclaw-local using templates/agent-first/flake.nix
3. Help me create a Telegram bot (@BotFather) and get my chat ID (@userinfobot)
4. Set up secrets (bot token, Anthropic key) - plain files at ~/.secrets/ is fine
5. Fill in the template placeholders and run home-manager switch
6. Verify: launchd running, bot responds to messages

Reference the nix-openclaw README for module options.
```

> **📦 完全ガイド: [github.com/openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)**
>
> nix-openclaw リポジトリは、Nix インストールに関する信頼できる唯一の情報源です。このページは概要のみを示しています。

## 提供されるもの

- Gateway（ゲートウェイ） + macOS アプリ + ツール（whisper、spotify、cameras）— すべてピン留め済み
- 再起動後も継続する Launchd サービス
- 宣言的設定を備えたプラグインシステム
- 即時ロールバック: `home-manager switch --rollback`

---

## Nix モードのランタイム挙動

`OPENCLAW_NIX_MODE=1` が設定されている場合（nix-openclaw では自動設定）:

OpenClaw は **Nix モード** をサポートしており、設定を決定論的にし、自動インストールのフローを無効化します。
以下をエクスポートすることで有効化できます。

```bash
OPENCLAW_NIX_MODE=1
```

macOS では、GUI アプリはシェルの環境変数を自動的に継承しません。
defaults を使用して Nix モードを有効化することもできます。

```bash
defaults write bot.molt.mac openclaw.nixMode -bool true
```

### 設定 + 状態パス

OpenClaw は `OPENCLAW_CONFIG_PATH` から JSON5 設定を読み込み、可変データを `OPENCLAW_STATE_DIR` に保存します。

- `OPENCLAW_STATE_DIR`（デフォルト: `~/.openclaw`）
- `OPENCLAW_CONFIG_PATH`（デフォルト: `$OPENCLAW_STATE_DIR/openclaw.json`）

Nix 配下で実行する場合は、ランタイムの状態と設定が不変のストア外に保たれるよう、これらを Nix 管理下の場所に明示的に設定してください。

### Nix モード時のランタイム挙動

- 自動インストールおよび自己変更フローが無効化されます
- 不足している依存関係は、Nix 固有の対処メッセージとして表示されます
- UI には、該当時に読み取り専用の Nix モードバナーが表示されます

## パッケージングに関する注意（macOS）

macOS のパッケージングフローでは、以下の場所に安定した Info.plist テンプレートが存在することを前提としています。

```
apps/macos/Sources/OpenClaw/Resources/Info.plist
```

[`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) は、このテンプレートをアプリバンドルにコピーし、動的なフィールド
（バンドル ID、バージョン / ビルド、Git SHA、Sparkle キー）をパッチします。これにより、SwiftPM の
パッケージングおよび Nix ビルド（完全な Xcode ツールチェーンに依存しない）において、plist を決定論的に保ちます。

## 関連

- [nix-openclaw](https://github.com/openclaw/nix-openclaw) — 完全なセットアップガイド
- [ウィザード](/start/wizard) — 非 Nix の CLI セットアップ
- [Docker](/install/docker) — コンテナ化されたセットアップ
