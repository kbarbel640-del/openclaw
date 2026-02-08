---
summary: "エージェント、エンベロープ、プロンプトにおけるタイムゾーンの扱い"
read_when:
  - モデル向けにタイムスタンプがどのように正規化されるかを理解する必要があります
  - システムプロンプト用にユーザーのタイムゾーンを設定する必要があります
title: "タイムゾーン"
x-i18n:
  source_path: concepts/timezone.md
  source_hash: 9ee809c96897db11
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:00Z
---

# タイムゾーン

OpenClaw は、モデルが **単一の基準時刻** を参照できるようにタイムスタンプを標準化します。

## メッセージエンベロープ（デフォルトはローカル）

受信メッセージは次のようなエンベロープでラップされます。

```
[Provider ... 2026-01-05 16:26 PST] message text
```

エンベロープ内のタイムスタンプは、デフォルトで **ホストのローカル時刻** になっており、分単位の精度です。

これは次で上書きできます。

```json5
{
  agents: {
    defaults: {
      envelopeTimezone: "local", // "utc" | "local" | "user" | IANA timezone
      envelopeTimestamp: "on", // "on" | "off"
      envelopeElapsed: "on", // "on" | "off"
    },
  },
}
```

- `envelopeTimezone: "utc"` は UTC を使用します。
- `envelopeTimezone: "user"` は `agents.defaults.userTimezone` を使用します（ホストのタイムゾーンにフォールバックします）。
- 固定オフセットにするには、明示的な IANA タイムゾーン（例: `"Europe/Vienna"`）を使用します。
- `envelopeTimestamp: "off"` は、エンベロープヘッダーから絶対タイムスタンプを削除します。
- `envelopeElapsed: "off"` は、経過時間サフィックス（`+2m` スタイル）を削除します。

### 例

**ローカル（デフォルト）:**

```
[Signal Alice +1555 2026-01-18 00:19 PST] hello
```

**固定タイムゾーン:**

```
[Signal Alice +1555 2026-01-18 06:19 GMT+1] hello
```

**経過時間:**

```
[Signal Alice +1555 +2m 2026-01-18T05:19Z] follow-up
```

## ツールペイロード（生のプロバイダーデータ + 正規化フィールド）

ツール呼び出し（`channels.discord.readMessages`、`channels.slack.readMessages` など）は **生のプロバイダータイムスタンプ** を返します。
また、一貫性のために正規化フィールドも付与します。

- `timestampMs`（UTC エポックミリ秒）
- `timestampUtc`（ISO 8601 の UTC 文字列）

生のプロバイダーフィールドは保持されます。

## システムプロンプト用のユーザータイムゾーン

`agents.defaults.userTimezone` を設定して、モデルにユーザーのローカルタイムゾーンを伝えます。これが
未設定の場合、OpenClaw は **実行時にホストのタイムゾーンを解決** します（設定の書き込みは行いません）。

```json5
{
  agents: { defaults: { userTimezone: "America/Chicago" } },
}
```

システムプロンプトには次が含まれます。

- ローカル時刻とタイムゾーンを含む `Current Date & Time` セクション
- `Time format: 12-hour` または `24-hour`

`agents.defaults.timeFormat`（`auto` | `12` | `24`）で、プロンプト形式を制御できます。

完全な挙動と例については、[Date & Time](/date-time) を参照してください。
