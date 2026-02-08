---
summary: "將 TypeBox 結構描述作為 Gateway 協定的單一事實來源"
read_when:
  - 更新協定結構描述或程式碼產生
title: "TypeBox"
x-i18n:
  source_path: concepts/typebox.md
  source_hash: 233800f4f5fabe8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:15Z
---

# 作為協定單一事實來源的 TypeBox

最後更新：2026-01-10

TypeBox 是一個以 TypeScript 為優先的結構描述程式庫。我們用它來定義 **Gateway
WebSocket 協定**（交握、請求/回應、伺服器事件）。這些結構描述驅動 **執行階段驗證**、**JSON Schema 匯出**，以及 macOS 應用程式的 **Swift 程式碼產生**。單一事實來源；其餘一切皆由此產生。

如果你想了解較高層級的協定背景，請從
[Gateway 架構](/concepts/architecture) 開始。

## 心智模型（30 秒）

每個 Gateway WS 訊息都是下列三種訊框之一：

- **Request**：`{ type: "req", id, method, params }`
- **Response**：`{ type: "res", id, ok, payload | error }`
- **Event**：`{ type: "event", event, payload, seq?, stateVersion? }`

第一個訊框 **必須** 是一個 `connect` 請求。之後，用戶端可以呼叫
方法（例如 `health`、`send`、`chat.send`），並訂閱事件（例如
`presence`、`tick`、`agent`）。

連線流程（最小）：

```
Client                    Gateway
  |---- req:connect -------->|
  |<---- res:hello-ok --------|
  |<---- event:tick ----------|
  |---- req:health ---------->|
  |<---- res:health ----------|
```

常見方法 + 事件：

| 類別      | 範例                                                      | 備註                                |
| --------- | --------------------------------------------------------- | ----------------------------------- |
| Core      | `connect`、`health`、`status`                             | `connect` 必須先呼叫                |
| Messaging | `send`、`poll`、`agent`、`agent.wait`                     | 具副作用的操作需要 `idempotencyKey` |
| Chat      | `chat.history`、`chat.send`、`chat.abort`、`chat.inject`  | WebChat 使用這些                    |
| Sessions  | `sessions.list`、`sessions.patch`、`sessions.delete`      | 工作階段管理                        |
| Nodes     | `node.list`、`node.invoke`、`node.pair.*`                 | Gateway WS + 節點動作               |
| Events    | `tick`、`presence`、`agent`、`chat`、`health`、`shutdown` | 伺服器推送                          |

權威清單位於 `src/gateway/server.ts`（`METHODS`、`EVENTS`）。

## 結構描述所在位置

- 原始碼：`src/gateway/protocol/schema.ts`
- 執行階段驗證器（AJV）：`src/gateway/protocol/index.ts`
- 伺服器交握 + 方法派發：`src/gateway/server.ts`
- Node 用戶端：`src/gateway/client.ts`
- 產生的 JSON Schema：`dist/protocol.schema.json`
- 產生的 Swift 模型：`apps/macos/Sources/OpenClawProtocol/GatewayModels.swift`

## 目前管線

- `pnpm protocol:gen`
  - 將 JSON Schema（draft‑07）寫入 `dist/protocol.schema.json`
- `pnpm protocol:gen:swift`
  - 產生 Swift Gateway 模型
- `pnpm protocol:check`
  - 執行兩個產生器並驗證輸出已提交

## 結構描述在執行階段的使用方式

- **伺服器端**：每個傳入訊框都會以 AJV 驗證。交握只接受一個
  其參數符合 `ConnectParams` 的 `connect` 請求。
- **用戶端**：JS 用戶端在使用事件與回應訊框前會先進行驗證。
- **方法介面**：Gateway 會在 `hello-ok` 中公告支援的 `methods` 與
  `events`。

## 範例訊框

連線（第一個訊息）：

```json
{
  "type": "req",
  "id": "c1",
  "method": "connect",
  "params": {
    "minProtocol": 2,
    "maxProtocol": 2,
    "client": {
      "id": "openclaw-macos",
      "displayName": "macos",
      "version": "1.0.0",
      "platform": "macos 15.1",
      "mode": "ui",
      "instanceId": "A1B2"
    }
  }
}
```

Hello-ok 回應：

```json
{
  "type": "res",
  "id": "c1",
  "ok": true,
  "payload": {
    "type": "hello-ok",
    "protocol": 2,
    "server": { "version": "dev", "connId": "ws-1" },
    "features": { "methods": ["health"], "events": ["tick"] },
    "snapshot": {
      "presence": [],
      "health": {},
      "stateVersion": { "presence": 0, "health": 0 },
      "uptimeMs": 0
    },
    "policy": { "maxPayload": 1048576, "maxBufferedBytes": 1048576, "tickIntervalMs": 30000 }
  }
}
```

