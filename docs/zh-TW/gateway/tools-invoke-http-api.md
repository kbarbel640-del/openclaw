---
summary: 「透過 Gateway HTTP 端點直接呼叫單一工具」
read_when:
  - 在不執行完整代理程式回合的情況下呼叫工具
  - 建置需要工具政策強制的自動化
title: 「工具呼叫 API」
x-i18n:
  source_path: gateway/tools-invoke-http-api.md
  source_hash: 17ccfbe0b0d9bb61
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:32Z
---

# Tools Invoke（HTTP）

OpenClaw 的 Gateway 閘道器 提供一個簡單的 HTTP 端點，用於直接呼叫單一工具。此端點永遠啟用，但受 Gateway 閘道器 驗證與工具政策管控。

- `POST /tools/invoke`
- 與 Gateway 閘道器 相同的連接埠（WS + HTTP 多工）：`http://<gateway-host>:<port>/tools/invoke`

預設最大負載大小為 2 MB。

## 驗證

使用 Gateway 閘道器 的驗證設定。請傳送 bearer token：

- `Authorization: Bearer <token>`

注意事項：

- 當 `gateway.auth.mode="token"` 時，請使用 `gateway.auth.token`（或 `OPENCLAW_GATEWAY_TOKEN`）。
- 當 `gateway.auth.mode="password"` 時，請使用 `gateway.auth.password`（或 `OPENCLAW_GATEWAY_PASSWORD`）。

## 請求本文

```json
{
  "tool": "sessions_list",
  "action": "json",
  "args": {},
  "sessionKey": "main",
  "dryRun": false
}
```

欄位：

- `tool`（string，必填）：要呼叫的工具名稱。
- `action`（string，選填）：若工具結構描述支援 `action` 且 args 負載未提供，則會對應至 args。
- `args`（object，選填）：工具專屬的引數。
- `sessionKey`（string，選填）：目標工作階段金鑰。若省略或為 `"main"`，Gateway 閘道器 會使用已設定的主要工作階段金鑰（遵循 `session.mainKey` 與預設代理程式，或在全域範圍使用 `global`）。
- `dryRun`（boolean，選填）：保留供未來使用；目前會被忽略。

## 政策 + 路由行為

工具可用性會透過與 Gateway 代理程式 相同的政策鏈進行篩選：

- `tools.profile` / `tools.byProvider.profile`
- `tools.allow` / `tools.byProvider.allow`
- `agents.<id>.tools.allow` / `agents.<id>.tools.byProvider.allow`
- 群組政策（若工作階段金鑰對應到群組或頻道）
- 子代理程式政策（使用子代理程式工作階段金鑰呼叫時）

若工具未被政策允許，端點會回傳 **404**。

為了協助群組政策解析脈絡，你可以選擇性設定：

- `x-openclaw-message-channel: <channel>`（範例：`slack`、`telegram`）
- `x-openclaw-account-id: <accountId>`（當存在多個帳戶時）

## 回應

- `200` → `{ ok: true, result }`
- `400` → `{ ok: false, error: { type, message } }`（無效請求或工具錯誤）
- `401` → 未授權
- `404` → 工具不可用（未找到或未加入允許清單）
- `405` → 不允許的方法

## 範例

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "sessions_list",
    "action": "json",
    "args": {}
  }'
```
