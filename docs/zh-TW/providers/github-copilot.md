---
summary: "從 OpenClaw 使用裝置流程登入 GitHub Copilot"
read_when:
  - 您想要將 GitHub Copilot 作為模型提供者使用
  - 您需要 `openclaw models auth login-github-copilot` 流程
title: "GitHub Copilot"
x-i18n:
  source_path: providers/github-copilot.md
  source_hash: 503e0496d92c921e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:17Z
---

# GitHub Copilot

## 什麼是 GitHub Copilot？

GitHub Copilot 是 GitHub 的 AI 程式碼助理。它為您的 GitHub 帳戶與方案提供 Copilot
模型的存取權。OpenClaw 可以用兩種不同方式將 Copilot 作為模型
提供者。

## 在 OpenClaw 中使用 Copilot 的兩種方式

### 1) 內建的 GitHub Copilot 提供者（`github-copilot`）

使用原生的裝置登入流程取得 GitHub 權杖，然後在 OpenClaw 執行時將其交換為
Copilot API 權杖。這是**預設**且最簡單的路徑，因為
不需要 VS Code。

### 2) Copilot Proxy 外掛（`copilot-proxy`）

使用 **Copilot Proxy** VS Code 擴充功能作為本機橋接。OpenClaw 會與
代理的 `/v1` 端點通訊，並使用您在那裡設定的模型清單。當您已在 VS Code 中執行 Copilot Proxy 或需要透過它進行路由時，請選擇此方式。
您必須啟用外掛並保持 VS Code 擴充功能執行中。

將 GitHub Copilot 作為模型提供者使用（`github-copilot`）。登入指令會執行
GitHub 裝置流程、儲存一個驗證設定檔，並更新您的設定以使用該
設定檔。

## CLI 設定

```bash
openclaw models auth login-github-copilot
```

系統會提示您造訪一個 URL 並輸入一次性代碼。請保持終端機
開啟直到流程完成。

### 可選旗標

```bash
openclaw models auth login-github-copilot --profile-id github-copilot:work
openclaw models auth login-github-copilot --yes
```

## 設定預設模型

```bash
openclaw models set github-copilot/gpt-4o
```

### 設定片段

```json5
{
  agents: { defaults: { model: { primary: "github-copilot/gpt-4o" } } },
}
```

## 注意事項

- 需要互動式 TTY；請直接在終端機中執行。
- Copilot 模型可用性取決於您的方案；如果某個模型被拒絕，請嘗試
  另一個 ID（例如 `github-copilot/gpt-4.1`）。
- 登入會在驗證設定檔儲存庫中儲存一個 GitHub 權杖，並在 OpenClaw 執行時將其交換為
  Copilot API 權杖。
