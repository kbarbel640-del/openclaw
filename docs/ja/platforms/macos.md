---
summary: "OpenClaw macOS コンパニオンアプリ（メニューバー + Gateway ブローカー）"
read_when:
  - macOS アプリ機能を実装する場合
  - macOS における Gateway ライフサイクルやノードブリッジを変更する場合
title: "macOS アプリ"
x-i18n:
  source_path: platforms/macos.md
  source_hash: a5b1c02e5905e4cb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:38Z
---

# OpenClaw macOS コンパニオン（メニューバー + Gateway ブローカー）

macOS アプリは、OpenClaw の **メニューバー コンパニオン** です。権限を管理し、ローカルで Gateway（launchd または手動）を管理／接続し、macOS の機能をノードとしてエージェントに公開します。

## 役割

- メニューバーにネイティブ通知とステータスを表示します。
- TCC プロンプト（通知、アクセシビリティ、画面収録、マイク、音声認識、Automation/AppleScript）を管理します。
- Gateway を実行または接続します（ローカルまたはリモート）。
- macOS 専用ツール（Canvas、Camera、Screen Recording、`system.run`）を公開します。
- **リモート** モードではローカルのノードホストサービスを起動（launchd）し、**ローカル** モードでは停止します。
- UI 自動化のために **PeekabooBridge** を任意でホストします。
- 要求に応じて npm/pnpm 経由でグローバル CLI（`openclaw`）をインストールします（Gateway ランタイムには bun は推奨されません）。

## ローカルモードとリモートモード

- **ローカル**（デフォルト）: 実行中のローカル Gateway があればそれに接続します。存在しない場合は `openclaw gateway install` を介して launchd サービスを有効化します。
- **リモート**: SSH/Tailscale 経由で Gateway に接続し、ローカルプロセスは起動しません。  
  アプリは、リモート Gateway からこの Mac に到達できるように、ローカルの **ノードホストサービス** を起動します。  
  アプリは Gateway を子プロセスとして生成しません。

## Launchd の制御

アプリは、ユーザー単位の LaunchAgent（ラベル `bot.molt.gateway`）を管理します  
（`--profile`/`OPENCLAW_PROFILE` を使用する場合は `bot.molt.<profile>`。レガシーの `com.openclaw.*` でもアンロード可能）。

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

名前付きプロファイルを実行する場合は、ラベルを `bot.molt.<profile>` に置き換えてください。

LaunchAgent がインストールされていない場合は、アプリから有効化するか、`openclaw gateway install` を実行してください。

## ノード機能（mac）

macOS アプリはノードとして振る舞います。一般的なコマンドは次のとおりです。

- Canvas: `canvas.present`, `canvas.navigate`, `canvas.eval`, `canvas.snapshot`, `canvas.a2ui.*`
- Camera: `camera.snap`, `camera.clip`
- Screen: `screen.record`
- System: `system.run`, `system.notify`

ノードは `permissions` マップを報告し、エージェントが許可内容を判断できるようにします。

ノードサービスとアプリの IPC:

- ヘッドレスなノードホストサービスが実行中（リモートモード）の場合、ノードとして Gateway の WS に接続します。
- `system.run` は macOS アプリ（UI/TCC コンテキスト）内でローカルの Unix ソケット越しに実行され、プロンプトと出力はアプリ内に留まります。

図（SCI）:

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + TCC + system.run)
```

## Exec 承認（system.run）

`system.run` は、macOS アプリ（設定 → Exec 承認）における **Exec 承認** によって制御されます。  
セキュリティ設定、確認、許可リストは、次の場所に Mac ローカルで保存されます。

```
~/.openclaw/exec-approvals.json
```

例:

```json
{
  "version": 1,
  "defaults": {
    "security": "deny",
    "ask": "on-miss"
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [{ "pattern": "/opt/homebrew/bin/rg" }]
    }
  }
}
```

注意:

- `allowlist` のエントリは、解決後のバイナリパスに対するグロブパターンです。
- プロンプトで「常に許可」を選択すると、そのコマンドが許可リストに追加されます。
- `system.run` の環境上書きはフィルタリングされ（`PATH`, `DYLD_*`, `LD_*`, `NODE_OPTIONS`, `PYTHON*`, `PERL*`, `RUBYOPT` は除外）、その後アプリの環境とマージされます。

## ディープリンク

アプリは、ローカルアクション用に `openclaw://` URL スキームを登録します。

