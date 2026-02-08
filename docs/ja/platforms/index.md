---
summary: "プラットフォーム対応の概要（Gateway（ゲートウェイ）+ コンパニオンアプリ）"
read_when:
  - OS 対応やインストール手順を探しているとき
  - Gateway（ゲートウェイ）をどこで実行するかを決めるとき
title: "プラットフォーム"
x-i18n:
  source_path: platforms/index.md
  source_hash: 959479995f9ecca3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:15Z
---

# プラットフォーム

OpenClaw のコアは TypeScript で書かれています。**Node が推奨ランタイム**です。
Bun は Gateway（ゲートウェイ）では推奨されません（WhatsApp／Telegram の不具合）。

コンパニオンアプリは macOS（メニューバーアプリ）およびモバイルノード（iOS／Android）向けに提供されています。Windows と
Linux 向けのコンパニオンアプリは計画中ですが、Gateway（ゲートウェイ）は現在すでに完全にサポートされています。
Windows 向けのネイティブコンパニオンアプリも計画中です。Gateway（ゲートウェイ）は WSL2 経由での利用を推奨します。

## OS を選択

- macOS: [macOS](/platforms/macos)
- iOS: [iOS](/platforms/ios)
- Android: [Android](/platforms/android)
- Windows: [Windows](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## VPS & ホスティング

- VPS ハブ: [VPS hosting](/vps)
- Fly.io: [Fly.io](/install/fly)
- Hetzner（Docker）: [Hetzner](/install/hetzner)
- GCP（Compute Engine）: [GCP](/install/gcp)
- exe.dev（VM + HTTPS プロキシ）: [exe.dev](/install/exe-dev)

## 共通リンク

- インストールガイド: [はじめに](/start/getting-started)
- Gateway（ゲートウェイ）運用手順: [Gateway](/gateway)
- Gateway（ゲートウェイ）設定: [Configuration](/gateway/configuration)
- サービスステータス: `openclaw gateway status`

## Gateway（ゲートウェイ）サービスのインストール（CLI）

以下のいずれかを使用してください（すべてサポートされています）:

- ウィザード（推奨）: `openclaw onboard --install-daemon`
- 直接: `openclaw gateway install`
- フローを設定: `openclaw configure` → **Gateway service** を選択
- 修復／移行: `openclaw doctor`（サービスのインストールまたは修復を提案します）

サービスのターゲットは OS に依存します:

- macOS: LaunchAgent（`bot.molt.gateway` または `bot.molt.<profile>`；旧来の `com.openclaw.*`）
- Linux／WSL2: systemd ユーザーサービス（`openclaw-gateway[-<profile>].service`）
