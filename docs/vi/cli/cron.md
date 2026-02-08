---
summary: "Tham chiếu CLI cho `openclaw cron` (lập lịch và chạy các tác vụ nền)"
read_when:
  - Bạn muốn các tác vụ và đánh thức theo lịch
  - Bạn đang gỡ lỗi việc thực thi cron và nhật ký
title: "cron"
x-i18n:
  source_path: cli/cron.md
  source_hash: cef64f2ac4a648d4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:21Z
---

# `openclaw cron`

Quản lý các tác vụ cron cho bộ lập lịch Gateway.

Liên quan:

- Tác vụ cron: [Cron jobs](/automation/cron-jobs)

Mẹo: chạy `openclaw cron --help` để xem toàn bộ bề mặt lệnh.

Lưu ý: các tác vụ `cron add` được cô lập mặc định gửi theo kiểu `--announce`. Dùng `--no-deliver` để giữ
đầu ra ở nội bộ. `--deliver` vẫn tồn tại như một bí danh đã bị ngừng cho `--announce`.

Lưu ý: các tác vụ một lần (`--at`) mặc định sẽ tự xóa sau khi thành công. Dùng `--keep-after-run` để giữ chúng.

## Các chỉnh sửa thường gặp

Cập nhật cài đặt gửi mà không thay đổi thông điệp:

```bash
openclaw cron edit <job-id> --announce --channel telegram --to "123456789"
```

Tắt gửi cho một tác vụ được cô lập:

```bash
openclaw cron edit <job-id> --no-deliver
```

Thông báo tới một kênh cụ thể:

```bash
openclaw cron edit <job-id> --announce --channel slack --to "channel:C1234567890"
```
