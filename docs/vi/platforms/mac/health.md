---
summary: "Cách ứng dụng macOS báo cáo trạng thái sức khỏe của gateway/Baileys"
read_when:
  - Gỡ lỗi các chỉ báo sức khỏe của ứng dụng mac
title: "Kiểm tra sức khỏe"
x-i18n:
  source_path: platforms/mac/health.md
  source_hash: 0560e96501ddf53a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:51Z
---

# Kiểm tra sức khỏe trên macOS

Cách xem liệu kênh đã liên kết có đang khỏe mạnh từ ứng dụng trên thanh menu hay không.

## Thanh menu

- Dấu chấm trạng thái hiện phản ánh sức khỏe của Baileys:
  - Xanh: đã liên kết + socket vừa được mở.
  - Cam: đang kết nối/đang thử lại.
  - Đỏ: đã đăng xuất hoặc thăm dò thất bại.
- Dòng phụ hiển thị “đã liên kết · xác thực 12m” hoặc hiển thị lý do lỗi.
- Mục menu “Chạy kiểm tra sức khỏe” kích hoạt thăm dò theo yêu cầu.

## Cài đặt

- Thẻ General có thêm thẻ Health hiển thị: tuổi xác thực của liên kết, đường dẫn/số lượng session-store, thời điểm kiểm tra gần nhất, lỗi/mã trạng thái gần nhất, và các nút Chạy kiểm tra sức khỏe / Mở nhật ký.
- Sử dụng ảnh chụp bộ nhớ đệm để UI tải tức thì và suy giảm nhẹ nhàng khi offline.
- **Tab Channels** hiển thị trạng thái kênh + các điều khiển cho WhatsApp/Telegram (QR đăng nhập, đăng xuất, thăm dò, lần ngắt kết nối/lỗi gần nhất).

## Cách thăm dò hoạt động

- Ứng dụng chạy `openclaw health --json` qua `ShellExecutor` khoảng mỗi ~60 giây và theo yêu cầu. Thăm dò tải thông tin xác thực và báo cáo trạng thái mà không gửi tin nhắn.
- Lưu riêng ảnh chụp tốt gần nhất và lỗi gần nhất để tránh nhấp nháy; hiển thị dấu thời gian của từng mục.

## Khi còn băn khoăn

- Bạn vẫn có thể dùng luồng CLI trong [Gateway health](/gateway/health) (`openclaw status`, `openclaw status --deep`, `openclaw health --json`) và theo dõi `/tmp/openclaw/openclaw-*.log` cho `web-heartbeat` / `web-reconnect`.
