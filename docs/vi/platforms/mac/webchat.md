---
summary: "Cách ứng dụng mac nhúng WebChat của Gateway và cách gỡ lỗi"
read_when:
  - Gỡ lỗi chế độ xem WebChat trên mac hoặc cổng loopback
title: "WebChat"
x-i18n:
  source_path: platforms/mac/webchat.md
  source_hash: 04ff448758e53009
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:55Z
---

# WebChat (ứng dụng macOS)

Ứng dụng thanh menu macOS nhúng giao diện WebChat như một chế độ xem SwiftUI gốc. Ứng dụng
kết nối tới Gateway và mặc định sử dụng **phiên chính** cho tác tử đã chọn
(với bộ chuyển phiên cho các phiên khác).

- **Chế độ local**: kết nối trực tiếp tới Gateway WebSocket cục bộ.
- **Chế độ remote**: chuyển tiếp cổng điều khiển của Gateway qua SSH và dùng
  đường hầm đó làm mặt phẳng dữ liệu.

## Khởi chạy & gỡ lỗi

- Thủ công: menu Lobster → “Open Chat”.
- Tự động mở để kiểm thử:
  ```bash
  dist/OpenClaw.app/Contents/MacOS/OpenClaw --webchat
  ```
- Nhật ký: `./scripts/clawlog.sh` (subsystem `bot.molt`, category `WebChatSwiftUI`).

## Cách kết nối

- Mặt phẳng dữ liệu: các phương thức WS của Gateway `chat.history`, `chat.send`, `chat.abort`,
  `chat.inject` và các sự kiện `chat`, `agent`, `presence`, `tick`, `health`.
- Phiên: mặc định là phiên chính (`main`, hoặc `global` khi phạm vi là
  toàn cục). UI có thể chuyển giữa các phiên.
- Onboarding dùng một phiên chuyên biệt để tách riêng thiết lập lần chạy đầu tiên.

## Bề mặt bảo mật

- Chế độ remote chỉ chuyển tiếp cổng điều khiển WebSocket của Gateway qua SSH.

## Hạn chế đã biết

- UI được tối ưu cho các phiên chat (không phải sandbox trình duyệt đầy đủ).
