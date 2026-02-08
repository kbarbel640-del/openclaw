---
summary: "`openclaw system` 用の CLI リファレンス（システムイベント、ハートビート、プレゼンス）"
read_when:
  - cron ジョブを作成せずにシステムイベントをキューに入れたい場合
  - ハートビートを有効化または無効化する必要がある場合
  - システムのプレゼンスエントリを確認したい場合
title: "system"
x-i18n:
  source_path: cli/system.md
  source_hash: 36ae5dbdec327f5a
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:59:25Z
---

# `openclaw system`

Gateway（ゲートウェイ）向けのシステムレベルのヘルパーです。システムイベントをキューに投入し、ハートビートを制御し、プレゼンスを表示します。

## 共通コマンド

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
openclaw system heartbeat enable
openclaw system heartbeat last
openclaw system presence
```

## `system event`

**main** セッションに対してシステムイベントをキューに入れます。次のハートビートが、それをプロンプト内の `System:` 行として注入します。`--mode now` を使用するとハートビートを即座にトリガーできます。`next-heartbeat` は次にスケジュールされたティックを待機します。

フラグ:

- `--text <text>`: 必須のシステムイベントテキストです。
- `--mode <mode>`: `now` または `next-heartbeat`（デフォルト）です。
- `--json`: 機械可読な出力です。

## `system heartbeat last|enable|disable`

ハートビート制御:

- `last`: 最後のハートビートイベントを表示します。
- `enable`: ハートビートを再びオンにします（無効化されていた場合はこれを使用します）。
- `disable`: ハートビートを一時停止します。

フラグ:

- `--json`: 機械可読な出力です。

## `system presence`

Gateway（ゲートウェイ）が把握している現在のシステムプレゼンスエントリ（ノード、インスタンス、および類似のステータス行）を一覧表示します。

フラグ:

- `--json`: 機械可読な出力です。

## 注記

- 現在の設定（ローカルまたはリモート）から到達可能な、稼働中の Gateway（ゲートウェイ）が必要です。
- システムイベントは一時的であり、再起動をまたいで永続化されません。
