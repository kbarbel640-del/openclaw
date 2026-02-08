---
summary: "分離や iMessage が必要な場合に、サンドボックス化された macOS VM（ローカルまたはホスト型）で OpenClaw を実行します"
read_when:
  - メインの macOS 環境から OpenClaw を分離したい場合
  - サンドボックス内で iMessage 連携（BlueBubbles）を使いたい場合
  - クローン可能でリセットできる macOS 環境が欲しい場合
  - ローカルとホスト型の macOS VM オプションを比較したい場合
title: "macOS VM"
x-i18n:
  source_path: install/macos-vm.md
  source_hash: 4d1c85a5e4945f9f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:12Z
---

# macOS VM 上の OpenClaw（サンドボックス化）

## 推奨デフォルト（ほとんどのユーザー向け）

- **小規模 Linux VPS**：常時稼働の Gateway（ゲートウェイ）と低コストを両立します。[VPS hosting](/vps) を参照してください。
- **専用ハードウェア**（Mac mini または Linux マシン）：フルコントロールが必要で、ブラウザ自動化に **住宅用 IP** を使いたい場合に適しています。多くのサイトはデータセンター IP をブロックするため、ローカルブラウジングの方がうまく動作することが多いです。
- **ハイブリッド**：Gateway（ゲートウェイ）は安価な VPS に置き、ブラウザ／UI 自動化が必要なときだけ Mac を **ノード** として接続します。[Nodes](/nodes) と [Gateway remote](/gateway/remote) を参照してください。

macOS 専用機能（iMessage／BlueBubbles）が必要な場合や、日常利用の Mac から厳密に分離したい場合にのみ macOS VM を使用してください。

## macOS VM の選択肢

### Apple Silicon Mac 上のローカル VM（Lume）

