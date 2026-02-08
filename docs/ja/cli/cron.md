---
summary: "CLI リファレンス：`openclaw cron`（バックグラウンドジョブのスケジュールと実行）"
read_when:
  - スケジュールされたジョブとウェイクアップが必要なとき
  - cron の実行とログのデバッグをしているとき
title: "cron"
x-i18n:
  source_path: cli/cron.md
  source_hash: cef64f2ac4a648d4
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:23Z
---

# `openclaw cron`

Gateway（ゲートウェイ）のスケジューラー向けに cron ジョブを管理します。

関連:

- cron ジョブ: [Cron jobs](/automation/cron-jobs)

ヒント: コマンドの全体像については、`openclaw cron --help` を実行してください。

注: 分離された `cron add` ジョブは、デフォルトで `--announce` 配信になります。出力を内部のままにするには `--no-deliver` を使用してください。
`--deliver` は、`--announce` の非推奨の別名として残っています。

注: ワンショット（`--at`）ジョブは、デフォルトで成功後に削除されます。保持するには `--keep-after-run` を使用してください。

## 一般的な編集

メッセージを変更せずに配信設定を更新します:

```bash
openclaw cron edit <job-id> --announce --channel telegram --to "123456789"
```

分離されたジョブの配信を無効にします:

```bash
openclaw cron edit <job-id> --no-deliver
```

特定のチャンネルに通知します:

```bash
openclaw cron edit <job-id> --announce --channel slack --to "channel:C1234567890"
```
