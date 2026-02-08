---
summary: "チャンネル、ルーティング、メディア、UX にわたる OpenClaw の機能です。"
read_when:
  - OpenClaw がサポートする内容の完全な一覧が必要なとき
title: "機能"
x-i18n:
  source_path: concepts/features.md
  source_hash: 1b6aee0bfda75182
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:02:46Z
---

## ハイライト

<Columns>
  <Card title="Channels" icon="message-square">
    1 つの Gateway（ゲートウェイ）で WhatsApp、Telegram、Discord、iMessage に対応します。
  </Card>
  <Card title="Plugins" icon="plug">
    拡張機能で Mattermost などを追加できます。
  </Card>
  <Card title="Routing" icon="route">
    分離されたセッションによるマルチエージェントルーティングです。
  </Card>
  <Card title="Media" icon="image">
    画像、音声、ドキュメントの送受信に対応します。
  </Card>
  <Card title="Apps and UI" icon="monitor">
    Web Control UI と macOS コンパニオンアプリです。
  </Card>
  <Card title="Mobile nodes" icon="smartphone">
    Canvas 対応の iOS および Android ノードです。
  </Card>
</Columns>

## 完全な一覧

- WhatsApp Web（Baileys）経由の WhatsApp 統合
- Telegram ボット対応（grammY）
- Discord ボット対応（channels.discord.js）
- Mattermost ボット対応（プラグイン）
- local imsg CLI（macOS）経由の iMessage 統合
- ツールストリーミング付き RPC モードにおける Pi 向けエージェントブリッジ
- 長い応答に対するストリーミングとチャンク分割
- ワークスペースまたは送信者ごとに分離されたセッションのためのマルチエージェントルーティング
- OAuth 経由の Anthropic および OpenAI に対するサブスクリプション認証
- セッション: ダイレクトチャットは共有の `main` に統合され、グループは分離されます
- メンションベースの起動によるグループチャット対応
- 画像、音声、ドキュメントのメディア対応
- オプションのボイスノート文字起こしフック
- WebChat と macOS メニューバーアプリ
- ペアリングと Canvas サーフェスを備えた iOS ノード
- ペアリング、Canvas、チャット、カメラを備えた Android ノード

<Note>
レガシーの Claude、Codex、Gemini、Opencode の経路は削除されました。Pi が唯一の
コーディングエージェント経路です。
</Note>
