---
summary: "チャンネル間で共有されるリアクションのセマンティクス"
read_when:
  - いずれかのチャンネルでリアクションに取り組むとき
title: "リアクション"
x-i18n:
  source_path: tools/reactions.md
  source_hash: 0f11bff9adb4bd02
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:48Z
---

# リアクションツール

チャンネル間で共有されるリアクションのセマンティクス:

- `emoji` は、リアクションを追加する際に必須です。
- `emoji=""` は、サポートされている場合にボットのリアクションを削除します。
- `remove: true` は、サポートされている場合に指定された絵文字を削除します（`emoji` が必要です）。

チャンネル別の注記:

- **Discord/Slack**: 空の `emoji` は、メッセージ上のボットのリアクションをすべて削除します。`remove: true` は、その絵文字だけを削除します。
- **Google Chat**: 空の `emoji` は、メッセージ上のアプリのリアクションを削除します。`remove: true` は、その絵文字だけを削除します。
- **Telegram**: 空の `emoji` は、ボットのリアクションを削除します。`remove: true` もリアクションを削除しますが、ツール検証のために空でない `emoji` が引き続き必要です。
- **WhatsApp**: 空の `emoji` は、ボットのリアクションを削除します。`remove: true` は空の絵文字にマップされます（`emoji` は引き続き必要です）。
- **Signal**: 受信したリアクション通知は、`channels.signal.reactionNotifications` が有効な場合にシステムイベントを発行します。
