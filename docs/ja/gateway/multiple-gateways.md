---
summary: "1 台のホストで複数の OpenClaw Gateway（ゲートウェイ）を実行（分離、ポート、プロファイル）"
read_when:
  - 同一マシンで複数の Gateway（ゲートウェイ）を実行する場合
  - Gateway（ゲートウェイ）ごとに分離された 設定 / 状態 / ポート が必要な場合
title: "複数の Gateway（ゲートウェイ）"
x-i18n:
  source_path: gateway/multiple-gateways.md
  source_hash: 09b5035d4e5fb97c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:43Z
---

# 複数の Gateway（ゲートウェイ）（同一ホスト）

ほとんどの構成では 1 つの Gateway（ゲートウェイ）で十分です。単一の Gateway（ゲートウェイ）で複数のメッセージング接続やエージェントを処理できます。より強力な分離や冗長性（例：レスキューボット）が必要な場合は、分離されたプロファイル / ポートで個別の Gateway（ゲートウェイ）を実行してください。

## 分離チェックリスト（必須）

- `OPENCLAW_CONFIG_PATH` — インスタンスごとの設定ファイル
- `OPENCLAW_STATE_DIR` — インスタンスごとの セッション、認証情報、キャッシュ
- `agents.defaults.workspace` — インスタンスごとのワークスペースルート
- `gateway.port`（または `--port`）— インスタンスごとに一意
- 派生ポート（browser / canvas）が重複しないこと

これらが共有されていると、設定の競合やポート衝突が発生します。

## 推奨：プロファイル（`--profile`）

プロファイルは `OPENCLAW_STATE_DIR` + `OPENCLAW_CONFIG_PATH` を自動的にスコープし、サービス名にサフィックスを付与します。

```bash
# main
openclaw --profile main setup
openclaw --profile main gateway --port 18789

# rescue
openclaw --profile rescue setup
openclaw --profile rescue gateway --port 19001
```

プロファイルごとのサービス：

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

## レスキューボット ガイド

同一ホスト上で、以下をそれぞれ独自に持つ 2 つ目の Gateway（ゲートウェイ）を実行します：

- プロファイル / 設定
- 状態ディレクトリ
- ワークスペース
- ベースポート（＋派生ポート）

これにより、プライマリ ボットが停止している場合でも、レスキューボットがデバッグや設定変更を行えるよう、メイン ボットから分離されます。

ポート間隔：派生する browser / canvas / CDP ポートが決して衝突しないよう、ベースポート間は少なくとも 20 ポート空けてください。

### インストール方法（レスキューボット）

```bash
# Main bot (existing or fresh, without --profile param)
# Runs on port 18789 + Chrome CDC/Canvas/... Ports
openclaw onboard
openclaw gateway install

# Rescue bot (isolated profile + ports)
openclaw --profile rescue onboard
# Notes:
# - workspace name will be postfixed with -rescue per default
# - Port should be at least 18789 + 20 Ports,
#   better choose completely different base port, like 19789,
# - rest of the onboarding is the same as normal

# To install the service (if not happened automatically during onboarding)
openclaw --profile rescue gateway install
```

## ポート割り当て（派生）

ベースポート = `gateway.port`（または `OPENCLAW_GATEWAY_PORT` / `--port`）。

- ブラウザ制御サービスのポート = ベース + 2（local loopback のみ）
- `canvasHost.port = base + 4`
- ブラウザ プロファイルの CDP ポートは `browser.controlPort + 9 .. + 108` から自動割り当て

これらのいずれかを 設定 または 環境変数 で上書きする場合は、インスタンスごとに一意である必要があります。

## Browser / CDP の注意点（よくある落とし穴）

- 複数のインスタンスで `browser.cdpUrl` を同じ値に固定しないでください。
- 各インスタンスには、独自のブラウザ制御ポートと CDP 範囲（Gateway（ゲートウェイ）ポートから派生）が必要です。
- 明示的な CDP ポートが必要な場合は、インスタンスごとに `browser.profiles.<name>.cdpPort` を設定してください。
- リモート Chrome：`browser.profiles.<name>.cdpUrl` を使用します（プロファイルごと、インスタンスごと）。

## 手動 env の例

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/main.json \
OPENCLAW_STATE_DIR=~/.openclaw-main \
openclaw gateway --port 18789

OPENCLAW_CONFIG_PATH=~/.openclaw/rescue.json \
OPENCLAW_STATE_DIR=~/.openclaw-rescue \
openclaw gateway --port 19001
```

## クイックチェック

```bash
openclaw --profile main status
openclaw --profile rescue status
openclaw --profile rescue browser status
```
