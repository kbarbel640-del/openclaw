---
summary: "OpenClaw アプリ、ゲートウェイノードトランスポート、および PeekabooBridge のための macOS IPC アーキテクチャ"
read_when:
  - IPC コントラクトまたはメニューバーアプリの IPC を編集する場合
title: "macOS IPC"
x-i18n:
  source_path: platforms/mac/xpc.md
  source_hash: d0211c334a4a59b7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:28Z
---

# OpenClaw macOS IPC アーキテクチャ

**現在のモデル:** ローカルの Unix ソケットが **ノードホストサービス** を **macOS アプリ** に接続し、exec 承認 + `system.run` を行います。検出 / 接続チェック用に `openclaw-mac` のデバッグ CLI が存在しますが、エージェントのアクションは引き続き Gateway WebSocket と `node.invoke` を経由します。UI 自動化には PeekabooBridge を使用します。

## 目標

- すべての TCC 対応作業（通知、画面収録、マイク、音声、AppleScript）を所有する単一の GUI アプリインスタンス。
- 自動化のための小さなサーフェス: Gateway + ノードコマンド、および UI 自動化用の PeekabooBridge。
- 予測可能な権限管理: 常に同じ署名済みバンドル ID、launchd によって起動されるため、TCC の許可が維持されます。

## 仕組み

### Gateway + ノードトランスポート

- アプリは Gateway（ローカルモード）を実行し、ノードとしてそれに接続します。
- エージェントのアクションは `node.invoke`（例: `system.run`、`system.notify`、`canvas.*`）を介して実行されます。

### ノードサービス + アプリ IPC

- ヘッドレスのノードホストサービスが Gateway WebSocket に接続します。
- `system.run` リクエストは、ローカル Unix ソケット経由で macOS アプリに転送されます。
- アプリは UI コンテキストで exec を実行し、必要に応じてプロンプトを表示し、結果を返します。

図（SCI）:

```
Agent -> Gateway -> Node Service (WS)
                      |  IPC (UDS + token + HMAC + TTL)
                      v
                  Mac App (UI + TCC + system.run)
```

### PeekabooBridge（UI 自動化）

- UI 自動化は、`bridge.sock` という名前の別個の UNIX ソケットと PeekabooBridge JSON プロトコルを使用します。
- ホストの優先順位（クライアント側）: Peekaboo.app → Claude.app → OpenClaw.app → ローカル実行。
- セキュリティ: ブリッジホストには許可された TeamID が必要です。DEBUG のみの same-UID エスケープハッチは `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1`（Peekaboo の慣例）によって保護されています。
- 詳細は [PeekabooBridge の使用方法](/platforms/mac/peekaboo) を参照してください。

## 運用フロー

- 再起動 / 再ビルド: `SIGN_IDENTITY="Apple Development: <Developer Name> (<TEAMID>)" scripts/restart-mac.sh`
  - 既存のインスタンスを終了
  - Swift のビルド + パッケージング
  - LaunchAgent の書き込み / ブートストラップ / キックスタート
- 単一インスタンス: 同じバンドル ID を持つ別のインスタンスが実行中の場合、アプリは早期に終了します。

## ハードニングに関する注意

- すべての特権サーフェスに対して TeamID の一致を必須とすることを推奨します。
- PeekabooBridge: `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1`（DEBUG のみ）により、ローカル開発用に same-UID 呼び出し元を許可する場合があります。
- すべての通信はローカル専用であり、ネットワークソケットは公開されません。
- TCC のプロンプトは GUI アプリバンドルからのみ発生します。再ビルド間で署名済みバンドル ID を安定させてください。
- IPC のハードニング: ソケットモード `0600`、トークン、peer-UID チェック、HMAC チャレンジ / レスポンス、短い TTL。
