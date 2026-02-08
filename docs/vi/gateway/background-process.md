---
summary: "Thực thi exec nền và quản lý tiến trình"
read_when:
  - Thêm hoặc chỉnh sửa hành vi exec nền
  - Gỡ lỗi các tác vụ exec chạy lâu
title: "Công cụ Exec nền và Process"
x-i18n:
  source_path: gateway/background-process.md
  source_hash: e11a7d74a75000d6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:07Z
---

# Công cụ Exec nền + Process

OpenClaw chạy các lệnh shell thông qua công cụ `exec` và giữ các tác vụ chạy lâu trong bộ nhớ. Công cụ `process` quản lý các phiên nền đó.

## công cụ exec

Các tham số chính:

- `command` (bắt buộc)
- `yieldMs` (mặc định 10000): tự động chuyển sang nền sau độ trễ này
- `background` (bool): chạy nền ngay lập tức
- `timeout` (giây, mặc định 1800): kết thúc tiến trình sau thời gian chờ này
- `elevated` (bool): chạy trên host nếu chế độ nâng quyền được bật/cho phép
- Cần TTY thực? Đặt `pty: true`.
- `workdir`, `env`

Hành vi:

- Chạy foreground trả về đầu ra trực tiếp.
- Khi chạy nền (tường minh hoặc do timeout), công cụ trả về `status: "running"` + `sessionId` và một đoạn tail ngắn.
- Đầu ra được giữ trong bộ nhớ cho đến khi phiên được thăm dò hoặc xóa.
- Nếu công cụ `process` bị không cho phép, `exec` sẽ chạy đồng bộ và bỏ qua `yieldMs`/`background`.

## Cầu nối tiến trình con

Khi tạo các tiến trình con chạy lâu bên ngoài các công cụ exec/process (ví dụ: CLI tự respawn hoặc helper của Gateway), hãy gắn helper cầu nối tiến trình con để các tín hiệu kết thúc được chuyển tiếp và các listener được tách khi thoát/lỗi. Điều này tránh tiến trình mồ côi trên systemd và giữ hành vi tắt nhất quán trên các nền tảng.

Ghi đè môi trường:

- `PI_BASH_YIELD_MS`: yield mặc định (ms)
- `PI_BASH_MAX_OUTPUT_CHARS`: giới hạn đầu ra trong bộ nhớ (ký tự)
- `OPENCLAW_BASH_PENDING_MAX_OUTPUT_CHARS`: giới hạn stdout/stderr đang chờ theo từng luồng (ký tự)
- `PI_BASH_JOB_TTL_MS`: TTL cho các phiên đã kết thúc (ms, giới hạn 1m–3h)

Cấu hình (ưu tiên):

- `tools.exec.backgroundMs` (mặc định 10000)
- `tools.exec.timeoutSec` (mặc định 1800)
- `tools.exec.cleanupMs` (mặc định 1800000)
- `tools.exec.notifyOnExit` (mặc định true): xếp hàng một sự kiện hệ thống + yêu cầu heartbeat khi một exec nền kết thúc.

## công cụ process

Hành động:

- `list`: các phiên đang chạy + đã kết thúc
- `poll`: lấy đầu ra mới cho một phiên (cũng báo cáo trạng thái thoát)
- `log`: đọc đầu ra đã tổng hợp (hỗ trợ `offset` + `limit`)
- `write`: gửi stdin (`data`, `eof` tùy chọn)
- `kill`: kết thúc một phiên nền
- `clear`: xóa một phiên đã kết thúc khỏi bộ nhớ
- `remove`: kill nếu đang chạy, ngược lại thì xóa nếu đã kết thúc

Ghi chú:

- Chỉ các phiên chạy nền mới được liệt kê/lưu trong bộ nhớ.
- Các phiên sẽ mất khi tiến trình khởi động lại (không lưu ra đĩa).
- Log phiên chỉ được lưu vào lịch sử chat nếu bạn chạy `process poll/log` và kết quả công cụ được ghi lại.
- `process` được giới hạn theo từng tác tử; chỉ thấy các phiên do tác tử đó khởi chạy.
- `process list` bao gồm một `name` dẫn xuất (động từ lệnh + mục tiêu) để quét nhanh.
- `process log` dùng `offset`/`limit` theo dòng (bỏ `offset` để lấy N dòng cuối).

## Ví dụ

Chạy một tác vụ dài và thăm dò sau:

```json
{ "tool": "exec", "command": "sleep 5 && echo done", "yieldMs": 1000 }
```

```json
{ "tool": "process", "action": "poll", "sessionId": "<id>" }
```

Bắt đầu chạy nền ngay:

```json
{ "tool": "exec", "command": "npm run build", "background": true }
```

Gửi stdin:

```json
{ "tool": "process", "action": "write", "sessionId": "<id>", "data": "y\n" }
```
