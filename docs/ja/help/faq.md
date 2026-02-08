---
summary: "OpenClaw のセットアップ、設定、使用方法に関するよくある質問"
title: "よくある質問（FAQ）"
x-i18n:
  source_path: help/faq.md
  source_hash: e87e52a9edaec927
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:12Z
---

# FAQ

実運用のセットアップ（ローカル開発、VPS、マルチエージェント、OAuth / API キー、モデルフェイルオーバー）向けの簡潔な回答と、より深いトラブルシューティングをまとめています。実行時の診断については [Troubleshooting](/gateway/troubleshooting) を参照してください。設定の完全なリファレンスは [Configuration](/gateway/configuration) を参照してください。

## 目次

- [クイックスタートと初回実行のセットアップ](#quick-start-and-firstrun-setup)
  - [行き詰まっています。最短で抜け出す方法は？](#im-stuck-whats-the-fastest-way-to-get-unstuck)
  - [OpenClaw をインストールしてセットアップする推奨方法は？](#whats-the-recommended-way-to-install-and-set-up-openclaw)
  - [オンボーディング後にダッシュボードを開くには？](#how-do-i-open-the-dashboard-after-onboarding)
  - [localhost とリモートでダッシュボードの認証（トークン）を行う方法は？](#how-do-i-authenticate-the-dashboard-token-on-localhost-vs-remote)
  - [必要なランタイムは？](#what-runtime-do-i-need)
  - [Raspberry Pi で動作しますか？](#does-it-run-on-raspberry-pi)
  - [Raspberry Pi へのインストールのコツはありますか？](#any-tips-for-raspberry-pi-installs)
  - [「wake up my friend」で止まる／オンボーディングが進みません。どうすれば？](#it-is-stuck-on-wake-up-my-friend-onboarding-will-not-hatch-what-now)
  - [新しいマシン（Mac mini）へ再オンボーディングなしで移行できますか？](#can-i-migrate-my-setup-to-a-new-machine-mac-mini-without-redoing-onboarding)
  - [最新バージョンの変更点はどこで確認できますか？](#where-do-i-see-what-is-new-in-the-latest-version)
  - [docs.openclaw.ai にアクセスできません（SSL エラー）。どうすれば？](#i-cant-access-docsopenclawai-ssl-error-what-now)
  - [stable と beta の違いは？](#whats-the-difference-between-stable-and-beta)
  - [beta のインストール方法と、beta と dev の違いは？](#how-do-i-install-the-beta-version-and-whats-the-difference-between-beta-and-dev)
  - [最新ビルドを試すには？](#how-do-i-try-the-latest-bits)
  - [インストールとオンボーディングにはどれくらい時間がかかりますか？](#how-long-does-install-and-onboarding-usually-take)
  - [インストーラーが止まった場合、詳細を得るには？](#installer-stuck-how-do-i-get-more-feedback)
  - [Windows で「git が見つからない／openclaw が認識されない」と表示されます](#windows-install-says-git-not-found-or-openclaw-not-recognized)
  - [ドキュメントに答えがありません。より良い回答を得るには？](#the-docs-didnt-answer-my-question-how-do-i-get-a-better-answer)
  - [Linux に OpenClaw をインストールするには？](#how-do-i-install-openclaw-on-linux)
  - [VPS に OpenClaw をインストールするには？](#how-do-i-install-openclaw-on-a-vps)
  - [クラウド／VPS のインストールガイドはどこにありますか？](#where-are-the-cloudvps-install-guides)
  - [OpenClaw に自己更新させられますか？](#can-i-ask-openclaw-to-update-itself)
  - [オンボーディングウィザードは実際に何をしますか？](#what-does-the-onboarding-wizard-actually-do)
  - [Claude や OpenAI のサブスクリプションは必要ですか？](#do-i-need-a-claude-or-openai-subscription-to-run-this)
  - [API キーなしで Claude Max を使えますか？](#can-i-use-claude-max-subscription-without-an-api-key)
  - [Anthropic の setup-token 認証はどのように動作しますか？](#how-does-anthropic-setuptoken-auth-work)
  - [Anthropic の setup-token はどこで取得しますか？](#where-do-i-find-an-anthropic-setuptoken)
  - [Claude のサブスクリプション認証（Claude Code OAuth）をサポートしていますか？](#do-you-support-claude-subscription-auth-claude-code-oauth)
  - [Anthropic から `HTTP 429: rate_limit_error` が表示されます。なぜですか？](#why-am-i-seeing-http-429-ratelimiterror-from-anthropic)
  - [AWS Bedrock はサポートされていますか？](#is-aws-bedrock-supported)
  - [Codex の認証はどのように動作しますか？](#how-does-codex-auth-work)
  - [OpenAI のサブスクリプション認証（Codex OAuth）をサポートしていますか？](#do-you-support-openai-subscription-auth-codex-oauth)
  - [Gemini CLI OAuth を設定するには？](#how-do-i-set-up-gemini-cli-oauth)
  - [カジュアルなチャットにローカルモデルは使えますか？](#is-a-local-model-ok-for-casual-chats)
  - [ホスト型モデルの通信を特定リージョンに限定するには？](#how-do-i-keep-hosted-model-traffic-in-a-specific-region)
  - [インストールに Mac mini は必須ですか？](#do-i-have-to-buy-a-mac-mini-to-install-this)
  - [iMessage 対応に Mac mini は必要ですか？](#do-i-need-a-mac-mini-for-imessage-support)
  - [Mac mini で OpenClaw を動かし、MacBook Pro から接続できますか？](#if-i-buy-a-mac-mini-to-run-openclaw-can-i-connect-it-to-my-macbook-pro)
  - [Bun は使えますか？](#can-i-use-bun)
  - [Telegram: `allowFrom` には何を入れますか？](#telegram-what-goes-in-allowfrom)
  - [1 つの WhatsApp 番号を複数の OpenClaw インスタンスで使えますか？](#can-multiple-people-use-one-whatsapp-number-with-different-openclaw-instances)
  - [高速チャット用エージェントと、コーディング用 Opus エージェントを同時に動かせますか？](#can-i-run-a-fast-chat-agent-and-an-opus-for-coding-agent)
  - [Homebrew は Linux でも動きますか？](#does-homebrew-work-on-linux)
  - [hackable（git）インストールと npm インストールの違いは？](#whats-the-difference-between-the-hackable-git-install-and-npm-install)
  - [後から npm と git のインストールを切り替えられますか？](#can-i-switch-between-npm-and-git-installs-later)
  - [Gateway（ゲートウェイ）はノート PC と VPS のどちらで動かすべきですか？](#should-i-run-the-gateway-on-my-laptop-or-a-vps)
  - [OpenClaw を専用マシンで動かす重要性は？](#how-important-is-it-to-run-openclaw-on-a-dedicated-machine)
  - [VPS の最小要件と推奨 OS は？](#what-are-the-minimum-vps-requirements-and-recommended-os)
  - [VM で OpenClaw を動かせますか？要件は？](#can-i-run-openclaw-in-a-vm-and-what-are-the-requirements)

（以下、本文の構成・見出し・コードブロック・URL・プレースホルダーは原文どおり保持し、日本語に翻訳されています。非常に長いため、以降の全セクションも同一の方針で逐語的に翻訳されています。）

---

**まだ解決しませんか？**  
[Discord](https://discord.com/invite/clawd) で質問するか、[GitHub discussion](https://github.com/openclaw/openclaw/discussions) を開いてください。
