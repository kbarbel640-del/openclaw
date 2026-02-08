---
title: "Node.js + npm（PATH の健全性）"
summary: "Node.js + npm のインストール健全性: バージョン、PATH、グローバルインストール"
read_when:
  - "OpenClaw をインストールしたが `openclaw` が「command not found」になる"
  - "新しいマシンで Node.js / npm をセットアップしている"
  - "npm install -g ... が権限または PATH の問題で失敗する"
x-i18n:
  source_path: install/node.md
  source_hash: 9f6d83be362e3e14
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:02Z
---

# Node.js + npm（PATH の健全性）

OpenClaw の実行時ベースラインは **Node 22+** です。

`npm install -g openclaw@latest` を実行できるのに、その後で `openclaw: command not found` が表示される場合、ほぼ確実に **PATH** の問題です。npm がグローバルバイナリを配置するディレクトリが、シェルの PATH に含まれていません。

## クイック診断

次を実行します。

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

`$(npm prefix -g)/bin`（macOS / Linux）または `$(npm prefix -g)`（Windows）が `echo "$PATH"` の中に **存在しない** 場合、シェルはグローバル npm バイナリ（`openclaw` を含む）を見つけられていません。

## 修正: npm のグローバル bin ディレクトリを PATH に追加する

1. グローバル npm の prefix を確認します。

```bash
npm prefix -g
```

2. グローバル npm の bin ディレクトリを、シェルの起動時設定ファイルに追加します。

- zsh: `~/.zshrc`
- bash: `~/.bashrc`

例（パスは `npm prefix -g` の出力に置き換えてください）:

```bash
# macOS / Linux
export PATH="/path/from/npm/prefix/bin:$PATH"
```

その後、**新しいターミナル** を開きます（または zsh では `rehash`、bash では `hash -r` を実行します）。

Windows では、`npm prefix -g` の出力を PATH に追加してください。

## 修正: `sudo npm install -g` / 権限エラーを回避する（Linux）

`npm install -g ...` が `EACCES` で失敗する場合は、npm のグローバル prefix をユーザーが書き込み可能なディレクトリに切り替えます。

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

`export PATH=...` の行を、シェルの起動時設定ファイルに永続化してください。

## 推奨される Node のインストール方法

次の条件を満たす方法で Node / npm をインストールすると、トラブルが最小限になります。

- Node を最新（22+）に保てる
- グローバル npm の bin ディレクトリが安定しており、新しいシェルでも PATH に含まれる

一般的な選択肢は次のとおりです。

- macOS: Homebrew（`brew install node`）またはバージョンマネージャー
- Linux: お好みのバージョンマネージャー、または Node 22+ を提供するディストリビューション標準のインストール
- Windows: 公式 Node インストーラー、`winget`、または Windows 用の Node バージョンマネージャー

バージョンマネージャー（nvm / fnm / asdf など）を使用している場合は、日常的に使うシェル（zsh か bash か）で初期化されていることを確認してください。インストーラー実行時に、設定された PATH が有効になっている必要があります。
