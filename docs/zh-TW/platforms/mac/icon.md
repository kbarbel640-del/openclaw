---
summary: "OpenClaw 在 macOS 上的選單列圖示狀態與動畫"
read_when:
  - 變更選單列圖示行為時
title: "選單列圖示"
x-i18n:
  source_path: platforms/mac/icon.md
  source_hash: a67a6e6bbdc2b611
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:07Z
---

# 選單列圖示狀態

作者：steipete · 更新：2025-12-06 · 範圍：macOS 應用程式（`apps/macos`）

- **閒置：** 一般圖示動畫（眨眼、偶爾晃動）。
- **暫停：** 狀態項目使用 `appearsDisabled`；不動作。
- **語音觸發（大耳朵）：** 語音喚醒偵測在聽到喚醒詞時呼叫 `AppState.triggerVoiceEars(ttl: nil)`，並在擷取語句期間維持 `earBoostActive=true`。耳朵放大（1.9x），為了可讀性加入圓形耳孔，接著在 1 秒靜默後透過 `stopVoiceEars()` 下落。僅由應用程式內的語音管線觸發。
- **工作中（代理程式執行）：** `AppState.isWorking=true` 觸發「尾巴／腿部奔跑」的微動作：在工作進行中加快腿部擺動並略微位移。目前在 WebChat 代理程式執行前後切換；當你串接其他長時間任務時，請加入相同的切換。

接線點

- 語音喚醒：在觸發時由 runtime/tester 呼叫 `AppState.triggerVoiceEars(ttl: nil)`，並在 1 秒靜默後呼叫 `stopVoiceEars()` 以符合擷取視窗。
- 代理程式活動：在工作區段前後設定 `AppStateStore.shared.setWorking(true/false)`（WebChat 代理程式呼叫已完成）。請保持區段精簡，並在 `defer` 區塊中重設，以避免動畫卡住。

形狀與尺寸

- 基礎圖示繪製於 `CritterIconRenderer.makeIcon(blink:legWiggle:earWiggle:earScale:earHoles:)`。
- 耳朵縮放預設為 `1.0`；語音加強會設定為 `earScale=1.9`，並切換 `earHoles=true`，且不改變整體外框（18×18 pt 範本影像渲染到 36×36 px 的 Retina 背景儲存）。
- 奔跑效果使用腿部擺動至約 1.0，並加入小幅水平抖動；此效果會疊加在任何既有的閒置晃動之上。

行為備註

- 耳朵／工作中沒有外部 CLI／broker 的切換；請維持在應用程式自身訊號內部，以避免意外抖動。
- 請將 TTL 保持短（&lt;10s），以便在工作卡住時圖示能快速回到基準狀態。
