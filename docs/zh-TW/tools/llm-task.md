---
summary: 「用於工作流程的僅限 JSON LLM 任務（選用外掛工具）」
read_when:
  - 當你想在工作流程中加入僅限 JSON 的 LLM 步驟
  - 當你需要可進行結構驗證的 LLM 輸出以供自動化
title: 「LLM 任務」
x-i18n:
  source_path: tools/llm-task.md
  source_hash: b7aa78f179cb0f63
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:54Z
---

# LLM 任務

`llm-task` 是一個 **選用外掛工具**，可執行僅限 JSON 的 LLM 任務，並回傳結構化輸出（可選擇是否依 JSON Schema 驗證）。

這非常適合像 Lobster 這樣的工作流程引擎：你可以加入單一 LLM 步驟，而不必為每個工作流程撰寫自訂的 OpenClaw 程式碼。

## 啟用外掛

1. 啟用外掛：

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  }
}
```

2. 將工具加入允許清單（它以 `optional: true` 註冊）：

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

## 設定（選用）

```json
{
  "plugins": {
    "entries": {
      "llm-task": {
        "enabled": true,
        "config": {
          "defaultProvider": "openai-codex",
          "defaultModel": "gpt-5.2",
          "defaultAuthProfileId": "main",
          "allowedModels": ["openai-codex/gpt-5.3-codex"],
          "maxTokens": 800,
          "timeoutMs": 30000
        }
      }
    }
  }
}
```

`allowedModels` 是 `provider/model` 字串的允許清單。若有設定，任何不在清單中的請求都會被拒絕。

## 工具參數

- `prompt`（string，必填）
- `input`（any，選填）
- `schema`（object，選填的 JSON Schema）
- `provider`（string，選填）
- `model`（string，選填）
- `authProfileId`（string，選填）
- `temperature`（number，選填）
- `maxTokens`（number，選填）
- `timeoutMs`（number，選填）

## 輸出

回傳包含已解析 JSON 的 `details.json`（若有提供，會依 `schema` 進行驗證）。

## 範例：Lobster 工作流程步驟

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": {
    "subject": "Hello",
    "body": "Can you help?"
  },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

## 安全性注意事項

- 此工具 **僅限 JSON**，並指示模型只輸出 JSON（不含程式碼區塊、不含說明文字）。
- 本次執行不會向模型公開任何工具。
- 除非你使用 `schema` 進行驗證，否則請將輸出視為不受信任。
- 在任何具副作用的步驟（send、post、exec）之前放置核准流程。
