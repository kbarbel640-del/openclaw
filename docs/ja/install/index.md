---
summary: "OpenClaw をインストールします（推奨インストーラー、グローバルインストール、またはソースから）"
read_when:
  - OpenClaw のインストール
  - GitHub からインストールしたい場合
title: "インストール概要"
x-i18n:
  source_path: install/index.md
  source_hash: 228056bb0a2176b8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:06Z
---

# インストール概要

特別な理由がない限り、インストーラーの使用を推奨します。CLI をセットアップし、オンボーディングを実行します。

## クイックインストール（推奨）

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows（PowerShell）:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

次のステップ（オンボーディングをスキップした場合）:

```bash
openclaw onboard --install-daemon
```

## システム要件

- **Node >=22**
- macOS、Linux、または WSL2 経由の Windows
- `pnpm`（ソースからビルドする場合のみ）

## インストール方法の選択

### 1) インストーラースクリプト（推奨）

npm 経由で `openclaw` をグローバルにインストールし、オンボーディングを実行します。

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

インストーラーフラグ:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

詳細: [Installer internals](/install/installer)。

非対話モード（オンボーディングをスキップ）:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### 2) グローバルインストール（手動）

すでに Node がある場合:

```bash
npm install -g openclaw@latest
```

libvips をグローバルにインストール済み（macOS では Homebrew 経由が一般的）で、`sharp` のインストールに失敗する場合は、事前ビルド済みバイナリを強制します。

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

`sharp: Please add node-gyp to your dependencies` が表示される場合は、ビルドツール（macOS: Xcode CLT + `npm install -g node-gyp`）をインストールするか、上記の `SHARP_IGNORE_GLOBAL_LIBVIPS=1` の回避策を使用してネイティブビルドをスキップしてください。

または pnpm を使用する場合:

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

pnpm は、ビルドスクリプトを含むパッケージに対して明示的な承認が必要です。初回インストールで「Ignored build scripts」の警告が表示されたら、`pnpm approve-builds -g` を実行し、表示されたパッケージを選択してください。

その後:

```bash
openclaw onboard --install-daemon
```

### 3) ソースから（コントリビューター／開発者向け）

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

ヒント: まだグローバルインストールがない場合は、`pnpm openclaw ...` 経由でリポジトリのコマンドを実行してください。

より深い開発ワークフローについては、[Setup](/start/setup) を参照してください。

### 4) その他のインストールオプション

- Docker: [Docker](/install/docker)
- Nix: [Nix](/install/nix)
- Ansible: [Ansible](/install/ansible)
- Bun（CLI のみ）: [Bun](/install/bun)

## インストール後

- オンボーディングを実行: `openclaw onboard --install-daemon`
- クイックチェック: `openclaw doctor`
- Gateway（ゲートウェイ）のヘルス確認: `openclaw status` + `openclaw health`
- ダッシュボードを開く: `openclaw dashboard`

## インストール方法: npm vs git（インストーラー）

インストーラーは 2 つの方法をサポートします。

- `npm`（デフォルト）: `npm install -g openclaw@latest`
- `git`: GitHub からクローン／ビルドし、ソースのチェックアウトから実行します。

### CLI フラグ

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

一般的なフラグ:

- `--install-method npm|git`
- `--git-dir <path>`（デフォルト: `~/openclaw`）
- `--no-git-update`（既存のチェックアウトを使用する場合は `git pull` をスキップ）
- `--no-prompt`（プロンプトを無効化。CI／自動化で必須）
- `--dry-run`（実行内容を表示するのみで、変更は行いません）
- `--no-onboard`（オンボーディングをスキップ）

### 環境変数

同等の環境変数（自動化に便利）:

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1`（デフォルト: `1`; `sharp` がシステムの libvips に対してビルドされるのを回避します）

## トラブルシューティング: `openclaw` が見つかりません（PATH）

簡易診断:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

`$(npm prefix -g)/bin`（macOS／Linux）または `$(npm prefix -g)`（Windows）が `echo "$PATH"` の中に **存在しない** 場合、シェルがグローバル npm バイナリ（`openclaw` を含む）を見つけられていません。

対処: シェルの起動ファイルに追加してください（zsh: `~/.zshrc`、bash: `~/.bashrc`）。

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

Windows では、`npm prefix -g` の出力を PATH に追加してください。

その後、新しいターミナルを開く（または zsh では `rehash`、bash では `hash -r` を実行）してください。

## 更新／アンインストール

- 更新: [Updating](/install/updating)
- 新しいマシンへの移行: [Migrating](/install/migrating)
- アンインストール: [Uninstall](/install/uninstall)
