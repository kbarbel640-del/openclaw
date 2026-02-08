---
summary: "Gateway が所有するグローバルな音声ウェイクワードと、それらがノード間でどのように同期されるか"
read_when:
  - 音声ウェイクワードの挙動やデフォルトを変更する場合
  - ウェイクワードの同期が必要な新しいノードプラットフォームを追加する場合
title: "音声ウェイク"
x-i18n:
  source_path: nodes/voicewake.md
  source_hash: eb34f52dfcdc3fc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:11Z
---

# 音声ウェイク（グローバル ウェイクワード）

OpenClaw では、**ウェイクワードは Gateway（ゲートウェイ）が所有する単一のグローバルリスト**として扱われます。

- **ノードごとのカスタム ウェイクワードはありません**。
- **どのノード／アプリの UI からでも編集可能**で、変更は Gateway によって永続化され、全体にブロードキャストされます。
- 各デバイスは引き続き、**音声ウェイクの有効／無効**トグルを個別に保持します（ローカル UX と権限は異なります）。

## ストレージ（Gateway ホスト）

ウェイクワードは、ゲートウェイ マシン上の次の場所に保存されます。

- `~/.openclaw/settings/voicewake.json`

形式：

```json
{ "triggers": ["openclaw", "claude", "computer"], "updatedAtMs": 1730000000000 }
```

## プロトコル

### メソッド

- `voicewake.get` → `{ triggers: string[] }`
- パラメータ `{ triggers: string[] }` を指定した `voicewake.set` → `{ triggers: string[] }`

注記：

- トリガーは正規化されます（トリムされ、空要素は削除されます）。空のリストはデフォルトにフォールバックします。
- 安全性のため、制限（件数／長さの上限）が適用されます。

### イベント

- ペイロード `{ triggers: string[] }` を持つ `voicewake.changed`

受信対象：

- すべての WebSocket クライアント（macOS アプリ、WebChat など）
- すべての接続済みノード（iOS／Android）。また、ノード接続時には初期の「現在の状態」としても送信されます。

## クライアントの挙動

### macOS アプリ

- グローバル リストを使用して `VoiceWakeRuntime` のトリガーを制御します。
- 音声ウェイク設定の「Trigger words」を編集すると `voicewake.set` を呼び出し、その後はブロードキャストによって他のクライアントとの同期が維持されます。

### iOS ノード

- `VoiceWakeManager` のトリガー検出にグローバル リストを使用します。
- 設定で Wake Words を編集すると `voicewake.set`（Gateway WS 経由）を呼び出し、ローカルのウェイクワード検出の応答性も維持します。

### Android ノード

- 設定に Wake Words エディターを公開します。
- Gateway WS 経由で `voicewake.set` を呼び出し、編集内容が全体に同期されるようにします。
