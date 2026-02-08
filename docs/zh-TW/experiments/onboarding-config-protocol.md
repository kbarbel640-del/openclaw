---
summary: "入門引導精靈與設定結構描述的 RPC 通訊協定備註"
read_when: "變更入門引導精靈步驟或設定結構描述端點時"
title: "入門引導與設定通訊協定"
x-i18n:
  source_path: experiments/onboarding-config-protocol.md
  source_hash: 55163b3ee029c024
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:13Z
---

# 入門引導 + 設定通訊協定

目的：在 CLI、macOS 應用程式與 Web UI 之間共用入門引導與設定介面。

## 元件

- 精靈引擎（共用的工作階段、提示與入門引導狀態）。
- CLI 入門引導使用與 UI 用戶端相同的精靈流程。
- Gateway 閘道器 RPC 提供精靈與設定結構描述端點。
- macOS 入門引導使用精靈步驟模型。
- Web UI 依據 JSON Schema + UI 提示來渲染設定表單。

## Gateway 閘道器 RPC

- `wizard.start` 參數：`{ mode?: "local"|"remote", workspace?: string }`
- `wizard.next` 參數：`{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel` 參數：`{ sessionId }`
- `wizard.status` 參數：`{ sessionId }`
- `config.schema` 參數：`{}`

回應（結構）

- 精靈：`{ sessionId, done, step?, status?, error? }`
- 設定結構描述：`{ schema, uiHints, version, generatedAt }`

## UI 提示

- `uiHints` 以路徑為鍵；可選的中繼資料（標籤 / 說明 / 群組 / 排序 / 進階 / 敏感 / 佔位符）。
- 敏感欄位以密碼輸入呈現；沒有遮蔽層。
- 不支援的結構描述節點會回退為原始 JSON 編輯器。

## 備註

- 本文件是追蹤入門引導 / 設定通訊協定重構的單一來源。