請求 + 回應：

```json
{ "type": "req", "id": "r1", "method": "health" }
```

```json
{ "type": "res", "id": "r1", "ok": true, "payload": { "ok": true } }
```

事件：

```json
{ "type": "event", "event": "tick", "payload": { "ts": 1730000000 }, "seq": 12 }
```

## 最小用戶端（Node.js）

最小可用流程：連線 + 健康檢查。

```ts
import { WebSocket } from "ws";

const ws = new WebSocket("ws://127.0.0.1:18789");

ws.on("open", () => {
  ws.send(
    JSON.stringify({
      type: "req",
      id: "c1",
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "cli",
          displayName: "example",
          version: "dev",
          platform: "node",
          mode: "cli",
        },
      },
    }),
  );
});

ws.on("message", (data) => {
  const msg = JSON.parse(String(data));
  if (msg.type === "res" && msg.id === "c1" && msg.ok) {
    ws.send(JSON.stringify({ type: "req", id: "h1", method: "health" }));
  }
  if (msg.type === "res" && msg.id === "h1") {
    console.log("health:", msg.payload);
    ws.close();
  }
});
```

## 實作範例：端到端新增一個方法

範例：新增一個會回傳 `{ ok: true, text }` 的 `system.echo` 請求。

1. **結構描述（單一事實來源）**

新增至 `src/gateway/protocol/schema.ts`：

```ts
export const SystemEchoParamsSchema = Type.Object(
  { text: NonEmptyString },
  { additionalProperties: false },
);

export const SystemEchoResultSchema = Type.Object(
  { ok: Type.Boolean(), text: NonEmptyString },
  { additionalProperties: false },
);
```

同時加入 `ProtocolSchemas` 並匯出型別：

```ts
  SystemEchoParams: SystemEchoParamsSchema,
  SystemEchoResult: SystemEchoResultSchema,
```

```ts
export type SystemEchoParams = Static<typeof SystemEchoParamsSchema>;
export type SystemEchoResult = Static<typeof SystemEchoResultSchema>;
```

2. **驗證**

在 `src/gateway/protocol/index.ts` 中匯出一個 AJV 驗證器：

```ts
export const validateSystemEchoParams = ajv.compile<SystemEchoParams>(SystemEchoParamsSchema);
```

3. **伺服器行為**

在 `src/gateway/server-methods/system.ts` 中新增處理器：

```ts
export const systemHandlers: GatewayRequestHandlers = {
  "system.echo": ({ params, respond }) => {
    const text = String(params.text ?? "");
    respond(true, { ok: true, text });
  },
};
```

在 `src/gateway/server-methods.ts` 中註冊它（已合併 `systemHandlers`），
然後在 `src/gateway/server.ts` 中將 `"system.echo"` 新增到 `METHODS`。

4. **重新產生**

```bash
pnpm protocol:check
```

5. **測試 + 文件**

在 `src/gateway/server.*.test.ts` 中新增伺服器測試，並在文件中註記該方法。

## Swift 程式碼產生行為

Swift 產生器會輸出：

- 具備 `req`、`res`、`event` 與 `unknown` case 的 `GatewayFrame` enum
- 強型別的 payload struct/enum
- `ErrorCode` 值與 `GATEWAY_PROTOCOL_VERSION`

未知的訊框型別會以原始 payload 形式保留，以確保向前相容。

## 版本管理 + 相容性

- `PROTOCOL_VERSION` 位於 `src/gateway/protocol/schema.ts`。
- 用戶端會送出 `minProtocol` + `maxProtocol`；伺服器會拒絕不相符的情況。
- Swift 模型會保留未知的訊框型別，以避免破壞舊版用戶端。

## 結構描述模式與慣例

- 多數物件使用 `additionalProperties: false` 以確保 payload 嚴格。
- `NonEmptyString` 是 ID 與方法/事件名稱的預設型別。
- 最上層的 `GatewayFrame` 在 `type` 上使用 **判別器**。
- 具有副作用的方法通常需要在 params 中提供 `idempotencyKey`
  （例如：`send`、`poll`、`agent`、`chat.send`）。

## 即時結構描述 JSON

產生的 JSON Schema 位於儲存庫中的 `dist/protocol.schema.json`。已發布的原始檔通常可在以下位置取得：

- https://raw.githubusercontent.com/openclaw/openclaw/main/dist/protocol.schema.json

## 當你變更結構描述時

1. 更新 TypeBox 結構描述。
2. 執行 `pnpm protocol:check`。
3. 提交重新產生的結構描述與 Swift 模型。
