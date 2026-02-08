---
summary: "Khắc phục sự cố lập lịch và gửi cron và heartbeat"
read_when:
  - Cron không chạy
  - Cron chạy nhưng không có tin nhắn được gửi
  - Heartbeat có vẻ im lặng hoặc bị bỏ qua
title: "Xử Lý Sự Cố Tự Động Hóa"
x-i18n:
  source_path: automation/troubleshooting.md
  source_hash: 10eca4a59119910f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:58Z
---

# Xử lý sự cố tự động hóa

Sử dụng trang này cho các vấn đề về bộ lập lịch và gửi (`cron` + `heartbeat`).

## Thang lệnh

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Sau đó chạy các kiểm tra tự động hóa:

```bash
openclaw cron status
openclaw cron list
openclaw system heartbeat last
```

## Cron không kích hoạt

```bash
openclaw cron status
openclaw cron list
openclaw cron runs --id <jobId> --limit 20
openclaw logs --follow
```

Đầu ra tốt trông như sau:

- `cron status` báo cáo đã bật và có `nextWakeAtMs` trong tương lai.
- Job được bật và có lịch/múi giờ hợp lệ.
- `cron runs` hiển thị `ok` hoặc lý do bỏ qua rõ ràng.

Các dấu hiệu thường gặp:

- `cron: scheduler disabled; jobs will not run automatically` → cron bị tắt trong cấu hình/biến môi trường.
- `cron: timer tick failed` → tick của bộ lập lịch bị crash; kiểm tra stack/ngữ cảnh log xung quanh.
- `reason: not-due` trong đầu ra chạy → chạy thủ công được gọi mà không có `--force` và job chưa đến hạn.

## Cron đã kích hoạt nhưng không có gửi

```bash
openclaw cron runs --id <jobId> --limit 20
openclaw cron list
openclaw channels status --probe
openclaw logs --follow
```

Đầu ra tốt trông như sau:

- Trạng thái chạy là `ok`.
- Chế độ gửi/đích gửi được đặt cho các job cô lập.
- Thăm dò kênh báo cáo kênh đích đã kết nối.

Các dấu hiệu thường gặp:

- Chạy thành công nhưng chế độ gửi là `none` → không mong đợi có tin nhắn bên ngoài.
- Thiếu/không hợp lệ đích gửi (`channel`/`to`) → chạy có thể thành công nội bộ nhưng bỏ qua gửi ra ngoài.
- Lỗi xác thực kênh (`unauthorized`, `missing_scope`, `Forbidden`) → việc gửi bị chặn bởi thông tin xác thực/quyền của kênh.

## Heartbeat bị chặn hoặc bỏ qua

```bash
openclaw system heartbeat last
openclaw logs --follow
openclaw config get agents.defaults.heartbeat
openclaw channels status --probe
```

Đầu ra tốt trông như sau:

- Heartbeat được bật với khoảng thời gian khác 0.
- Kết quả heartbeat gần nhất là `ran` (hoặc lý do bỏ qua đã được hiểu rõ).

Các dấu hiệu thường gặp:

- `heartbeat skipped` với `reason=quiet-hours` → nằm ngoài `activeHours`.
- `requests-in-flight` → luồng chính bận; heartbeat bị hoãn.
- `empty-heartbeat-file` → `HEARTBEAT.md` tồn tại nhưng không có nội dung có thể hành động.
- `alerts-disabled` → cài đặt hiển thị chặn việc gửi heartbeat ra ngoài.

## Những lưu ý về timezone và activeHours

```bash
openclaw config get agents.defaults.heartbeat.activeHours
openclaw config get agents.defaults.heartbeat.activeHours.timezone
openclaw config get agents.defaults.userTimezone || echo "agents.defaults.userTimezone not set"
openclaw cron list
openclaw logs --follow
```

Quy tắc nhanh:

- `Config path not found: agents.defaults.userTimezone` nghĩa là khóa chưa được đặt; heartbeat sẽ quay về múi giờ của host (hoặc `activeHours.timezone` nếu được đặt).
- Cron không có `--tz` sẽ dùng múi giờ của host Gateway.
- `activeHours` của heartbeat dùng cách phân giải múi giờ đã cấu hình (`user`, `local`, hoặc IANA tz tường minh).
- Dấu thời gian ISO không có múi giờ được coi là UTC cho các lịch cron `at`.

Các dấu hiệu thường gặp:

- Job chạy sai thời điểm theo đồng hồ sau khi thay đổi múi giờ của host.
- Heartbeat luôn bị bỏ qua vào ban ngày của bạn vì `activeHours.timezone` sai.

Liên quan:

- [/automation/cron-jobs](/automation/cron-jobs)
- [/gateway/heartbeat](/gateway/heartbeat)
- [/automation/cron-vs-heartbeat](/automation/cron-vs-heartbeat)
- [/concepts/timezone](/concepts/timezone)
