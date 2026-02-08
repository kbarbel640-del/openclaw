---
summary: "在 OpenClaw 中使用 Qwen OAuth（免費方案）"
read_when:
  - 您想要在 OpenClaw 中使用 Qwen
  - 您想要使用 Qwen Coder 的免費方案 OAuth 存取
title: "Qwen"
x-i18n:
  source_path: providers/qwen.md
  source_hash: 88b88e224e2fecbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:23Z
---

# Qwen

Qwen 為 Qwen Coder 與 Qwen Vision 模型提供免費方案的 OAuth 流程
（每日 2,000 次請求，受 Qwen 速率限制影響）。

## 啟用外掛

```bash
openclaw plugins enable qwen-portal-auth
```

啟用後請重新啟動 Gateway 閘道器。

## 驗證

```bash
openclaw models auth login --provider qwen-portal --set-default
```

這會執行 Qwen 的裝置碼 OAuth 流程，並將提供者項目寫入您的
`models.json`（另外建立一個 `qwen` 別名以便快速切換）。

## 模型 ID

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

使用以下方式切換模型：

```bash
openclaw models set qwen-portal/coder-model
```

## 重用 Qwen Code CLI 登入

如果您已使用 Qwen Code CLI 登入，OpenClaw 會在載入驗證儲存庫時，從
`~/.qwen/oauth_creds.json` 同步認證。您仍需要一個
`models.providers.qwen-portal` 項目（請使用上述登入指令建立）。

## 注意事項

- 權杖會自動重新整理；若重新整理失敗或存取被撤銷，請重新執行登入指令。
- 預設基底 URL：`https://portal.qwen.ai/v1`（若 Qwen 提供不同的端點，可使用
  `models.providers.qwen-portal.baseUrl` 覆寫）。
- 提供者層級的規則請參閱 [Model providers](/concepts/model-providers)。
