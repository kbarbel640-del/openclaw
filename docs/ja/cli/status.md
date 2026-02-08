---
summary: "`openclaw status`（診断、プローブ、使用状況スナップショット）の CLI リファレンス"
read_when:
  - チャンネルの健全性 + 最近のセッション受信者を素早く診断したいとき
  - デバッグ用に貼り付け可能な「all」ステータスが欲しいとき
title: "status"
x-i18n:
  source_path: cli/status.md
  source_hash: 2bbf5579c48034fc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:59:27Z
---

# `openclaw status`

チャンネル + セッションの診断です。

```bash
openclaw status
openclaw status --all
openclaw status --deep
openclaw status --usage
```

注記:

- `--deep` はライブプローブ（WhatsApp Web + Telegram + Discord + Google Chat + Slack + Signal）を実行します。
- 複数のエージェントが設定されている場合、出力にはエージェントごとのセッションストアが含まれます。
- 利用可能な場合、概要には Gateway（ゲートウェイ）+ ノードホストサービスのインストール/実行時ステータスが含まれます。
- 概要には更新チャンネル + git SHA（ソースのチェックアウト向け）が含まれます。
- 更新情報は概要に表示されます。更新が利用可能な場合、ステータスは `openclaw update` を実行するためのヒントを表示します（[Updating](/install/updating) を参照）。
