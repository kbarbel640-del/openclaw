---
summary: "Gateway（ゲートウェイ）+ CLI による投票の送信"
read_when:
  - 投票サポートの追加または変更時
  - CLI または Gateway（ゲートウェイ）からの投票送信のデバッグ時
title: "投票"
x-i18n:
  source_path: automation/poll.md
  source_hash: 760339865d27ec40
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:41:42Z
---

# 投票

## サポートされているチャンネル

- WhatsApp（web チャンネル）
- Discord
- MS Teams（Adaptive Cards）

## CLI

```bash
# WhatsApp
openclaw message poll --target +15555550123 \
  --poll-question "Lunch today?" --poll-option "Yes" --poll-option "No" --poll-option "Maybe"
openclaw message poll --target 123456789@g.us \
  --poll-question "Meeting time?" --poll-option "10am" --poll-option "2pm" --poll-option "4pm" --poll-multi

# Discord
openclaw message poll --channel discord --target channel:123456789 \
  --poll-question "Snack?" --poll-option "Pizza" --poll-option "Sushi"
openclaw message poll --channel discord --target channel:123456789 \
  --poll-question "Plan?" --poll-option "A" --poll-option "B" --poll-duration-hours 48

# MS Teams
openclaw message poll --channel msteams --target conversation:19:abc@thread.tacv2 \
  --poll-question "Lunch?" --poll-option "Pizza" --poll-option "Sushi"
```

オプション:

- `--channel`: `whatsapp`（デフォルト）、`discord`、または `msteams`
- `--poll-multi`: 複数オプションの選択を許可します
- `--poll-duration-hours`: Discord 専用（省略時は 24 がデフォルトです）

## Gateway RPC

メソッド: `poll`

パラメータ:

- `to`（string、必須）
- `question`（string、必須）
- `options`（string[]、必須）
- `maxSelections`（number、任意）
- `durationHours`（number、任意）
- `channel`（string、任意、デフォルト: `whatsapp`）
- `idempotencyKey`（string、必須）

## チャンネルの違い

- WhatsApp: 2～12 個のオプション、`maxSelections` はオプション数の範囲内である必要があります。`durationHours` は無視されます。
- Discord: 2～10 個のオプション、`durationHours` は 1～768 時間にクランプされます（デフォルト 24）。`maxSelections > 1` は複数選択を有効化します。Discord は厳密な選択数をサポートしていません。
- MS Teams: Adaptive Card の投票（OpenClaw 管理）。ネイティブの投票 API はありません。`durationHours` は無視されます。

## エージェントツール（Message）

`message` ツールを `poll` アクション（`to`、`pollQuestion`、`pollOption`、任意の `pollMulti`、`pollDurationHours`、`channel`）とともに使用します。

注意: Discord には「厳密に N 個を選択」モードがありません。`pollMulti` は複数選択にマッピングされます。
Teams の投票は Adaptive Cards としてレンダリングされ、`~/.openclaw/msteams-polls.json` で投票を記録するために Gateway（ゲートウェイ）がオンラインのままである必要があります。
