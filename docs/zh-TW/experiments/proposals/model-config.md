---
summary: 「探索：模型設定、驗證設定檔與後備行為」
read_when:
  - 探索未來的模型選擇與驗證設定檔構想
title: 「Model Config 探索」
x-i18n:
  source_path: experiments/proposals/model-config.md
  source_hash: 48623233d80f874c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:15Z
---

# Model Config （探索）

本文件彙整未來模型設定的**想法**。這不是一份
已發佈的規格。關於目前的行為，請參見：

- [Models](/concepts/models)
- [Model failover](/concepts/model-failover)
- [OAuth + profiles](/concepts/oauth)

## 動機

營運者希望：

- 每個提供者可有多個驗證設定檔（個人 vs 工作）。
- 簡單的 `/model` 選擇，並具備可預期的後備行為。
- 清楚區分文字模型與支援影像的模型。

## 可能方向（高層次）

- 保持模型選擇的簡單性：`provider/model`，並支援選用的別名。
- 讓提供者擁有多個驗證設定檔，並具有明確的順序。
- 使用全域後備清單，讓所有工作階段以一致方式進行失敗轉移。
- 僅在明確設定時才覆寫影像路由。

## 開放問題

- 設定檔輪替應以提供者為單位，還是以模型為單位？
- UI 應如何呈現工作階段的設定檔選擇？
- 從舊有設定鍵遷移的最安全路徑是什麼？
