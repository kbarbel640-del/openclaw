---
summary: "Tài liệu tham chiếu CLI cho `openclaw system` (sự kiện hệ thống, heartbeat, presence)"
read_when:
  - Bạn muốn xếp hàng một sự kiện hệ thống mà không cần tạo cron job
  - Bạn cần bật hoặc tắt heartbeat
  - Bạn muốn kiểm tra các mục presence của hệ thống
title: "system"
x-i18n:
  source_path: cli/system.md
  source_hash: 36ae5dbdec327f5a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:33Z
---

# `openclaw system`

Các trợ giúp cấp hệ thống cho Gateway: xếp hàng sự kiện hệ thống, điều khiển heartbeat,
và xem presence.

## Common commands

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
openclaw system heartbeat enable
openclaw system heartbeat last
openclaw system presence
```

## `system event`

Xếp hàng một sự kiện hệ thống trên phiên **main**. Nhịp heartbeat tiếp theo sẽ chèn
nó như một dòng `System:` trong prompt. Dùng `--mode now` để kích hoạt heartbeat
ngay lập tức; `next-heartbeat` sẽ đợi đến tick được lên lịch tiếp theo.

Flags:

- `--text <text>`: văn bản sự kiện hệ thống bắt buộc.
- `--mode <mode>`: `now` hoặc `next-heartbeat` (mặc định).
- `--json`: đầu ra dạng máy đọc.

## `system heartbeat last|enable|disable`

Điều khiển heartbeat:

- `last`: hiển thị sự kiện heartbeat gần nhất.
- `enable`: bật lại heartbeat (dùng khi chúng đã bị tắt).
- `disable`: tạm dừng heartbeat.

Flags:

- `--json`: đầu ra dạng máy đọc.

## `system presence`

Liệt kê các mục presence hệ thống hiện tại mà Gateway biết (các node,
instance và các dòng trạng thái tương tự).

Flags:

- `--json`: đầu ra dạng máy đọc.

## Notes

- Yêu cầu Gateway đang chạy và có thể truy cập được theo cấu hình hiện tại của bạn (local hoặc remote).
- Các sự kiện hệ thống là tạm thời và không được lưu lại qua các lần khởi động lại.
