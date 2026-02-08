---
summary: "OpenClaw が入力中インジケーターを表示するタイミングと、その調整方法"
read_when:
  - 入力中インジケーターの挙動またはデフォルトを変更するとき
title: "入力中インジケーター"
x-i18n:
  source_path: concepts/typing-indicators.md
  source_hash: 8ee82d02829c4ff5
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:14:24Z
---

# 入力中インジケーター

入力中インジケーターは、実行がアクティブな間、チャットチャンネルに送信されます。入力開始の **タイミング** を制御するには
`agents.defaults.typingMode` を使用し、更新の **頻度** を制御するには `typingIntervalSeconds`
を使用します。

## デフォルト

`agents.defaults.typingMode` が **未設定** の場合、OpenClaw は従来の挙動を維持します。

- **ダイレクトチャット**: モデルループが開始されると直ちに入力が開始されます。
- **メンションありのグループチャット**: 直ちに入力が開始されます。
- **メンションなしのグループチャット**: メッセージテキストのストリーミングが開始されたときにのみ入力が開始されます。
- **ハートビート実行**: 入力は無効です。

## モード

`agents.defaults.typingMode` を次のいずれかに設定します。

- `never` — 入力中インジケーターは一切表示されません。
- `instant` — 実行が後でサイレント返信トークンのみを返す場合でも、**モデルループの開始と同時に** 入力を開始します。
- `thinking` — **最初の推論デルタ** で入力を開始します（実行に
  `reasoningLevel: "stream"` が必要です）。
- `message` — **最初の非サイレントなテキストデルタ** で入力を開始します（`NO_REPLY` のサイレントトークンを無視します）。

「どれだけ早く発火するか」の順序:
`never` → `message` → `thinking` → `instant`

## 設定

```json5
{
  agent: {
    typingMode: "thinking",
    typingIntervalSeconds: 6,
  },
}
```

セッションごとに、モードまたは間隔を上書きできます。

```json5
{
  session: {
    typingMode: "message",
    typingIntervalSeconds: 4,
  },
}
```

## 注記

- `message` モードでは、サイレントのみの返信（例: 出力を抑止するために使用される `NO_REPLY`
  トークン）では入力は表示されません。
- `thinking` は、実行が推論をストリーミングする場合（`reasoningLevel: "stream"`）にのみ発火します。
  モデルが推論デルタを出力しない場合、入力は開始されません。
- ハートビートでは、モードにかかわらず入力は表示されません。
- `typingIntervalSeconds` は開始時刻ではなく、**更新間隔** を制御します。
  デフォルトは 6 秒です。
