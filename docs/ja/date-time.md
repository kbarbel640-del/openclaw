---
summary: "エンベロープ、プロンプト、ツール、コネクター全体における日付と時刻の取り扱い"
read_when:
  - モデルまたはユーザーに対してタイムスタンプの表示方法を変更している場合
  - メッセージまたはシステムプロンプト出力における時刻フォーマットをデバッグしている場合
title: "日付と時刻"
x-i18n:
  source_path: date-time.md
  source_hash: 753af5946a006215
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:14:00Z
---

# 日付 & 時刻

OpenClaw は、**トランスポートのタイムスタンプにはホストのローカル時刻**を、**システムプロンプトにはユーザーのタイムゾーンのみ**を既定で使用します。
プロバイダーのタイムスタンプは、ツールが本来のセマンティクスを維持できるよう保持されます（現在時刻は `session_status` で利用できます）。

## メッセージエンベロープ（既定でローカル）

受信メッセージは、タイムスタンプ（分精度）とともにラップされます。

```
[Provider ... 2026-01-05 16:26 PST] message text
```

このエンベロープのタイムスタンプは、プロバイダーのタイムゾーンに関係なく、既定で**ホストのローカル**になります。

この挙動は上書きできます。

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
- `envelopeTimezone: "local"` はホストのタイムゾーンを使用します。
- `envelopeTimezone: "user"` は `agents.defaults.userTimezone` を使用します（ホストのタイムゾーンにフォールバックします）。
- 固定ゾーンには、明示的な IANA タイムゾーン（例: `"America/Chicago"`）を使用します。
- `envelopeTimestamp: "off"` は、エンベロープヘッダーから絶対タイムスタンプを削除します。
- `envelopeElapsed: "off"` は、経過時間サフィックス（`+2m` スタイル）を削除します。

### 例

**ローカル（既定）:**

```
[WhatsApp +1555 2026-01-18 00:19 PST] hello
```

**ユーザータイムゾーン:**

```
[WhatsApp +1555 2026-01-18 00:19 CST] hello
```

**経過時間が有効:**

```
[WhatsApp +1555 +30s 2026-01-18T05:19Z] follow-up
```

## システムプロンプト: 現在の日付と時刻

ユーザーのタイムゾーンが判明している場合、システムプロンプトには専用の
**Current Date & Time** セクションが含まれ、プロンプトキャッシュを安定させるために
**タイムゾーンのみ**（時刻/時刻形式は含めない）が示されます。

```
Time zone: America/Chicago
```

エージェントが現在時刻を必要とする場合は、`session_status` ツールを使用してください。ステータス
カードにはタイムスタンプ行が含まれます。

## システムイベント行（既定でローカル）

エージェントコンテキストに挿入されるキュー済みシステムイベントには、メッセージエンベロープと同じタイムゾーン選択（既定: ホストのローカル）を用いたタイムスタンプがプレフィックスされます。

```
System: [2026-01-12 12:19:17 PST] Model switched.
```

### ユーザータイムゾーン + 形式を設定する

```json5
{
  agents: {
    defaults: {
      userTimezone: "America/Chicago",
      timeFormat: "auto", // auto | 12 | 24
    },
  },
}
```

- `userTimezone` は、プロンプトコンテキスト向けに**ユーザーのローカルタイムゾーン**を設定します。
- `timeFormat` は、プロンプトにおける **12 時間/24 時間表示**を制御します。`auto` は OS の設定に従います。

## 時刻形式の検出（自動）

`timeFormat: "auto"` の場合、OpenClaw は OS の設定（macOS/Windows）を検査し、ロケールの書式にフォールバックします。検出された値は、繰り返しのシステムコールを避けるため、**プロセスごとにキャッシュ**されます。

## ツールペイロード + コネクター（生のプロバイダー時刻 + 正規化フィールド）

チャンネルツールは、**プロバイダーのネイティブなタイムスタンプ**を返し、一貫性のために正規化フィールドを追加します。

- `timestampMs`: エポックミリ秒（UTC）
- `timestampUtc`: ISO 8601 の UTC 文字列

生のプロバイダー フィールドは、何も失われないよう保持されます。

- Slack: API 由来のエポック風文字列
- Discord: UTC ISO タイムスタンプ
- Telegram/WhatsApp: プロバイダー固有の数値/ISO タイムスタンプ

ローカル時刻が必要な場合は、既知のタイムゾーンを使用して下流で変換してください。

## 関連ドキュメント

- [システムプロンプト](/concepts/system-prompt)
- [タイムゾーン](/concepts/timezone)
- [メッセージ](/concepts/messages)
