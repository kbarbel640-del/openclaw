---
summary: "Android アプリ（node）：接続ランブック + Canvas / Chat / Camera"
read_when:
  - Android node のペアリングまたは再接続を行うとき
  - Android Gateway（ゲートウェイ）の検出や認証をデバッグするとき
  - クライアント間でチャット履歴の整合性を確認するとき
title: "Android アプリ"
x-i18n:
  source_path: platforms/android.md
  source_hash: 9cd02f12065ce2bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:20Z
---

# Android アプリ（Node）

## サポート概要

- 役割：コンパニオン node アプリ（Android は Gateway をホストしません）。
- Gateway 必須：はい（macOS、Linux、または Windows（WSL2 経由）で実行します）。
- インストール：[はじめに](/start/getting-started) + [ペアリング](/gateway/pairing)。
- Gateway：[ランブック](/gateway) + [設定](/gateway/configuration)。
  - プロトコル：[Gateway プロトコル](/gateway/protocol)（nodes + コントロールプレーン）。

## システム制御

システム制御（launchd / systemd）は Gateway ホスト上で行われます。[Gateway](/gateway) を参照してください。

## 接続ランブック

Android node アプリ ⇄（mDNS / NSD + WebSocket）⇄ **Gateway**

Android は Gateway の WebSocket（デフォルト `ws://<host>:18789`）に直接接続し、Gateway 管理のペアリングを使用します。

### 前提条件

- 「マスター」マシンで Gateway を実行できること。
- Android デバイス／エミュレーターから Gateway の WebSocket に到達できること：
  - mDNS / NSD を利用した同一 LAN、**または**
  - Tailscale を利用した同一 tailnet（Wide-Area Bonjour / unicast DNS-SD を使用、下記参照）、**または**
  - Gateway のホスト／ポートを手動指定（フォールバック）
- Gateway マシン上（または SSH 経由）で CLI（`openclaw`）を実行できること。

### 1) Gateway を起動

```bash
openclaw gateway --port 18789 --verbose
```

ログに次のような出力が表示されることを確認してください：

- `listening on ws://0.0.0.0:18789`

tailnet のみの構成（Vienna ⇄ London など、推奨）の場合は、Gateway を tailnet IP にバインドします：

- Gateway ホスト上の `~/.openclaw/openclaw.json` で `gateway.bind: "tailnet"` を設定します。
- Gateway / macOS メニューバーアプリを再起動します。

### 2) 検出を確認（任意）

Gateway マシンから：

```bash
dns-sd -B _openclaw-gw._tcp local.
```

追加のデバッグ情報：[Bonjour](/gateway/bonjour)。

#### unicast DNS-SD による Tailnet（Vienna ⇄ London）検出

Android の NSD / mDNS 検出はネットワークをまたぎません。Android node と Gateway が異なるネットワーク上にあり、Tailscale で接続されている場合は、Wide-Area Bonjour / unicast DNS-SD を使用してください：

1. Gateway ホスト上に DNS-SD ゾーン（例：`openclaw.internal.`）を設定し、`_openclaw-gw._tcp` レコードを公開します。
2. 選択したドメインをその DNS サーバーに向ける Tailscale の split DNS を設定します。

詳細および CoreDNS 設定例：[Bonjour](/gateway/bonjour)。

### 3) Android から接続

Android アプリ内で：

- アプリは **フォアグラウンドサービス**（永続通知）を通じて Gateway との接続を維持します。
- **Settings** を開きます。
- **Discovered Gateways** の下で Gateway を選択し、**Connect** をタップします。
- mDNS がブロックされている場合は、**Advanced → Manual Gateway**（ホスト + ポート）を使用し、**Connect (Manual)** をタップします。

最初のペアリングが成功すると、Android は起動時に自動再接続します：

- 手動エンドポイント（有効な場合）、それ以外は
- 最後に検出された Gateway（ベストエフォート）。

### 4) ペアリングを承認（CLI）

Gateway マシン上で：

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

ペアリングの詳細：[Gateway ペアリング](/gateway/pairing)。

### 5) node が接続されていることを確認

- nodes のステータスから：
  ```bash
  openclaw nodes status
  ```
- Gateway から：
  ```bash
  openclaw gateway call node.list --params "{}"
  ```

### 6) チャット + 履歴

Android node の Chat シートは Gateway の **primary session key**（`main`）を使用するため、履歴や返信は WebChat や他のクライアントと共有されます：

- 履歴：`chat.history`
- 送信：`chat.send`
- プッシュ更新（ベストエフォート）：`chat.subscribe` → `event:"chat"`

### 7) Canvas + カメラ

#### Gateway Canvas Host（Web コンテンツ向けに推奨）

エージェントがディスク上で編集できる実際の HTML / CSS / JS を node に表示したい場合は、node を Gateway の canvas host に向けてください。

注：nodes は `canvasHost.port` 上のスタンドアロン canvas host（デフォルト `18793`）を使用します。

1. Gateway ホスト上に `~/.openclaw/workspace/canvas/index.html` を作成します。

2. node からそれにアクセスします（LAN）：

```bash
openclaw nodes invoke --node "<Android Node>" --command canvas.navigate --params '{"url":"http://<gateway-hostname>.local:18793/__openclaw__/canvas/"}'
```

tailnet（任意）：両方のデバイスが Tailscale 上にある場合は、`.local` の代わりに MagicDNS 名または tailnet IP を使用してください。例：`http://<gateway-magicdns>:18793/__openclaw__/canvas/`。

このサーバーは HTML にライブリロードクライアントを注入し、ファイル変更時に再読み込みします。
A2UI ホストは `http://<gateway-host>:18793/__openclaw__/a2ui/` にあります。

Canvas コマンド（フォアグラウンドのみ）：

- `canvas.eval`、`canvas.snapshot`、`canvas.navigate`（デフォルトのスキャフォールドに戻るには `{"url":""}` または `{"url":"/"}` を使用します）。`canvas.snapshot` は `{ format, base64 }`（デフォルト `format="jpeg"`）を返します。
- A2UI：`canvas.a2ui.push`、`canvas.a2ui.reset`（`canvas.a2ui.pushJSONL` はレガシーエイリアス）

カメラコマンド（フォアグラウンドのみ、権限による制御あり）：

- `camera.snap`（jpg）
- `camera.clip`（mp4）

パラメーターおよび CLI ヘルパーについては [Camera node](/nodes/camera) を参照してください。
