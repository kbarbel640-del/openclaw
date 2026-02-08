---
summary: "インストーラースクリプト（install.sh + install-cli.sh）の仕組み、フラグ、および自動化について"
read_when:
  - "`openclaw.ai/install.sh` を理解したい場合"
  - "インストールを自動化（CI / ヘッドレス）したい場合"
  - "GitHub のチェックアウトからインストールしたい場合"
title: "インストーラー内部構造"
x-i18n:
  source_path: install/installer.md
  source_hash: 9e0a19ecb5da0a39
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:08Z
---

# インストーラー内部構造

OpenClaw には 2 つのインストーラースクリプトがあります（`openclaw.ai` から配信）:

- `https://openclaw.ai/install.sh` — 「推奨」インストーラー（デフォルトでは npm のグローバルインストール。GitHub のチェックアウトからのインストールも可能）
- `https://openclaw.ai/install-cli.sh` — 非 root フレンドリーな CLI インストーラー（独自の Node を含むプレフィックスにインストール）
- `https://openclaw.ai/install.ps1` — Windows PowerShell インストーラー（デフォルトは npm、オプションで git インストール）

現在のフラグや挙動を確認するには、次を実行してください:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Windows（PowerShell）のヘルプ:

```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -?
```

インストーラーが完了したにもかかわらず、新しいターミナルで `openclaw` が見つからない場合、通常は Node / npm の PATH の問題です。以下を参照してください: [Install](/install#nodejs--npm-path-sanity)。

## install.sh（推奨）

概要（高レベル）:

- OS を検出（macOS / Linux / WSL）。
- Node.js **22+** を確保（macOS は Homebrew、Linux は NodeSource）。
- インストール方法を選択:
  - `npm`（デフォルト）: `npm install -g openclaw@latest`
  - `git`: ソースのチェックアウトを clone / build し、ラッパースクリプトをインストール
- Linux では、必要に応じて npm の prefix を `~/.npm-global` に切り替え、npm のグローバル権限エラーを回避。
- 既存のインストールをアップグレードする場合: `openclaw doctor --non-interactive` を実行（ベストエフォート）。
- git インストールの場合: インストール / 更新後に `openclaw doctor --non-interactive` を実行（ベストエフォート）。
- `sharp` のネイティブインストールに関する落とし穴を回避するため、デフォルトで `SHARP_IGNORE_GLOBAL_LIBVIPS=1` を使用（システムの libvips に対するビルドを回避）。

`sharp` をグローバルにインストールされた libvips にリンクさせたい場合（またはデバッグ目的の場合）は、次を設定してください:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=0 curl -fsSL https://openclaw.ai/install.sh | bash
```

### 検出性 / 「git インストール」プロンプト

**すでに OpenClaw のソースチェックアウト内**（`package.json` + `pnpm-workspace.yaml` により検出）でインストーラーを実行した場合、次のプロンプトが表示されます:

- このチェックアウトを更新して使用する（`git`）
- グローバル npm インストールに移行する（`npm`）

非対話的なコンテキスト（TTY なし / `--no-prompt`）では、`--install-method git|npm` を指定する（または `OPENCLAW_INSTALL_METHOD` を設定する）必要があります。そうしない場合、スクリプトはコード `2` で終了します。

### なぜ Git が必要なのか

Git は `--install-method git` のパス（clone / pull）に必要です。

`npm` インストールでは、通常 Git は不要ですが、環境によっては必要になる場合があります（例: パッケージや依存関係が git URL 経由で取得される場合）。インストーラーは現在、フレッシュなディストリビューションでの `spawn git ENOENT` な不意打ちを避けるため、Git の存在を確保します。

### なぜ新規 Linux 環境で npm が `EACCES` に書き込もうとするのか

一部の Linux セットアップ（特に、システムのパッケージマネージャーや NodeSource 経由で Node をインストールした直後）では、npm のグローバル prefix が root 所有の場所を指します。その結果、`npm install -g ...` が `EACCES` / `mkdir` の権限エラーで失敗します。

`install.sh` は、prefix を次に切り替えることでこれを緩和します:

- `~/.npm-global`（存在する場合、`~/.bashrc` / `~/.zshrc` 内の `PATH` に追加）

## install-cli.sh（非 root CLI インストーラー）

このスクリプトは、`openclaw` をプレフィックス（デフォルト: `~/.openclaw`）にインストールし、さらにそのプレフィックス配下に専用の Node ランタイムもインストールします。そのため、システムの Node / npm に手を加えたくないマシンでも動作します。

ヘルプ:

```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash -s -- --help
```

## install.ps1（Windows PowerShell）

概要（高レベル）:

- Node.js **22+** を確保（winget / Chocolatey / Scoop または手動）。
- インストール方法を選択:
  - `npm`（デフォルト）: `npm install -g openclaw@latest`
  - `git`: ソースのチェックアウトを clone / build し、ラッパースクリプトをインストール
- アップグレードおよび git インストール時に `openclaw doctor --non-interactive` を実行（ベストエフォート）。

例:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git -GitDir "C:\\openclaw"
```

環境変数:

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`

Git の要件:

`-InstallMethod git` を選択し、Git が存在しない場合、インストーラーは
Git for Windows のリンク（`https://git-scm.com/download/win`）を表示して終了します。

Windows でよくある問題:

- **npm error spawn git / ENOENT**: Git for Windows をインストールし、PowerShell を再起動してからインストーラーを再実行してください。
- **"openclaw" is not recognized**: npm のグローバル bin フォルダーが PATH に含まれていません。多くのシステムでは
  `%AppData%\\npm` が使用されます。`npm config get prefix` を実行し、`\\bin` を PATH に追加してから PowerShell を再起動することもできます。
