---
summary: "ヘッドレスノードホスト向けの `openclaw node` の CLI リファレンス"
read_when:
  - ヘッドレスノードホストを実行する場合
  - system.run のために非 macOS ノードをペアリングする場合
title: "node"
x-i18n:
  source_path: cli/node.md
  source_hash: a8b1a57712663e22
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:45Z
---

# `openclaw node`

Gateway WebSocket に接続し、このマシン上で
`system.run` / `system.which` を公開する **ヘッドレスノードホスト** を実行します。

## なぜノードホストを使うのですか？

フル機能の macOS コンパニオンアプリをそこにインストールせずに、ネットワーク内の **他のマシンでコマンドを実行** したい場合にノードホストを使用します。

一般的なユースケース:

- リモートの Linux/Windows ボックス（ビルドサーバー、ラボマシン、NAS）でコマンドを実行する。
- exec を Gateway（ゲートウェイ）上で **サンドボックス化された** 状態に保ちつつ、承認済みの実行を他のホストに委任する。
- 自動化や CI ノード向けに、軽量でヘッドレスな実行ターゲットを提供する。

実行は引き続き **exec 承認** と、ノードホスト上のエージェントごとの許可リストによって保護されるため、コマンドアクセスを範囲指定して明示的に保てます。

## ブラウザープロキシ（ゼロ設定）

ノード上で `browser.enabled` が無効化されていない場合、ノードホストは自動的にブラウザープロキシをアドバタイズします。これにより、追加設定なしで、そのノード上のブラウザー自動化をエージェントが使用できます。

必要に応じてノード側で無効化してください:

```json5
{
  nodeHost: {
    browserProxy: {
      enabled: false,
    },
  },
}
```

## 実行（フォアグラウンド）

```bash
openclaw node run --host <gateway-host> --port 18789
```

オプション:

- `--host <host>`: Gateway WebSocket ホスト（デフォルト: `127.0.0.1`）
- `--port <port>`: Gateway WebSocket ポート（デフォルト: `18789`）
- `--tls`: ゲートウェイ接続に TLS を使用する
- `--tls-fingerprint <sha256>`: 期待される TLS 証明書フィンガープリント（sha256）
- `--node-id <id>`: ノード id を上書きする（ペアリングトークンをクリアします）
- `--display-name <name>`: ノードの表示名を上書きする

## サービス（バックグラウンド）

ヘッドレスノードホストをユーザーサービスとしてインストールします。

```bash
openclaw node install --host <gateway-host> --port 18789
```

オプション:

- `--host <host>`: Gateway WebSocket ホスト（デフォルト: `127.0.0.1`）
- `--port <port>`: Gateway WebSocket ポート（デフォルト: `18789`）
- `--tls`: ゲートウェイ接続に TLS を使用する
- `--tls-fingerprint <sha256>`: 期待される TLS 証明書フィンガープリント（sha256）
- `--node-id <id>`: ノード id を上書きする（ペアリングトークンをクリアします）
- `--display-name <name>`: ノードの表示名を上書きする
- `--runtime <runtime>`: サービスのランタイム（`node` または `bun`）
- `--force`: すでにインストール済みの場合は再インストール/上書きする

サービスを管理します:

```bash
openclaw node status
openclaw node stop
openclaw node restart
openclaw node uninstall
```

サービスなしのフォアグラウンドノードホストには `openclaw node run` を使用します。

サービスコマンドは、機械可読な出力のために `--json` を受け付けます。

## ペアリング

最初の接続により、Gateway（ゲートウェイ）上に保留中のノードペアリクエストが作成されます。次の方法で承認してください:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

ノードホストは、ノード id、トークン、表示名、ゲートウェイ接続情報を
`~/.openclaw/node.json` に保存します。

## Exec 承認

`system.run` はローカルの exec 承認によって制御されます:

- `~/.openclaw/exec-approvals.json`
- [Exec 承認](/tools/exec-approvals)
- `openclaw approvals --node <id|name|ip>`（Gateway（ゲートウェイ）から編集します）
