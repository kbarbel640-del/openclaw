---
summary: 「當喚醒詞與按住說話重疊時的語音覆蓋層生命週期」
read_when:
  - 調整語音覆蓋層行為
title: 「語音覆蓋層」
x-i18n:
  source_path: platforms/mac/voice-overlay.md
  source_hash: 3be1a60aa7940b23
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:14Z
---

# 語音覆蓋層生命週期（macOS）

受眾：macOS 應用程式貢獻者。目標：在喚醒詞與按住說話重疊時，保持語音覆蓋層的可預期性。

### 目前意圖

- 若覆蓋層已因喚醒詞而顯示，且使用者按下熱鍵，則熱鍵工作階段會「採用」既有文字而非重設。覆蓋層在按住熱鍵期間持續顯示。當使用者放開時：若有修剪後的文字則送出，否則關閉。
- 僅使用喚醒詞時仍會在靜默後自動送出；按住說話則在放開時立即送出。

### 已實作（2025 年 12 月 9 日）

- 覆蓋層工作階段現在會為每次擷取（喚醒詞或按住說話）攜帶一個權杖。當權杖不相符時，部分／最終／送出／關閉／音量更新會被丟棄，避免過期回呼。
- 按住說話會將任何可見的覆蓋層文字採用為前綴（因此在喚醒覆蓋層顯示時按下熱鍵，會保留文字並附加新的語音）。在回退至目前文字前，最多等待 1.5 秒以取得最終轉錄。
- 提示音／覆蓋層記錄會在 `info` 發出，分類為 `voicewake.overlay`、`voicewake.ptt` 與 `voicewake.chime`（工作階段開始、部分、最終、送出、關閉、提示音原因）。

### 下一步

1. **VoiceSessionCoordinator（actor）**
   - 同一時間僅擁有一個 `VoiceSession`。
   - API（以權杖為基礎）：`beginWakeCapture`、`beginPushToTalk`、`updatePartial`、`endCapture`、`cancel`、`applyCooldown`。
   - 丟棄攜帶過期權杖的回呼（防止舊的辨識器重新開啟覆蓋層）。
2. **VoiceSession（模型）**
   - 欄位：`token`、`source`（wakeWord|pushToTalk）、已提交／易變文字、提示音旗標、計時器（自動送出、閒置）、`overlayMode`（display|editing|sending）、冷卻期限。
3. **覆蓋層繫結**
   - `VoiceSessionPublisher`（`ObservableObject`）將作用中的工作階段鏡射到 SwiftUI。
   - `VoiceWakeOverlayView` 僅透過發布者進行渲染；它不會直接變更全域單例。
   - 覆蓋層使用者動作（`sendNow`、`dismiss`、`edit`）會以工作階段權杖回呼至協調器。
4. **統一的送出路徑**
   - 在 `endCapture` 時：若修剪後文字為空 → 關閉；否則 `performSend(session:)`（只播放一次送出提示音、轉送、關閉）。
   - 按住說話：不延遲；喚醒詞：可選的自動送出延遲。
   - 在按住說話結束後，對喚醒執行階段套用短暫冷卻，避免喚醒詞立即再次觸發。
5. **記錄**
   - 協調器在子系統 `bot.molt`、分類 `voicewake.overlay` 與 `voicewake.chime` 發出 `.info` 記錄。
   - 關鍵事件：`session_started`、`adopted_by_push_to_talk`、`partial`、`finalized`、`send`、`dismiss`、`cancel`、`cooldown`。

### 除錯檢查清單

- 在重現黏住的覆蓋層時串流記錄：

  ```bash
  sudo log stream --predicate 'subsystem == "bot.molt" AND category CONTAINS "voicewake"' --level info --style compact
  ```

- 確認僅有一個作用中的工作階段權杖；過期回呼應由協調器丟棄。
- 確保按住說話的放開一定會以作用中的權杖呼叫 `endCapture`；若文字為空，預期會出現 `dismiss`，且不播放提示音或送出。

### 遷移步驟（建議）

1. 新增 `VoiceSessionCoordinator`、`VoiceSession` 與 `VoiceSessionPublisher`。
2. 重構 `VoiceWakeRuntime`，以建立／更新／結束工作階段，取代直接操作 `VoiceWakeOverlayController`。
3. 重構 `VoicePushToTalk` 以採用既有工作階段，並在放開時呼叫 `endCapture`；套用執行階段冷卻。
4. 將 `VoiceWakeOverlayController` 連接至發布者；移除來自執行階段／PTT 的直接呼叫。
5. 新增整合測試，涵蓋工作階段採用、冷卻，以及空文字關閉。
