---
summary: "Giám sát thời hạn OAuth cho các nhà cung cấp mô hình"
read_when:
  - Thiết lập giám sát hoặc cảnh báo hết hạn xác thực
  - Tự động hóa kiểm tra làm mới OAuth cho Claude Code / Codex
title: "Giám sát xác thực"
x-i18n:
  source_path: automation/auth-monitoring.md
  source_hash: eef179af9545ed7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:53Z
---

# Giám sát xác thực

OpenClaw cung cấp trạng thái sức khỏe thời hạn OAuth qua `openclaw models status`. Hãy dùng mục này cho
tự động hóa và cảnh báo; các script chỉ là tùy chọn bổ sung cho quy trình trên điện thoại.

## Ưu tiên: kiểm tra bằng CLI (tính di động)

```bash
openclaw models status --check
```

Mã thoát:

- `0`: OK
- `1`: thông tin xác thực đã hết hạn hoặc bị thiếu
- `2`: sắp hết hạn (trong vòng 24 giờ)

Hoạt động với cron/systemd và không cần script bổ sung.

## Script tùy chọn (ops / quy trình điện thoại)

Các script này nằm dưới `scripts/` và là **tùy chọn**. Chúng giả định có quyền truy cập SSH vào
máy chủ Gateway và được tinh chỉnh cho systemd + Termux.

- `scripts/claude-auth-status.sh` hiện dùng `openclaw models status --json` làm
  nguồn sự thật (dự phòng bằng cách đọc trực tiếp tệp nếu CLI không khả dụng),
  vì vậy hãy giữ `openclaw` trên `PATH` cho các bộ hẹn giờ.
- `scripts/auth-monitor.sh`: đích cron/systemd timer; gửi cảnh báo (ntfy hoặc điện thoại).
- `scripts/systemd/openclaw-auth-monitor.{service,timer}`: systemd user timer.
- `scripts/claude-auth-status.sh`: trình kiểm tra xác thực Claude Code + OpenClaw (full/json/simple).
- `scripts/mobile-reauth.sh`: luồng xác thực lại có hướng dẫn qua SSH.
- `scripts/termux-quick-auth.sh`: widget một chạm hiển thị trạng thái + mở URL xác thực.
- `scripts/termux-auth-widget.sh`: luồng widget có hướng dẫn đầy đủ.
- `scripts/termux-sync-widget.sh`: đồng bộ thông tin xác thực Claude Code → OpenClaw.

Nếu bạn không cần tự động hóa trên điện thoại hoặc bộ hẹn giờ systemd, hãy bỏ qua các script này.
