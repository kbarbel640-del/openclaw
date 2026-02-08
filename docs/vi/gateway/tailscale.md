---
summary: "Tích hợp Tailscale Serve/Funnel cho bảng điều khiển Gateway"
read_when:
  - Hiển thị UI Điều Khiển Gateway ra ngoài localhost
  - Tự động hóa truy cập bảng điều khiển qua tailnet hoặc công khai
title: "Tailscale"
x-i18n:
  source_path: gateway/tailscale.md
  source_hash: c900c70a9301f290
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:25Z
---

# Tailscale (bảng điều khiển Gateway)

OpenClaw có thể tự động cấu hình Tailscale **Serve** (tailnet) hoặc **Funnel** (công khai) cho
bảng điều khiển Gateway và cổng WebSocket. Cách này giữ Gateway chỉ bind vào loopback trong khi
Tailscale cung cấp HTTPS, định tuyến, và (với Serve) các header định danh.

## Chế độ

- `serve`: Serve chỉ trong Tailnet qua `tailscale serve`. Gateway vẫn ở `127.0.0.1`.
- `funnel`: HTTPS công khai qua `tailscale funnel`. OpenClaw yêu cầu mật khẩu dùng chung.
- `off`: Mặc định (không tự động hóa Tailscale).

## Xác thực

Đặt `gateway.auth.mode` để kiểm soát quá trình bắt tay:

- `token` (mặc định khi `OPENCLAW_GATEWAY_TOKEN` được đặt)
- `password` (bí mật dùng chung qua `OPENCLAW_GATEWAY_PASSWORD` hoặc config)

Khi `tailscale.mode = "serve"` và `gateway.auth.allowTailscale` là `true`,
các yêu cầu Serve proxy hợp lệ có thể xác thực qua các header định danh của Tailscale
(`tailscale-user-login`) mà không cần cung cấp token/mật khẩu. OpenClaw xác minh
định danh bằng cách phân giải địa chỉ `x-forwarded-for` qua daemon Tailscale cục bộ
(`tailscale whois`) và đối chiếu với header trước khi chấp nhận.
OpenClaw chỉ coi một yêu cầu là Serve khi nó đến từ loopback cùng với các header
`x-forwarded-for`, `x-forwarded-proto`, và `x-forwarded-host` của Tailscale.
Để yêu cầu thông tin xác thực tường minh, hãy đặt `gateway.auth.allowTailscale: false` hoặc
ép buộc `gateway.auth.mode: "password"`.

## Ví dụ cấu hình

### Chỉ Tailnet (Serve)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

Mở: `https://<magicdns>/` (hoặc `gateway.controlUi.basePath` bạn đã cấu hình)

### Chỉ Tailnet (bind vào IP Tailnet)

Dùng khi bạn muốn Gateway lắng nghe trực tiếp trên IP Tailnet (không dùng Serve/Funnel).

```json5
{
  gateway: {
    bind: "tailnet",
    auth: { mode: "token", token: "your-token" },
  },
}
```

Kết nối từ một thiết bị Tailnet khác:

- UI Điều Khiển: `http://<tailscale-ip>:18789/`
- WebSocket: `ws://<tailscale-ip>:18789`

Lưu ý: loopback (`http://127.0.0.1:18789`) sẽ **không** hoạt động trong chế độ này.

### Internet công khai (Funnel + mật khẩu dùng chung)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password", password: "replace-me" },
  },
}
```

Ưu tiên `OPENCLAW_GATEWAY_PASSWORD` thay vì ghi mật khẩu xuống đĩa.

## Ví dụ CLI

```bash
openclaw gateway --tailscale serve
openclaw gateway --tailscale funnel --auth password
```

## Ghi chú

- Tailscale Serve/Funnel yêu cầu CLI `tailscale` được cài đặt và đăng nhập.
- `tailscale.mode: "funnel"` sẽ từ chối khởi động trừ khi chế độ xác thực là `password` để tránh phơi bày công khai.
- Đặt `gateway.tailscale.resetOnExit` nếu bạn muốn OpenClaw hoàn tác cấu hình `tailscale serve`
  hoặc `tailscale funnel` khi tắt.
- `gateway.bind: "tailnet"` là bind trực tiếp vào Tailnet (không HTTPS, không Serve/Funnel).
- `gateway.bind: "auto"` ưu tiên loopback; dùng `tailnet` nếu bạn muốn chỉ Tailnet.
- Serve/Funnel chỉ phơi bày **UI điều khiển Gateway + WS**. Các node kết nối qua
  cùng endpoint WS của Gateway, nên Serve có thể hoạt động cho truy cập node.

## Điều khiển trình duyệt (Gateway từ xa + trình duyệt cục bộ)

Nếu bạn chạy Gateway trên một máy nhưng muốn điều khiển trình duyệt trên máy khác,
hãy chạy một **node host** trên máy có trình duyệt và giữ cả hai trong cùng tailnet.
Gateway sẽ proxy các thao tác trình duyệt tới node; không cần server điều khiển riêng hay URL Serve.

Tránh dùng Funnel cho điều khiển trình duyệt; hãy coi việc ghép cặp node giống như quyền truy cập của người vận hành.

## Điều kiện tiên quyết + giới hạn của Tailscale

- Serve yêu cầu HTTPS được bật cho tailnet; CLI sẽ nhắc nếu thiếu.
- Serve chèn các header định danh của Tailscale; Funnel thì không.
- Funnel yêu cầu Tailscale v1.38.3+, MagicDNS, HTTPS được bật, và thuộc tính node funnel.
- Funnel chỉ hỗ trợ các cổng `443`, `8443`, và `10000` qua TLS.
- Funnel trên macOS yêu cầu biến thể ứng dụng Tailscale mã nguồn mở.

## Tìm hiểu thêm

- Tổng quan Tailscale Serve: https://tailscale.com/kb/1312/serve
- Lệnh `tailscale serve`: https://tailscale.com/kb/1242/tailscale-serve
- Tổng quan Tailscale Funnel: https://tailscale.com/kb/1223/tailscale-funnel
- Lệnh `tailscale funnel`: https://tailscale.com/kb/1311/tailscale-funnel
