---
summary: "SOUL Evil Hook（將 SOUL.md 與 SOUL_EVIL.md 互換）"
read_when:
  - 你想要啟用或調整 SOUL Evil Hook
  - 你想要清除視窗或隨機機率的人格切換
title: "SOUL Evil Hook"
x-i18n:
  source_path: hooks/soul-evil.md
  source_hash: cc32c1e207f2b692
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:35Z
---

# SOUL Evil Hook

SOUL Evil Hook 會在清除視窗期間或依隨機機率，將**注入的** `SOUL.md` 內容與 `SOUL_EVIL.md` 互換。它**不會**修改磁碟上的檔案。

## 運作方式

當 `agent:bootstrap` 執行時，該 Hook 可以在系統提示組裝之前，於記憶體中取代 `SOUL.md` 內容。若 `SOUL_EVIL.md` 缺失或為空，OpenClaw 會記錄警告並保留正常的 `SOUL.md`。

子代理程式的執行**不會**在其啟動檔案中包含 `SOUL.md`，因此此 Hook 對子代理程式沒有影響。

## 啟用

```bash
openclaw hooks enable soul-evil
```

接著設定組態：

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

在代理程式工作區根目錄（與 `SOUL.md` 同層）建立 `SOUL_EVIL.md`。

## 選項

- `file`（字串）：替代的 SOUL 檔名（預設：`SOUL_EVIL.md`）
- `chance`（數值 0–1）：每次執行使用 `SOUL_EVIL.md` 的隨機機率
- `purge.at`（HH:mm）：每日清除開始時間（24 小時制）
- `purge.duration`（期間）：視窗長度（例如：`30s`、`10m`、`1h`）

**優先順序：** 清除視窗優先於機率。

**時區：** 若已設定則使用 `agents.defaults.userTimezone`；否則使用主機時區。

## 備註

- 不會在磁碟上寫入或修改任何檔案。
- 若 `SOUL.md` 不在啟動清單中，該 Hook 不會有任何作用。

## 另請參閱

- [Hooks](/hooks)