既存の Apple Silicon Mac 上で、[Lume](https://cua.ai/docs/lume) を使ってサンドボックス化された macOS VM で OpenClaw を実行します。

これにより、次が得られます。

- 分離された完全な macOS 環境（ホストはクリーンなまま）
- BlueBubbles による iMessage 対応（Linux／Windows では不可能）
- VM のクローンによる即時リセット
- 追加ハードウェアやクラウド費用なし

### ホスト型 Mac プロバイダー（クラウド）

クラウド上で macOS が必要な場合、ホスト型 Mac プロバイダーも利用できます。

- [MacStadium](https://www.macstadium.com/)（ホスト型 Mac）
- その他のホスト型 Mac ベンダーも利用可能です。各社の VM + SSH ドキュメントに従ってください。

macOS VM への SSH アクセスを取得したら、以下の手順 6 に進んでください。

---

## クイックパス（Lume、経験者向け）

1. Lume をインストール
2. `lume create openclaw --os macos --ipsw latest`
3. セットアップアシスタントを完了し、リモートログイン（SSH）を有効化
4. `lume run openclaw --no-display`
5. SSH で接続し、OpenClaw をインストールしてチャンネルを設定
6. 完了

---

## 必要なもの（Lume）

- Apple Silicon Mac（M1／M2／M3／M4）
- ホストに macOS Sequoia 以降
- VM あたり約 60 GB の空きディスク容量
- 約 20 分

---

## 1) Lume をインストール

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/lume/scripts/install.sh)"
```

`~/.local/bin` が PATH にない場合：

```bash
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.zshrc && source ~/.zshrc
```

確認：

```bash
lume --version
```

ドキュメント：[Lume Installation](https://cua.ai/docs/lume/guide/getting-started/installation)

---

## 2) macOS VM を作成

```bash
lume create openclaw --os macos --ipsw latest
```

macOS をダウンロードして VM を作成します。VNC ウィンドウが自動的に開きます。

注意：ダウンロードには接続状況により時間がかかる場合があります。

---

## 3) セットアップアシスタントを完了

VNC ウィンドウ内で次を行います。

1. 言語と地域を選択
2. Apple ID はスキップ（後で iMessage を使う場合はサインインしても構いません）
3. ユーザーアカウントを作成（ユーザー名とパスワードを記録）
4. すべてのオプション機能をスキップ

セットアップ完了後、SSH を有効化します。

1. システム設定 → 一般 → 共有 を開く
2. 「リモートログイン」を有効化

---

## 4) VM の IP アドレスを取得

```bash
lume get openclaw
```

IP アドレスを確認します（通常は `192.168.64.x`）。

---

## 5) VM に SSH 接続

```bash
ssh youruser@192.168.64.X
```

`youruser` を作成したアカウントに置き換え、IP は VM の IP に置き換えてください。

---

## 6) OpenClaw をインストール

VM 内で実行します。

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

オンボーディングの指示に従い、モデルプロバイダー（Anthropic、OpenAI など）を設定します。

---

## 7) チャンネルを設定

設定ファイルを編集します。

```bash
nano ~/.openclaw/openclaw.json
```

チャンネルを追加します。

```json
{
  "channels": {
    "whatsapp": {
      "dmPolicy": "allowlist",
      "allowFrom": ["+15551234567"]
    },
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN"
    }
  }
}
```

その後、WhatsApp にログイン（QR をスキャン）します。

```bash
openclaw channels login
```

---

## 8) ヘッドレスで VM を実行

VM を停止し、表示なしで再起動します。

```bash
lume stop openclaw
lume run openclaw --no-display
```

VM はバックグラウンドで実行されます。OpenClaw のデーモンが Gateway（ゲートウェイ）を稼働させ続けます。

状態を確認するには：

```bash
ssh youruser@192.168.64.X "openclaw status"
```

---

## ボーナス：iMessage 連携

これは macOS で実行する最大の利点です。[BlueBubbles](https://bluebubbles.app) を使って OpenClaw に iMessage を追加します。

VM 内で次を行います。

1. bluebubbles.app から BlueBubbles をダウンロード
2. Apple ID でサインイン
3. Web API を有効化し、パスワードを設定
4. BlueBubbles の Webhook を Gateway（ゲートウェイ）に向ける（例：`https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`）

OpenClaw の設定に追加します。

```json
{
  "channels": {
    "bluebubbles": {
      "serverUrl": "http://localhost:1234",
      "password": "your-api-password",
      "webhookPath": "/bluebubbles-webhook"
    }
  }
}
```

Gateway（ゲートウェイ）を再起動します。これでエージェントが iMessage を送受信できるようになります。

詳細なセットアップ：[BlueBubbles channel](/channels/bluebubbles)

---

## ゴールデンイメージを保存

さらにカスタマイズする前に、クリーンな状態をスナップショットします。

```bash
lume stop openclaw
lume clone openclaw openclaw-golden
```

いつでもリセットできます。

```bash
lume stop openclaw && lume delete openclaw
lume clone openclaw-golden openclaw
lume run openclaw --no-display
```

---

## 24/7 で実行

VM を常時稼働させるには：

- Mac を電源に接続したままにする
- システム設定 → 省エネルギー でスリープを無効化
- 必要に応じて `caffeinate` を使用

真の常時稼働が必要な場合は、専用の Mac mini や小規模 VPS を検討してください。[VPS hosting](/vps) を参照してください。

---

## トラブルシューティング

| 問題                          | 解決策                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| VM に SSH 接続できない        | VM のシステム設定で「リモートログイン」が有効になっているか確認してください                        |
| VM の IP が表示されない       | VM が完全に起動するまで待ち、再度 `lume get openclaw` を実行してください                           |
| Lume コマンドが見つからない   | `~/.local/bin` を PATH に追加してください                                                          |
| WhatsApp の QR が読み取れない | `openclaw channels login` を実行する際、ホストではなく VM にログインしていることを確認してください |

---

## 関連ドキュメント

- [VPS hosting](/vps)
- [Nodes](/nodes)
- [Gateway remote](/gateway/remote)
- [BlueBubbles channel](/channels/bluebubbles)
- [Lume Quickstart](https://cua.ai/docs/lume/guide/getting-started/quickstart)
- [Lume CLI Reference](https://cua.ai/docs/lume/reference/cli-reference)
- [Unattended VM Setup](https://cua.ai/docs/lume/guide/fundamentals/unattended-setup)（上級）
- [Docker Sandboxing](/install/docker)（代替の分離手法）
