---
summary: "節點的位置指令（location.get）、權限模式與背景行為"
read_when:
  - 新增位置節點支援或權限 UI
  - 設計背景位置 + 推播流程
title: "位置指令"
x-i18n:
  source_path: nodes/location-command.md
  source_hash: 23124096256384d2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:55Z
---

# 位置指令（節點）

## TL;DR

- `location.get` 是一個節點指令（透過 `node.invoke`）。
- 預設為關閉。
- 設定使用選擇器：關閉 / 使用期間 / 永遠。
- 獨立切換：精確位置。

## 為何使用選擇器（而非只有開關）

OS 權限是多層級的。我們可以在應用程式內提供選擇器，但實際授權仍由 OS 決定。

- iOS/macOS：使用者可在系統提示或設定中選擇 **使用期間** 或 **永遠**。應用程式可以請求升級，但 OS 可能要求前往設定。
- Android：背景位置是獨立的權限；在 Android 10+ 通常需要走設定流程。
- 精確位置是獨立的授權（iOS 14+「精確」，Android 的「fine」對「coarse」）。

UI 中的選擇器驅動我們請求的模式；實際授權存在於 OS 設定中。

## 設定模型

每個節點裝置：

- `location.enabledMode`：`off | whileUsing | always`
- `location.preciseEnabled`：bool

UI 行為：

- 選擇 `whileUsing` 會請求前景權限。
- 選擇 `always` 會先確保 `whileUsing`，再請求背景（或在需要時引導使用者前往設定）。
- 若 OS 拒絕所請求的層級，則回退至已授與的最高層級並顯示狀態。

## 權限對應（node.permissions）

選用。macOS 節點會透過權限對應回報 `location`；iOS/Android 可能省略。

## 指令：`location.get`

透過 `node.invoke` 呼叫。

參數（建議）：

```json
{
  "timeoutMs": 10000,
  "maxAgeMs": 15000,
  "desiredAccuracy": "coarse|balanced|precise"
}
```

回應負載：

```json
{
  "lat": 48.20849,
  "lon": 16.37208,
  "accuracyMeters": 12.5,
  "altitudeMeters": 182.0,
  "speedMps": 0.0,
  "headingDeg": 270.0,
  "timestamp": "2026-01-03T12:34:56.000Z",
  "isPrecise": true,
  "source": "gps|wifi|cell|unknown"
}
```

錯誤（穩定代碼）：

- `LOCATION_DISABLED`：選擇器為關閉。
- `LOCATION_PERMISSION_REQUIRED`：缺少所請求模式的權限。
- `LOCATION_BACKGROUND_UNAVAILABLE`：應用程式在背景中，但僅允許「使用期間」。
- `LOCATION_TIMEOUT`：未能在時間內取得定位。
- `LOCATION_UNAVAILABLE`：系統故障／無提供者。

## 背景行為（未來）

目標：即使節點在背景中，模型也能請求位置，但僅在以下條件成立時：

- 使用者選擇 **永遠**。
- OS 授與背景位置。
- 應用程式被允許在背景中為位置而執行（iOS 背景模式／Android 前景服務或特殊許可）。

推播觸發流程（未來）：

1. Gateway 閘道器 向節點發送推播（靜默推播或 FCM 資料）。
2. 節點短暫喚醒並向裝置請求位置。
3. 節點將負載轉送至 Gateway 閘道器。

備註：

- iOS：需要「永遠」權限 + 背景位置模式。靜默推播可能被節流；預期會有間歇性失敗。
- Android：背景位置可能需要前景服務；否則預期會被拒絕。

## 模型／工具整合

- 工具介面：`nodes` 工具新增 `location_get` 動作（需要節點）。
- CLI：`openclaw nodes location get --node <id>`。
- 代理程式指南：僅在使用者已啟用位置並理解其範圍時呼叫。

## UX 文案（建議）

- 關閉：「位置分享已停用。」
- 使用期間：「僅在 OpenClaw 開啟時。」
- 永遠：「允許背景位置。需要系統權限。」
- 精確：「使用精確 GPS 位置。關閉以分享近似位置。」
