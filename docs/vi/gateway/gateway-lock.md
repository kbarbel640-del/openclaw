---
summary: "Bộ bảo vệ singleton Gateway sử dụng ràng buộc trình lắng nghe WebSocket"
read_when:
  - Chạy hoặc gỡ lỗi tiến trình gateway
  - Điều tra việc thực thi một phiên bản duy nhất
title: "Khóa Gateway"
x-i18n:
  source_path: gateway/gateway-lock.md
  source_hash: 15fdfa066d1925da
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:06Z
---

# Khóa Gateway

Cập nhật lần cuối: 2025-12-11

## Lý do

- Đảm bảo chỉ một phiên bản gateway chạy trên mỗi cổng cơ sở trên cùng máy chủ; các gateway bổ sung phải dùng hồ sơ cô lập và cổng riêng.
- Chịu được sự cố/SIGKILL mà không để lại tệp khóa lỗi thời.
- Thất bại nhanh với lỗi rõ ràng khi cổng điều khiển đã bị chiếm.

## Cơ chế

- Gateway ràng buộc trình lắng nghe WebSocket (mặc định `ws://127.0.0.1:18789`) ngay khi khởi động bằng một trình lắng nghe TCP độc quyền.
- Nếu việc ràng buộc thất bại với `EADDRINUSE`, quá trình khởi động ném `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`.
- Hệ điều hành tự động giải phóng trình lắng nghe khi tiến trình thoát dưới mọi hình thức, bao gồm cả sự cố và SIGKILL—không cần tệp khóa riêng hay bước dọn dẹp nào.
- Khi tắt, gateway đóng máy chủ WebSocket và máy chủ HTTP nền để giải phóng cổng kịp thời.

## Bề mặt lỗi

- Nếu một tiến trình khác đang giữ cổng, quá trình khởi động ném `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`.
- Các lỗi ràng buộc khác hiển thị dưới dạng `GatewayLockError("failed to bind gateway socket on ws://127.0.0.1:<port>: …")`.

## Ghi chú vận hành

- Nếu cổng bị chiếm bởi _một_ tiến trình khác, lỗi vẫn giống nhau; hãy giải phóng cổng hoặc chọn cổng khác với `openclaw gateway --port <port>`.
- Ứng dụng macOS vẫn duy trì bộ bảo vệ PID nhẹ của riêng mình trước khi khởi chạy gateway; khóa thời gian chạy được thực thi bởi ràng buộc WebSocket.
