---
summary: "Các bộ điều hợp RPC cho CLI bên ngoài (signal-cli, imsg cũ) và các mẫu gateway"
read_when:
  - Thêm hoặc thay đổi các tích hợp CLI bên ngoài
  - Gỡ lỗi các bộ điều hợp RPC (signal-cli, imsg)
title: "Bộ điều hợp RPC"
x-i18n:
  source_path: reference/rpc.md
  source_hash: 06dc6b97184cc704
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:14Z
---

# Bộ điều hợp RPC

OpenClaw tích hợp các CLI bên ngoài qua JSON-RPC. Hiện nay có hai mẫu được sử dụng.

## Mẫu A: HTTP daemon (signal-cli)

- `signal-cli` chạy như một daemon với JSON-RPC qua HTTP.
- Luồng sự kiện là SSE (`/api/v1/events`).
- Kiểm tra tình trạng: `/api/v1/check`.
- OpenClaw sở hữu vòng đời khi `channels.signal.autoStart=true`.

Xem [Signal](/channels/signal) để biết thiết lập và các endpoint.

## Mẫu B: tiến trình con stdio (di sản: imsg)

> **Lưu ý:** Với các thiết lập iMessage mới, hãy dùng [BlueBubbles](/channels/bluebubbles) thay thế.

- OpenClaw khởi chạy `imsg rpc` như một tiến trình con (tích hợp iMessage di sản).
- JSON-RPC phân tách theo dòng qua stdin/stdout (mỗi dòng một đối tượng JSON).
- Không có cổng TCP, không cần daemon.

Các phương thức cốt lõi được dùng:

- `watch.subscribe` → thông báo (`method: "message"`)
- `watch.unsubscribe`
- `send`
- `chats.list` (thăm dò/chẩn đoán)

Xem [iMessage](/channels/imessage) để biết thiết lập di sản và định địa chỉ (`chat_id` được ưu tiên).

## Hướng dẫn cho bộ điều hợp

- Gateway sở hữu tiến trình (khởi động/dừng gắn với vòng đời của provider).
- Giữ các client RPC bền bỉ: timeout, khởi động lại khi thoát.
- Ưu tiên ID ổn định (ví dụ: `chat_id`) hơn chuỗi hiển thị.
