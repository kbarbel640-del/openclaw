---
summary: "計畫：新增 OpenResponses /v1/responses 端點，並以乾淨方式淘汰 Chat Completions"
owner: "openclaw"
status: "draft"
last_updated: "2026-01-19"
title: "OpenResponses Gateway 閘道器計畫"
x-i18n:
  source_path: experiments/plans/openresponses-gateway.md
  source_hash: 71a22c48397507d1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:22Z
---

# OpenResponses Gateway 閘道器整合計畫

## 背景

OpenClaw Gateway 目前僅提供一個最小化、相容 OpenAI 的 Chat Completions 端點，位於
`/v1/chat/completions`（請參閱 [OpenAI Chat Completions](/gateway/openai-http-api)）。

Open Responses 是一個基於 OpenAI Responses API 的開放推論標準。其設計用於代理式工作流程，
並使用以項目為基礎的輸入以及語意化串流事件。OpenResponses 規格定義的是
`/v1/responses`，而非 `/v1/chat/completions`。

## 目標

- 新增一個符合 OpenResponses 語意的 `/v1/responses` 端點。
- 保留 Chat Completions 作為相容層，且易於停用並最終移除。
- 以隔離、可重用的結構描述來標準化驗證與解析。

## 非目標

- 第一階段即達成完整的 OpenResponses 功能等同（影像、檔案、託管工具）。
- 取代內部代理執行邏輯或工具協調機制。
- 在第一階段變更既有的 `/v1/chat/completions` 行為。

## 研究摘要

來源：OpenResponses OpenAPI、OpenResponses 規格網站，以及 Hugging Face 部落格文章。

擷取的重點如下：

- `POST /v1/responses` 接受 `CreateResponseBody` 欄位，例如 `model`、`input`（字串或
  `ItemParam[]`）、`instructions`、`tools`、`tool_choice`、`stream`、`max_output_tokens`，以及
  `max_tool_calls`。
- `ItemParam` 是一個可判別的聯合型別，包含：
  - 具有角色 `system`、`developer`、`user`、`assistant` 的 `message` 項目
  - `function_call` 與 `function_call_output`
  - `reasoning`
  - `item_reference`
- 成功的回應會回傳一個 `ResponseResource`，其中包含 `object: "response"`、`status`，以及
  `output` 項目。
- 串流使用語意化事件，例如：
  - `response.created`、`response.in_progress`、`response.completed`、`response.failed`
  - `response.output_item.added`、`response.output_item.done`
  - `response.content_part.added`、`response.content_part.done`
  - `response.output_text.delta`、`response.output_text.done`
- 規格要求：
  - `Content-Type: text/event-stream`
  - `event:` 必須與 JSON 的 `type` 欄位相符
  - 終止事件必須是字面值 `[DONE]`
- 推理項目可能會暴露 `content`、`encrypted_content`，以及 `summary`。
- HF 範例在請求中包含 `OpenResponses-Version: latest`（選用標頭）。

## 建議架構

- 新增僅包含 Zod 結構描述的 `src/gateway/open-responses.schema.ts`（不匯入 gateway）。
- 新增用於 `/v1/responses` 的 `src/gateway/openresponses-http.ts`（或 `open-responses-http.ts`）。
- 保持 `src/gateway/openai-http.ts` 作為既有的相容性轉接層。
- 新增設定 `gateway.http.endpoints.responses.enabled`（預設為 `false`）。
- 保持 `gateway.http.endpoints.chatCompletions.enabled` 的獨立性；允許兩個端點分別切換。
- 當啟用 Chat Completions 時，在啟動時發出警告以提示其為舊版功能。

## Chat Completions 的淘汰路徑

- 維持嚴格的模組邊界：responses 與 chat completions 之間不共用任何結構描述型別。
- 讓 Chat Completions 透過設定選擇性啟用，以便在不修改程式碼的情況下停用。
- 一旦 `/v1/responses` 穩定後，更新文件將 Chat Completions 標示為舊版。
- 未來可選步驟：將 Chat Completions 的請求對映至 Responses 處理器，以簡化移除流程。

## 第 1 階段支援子集

- 接受 `input`，形式為字串或具有訊息角色與 `function_call_output` 的 `ItemParam[]`。
- 將 system 與 developer 訊息萃取至 `extraSystemPrompt`。
- 使用最近的 `user` 或 `function_call_output` 作為代理執行時的目前訊息。
- 以 `invalid_request_error` 拒絕不支援的內容部分（影像／檔案）。
- 回傳單一 assistant 訊息，內容為 `output_text`。
- 在權杖計算尚未串接前，回傳數值皆為零的 `usage`。

## 驗證策略（不使用 SDK）

- 為支援的子集實作 Zod 結構描述，包括：
  - `CreateResponseBody`
  - `ItemParam` 與訊息內容部分的聯合型別
  - `ResponseResource`
  - Gateway 使用的串流事件結構
- 將結構描述集中於單一、隔離的模組中，以避免漂移並支援未來的程式碼產生。

## 串流實作（第 1 階段）

- SSE 行同時包含 `event:` 與 `data:`。
- 必要的最小序列（最低可行）：
  - `response.created`
  - `response.output_item.added`
  - `response.content_part.added`
  - `response.output_text.delta`（視需要重複）
  - `response.output_text.done`
  - `response.content_part.done`
  - `response.completed`
  - `[DONE]`

## 測試與驗證計畫

- 為 `/v1/responses` 新增端對端測試覆蓋：
  - 需要驗證
  - 非串流回應結構
  - 串流事件順序與 `[DONE]`
  - 透過標頭與 `user` 進行工作階段路由
- 保持 `src/gateway/openai-http.e2e.test.ts` 不變。
- 手動測試：使用 curl 對 `/v1/responses` 搭配 `stream: true`，並驗證事件順序與終止
  `[DONE]`。

## 文件更新（後續）

- 新增一個文件頁面，說明 `/v1/responses` 的使用方式與範例。
- 更新 `/gateway/openai-http-api`，加入舊版註記並指向 `/v1/responses`。