### `openclaw://agent`

Gateway の `agent` リクエストをトリガーします。

```bash
open 'openclaw://agent?message=Hello%20from%20deep%20link'
```

クエリパラメータ:

- `message`（必須）
- `sessionKey`（任意）
- `thinking`（任意）
- `deliver` / `to` / `channel`（任意）
- `timeoutSeconds`（任意）
- `key`（無人モード用キー、任意）

安全性:

- `key` がない場合、アプリは確認を求めます。
- 有効な `key` がある場合、実行は無人で行われます（個人用自動化を想定）。

## オンボーディング フロー（一般的）

1. **OpenClaw.app** をインストールして起動します。
2. 権限チェックリスト（TCC プロンプト）を完了します。
3. **ローカル** モードが有効で、Gateway が実行中であることを確認します。
4. ターミナルからのアクセスが必要な場合は CLI をインストールします。

## ビルド & 開発ワークフロー（ネイティブ）

- `cd apps/macos && swift build`
- `swift run OpenClaw`（または Xcode）
- アプリをパッケージ化: `scripts/package-mac-app.sh`

## Gateway 接続のデバッグ（macOS CLI）

デバッグ用 CLI を使用すると、アプリを起動せずに、macOS アプリと同じ Gateway WebSocket のハンドシェイクおよびデバイス検出ロジックを検証できます。

```bash
cd apps/macos
swift run openclaw-mac connect --json
swift run openclaw-mac discover --timeout 3000 --json
```

接続オプション:

- `--url <ws://host:port>`: 設定を上書き
- `--mode <local|remote>`: 設定から解決（デフォルト: config または local）
- `--probe`: 新しいヘルスプローブを強制
- `--timeout <ms>`: リクエストタイムアウト（デフォルト: `15000`）
- `--json`: 差分比較用の構造化出力

検出オプション:

- `--include-local`: 「local」としてフィルタされる Gateway も含める
- `--timeout <ms>`: 全体の検出ウィンドウ（デフォルト: `2000`）
- `--json`: 差分比較用の構造化出力

ヒント: `openclaw gateway discover --json` と比較すると、macOS アプリの検出パイプライン（NWBrowser + tailnet DNS‑SD フォールバック）が、Node CLI の `dns-sd` ベースの検出と異なるかどうかを確認できます。

## リモート接続の仕組み（SSH トンネル）

macOS アプリが **リモート** モードで動作する場合、ローカルの UI コンポーネントが localhost 上にあるかのようにリモート Gateway と通信できるよう、SSH トンネルを開きます。

### 制御トンネル（Gateway WebSocket ポート）

- **目的:** ヘルスチェック、ステータス、Web Chat、設定、その他の制御プレーン呼び出し。
- **ローカルポート:** Gateway ポート（デフォルト `18789`）。常に固定です。
- **リモートポート:** リモートホスト上の同じ Gateway ポート。
- **挙動:** ランダムなローカルポートは使用せず、既存の健全なトンネルを再利用するか、必要に応じて再起動します。
- **SSH 形式:** BatchMode + ExitOnForwardFailure + keepalive オプション付きの `ssh -N -L <local>:127.0.0.1:<remote>`。
- **IP の報告:** SSH トンネルは loopback を使用するため、Gateway からはノードの IP が `127.0.0.1` として見えます。実際のクライアント IP を表示したい場合は、**Direct（ws/wss）** トランスポートを使用してください（[macOS remote access](/platforms/mac/remote) を参照）。

セットアップ手順については [macOS remote access](/platforms/mac/remote) を、プロトコルの詳細については [Gateway protocol](/gateway/protocol) を参照してください。

## 関連ドキュメント

- [Gateway runbook](/gateway)
- [Gateway（macOS）](/platforms/mac/bundled-gateway)
- [macOS permissions](/platforms/mac/permissions)
- [Canvas](/platforms/mac/canvas)
