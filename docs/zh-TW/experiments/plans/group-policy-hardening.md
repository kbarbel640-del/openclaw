---
summary: "Telegram 允許清單強化：前綴 + 空白正規化"
read_when:
  - 檢視歷史 Telegram 允許清單變更時
title: "Telegram 允許清單強化"
x-i18n:
  source_path: experiments/plans/group-policy-hardening.md
  source_hash: a2eca5fcc8537694
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:11Z
---

# Telegram 允許清單強化

**日期**：2026-01-05  
**狀態**：完成  
**PR**：#216

## 摘要

Telegram 允許清單現在可不分大小寫地接受 `telegram:` 與 `tg:` 前綴，並能容忍
意外的空白。這使得輸入端的允許清單檢查與輸出端傳送的正規化行為一致。

## 變更內容

- 前綴 `telegram:` 與 `tg:` 視為相同（不分大小寫）。
- 允許清單項目會進行修剪；空白項目將被忽略。

## 範例

以下所有項目都會被接受為相同的 ID：

- `telegram:123456`
- `TG:123456`
- `tg:123456`

## 為何重要

從日誌或聊天 ID 複製貼上時，常會包含前綴與空白。進行正規化可避免在判斷是否於 私訊 或群組中回應時出現誤判的否定結果。

## 相關文件

- [群組聊天](/concepts/groups)
- [Telegram 提供者](/channels/telegram)
