---
summary: "アウトバウンドのプロバイダー呼び出しのリトライポリシー"
read_when:
  - プロバイダーのリトライ動作またはデフォルトを更新する場合
  - プロバイダー送信エラーまたはレート制限をデバッグする場合
title: "リトライポリシー"
x-i18n:
  source_path: concepts/retry.md
  source_hash: 55bb261ff567f46c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:07:26Z
---

# リトライポリシー

## 目標

- 複数ステップのフロー単位ではなく、HTTP リクエスト単位でリトライします。
- 現在のステップのみをリトライすることで、順序を維持します。
- 非冪等な操作の重複を避けます。

## デフォルト

- 試行回数: 3
- 最大遅延上限: 30000 ms
- ジッター: 0.1（10%）
- プロバイダーのデフォルト:
  - Telegram の最小遅延: 400 ms
  - Discord の最小遅延: 500 ms

## 動作

### Discord

- レート制限エラー（HTTP 429）の場合のみリトライします。
- 利用可能な場合は Discord の `retry_after` を使用し、それ以外の場合は指数バックオフを使用します。

### Telegram

- 一時的なエラー（429、タイムアウト、接続の失敗/リセット/クローズ、一時的に利用不可）の場合にリトライします。
- 利用可能な場合は `retry_after` を使用し、それ以外の場合は指数バックオフを使用します。
- Markdown の解析エラーはリトライしません。プレーンテキストにフォールバックします。

## 設定

`~/.openclaw/openclaw.json` で、プロバイダーごとにリトライポリシーを設定します:

```json5
{
  channels: {
    telegram: {
      retry: {
        attempts: 3,
        minDelayMs: 400,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
    discord: {
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

## 注記

- リトライはリクエスト単位（メッセージ送信、メディアアップロード、リアクション、投票、ステッカー）で適用されます。
- 複合フローでは、完了したステップはリトライされません。
