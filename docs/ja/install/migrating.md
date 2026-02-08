---
summary: "あるマシンから別のマシンへ OpenClaw のインストールを移動（移行）します"
read_when:
  - OpenClaw を新しいラップトップ／サーバーに移行する場合
  - セッション、認証、チャンネルのログイン（WhatsApp など）を保持したい場合
title: "移行ガイド"
x-i18n:
  source_path: install/migrating.md
  source_hash: 604d862c4bf86e79
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:12Z
---

# OpenClaw を新しいマシンへ移行する

このガイドでは、**オンボーディングをやり直さずに** OpenClaw Gateway（ゲートウェイ）をあるマシンから別のマシンへ移行します。

移行の考え方はシンプルです。

- **state ディレクトリ**（`$OPENCLAW_STATE_DIR`、既定: `~/.openclaw/`）をコピーします。ここには設定、認証、セッション、チャンネルの状態が含まれます。
- **workspace**（既定で `~/.openclaw/workspace/`）をコピーします。ここにはエージェントのファイル（メモリ、プロンプトなど）が含まれます。

ただし、**profile**、**権限**、**部分的なコピー**に関する一般的な落とし穴があります。

## はじめる前に（何を移行するか）

### 1) state ディレクトリを特定する

多くのインストールでは既定値を使用します。

- **State dir:** `~/.openclaw/`

ただし、次を使用している場合は異なることがあります。

- `--profile <name>`（しばしば `~/.openclaw-<profile>/` になります）
- `OPENCLAW_STATE_DIR=/some/path`

不明な場合は、**旧** マシンで次を実行してください。

```bash
openclaw status
```

出力内の `OPENCLAW_STATE_DIR` / profile に関する記述を探してください。複数の Gateway（ゲートウェイ）を実行している場合は、各 profile ごとに繰り返してください。

### 2) workspace を特定する

一般的な既定値は次のとおりです。

- `~/.openclaw/workspace/`（推奨 workspace）
- 自分で作成したカスタムフォルダー

workspace には、`MEMORY.md`、`USER.md`、`memory/*.md` などのファイルがあります。

### 3) 何が保持されるかを理解する

state dir と workspace の **両方** をコピーした場合、次が保持されます。

- Gateway（ゲートウェイ）の設定（`openclaw.json`）
- 認証 profile／API キー／OAuth トークン
- セッション履歴 + エージェントの状態
- チャンネルの状態（例: WhatsApp のログイン／セッション）
- workspace のファイル（メモリ、Skills のメモなど）

workspace **のみ**（例: Git 経由）をコピーした場合、次は **保持されません**。

- セッション
- 認証情報
- チャンネルのログイン

これらは `$OPENCLAW_STATE_DIR` 配下にあります。

## 移行手順（推奨）

### ステップ 0 — バックアップを作成する（旧マシン）

**旧** マシンで、まず Gateway（ゲートウェイ）を停止して、コピー中にファイルが変更されないようにします。

```bash
openclaw gateway stop
```

（任意ですが推奨）state dir と workspace をアーカイブします。

```bash
# Adjust paths if you use a profile or custom locations
cd ~
tar -czf openclaw-state.tgz .openclaw

tar -czf openclaw-workspace.tgz .openclaw/workspace
```

複数の profile／state dir（例: `~/.openclaw-main`、`~/.openclaw-work`）がある場合は、それぞれをアーカイブしてください。

### ステップ 1 — 新しいマシンに OpenClaw をインストールする

**新** マシンで、CLI（必要に応じて Node）をインストールします。

- 参照: [Install](/install)

この段階でオンボーディングにより新しい `~/.openclaw/` が作成されても問題ありません。次のステップで上書きします。

### ステップ 2 — state dir + workspace を新しいマシンへコピーする

次の **両方** をコピーします。

- `$OPENCLAW_STATE_DIR`（既定: `~/.openclaw/`）
- workspace（既定: `~/.openclaw/workspace/`）

一般的な方法は次のとおりです。

- tarball を `scp` して展開
- SSH 経由で `rsync -a`
- 外付けドライブ

コピー後、次を確認してください。

- 隠しディレクトリが含まれていること（例: `.openclaw/`）
- Gateway（ゲートウェイ）を実行するユーザーのファイル所有権になっていること

### ステップ 3 — Doctor を実行する（移行 + サービス修復）

**新** マシンで次を実行します。

```bash
openclaw doctor
```

Doctor は「安全で堅実」なコマンドです。サービスを修復し、設定の移行を適用し、不整合について警告します。

その後、次を実行します。

```bash
openclaw gateway restart
openclaw status
```

## よくある落とし穴（回避方法）

### 落とし穴: profile／state-dir の不一致

旧 Gateway（ゲートウェイ）を profile（または `OPENCLAW_STATE_DIR`）付きで実行しており、新しい Gateway（ゲートウェイ）が別のものを使用している場合、次のような症状が出ます。

- 設定変更が反映されない
- チャンネルが消える／ログアウトされる
- セッション履歴が空になる

対処: 移行した **同一の** profile／state dir を使用して Gateway（ゲートウェイ）／サービスを実行し、次を再実行してください。

```bash
openclaw doctor
```

### 落とし穴: `openclaw.json` だけをコピーしている

`openclaw.json` だけでは不十分です。多くのプロバイダーは次の配下に状態を保存します。

- `$OPENCLAW_STATE_DIR/credentials/`
- `$OPENCLAW_STATE_DIR/agents/<agentId>/...`

必ず `$OPENCLAW_STATE_DIR` フォルダー全体を移行してください。

### 落とし穴: 権限／所有権

root でコピーした、またはユーザーを変更した場合、Gateway（ゲートウェイ）が認証情報／セッションを読み取れないことがあります。

対処: state dir と workspace が Gateway（ゲートウェイ）を実行するユーザーの所有になっていることを確認してください。

### 落とし穴: リモート／ローカル モード間の移行

- UI（WebUI／TUI）が **リモート** Gateway（ゲートウェイ）を指している場合、セッションストア + workspace はリモートホスト側にあります。
- ノート PC を移行しても、リモート Gateway（ゲートウェイ）の状態は移動しません。

リモートモードの場合は、**Gateway（ゲートウェイ）のホスト** を移行してください。

### 落とし穴: バックアップ内のシークレット

`$OPENCLAW_STATE_DIR` にはシークレット（API キー、OAuth トークン、WhatsApp の認証情報）が含まれます。本番シークレットとして扱ってください。

- 暗号化して保管する
- 安全でないチャネルで共有しない
- 露出の疑いがある場合はキーをローテーションする

## 確認チェックリスト

新しいマシンで次を確認してください。

- `openclaw status` で Gateway（ゲートウェイ）が実行中と表示される
- チャンネルが引き続き接続されている（例: WhatsApp の再ペアリングが不要）
- ダッシュボードが開き、既存のセッションが表示される
- workspace のファイル（メモリ、設定）が存在する

## 関連

- [Doctor](/gateway/doctor)
- [Gateway troubleshooting](/gateway/troubleshooting)
- [Where does OpenClaw store its data?](/help/faq#where-does-openclaw-store-its-data)
