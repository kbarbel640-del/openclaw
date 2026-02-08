---
summary: "Giao thức WebSocket của Gateway: bắt tay, khung, phiên bản hóa"
read_when:
  - Triển khai hoặc cập nhật client WS của gateway
  - Gỡ lỗi sai lệch giao thức hoặc lỗi kết nối
  - Tạo lại schema/mô hình giao thức
title: "Giao thức Gateway"
x-i18n:
  source_path: gateway/protocol.md
  source_hash: bdafac40d5356590
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:24Z
---

# Giao thức Gateway (WebSocket)

Giao thức WS của Gateway là **một mặt phẳng điều khiển duy nhất + vận chuyển node**
cho OpenClaw. Tất cả client (CLI, web UI, ứng dụng macOS, node iOS/Android, node
không giao diện) kết nối qua WebSocket và khai báo **vai trò** + **phạm vi**
tại thời điểm bắt tay.

## Vận chuyển

- WebSocket, khung văn bản với payload JSON.
- Khung đầu tiên **phải** là một yêu cầu `connect`.

## Bắt tay (kết nối)

Gateway → Client (thử thách trước khi kết nối):

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "…", "ts": 1737264000000 }
}
```

Client → Gateway:

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "1.2.3",
      "platform": "macos",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-cli/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

Gateway → Client:

```json
{
  "type": "res",
  "id": "…",
  "ok": true,
  "payload": { "type": "hello-ok", "protocol": 3, "policy": { "tickIntervalMs": 15000 } }
}
```

Khi phát hành token thiết bị, `hello-ok` cũng bao gồm:

```json
{
  "auth": {
    "deviceToken": "…",
    "role": "operator",
    "scopes": ["operator.read", "operator.write"]
  }
}
```

### Ví dụ node

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "ios-node",
      "version": "1.2.3",
      "platform": "ios",
      "mode": "node"
    },
    "role": "node",
    "scopes": [],
    "caps": ["camera", "canvas", "screen", "location", "voice"],
    "commands": ["camera.snap", "canvas.navigate", "screen.record", "location.get"],
    "permissions": { "camera.capture": true, "screen.record": false },
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-ios/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

## Đóng khung

- **Yêu cầu**: `{type:"req", id, method, params}`
- **Phản hồi**: `{type:"res", id, ok, payload|error}`
- **Sự kiện**: `{type:"event", event, payload, seq?, stateVersion?}`

Các phương thức gây tác dụng phụ yêu cầu **khóa idempotency** (xem schema).

## Vai trò + phạm vi

### Vai trò

- `operator` = client mặt phẳng điều khiển (CLI/UI/tự động hóa).
- `node` = máy chủ khả năng (camera/màn hình/canvas/system.run).

### Phạm vi (operator)

Các phạm vi phổ biến:

- `operator.read`
- `operator.write`
- `operator.admin`
- `operator.approvals`
- `operator.pairing`

### Khả năng/lệnh/quyền (node)

Node khai báo các yêu cầu khả năng tại thời điểm kết nối:

- `caps`: các danh mục khả năng cấp cao.
- `commands`: danh sách cho phép lệnh để invoke.
- `permissions`: các công tắc chi tiết (ví dụ: `screen.record`, `camera.capture`).

Gateway coi đây là các **claim** và thực thi danh sách cho phép phía máy chủ.

## Presence

- `system-presence` trả về các mục được khóa theo định danh thiết bị.
- Các mục presence bao gồm `deviceId`, `roles` và `scopes` để UI có thể hiển thị một dòng duy nhất cho mỗi thiết bị
  ngay cả khi nó kết nối với cả **operator** và **node**.

### Phương thức hỗ trợ cho node

- Node có thể gọi `skills.bins` để lấy danh sách hiện tại các executable của skill
  nhằm kiểm tra tự động cho phép.

## Phê duyệt exec

- Khi một yêu cầu exec cần phê duyệt, gateway phát `exec.approval.requested`.
- Client operator giải quyết bằng cách gọi `exec.approval.resolve` (yêu cầu phạm vi `operator.approvals`).

## Phiên bản hóa

- `PROTOCOL_VERSION` nằm trong `src/gateway/protocol/schema.ts`.
- Client gửi `minProtocol` + `maxProtocol`; máy chủ từ chối nếu không khớp.
- Schema + mô hình được tạo từ các định nghĩa TypeBox:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`
  - `pnpm protocol:check`

## Xác thực

- Nếu `OPENCLAW_GATEWAY_TOKEN` (hoặc `--token`) được đặt, `connect.params.auth.token`
  phải khớp, nếu không socket sẽ bị đóng.
- Sau khi ghép cặp, Gateway phát hành một **token thiết bị** được giới hạn theo
  vai trò + phạm vi của kết nối. Token này được trả về trong `hello-ok.auth.deviceToken` và nên
  được client lưu lại cho các lần kết nối sau.
- Token thiết bị có thể được xoay vòng/thu hồi qua `device.token.rotate` và
  `device.token.revoke` (yêu cầu phạm vi `operator.pairing`).

## Định danh thiết bị + ghép cặp

- Node nên bao gồm một định danh thiết bị ổn định (`device.id`) được suy ra từ
  fingerprint của cặp khóa.
- Gateway phát hành token theo từng thiết bị + vai trò.
- Phê duyệt ghép cặp là bắt buộc cho các ID thiết bị mới trừ khi bật tự động phê duyệt cục bộ.
- Kết nối **cục bộ** bao gồm loopback và địa chỉ tailnet của chính máy chủ gateway
  (vì vậy các bind tailnet cùng máy chủ vẫn có thể tự động phê duyệt).
- Tất cả client WS phải bao gồm định danh `device` trong quá trình `connect` (operator + node).
  UI điều khiển chỉ có thể bỏ qua **duy nhất** khi bật `gateway.controlUi.allowInsecureAuth`
  (hoặc `gateway.controlUi.dangerouslyDisableDeviceAuth` cho trường hợp break-glass).
- Các kết nối không cục bộ phải ký nonce `connect.challenge` do máy chủ cung cấp.

## TLS + ghim chứng chỉ

- TLS được hỗ trợ cho các kết nối WS.
- Client có thể tùy chọn ghim fingerprint chứng chỉ của gateway (xem cấu hình `gateway.tls`
  cùng với `gateway.remote.tlsFingerprint` hoặc CLI `--tls-fingerprint`).

## Phạm vi

Giao thức này phơi bày **toàn bộ API của gateway** (trạng thái, kênh, mô hình, chat,
agent, phiên, node, phê duyệt, v.v.). Bề mặt chính xác được xác định bởi các schema
TypeBox trong `src/gateway/protocol/schema.ts`.
