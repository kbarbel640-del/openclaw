---
summary: "CLI リファレンス：`openclaw onboard`（対話式オンボーディングウィザード）"
read_when:
  - Gateway（ゲートウェイ）、ワークスペース、認証、チャンネル、Skills のガイド付きセットアップが必要な場合
title: "onboard"
x-i18n:
  source_path: cli/onboard.md
  source_hash: 69a96accb2d571ff
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:40Z
---

# `openclaw onboard`

対話式オンボーディングウィザード（ローカルまたはリモートの Gateway（ゲートウェイ）セットアップ）。

## 関連ガイド

- CLI オンボーディングハブ：[Onboarding Wizard (CLI)](/start/wizard)
- CLI オンボーディングリファレンス：[CLI Onboarding Reference](/start/wizard-cli-reference)
- CLI 自動化：[CLI Automation](/start/wizard-cli-automation)
- macOS オンボーディング：[Onboarding (macOS App)](/start/onboarding)

## 例

```bash
openclaw onboard
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --mode remote --remote-url ws://gateway-host:18789
```

フローの注記：

- `quickstart`：プロンプトは最小限で、ゲートウェイトークンを自動生成します。
- `manual`：ポート／バインド／認証の完全なプロンプト（`advanced` のエイリアス）。
- 最速の最初のチャット：`openclaw dashboard`（Control UI、チャンネル設定なし）。

## 一般的な後続コマンド

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` は非対話モードを意味しません。スクリプトには `--non-interactive` を使用してください。
</Note>
