---
summary: "OpenClaw は、あらゆる OS で動作する AI エージェント向けのマルチチャンネル Gateway（ゲートウェイ）です。"
read_when:
  - OpenClaw を初めて知る方に紹介する場合
title: "OpenClaw"
x-i18n:
  source_path: index.md
  source_hash: 97a613c67efb448b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:09Z
---

# OpenClaw 🦞

<p align="center">
    <img
        src="/assets/openclaw-logo-text-dark.png"
        alt="OpenClaw"
        width="500"
        class="dark:hidden"
    />
    <img
        src="/assets/openclaw-logo-text.png"
        alt="OpenClaw"
        width="500"
        class="hidden dark:block"
    />
</p>

> _「EXFOLIATE! EXFOLIATE!」_ — おそらく宇宙ロブスターの言葉です

<p align="center">
  <strong>WhatsApp、Telegram、Discord、iMessage などに対応する、AI エージェント向けの Any OS Gateway（ゲートウェイ）。</strong><br />
  メッセージを送るだけで、ポケットからエージェントの応答を受け取れます。プラグインにより Mattermost なども追加できます。
</p>

<Columns>
  <Card title="Get Started" href="/start/getting-started" icon="rocket">
    OpenClaw をインストールし、数分で Gateway（ゲートウェイ）を起動できます。
  </Card>
  <Card title="Run the Wizard" href="/start/wizard" icon="sparkles">
    `openclaw onboard` とペアリングフローによるガイド付きセットアップです。
  </Card>
  <Card title="Open the Control UI" href="/web/control-ui" icon="layout-dashboard">
    チャット、設定、セッション用のブラウザダッシュボードを起動します。
  </Card>
</Columns>

## OpenClaw とは？

OpenClaw は **セルフホスト型 Gateway（ゲートウェイ）** であり、WhatsApp、Telegram、Discord、iMessage などのお気に入りのチャットアプリを、Pi のような AI コーディングエージェントに接続します。自身のマシン（またはサーバー）上で単一の Gateway プロセスを実行するだけで、メッセージングアプリと常時利用可能な AI アシスタントをつなぐ橋渡しとなります。

**対象ユーザーは？** どこからでもメッセージできる個人用 AI アシスタントを求めつつ、データの管理権限を手放さず、ホスト型サービスに依存したくない開発者やパワーユーザーです。

**何が違うのか？**

- **セルフホスト**: 自分のハードウェアで、自分のルールで動作します
- **マルチチャンネル**: 1 つの Gateway で WhatsApp、Telegram、Discord などを同時に提供します
- **エージェントネイティブ**: ツール利用、セッション、メモリ、マルチエージェントルーティングを備えたコーディングエージェント向け設計です
- **オープンソース**: MIT ライセンス、コミュニティ主導です

**必要なものは？** Node 22 以上、API キー（Anthropic 推奨）、そして 5 分です。

## 仕組み

```mermaid
flowchart LR
  A["Chat apps + plugins"] --> B["Gateway"]
  B --> C["Pi agent"]
  B --> D["CLI"]
  B --> E["Web Control UI"]
  B --> F["macOS app"]
  B --> G["iOS and Android nodes"]
```

Gateway（ゲートウェイ）は、セッション、ルーティング、チャンネル接続における単一の信頼できる情報源です。

## 主な機能

<Columns>
  <Card title="Multi-channel gateway" icon="network">
    単一の Gateway プロセスで WhatsApp、Telegram、Discord、iMessage に対応します。
  </Card>
  <Card title="Plugin channels" icon="plug">
    拡張パッケージで Mattermost などを追加できます。
  </Card>
  <Card title="Multi-agent routing" icon="route">
    エージェント、ワークスペース、送信者ごとに分離されたセッションです。
  </Card>
  <Card title="Media support" icon="image">
    画像、音声、ドキュメントの送受信が可能です。
  </Card>
  <Card title="Web Control UI" icon="monitor">
    チャット、設定、セッション、ノード向けのブラウザダッシュボードです。
  </Card>
  <Card title="Mobile nodes" icon="smartphone">
    Canvas 対応の iOS および Android ノードをペアリングできます。
  </Card>
</Columns>

## クイックスタート

<Steps>
  <Step title="Install OpenClaw">
    ```bash
    npm install -g openclaw@latest
    ```
  </Step>
  <Step title="Onboard and install the service">
    ```bash
    openclaw onboard --install-daemon
    ```
  </Step>
  <Step title="Pair WhatsApp and start the Gateway">
    ```bash
    openclaw channels login
    openclaw gateway --port 18789
    ```
  </Step>
</Steps>

完全なインストール手順や開発環境のセットアップが必要ですか？ [Quick start](/start/quickstart) を参照してください。

## ダッシュボード

Gateway の起動後、ブラウザの Control UI を開きます。

- ローカル既定: http://127.0.0.1:18789/
- リモートアクセス: [Web surfaces](/web) および [Tailscale](/gateway/tailscale)

<p align="center">
  <img src="whatsapp-openclaw.jpg" alt="OpenClaw" width="420" />
</p>

## 設定（任意）

設定は `~/.openclaw/openclaw.json` にあります。

- **何もしない場合**、OpenClaw はバンドルされた Pi バイナリを RPC モードで使用し、送信者ごとのセッションを作成します。
- 制限を強化したい場合は、`channels.whatsapp.allowFrom` から始め、（グループ向けには）メンションルールを設定してください。

例:

```json5
{
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
  messages: { groupChat: { mentionPatterns: ["@openclaw"] } },
}
```

## ここから始める

<Columns>
  <Card title="Docs hubs" href="/start/hubs" icon="book-open">
    すべてのドキュメントとガイドを、ユースケース別に整理しています。
  </Card>
  <Card title="Configuration" href="/gateway/configuration" icon="settings">
    中核となる Gateway 設定、トークン、プロバイダー設定です。
  </Card>
  <Card title="Remote access" href="/gateway/remote" icon="globe">
    SSH と tailnet のアクセスパターンです。
  </Card>
  <Card title="Channels" href="/channels/telegram" icon="message-square">
    WhatsApp、Telegram、Discord など、チャンネル別のセットアップです。
  </Card>
  <Card title="Nodes" href="/nodes" icon="smartphone">
    ペアリングと Canvas に対応した iOS および Android ノードです。
  </Card>
  <Card title="Help" href="/help" icon="life-buoy">
    一般的な対処法とトラブルシューティングの入口です。
  </Card>
</Columns>

## さらに詳しく

<Columns>
  <Card title="Full feature list" href="/concepts/features" icon="list">
    チャンネル、ルーティング、メディア機能の完全な一覧です。
  </Card>
  <Card title="Multi-agent routing" href="/concepts/multi-agent" icon="route">
    ワークスペースの分離とエージェントごとのセッションです。
  </Card>
  <Card title="Security" href="/gateway/security" icon="shield">
    トークン、許可リスト、安全制御について説明します。
  </Card>
  <Card title="Troubleshooting" href="/gateway/troubleshooting" icon="wrench">
    Gateway の診断と一般的なエラーです。
  </Card>
  <Card title="About and credits" href="/reference/credits" icon="info">
    プロジェクトの起源、貢献者、ライセンスについてです。
  </Card>
</Columns>
