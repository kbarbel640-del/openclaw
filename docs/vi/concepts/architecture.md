---
summary: "Kiến trúc Gateway WebSocket, các thành phần và luồng client"
read_when:
  - Khi làm việc với giao thức gateway, client hoặc transport
title: "Kiến trúc Gateway"
x-i18n:
  source_path: concepts/architecture.md
  source_hash: c636d5d8a5e62806
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:45Z
---

# Kiến trúc Gateway

Cập nhật lần cuối: 2026-01-22

## Tổng quan

- Một **Gateway** tồn tại lâu dài sở hữu tất cả các bề mặt nhắn tin (WhatsApp qua
  Baileys, Telegram qua grammY, Slack, Discord, Signal, iMessage, WebChat).
- Các client mặt phẳng điều khiển (ứng dụng macOS, CLI, web UI, tự động hóa) kết nối tới
  Gateway qua **WebSocket** trên bind host đã cấu hình (mặc định
  `127.0.0.1:18789`).
- **Nodes** (macOS/iOS/Android/headless) cũng kết nối qua **WebSocket**, nhưng
  khai báo `role: node` với caps/commands tường minh.
- Mỗi host chỉ có một Gateway; đây là nơi duy nhất mở một phiên WhatsApp.
- Một **canvas host** (mặc định `18793`) phục vụ HTML có thể chỉnh sửa bởi agent và A2UI.

## Thành phần và luồng

### Gateway (daemon)

- Duy trì các kết nối provider.
- Phơi bày một API WS có kiểu (request, response, sự kiện server‑push).
- Xác thực các frame vào theo JSON Schema.
- Phát các sự kiện như `agent`, `chat`, `presence`, `health`, `heartbeat`, `cron`.

### Clients (ứng dụng mac / CLI / web admin)

- Mỗi client một kết nối WS.
- Gửi request (`health`, `status`, `send`, `agent`, `system-presence`).
- Đăng ký sự kiện (`tick`, `agent`, `presence`, `shutdown`).

### Nodes (macOS / iOS / Android / headless)

- Kết nối tới **cùng một máy chủ WS** với `role: node`.
- Cung cấp danh tính thiết bị trong `connect`; ghép cặp là **dựa trên thiết bị** (vai trò `node`) và
  phê duyệt nằm trong kho ghép cặp thiết bị.
- Phơi bày các lệnh như `canvas.*`, `camera.*`, `screen.record`, `location.get`.

Chi tiết giao thức:

- [Gateway protocol](/gateway/protocol)

### WebChat

- UI tĩnh sử dụng API WS của Gateway để lấy lịch sử chat và gửi tin.
- Trong các thiết lập từ xa, kết nối qua cùng đường hầm SSH/Tailscale như các
  client khác.

## Vòng đời kết nối (một client)

```
Client                    Gateway
  |                          |
  |---- req:connect -------->|
  |<------ res (ok) ---------|   (or res error + close)
  |   (payload=hello-ok carries snapshot: presence + health)
  |                          |
  |<------ event:presence ---|
  |<------ event:tick -------|
  |                          |
  |------- req:agent ------->|
  |<------ res:agent --------|   (ack: {runId,status:"accepted"})
  |<------ event:agent ------|   (streaming)
  |<------ res:agent --------|   (final: {runId,status,summary})
  |                          |
```

## Giao thức wire (tóm tắt)

- Transport: WebSocket, frame văn bản với payload JSON.
- Frame đầu tiên **bắt buộc** là `connect`.
- Sau bắt tay:
  - Request: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - Sự kiện: `{type:"event", event, payload, seq?, stateVersion?}`
- Nếu `OPENCLAW_GATEWAY_TOKEN` (hoặc `--token`) được đặt, `connect.params.auth.token`
  phải khớp nếu không socket sẽ đóng.
- Khóa idempotency là bắt buộc cho các phương thức gây tác dụng phụ (`send`, `agent`) để
  có thể retry an toàn; máy chủ giữ một bộ nhớ đệm khử trùng lặp tồn tại ngắn.
- Nodes phải bao gồm `role: "node"` cùng caps/commands/permissions trong `connect`.

## Ghép cặp + tin cậy cục bộ

- Tất cả client WS (operator + nodes) đều bao gồm **danh tính thiết bị** trong `connect`.
- ID thiết bị mới cần phê duyệt ghép cặp; Gateway phát hành **device token**
  cho các lần kết nối sau.
- Kết nối **cục bộ** (loopback hoặc địa chỉ tailnet của chính host gateway) có thể được
  tự động phê duyệt để giữ UX cùng host mượt mà.
- Kết nối **không cục bộ** phải ký nonce `connect.challenge` và yêu cầu
  phê duyệt tường minh.
- Xác thực Gateway (`gateway.auth.*`) vẫn áp dụng cho **tất cả** các kết nối, cục bộ hay
  từ xa.

Chi tiết: [Gateway protocol](/gateway/protocol), [Pairing](/start/pairing),
[Security](/gateway/security).

## Định kiểu giao thức và sinh mã

- Các schema TypeBox định nghĩa giao thức.
- JSON Schema được sinh từ các schema đó.
- Các model Swift được sinh từ JSON Schema.

## Truy cập từ xa

- Ưu tiên: Tailscale hoặc VPN.
- Phương án khác: đường hầm SSH
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- Cùng một bắt tay + token xác thực áp dụng qua đường hầm.
- TLS + tùy chọn pinning có thể được bật cho WS trong các thiết lập từ xa.

## Ảnh chụp vận hành

- Khởi động: `openclaw gateway` (chạy foreground, log ra stdout).
- Sức khỏe: `health` qua WS (cũng bao gồm trong `hello-ok`).
- Giám sát: launchd/systemd để tự động khởi động lại.

## Bất biến

- Chính xác một Gateway điều khiển một phiên Baileys duy nhất trên mỗi host.
- Bắt tay là bắt buộc; bất kỳ frame đầu tiên nào không phải JSON hoặc không phải connect sẽ bị đóng cứng.
- Sự kiện không được phát lại; client phải làm mới khi có khoảng trống.
