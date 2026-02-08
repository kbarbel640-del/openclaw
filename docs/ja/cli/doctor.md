---
summary: "`openclaw doctor` の CLI リファレンス（ヘルスチェック + ガイド付き修復）"
read_when:
  - 接続/認証の問題があり、ガイド付きの修正を行いたい場合
  - 更新後に正常性チェックを行いたい場合
title: "doctor"
x-i18n:
  source_path: cli/doctor.md
  source_hash: 92310aa3f3d111e9
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:25Z
---

# `openclaw doctor`

Gateway（ゲートウェイ）とチャンネルのヘルスチェック + クイック修復です。

関連:

- トラブルシューティング: [Troubleshooting](/gateway/troubleshooting)
- セキュリティ監査: [Security](/gateway/security)

## 例

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --deep
```

注記:

- 対話プロンプト（キーチェーン/OAuth の修正など）は、stdin が TTY であり、かつ `--non-interactive` が設定されて**いない**場合にのみ実行されます。ヘッドレス実行（cron、Telegram、ターミナルなし）ではプロンプトはスキップされます。
- `--fix`（`--repair` のエイリアス）は、バックアップを `~/.openclaw/openclaw.json.bak` に書き込み、未知の設定キーを削除し、各削除内容を一覧表示します。

## macOS: `launchctl` 環境変数オーバーライド

以前に `launchctl setenv OPENCLAW_GATEWAY_TOKEN ...`（または `...PASSWORD`）を実行していた場合、その値が設定ファイルを上書きし、継続的な「unauthorized」エラーの原因になることがあります。

```bash
launchctl getenv OPENCLAW_GATEWAY_TOKEN
launchctl getenv OPENCLAW_GATEWAY_PASSWORD

launchctl unsetenv OPENCLAW_GATEWAY_TOKEN
launchctl unsetenv OPENCLAW_GATEWAY_PASSWORD
```
