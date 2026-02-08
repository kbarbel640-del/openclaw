---
summary: "SSH 経由でリモートの OpenClaw Gateway（ゲートウェイ）を制御する macOS アプリのフロー"
read_when:
  - リモート mac 制御のセットアップまたはデバッグ時
title: "リモート制御"
x-i18n:
  source_path: platforms/mac/remote.md
  source_hash: 61b43707250d5515
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:33Z
---

# リモート OpenClaw（macOS ⇄ リモートホスト）

このフローでは、macOS アプリを別のホスト（デスクトップ／サーバー）で実行中の OpenClaw Gateway（ゲートウェイ）に対する完全なリモートコントローラーとして動作させます。これはアプリの **Remote over SSH**（リモート実行）機能です。ヘルスチェック、Voice Wake の転送、Web Chat を含むすべての機能は、_Settings → General_ にある同一のリモート SSH 設定を再利用します。

## モード

- **Local（この Mac）**: すべてがノートパソコン上で実行されます。SSH は使用しません。
- **Remote over SSH（デフォルト）**: OpenClaw のコマンドがリモートホスト上で実行されます。mac アプリは `-o BatchMode` に、選択した ID／キーとローカルのポートフォワードを組み合わせて SSH 接続を開きます。
- **Remote direct（ws/wss）**: SSH トンネルを使用しません。mac アプリは Gateway（ゲートウェイ）の URL に直接接続します（例: Tailscale Serve や公開 HTTPS リバースプロキシ経由）。

## リモートトランスポート

リモートモードは 2 種類のトランスポートをサポートします。

- **SSH トンネル**（デフォルト）: `ssh -N -L ...` を使用して Gateway（ゲートウェイ）のポートを localhost にフォワードします。トンネルは loopback のため、Gateway（ゲートウェイ）からはノードの IP が `127.0.0.1` として認識されます。
- **Direct（ws/wss）**: Gateway（ゲートウェイ）の URL に直接接続します。Gateway（ゲートウェイ）からは実際のクライアント IP が認識されます。

## リモートホスト側の前提条件

1. Node + pnpm をインストールし、OpenClaw CLI（`pnpm install && pnpm build && pnpm link --global`）をビルド／インストールします。
2. 非対話シェルでも `openclaw` が PATH 上にあることを確認します（必要に応じて `/usr/local/bin` または `/opt/homebrew/bin` にシンボリックリンクします）。
3. キー認証で SSH を有効にします。LAN 外からの安定した到達性のため、**Tailscale** の IP を推奨します。

## macOS アプリのセットアップ

1. _Settings → General_ を開きます。
2. **OpenClaw runs** で **Remote over SSH** を選択し、以下を設定します。
   - **Transport**: **SSH tunnel** または **Direct（ws/wss）**。
   - **SSH target**: `user@host`（任意で `:port`）。
     - Gateway（ゲートウェイ）が同一 LAN 上にあり Bonjour をアドバタイズしている場合、検出リストから選択するとこの項目が自動入力されます。
   - **Gateway URL**（Direct のみ）: `wss://gateway.example.ts.net`（ローカル／LAN の場合は `ws://...`）。
   - **Identity file**（詳細）: 使用するキーのパス。
   - **Project root**（詳細）: コマンド実行に使用されるリモートのチェックアウトパス。
   - **CLI path**（詳細）: 実行可能な `openclaw` のエントリーポイント／バイナリへの任意のパス（アドバタイズされている場合は自動入力）。
3. **Test remote** をクリックします。成功すれば、リモートの `openclaw status --json` が正しく実行されていることを示します。失敗は通常 PATH／CLI の問題を意味します。終了コード 127 は、リモートで CLI が見つからないことを示します。
4. 以後、ヘルスチェックと Web Chat は自動的にこの SSH トンネル経由で実行されます。

## Web Chat

- **SSH トンネル**: Web Chat はフォワードされた WebSocket 制御ポート（デフォルト 18789）経由で Gateway（ゲートウェイ）に接続します。
- **Direct（ws/wss）**: Web Chat は設定された Gateway（ゲートウェイ）URL に直接接続します。
- もはや WebChat 用の個別 HTTP サーバーは存在しません。

## 権限

- リモートホストには、ローカルと同じ TCC 承認（Automation、Accessibility、Screen Recording、Microphone、Speech Recognition、Notifications）が必要です。一度そのマシンでオンボーディングを実行して付与してください。
- ノードは `node.list` / `node.describe` を通じて権限状態をアドバタイズし、エージェントが利用可能な機能を把握できるようにします。

## セキュリティに関する注意

- リモートホストでは loopback へのバインドを優先し、SSH または Tailscale 経由で接続してください。
- Gateway（ゲートウェイ）を非 loopback インターフェースにバインドする場合は、トークン／パスワード認証を必須にしてください。
- [Security](/gateway/security) および [Tailscale](/gateway/tailscale) を参照してください。

## WhatsApp ログインフロー（リモート）

- `openclaw channels login --verbose` を **リモートホスト上で** 実行します。スマートフォンの WhatsApp で QR をスキャンしてください。
- 認証が期限切れになった場合は、そのホストで再度ログインを実行します。ヘルスチェックでリンクの問題が表示されます。

## トラブルシューティング

- **exit 127 / not found**: `openclaw` が非ログインシェルの PATH にありません。`/etc/paths`、シェルの rc、または `/usr/local/bin`/`/opt/homebrew/bin` へのシンボリックリンクに追加してください。
- **Health probe failed**: SSH の到達性、PATH、そして Baileys がログイン済みであること（`openclaw status --json`）を確認してください。
- **Web Chat が停止する**: リモートホストで Gateway（ゲートウェイ）が実行中であり、フォワードされたポートが Gateway（ゲートウェイ）の WS ポートと一致していることを確認してください。UI には正常な WS 接続が必要です。
- **Node IP が 127.0.0.1 と表示される**: SSH トンネル使用時は想定どおりです。Gateway（ゲートウェイ）に実際のクライアント IP を認識させたい場合は、**Transport** を **Direct（ws/wss）** に切り替えてください。
- **Voice Wake**: リモートモードではトリガーフレーズが自動的に転送されます。個別のフォワーダーは不要です。

## 通知サウンド

`openclaw` と `node.invoke` を使用して、スクリプトから通知ごとにサウンドを選択します。例:

```bash
openclaw nodes notify --node <id> --title "Ping" --body "Remote gateway ready" --sound Glass
```

アプリにはもはやグローバルな「デフォルトサウンド」切り替えはありません。呼び出し元がリクエストごとにサウンド（またはなし）を選択します。
