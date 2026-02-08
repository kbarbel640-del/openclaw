---
summary: "Lưu giữ quyền macOS (TCC) và yêu cầu ký"
read_when:
  - Gỡ lỗi các lời nhắc quyền macOS bị thiếu hoặc bị kẹt
  - Đóng gói hoặc ký ứng dụng macOS
  - Thay đổi bundle ID hoặc đường dẫn cài đặt ứng dụng
title: "Quyền macOS"
x-i18n:
  source_path: platforms/mac/permissions.md
  source_hash: d012589c0583dd0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:51Z
---

# Quyền macOS (TCC)

Việc cấp quyền trên macOS khá mong manh. TCC liên kết một quyền đã cấp với chữ ký mã của ứng dụng, bundle identifier và đường dẫn trên đĩa. Nếu bất kỳ yếu tố nào thay đổi, macOS sẽ coi ứng dụng là mới và có thể bỏ hoặc ẩn các lời nhắc.

## Yêu cầu để quyền ổn định

- Cùng đường dẫn: chạy ứng dụng từ một vị trí cố định (đối với OpenClaw, `dist/OpenClaw.app`).
- Cùng bundle identifier: thay đổi bundle ID sẽ tạo ra một danh tính quyền mới.
- Ứng dụng đã ký: các bản build chưa ký hoặc ký ad-hoc sẽ không lưu giữ quyền.
- Chữ ký nhất quán: dùng chứng chỉ Apple Development hoặc Developer ID thật
  để chữ ký ổn định qua các lần build lại.

Chữ ký ad-hoc tạo ra một danh tính mới ở mỗi lần build. macOS sẽ quên các quyền đã cấp trước đó, và các lời nhắc có thể biến mất hoàn toàn cho đến khi các mục cũ được xóa.

## Danh sách khôi phục khi lời nhắc biến mất

1. Thoát ứng dụng.
2. Xóa mục ứng dụng trong System Settings -> Privacy & Security.
3. Mở lại ứng dụng từ cùng đường dẫn và cấp lại quyền.
4. Nếu lời nhắc vẫn không xuất hiện, đặt lại các mục TCC bằng `tccutil` và thử lại.
5. Một số quyền chỉ xuất hiện lại sau khi khởi động lại macOS hoàn toàn.

Ví dụ đặt lại (thay bundle ID khi cần):

```bash
sudo tccutil reset Accessibility bot.molt.mac
sudo tccutil reset ScreenCapture bot.molt.mac
sudo tccutil reset AppleEvents
```

Nếu bạn đang kiểm thử quyền, luôn ký bằng chứng chỉ thật. Các bản build ad-hoc chỉ phù hợp cho chạy cục bộ nhanh khi quyền không quan trọng.
