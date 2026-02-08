---
summary: "iOS ノードアプリ：Gateway（ゲートウェイ）への接続、ペアリング、キャンバス、トラブルシューティング"
read_when:
  - iOS ノードのペアリングまたは再接続
  - ソースから iOS アプリを実行する場合
  - ゲートウェイ検出やキャンバスコマンドのデバッグ
title: "iOS アプリ"
x-i18n:
  source_path: platforms/ios.md
  source_hash: 692eebdc82e4bb8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:20Z
---

# iOS アプリ（Node）

提供状況：内部プレビュー。iOS アプリはまだ一般公開されていません。

## 概要

- WebSocket（LAN または tailnet）経由で Gateway（ゲートウェイ）に接続します。
- ノードの機能を公開します：Canvas、画面スナップショット、カメラキャプチャ、位置情報、トークモード、ボイスウェイク。
- `node.invoke` コマンドを受信し、ノードのステータスイベントを報告します。

## 要件

- 別のデバイス（macOS、Linux、または WSL2 経由の Windows）で稼働する Gateway（ゲートウェイ）。
- ネットワーク経路：
  - Bonjour による同一 LAN、**または**
  - ユニキャスト DNS-SD（例のドメイン：`openclaw.internal.`）による tailnet、**または**
  - 手動のホスト／ポート（フォールバック）。

## クイックスタート（ペアリング + 接続）

1. Gateway（ゲートウェイ）を起動します：

```bash
openclaw gateway --port 18789
```

2. iOS アプリで「設定」を開き、検出されたゲートウェイを選択します（または「Manual Host」を有効にしてホスト／ポートを入力します）。

3. ゲートウェイのホストでペアリング要求を承認します：

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

4. 接続を確認します：

```bash
openclaw nodes status
openclaw gateway call node.list --params "{}"
```

## 検出経路

### Bonjour（LAN）

Gateway（ゲートウェイ）は `local.` 上で `_openclaw-gw._tcp` をアドバタイズします。iOS アプリはこれらを自動的に一覧表示します。

### Tailnet（クロスネットワーク）

mDNS がブロックされている場合は、ユニキャスト DNS-SD ゾーン（ドメインを選択。例：`openclaw.internal.`）と Tailscale のスプリット DNS を使用します。
CoreDNS の例については [Bonjour](/gateway/bonjour) を参照してください。

### 手動のホスト／ポート

「設定」で **Manual Host** を有効にし、ゲートウェイのホスト + ポート（デフォルト `18789`）を入力します。

## Canvas + A2UI

iOS ノードは WKWebView のキャンバスを描画します。`node.invoke` を使用して操作します：

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.navigate --params '{"url":"http://<gateway-host>:18793/__openclaw__/canvas/"}'
```

注意事項：

- Gateway（ゲートウェイ）のキャンバスホストは `/__openclaw__/canvas/` と `/__openclaw__/a2ui/` を提供します。
- キャンバスホストの URL がアドバタイズされると、iOS ノードは接続時に A2UI へ自動的にナビゲートします。
- `canvas.navigate` と `{"url":""}` を使用して、内蔵のスキャフォールドに戻ります。

### Canvas の eval／スナップショット

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.eval --params '{"javaScript":"(() => { const {ctx} = window.__openclaw; ctx.clearRect(0,0,innerWidth,innerHeight); ctx.lineWidth=6; ctx.strokeStyle=\"#ff2d55\"; ctx.beginPath(); ctx.moveTo(40,40); ctx.lineTo(innerWidth-40, innerHeight-40); ctx.stroke(); return \"ok\"; })()"}'
```

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.snapshot --params '{"maxWidth":900,"format":"jpeg"}'
```

## ボイスウェイク + トークモード

- ボイスウェイクとトークモードは「設定」で利用できます。
- iOS はバックグラウンドオーディオを停止する場合があります。アプリがアクティブでないときの音声機能はベストエフォートとして扱ってください。

## よくあるエラー

- `NODE_BACKGROUND_UNAVAILABLE`：iOS アプリをフォアグラウンドにしてください（キャンバス／カメラ／画面コマンドには必要です）。
- `A2UI_HOST_NOT_CONFIGURED`：Gateway（ゲートウェイ）がキャンバスホスト URL をアドバタイズしていません。[Gateway 設定](/gateway/configuration) の `canvasHost` を確認してください。
- ペアリングのプロンプトが表示されない：`openclaw nodes pending` を実行し、手動で承認してください。
- 再インストール後に再接続できない：Keychain のペアリングトークンが消去されています。ノードを再度ペアリングしてください。

## 関連ドキュメント

- [ペアリング](/gateway/pairing)
- [検出](/gateway/discovery)
- [Bonjour](/gateway/bonjour)
