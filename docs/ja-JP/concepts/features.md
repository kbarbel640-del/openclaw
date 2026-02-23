---
summary: "チャネル、ルーティング、メディア、UX にわたる OpenClaw の機能一覧。"
read_when:
  - OpenClaw がサポートする機能の一覧を確認したいとき
title: "機能"
---

## 主なポイント

<Columns>
  <Card title="Channels" icon="message-square">
    統合ゲートウェイ経由の WhatsApp / Telegram / Discord / iMessage 連携。
  </Card>
  <Card title="Plugins" icon="plug">
    Microsoft Teams などの追加を可能にするプラグイン拡張。
  </Card>
  <Card title="Routing" icon="route">
    ワークスペース単位のセッション分離によるマルチエージェント・ルーティング。
  </Card>
  <Card title="Media" icon="image">
    画像・音声・ドキュメントの入出力対応。
  </Card>
  <Card title="Apps and UI" icon="monitor">
    Web ベースの管理 UI と macOS デスクトップアプリ。
  </Card>
  <Card title="Mobile nodes" icon="smartphone">
    Canvas 対応の iOS / Android 実行ノード。
  </Card>
</Columns>

## 機能一覧

- WhatsApp 連携（WhatsApp Web / Baileys）
- Telegram 連携（ボット / grammY）
- Discord 連携（ボット / channels.discord.js）
- Microsoft Teams 連携（プラグイン）
- iMessage 連携（macOS / ローカル `imsg` CLI）
- Pi エージェントブリッジ（RPC モード / ツールストリーミング対応）
- 長文応答のストリーミング配信とチャンキング
- セッション分離（ワークスペース単位または送信者単位）
- マルチエージェント・ルーティング（セッション分離ベース）
- サブスクリプション認証（Anthropic / OpenAI OAuth）
- セッション運用（ダイレクトチャットは共有 `main`、グループは個別分離）
- グループチャット起動（メンションによる起動）
- メディア入出力（画像・音声・ドキュメント）
- 音声メモ文字起こし（任意フック）
- クライアント UI（WebChat / macOS メニューバーアプリ）
- iOS ノード（ペアリング / Canvas 対応）
- Android ノード（ペアリング / チャット / カメラ対応）

<Note>
従来の Claude、Codex、Gemini、Opencode のパスは削除されました。現在のコーディングエージェントのパスは Pi のみです。
</Note>
