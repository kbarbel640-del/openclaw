---
summary: 「全域語音喚醒詞（由 Gateway 閘道器擁有）以及它們如何在各節點之間同步」
read_when:
  - 變更語音喚醒詞行為或預設值
  - 新增需要喚醒詞同步的新節點平台
title: 「語音喚醒」
x-i18n:
  source_path: nodes/voicewake.md
  source_hash: eb34f52dfcdc3fc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:53Z
---

# 語音喚醒（全域喚醒詞）

OpenClaw 將 **喚醒詞視為由「Gateway 閘道器」擁有的單一全域清單**。

- **沒有每個節點各自的自訂喚醒詞**。
- **任何節點／應用程式 UI 都可以編輯**此清單；變更會由 Gateway 閘道器保存並向所有人廣播。
- 各裝置仍各自保有 **語音喚醒 啟用／停用** 的切換（本地 UX 與權限可能不同）。

## 儲存（Gateway 閘道器主機）

喚醒詞儲存在 Gateway 閘道器主機上，位置為：

- `~/.openclaw/settings/voicewake.json`

結構：

```json
{ "triggers": ["openclaw", "claude", "computer"], "updatedAtMs": 1730000000000 }
```

## 通訊協定

### 方法

- `voicewake.get` → `{ triggers: string[] }`
- `voicewake.set`，參數為 `{ triggers: string[] }` → `{ triggers: string[] }`

備註：

- 觸發詞會被正規化（去除前後空白、移除空值）。空清單會回退為預設值。
- 為了安全性會強制限制（數量／長度上限）。

### 事件

- `voicewake.changed`，負載為 `{ triggers: string[] }`

接收對象：

- 所有 WebSocket 用戶端（macOS 應用程式、WebChat 等）
- 所有已連線的節點（iOS／Android），並且在節點連線時也會作為初始「目前狀態」推送。

## 用戶端行為

### macOS 應用程式

- 使用全域清單來控管 `VoiceWakeRuntime` 觸發。
- 在語音喚醒設定中編輯「觸發詞」會呼叫 `voicewake.set`，之後依賴廣播來讓其他用戶端保持同步。

### iOS 節點

- 使用全域清單進行 `VoiceWakeManager` 觸發偵測。
- 在設定中編輯喚醒詞會呼叫 `voicewake.set`（透過 Gateway 閘道器 WS），同時保持本地喚醒詞偵測的即時回應。

### Android 節點

- 在設定中提供喚醒詞編輯器。
- 透過 Gateway 閘道器 WS 呼叫 `voicewake.set`，讓編輯內容在各處同步。
