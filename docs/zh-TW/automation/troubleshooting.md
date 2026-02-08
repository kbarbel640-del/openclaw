---
summary: 「疑難排解 cron 與 heartbeat 的排程與傳送」
read_when:
  - Cron 未執行
  - Cron 已執行但未傳送任何訊息
  - Heartbeat 似乎無聲或被跳過
title: 「自動化疑難排解」
x-i18n:
  source_path: automation/troubleshooting.md
  source_hash: 10eca4a59119910f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:01Z
---

# 自動化疑難排解

當排程器與傳送出現問題時，請使用此頁面（`cron` + `heartbeat`）。

## 指令階梯

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

接著執行自動化檢查：

```bash
openclaw cron status
openclaw cron list
openclaw system heartbeat last
```

## Cron 未觸發

```bash
openclaw cron status
openclaw cron list
openclaw cron runs --id <jobId> --limit 20
openclaw logs --follow
```

良好的輸出看起來像是：

- `cron status` 回報已啟用，且有未來的 `nextWakeAtMs`。
- 工作已啟用，並且具有有效的排程／時區。
- `cron runs` 顯示 `ok` 或明確的跳過原因。

常見特徵：

- `cron: scheduler disabled; jobs will not run automatically` → 設定／環境變數中已停用 cron。
- `cron: timer tick failed` → 排程器 tick 當機；請檢視周邊的堆疊／日誌內容。
- 在執行輸出中出現 `reason: not-due` → 手動執行時未提供 `--force`，且工作尚未到期。

## Cron 已觸發但未傳送

```bash
openclaw cron runs --id <jobId> --limit 20
openclaw cron list
openclaw channels status --probe
openclaw logs --follow
```

良好的輸出看起來像是：

- 執行狀態為 `ok`。
- 已為隔離的工作設定傳送模式／目標。
- 頻道探測回報目標頻道已連線。

常見特徵：

- 執行成功但傳送模式為 `none` → 不預期有任何外部訊息。
- 傳送目標遺失／無效（`channel`／`to`）→ 內部執行可能成功，但會略過對外傳送。
- 頻道驗證錯誤（`unauthorized`、`missing_scope`、`Forbidden`）→ 傳送被頻道憑證／權限阻擋。

## Heartbeat 被抑制或跳過

```bash
openclaw system heartbeat last
openclaw logs --follow
openclaw config get agents.defaults.heartbeat
openclaw channels status --probe
```

良好的輸出看起來像是：

- Heartbeat 已啟用且間隔為非零。
- 最近一次 heartbeat 結果為 `ran`（或能理解其跳過原因）。

常見特徵：

- `heartbeat skipped` 搭配 `reason=quiet-hours` → 位於 `activeHours` 之外。
- `requests-in-flight` → 主通道繁忙；heartbeat 延後。
- `empty-heartbeat-file` → `HEARTBEAT.md` 存在，但沒有可採取的內容。
- `alerts-disabled` → 可見性設定抑制了對外的 heartbeat 訊息。

## 時區與 activeHours 的注意事項

```bash
openclaw config get agents.defaults.heartbeat.activeHours
openclaw config get agents.defaults.heartbeat.activeHours.timezone
openclaw config get agents.defaults.userTimezone || echo "agents.defaults.userTimezone not set"
openclaw cron list
openclaw logs --follow
```

快速規則：

- `Config path not found: agents.defaults.userTimezone` 表示該鍵未設定；heartbeat 會回退至主機時區（或若有設定則為 `activeHours.timezone`）。
- 未設定 `--tz` 的 cron 會使用 Gateway 閘道器 主機時區。
- Heartbeat 的 `activeHours` 會使用已設定的時區解析（`user`、`local`，或明確的 IANA tz）。
- 未含時區的 ISO 時間戳會在 cron 的 `at` 排程中視為 UTC。

常見特徵：

- 主機時區變更後，工作在錯誤的實際時鐘時間執行。
- 因為 `activeHours.timezone` 設定錯誤，導致在你的白天時段 heartbeat 總是被跳過。

相關內容：

- [/automation/cron-jobs](/automation/cron-jobs)
- [/gateway/heartbeat](/gateway/heartbeat)
- [/automation/cron-vs-heartbeat](/automation/cron-vs-heartbeat)
- [/concepts/timezone](/concepts/timezone)
