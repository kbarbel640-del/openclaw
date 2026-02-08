---
summary: "Truy cập và xác thực dashboard Gateway (Control UI)"
read_when:
  - Thay đổi chế độ xác thực hoặc mức độ phơi bày dashboard
title: "Dashboard"
x-i18n:
  source_path: web/dashboard.md
  source_hash: 852e359885574fa3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:48Z
---

# Dashboard (Control UI)

Dashboard Gateway là Control UI trên trình duyệt, mặc định được phục vụ tại `/`
(có thể ghi đè bằng `gateway.controlUi.basePath`).

Mở nhanh (Gateway cục bộ):

- http://127.0.0.1:18789/ (hoặc http://localhost:18789/)

Tham chiếu chính:

- [Control UI](/web/control-ui) để biết cách sử dụng và các khả năng của UI.
- [Tailscale](/gateway/tailscale) cho tự động hóa Serve/Funnel.
- [Web surfaces](/web) cho các chế độ bind và lưu ý bảo mật.

Xác thực được áp dụng ở bước bắt tay WebSocket thông qua `connect.params.auth`
(token hoặc mật khẩu). Xem `gateway.auth` trong [Gateway configuration](/gateway/configuration).

Lưu ý bảo mật: Control UI là một **bề mặt quản trị** (chat, cấu hình, phê duyệt exec).
Không công khai nó ra Internet. UI lưu token trong `localStorage` sau lần tải đầu tiên.
Ưu tiên localhost, Tailscale Serve, hoặc một đường hầm SSH.

## Fast path (khuyến nghị)

- Sau khi onboarding, CLI tự động mở dashboard và in ra một liên kết sạch (không kèm token).
- Mở lại bất cứ lúc nào: `openclaw dashboard` (sao chép liên kết, mở trình duyệt nếu có thể, hiển thị gợi ý SSH nếu chạy headless).
- Nếu UI yêu cầu xác thực, dán token từ `gateway.auth.token` (hoặc `OPENCLAW_GATEWAY_TOKEN`) vào cài đặt Control UI.

## Cơ bản về token (cục bộ vs từ xa)

- **Localhost**: mở `http://127.0.0.1:18789/`.
- **Nguồn token**: `gateway.auth.token` (hoặc `OPENCLAW_GATEWAY_TOKEN`); UI lưu một bản sao trong localStorage sau khi bạn kết nối.
- **Không phải localhost**: dùng Tailscale Serve (không cần token nếu `gateway.auth.allowTailscale: true`), bind tailnet với token, hoặc một đường hầm SSH. Xem [Web surfaces](/web).

## Nếu bạn thấy “unauthorized” / 1008

- Đảm bảo gateway có thể truy cập được (cục bộ: `openclaw status`; từ xa: tạo đường hầm SSH `ssh -N -L 18789:127.0.0.1:18789 user@host` rồi mở `http://127.0.0.1:18789/`).
- Lấy token từ máy chủ gateway: `openclaw config get gateway.auth.token` (hoặc tạo một token: `openclaw doctor --generate-gateway-token`).
- Trong cài đặt dashboard, dán token vào trường xác thực, sau đó kết nối.
