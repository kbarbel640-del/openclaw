---
summary: "SOUL Evil フック（SOUL.md を SOUL_EVIL.md に差し替え）"
read_when:
  - SOUL Evil フックを有効化または調整したいとき
  - パージウィンドウやランダム確率によるペルソナ切り替えを行いたいとき
title: "SOUL Evil フック"
x-i18n:
  source_path: hooks/soul-evil.md
  source_hash: cc32c1e207f2b692
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:01Z
---

# SOUL Evil フック

SOUL Evil フックは、パージウィンドウ中、またはランダム確率によって、**注入された** `SOUL.md` の内容を `SOUL_EVIL.md` に入れ替えます。ディスク上のファイルは**変更しません**。

## 仕組み

`agent:bootstrap` が実行される際、このフックはシステムプロンプトが組み立てられる前に、メモリ上の `SOUL.md` の内容を置き換えることができます。`SOUL_EVIL.md` が欠落している、または空の場合、OpenClaw は警告をログに出力し、通常の `SOUL.md` を保持します。

サブエージェントの実行では、ブートストラップファイルに `SOUL.md` が含まれないため、このフックはサブエージェントには影響しません。

## 有効化

```bash
openclaw hooks enable soul-evil
```

次に、設定を行います。

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

エージェントのワークスペースルート（`SOUL.md` の隣）に `SOUL_EVIL.md` を作成します。

## オプション

- `file`（string）: 代替の SOUL ファイル名（既定値: `SOUL_EVIL.md`）
- `chance`（number 0–1）: 実行ごとに `SOUL_EVIL.md` を使用するランダム確率
- `purge.at`（HH:mm）: 日次パージ開始時刻（24 時間表記）
- `purge.duration`（duration）: ウィンドウ長（例: `30s`、`10m`、`1h`）

**優先順位:** パージウィンドウは確率設定よりも優先されます。

**タイムゾーン:** 設定されている場合は `agents.defaults.userTimezone` を使用し、未設定の場合はホストのタイムゾーンを使用します。

## 注記

- ディスク上のファイルは書き込まれず、変更もされません。
- ブートストラップリストに `SOUL.md` が含まれていない場合、このフックは何もしません。

## 関連項目

- [Hooks](/hooks)
