---
summary: "Các bề mặt web của Gateway: Control UI, chế độ bind và bảo mật"
read_when:
  - Bạn muốn truy cập Gateway qua Tailscale
  - Bạn muốn Control UI trên trình duyệt và chỉnh sửa cấu hình
title: "Web"
x-i18n:
  source_path: web/index.md
  source_hash: 1315450b71a799c8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:50Z
---

# Web (Gateway)

Gateway cung cấp một **Control UI trên trình duyệt** (Vite + Lit) từ cùng cổng với Gateway WebSocket:

- mặc định: `http://<host>:18789/`
- tiền tố tùy chọn: đặt `gateway.controlUi.basePath` (ví dụ: `/openclaw`)

Các khả năng nằm trong [Control UI](/web/control-ui).
Trang này tập trung vào các chế độ bind, bảo mật và các bề mặt hướng web.

## Webhooks

Khi `hooks.enabled=true`, Gateway cũng mở một endpoint webhook nhỏ trên cùng máy chủ HTTP.
Xem [Cấu hình Gateway](/gateway/configuration) → `hooks` để biết xác thực + payload.

## Config (bật mặc định)

Control UI **được bật mặc định** khi có sẵn các asset (`dist/control-ui`).
Bạn có thể kiểm soát qua cấu hình:

```json5
{
  gateway: {
    controlUi: { enabled: true, basePath: "/openclaw" }, // basePath optional
  },
}
```

## Truy cập Tailscale

### Serve tích hợp (khuyến nghị)

Giữ Gateway trên loopback và để Tailscale Serve proxy:

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

Sau đó khởi động gateway:

```bash
openclaw gateway
```

Mở:

- `https://<magicdns>/` (hoặc `gateway.controlUi.basePath` đã cấu hình của bạn)

### Bind tailnet + token

```json5
{
  gateway: {
    bind: "tailnet",
    controlUi: { enabled: true },
    auth: { mode: "token", token: "your-token" },
  },
}
```

Sau đó khởi động gateway (cần token cho các bind không phải loopback):

```bash
openclaw gateway
```

Mở:

- `http://<tailscale-ip>:18789/` (hoặc `gateway.controlUi.basePath` đã cấu hình của bạn)

### Internet công cộng (Funnel)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password" }, // or OPENCLAW_GATEWAY_PASSWORD
  },
}
```

## Ghi chú bảo mật

- Xác thực Gateway được yêu cầu theo mặc định (token/mật khẩu hoặc header danh tính Tailscale).
- Các bind không phải loopback vẫn **yêu cầu** token/mật khẩu dùng chung (`gateway.auth` hoặc env).
- Trình wizard tạo token gateway theo mặc định (kể cả trên loopback).
- UI gửi `connect.params.auth.token` hoặc `connect.params.auth.password`.
- Control UI gửi các header chống clickjacking và chỉ chấp nhận kết nối websocket
  từ trình duyệt cùng origin trừ khi đặt `gateway.controlUi.allowedOrigins`.
- Với Serve, các header danh tính Tailscale có thể đáp ứng xác thực khi
  `gateway.auth.allowTailscale` là `true` (không cần token/mật khẩu). Đặt
  `gateway.auth.allowTailscale: false` để yêu cầu thông tin xác thực rõ ràng. Xem
  [Tailscale](/gateway/tailscale) và [Bảo mật](/gateway/security).
- `gateway.tailscale.mode: "funnel"` yêu cầu `gateway.auth.mode: "password"` (mật khẩu dùng chung).

## Xây dựng UI

Gateway phục vụ các tệp tĩnh từ `dist/control-ui`. Hãy build chúng bằng:

```bash
pnpm ui:build # auto-installs UI deps on first run
```
