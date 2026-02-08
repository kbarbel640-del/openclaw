---
summary: "Các script trong kho: mục đích, phạm vi và lưu ý an toàn"
read_when:
  - Chạy các script từ kho
  - Thêm hoặc thay đổi script trong ./scripts
title: "Scripts"
x-i18n:
  source_path: help/scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:03Z
---

# Scripts

Thư mục `scripts/` chứa các script trợ giúp cho quy trình làm việc cục bộ và các tác vụ vận hành.
Hãy dùng chúng khi một tác vụ gắn rõ ràng với một script; nếu không thì ưu tiên CLI.

## Quy ước

- Các script là **không bắt buộc** trừ khi được tham chiếu trong tài liệu hoặc checklist phát hành.
- Ưu tiên các bề mặt CLI khi có sẵn (ví dụ: giám sát xác thực dùng `openclaw models status --check`).
- Giả định script phụ thuộc vào máy chủ; hãy đọc trước khi chạy trên một máy mới.

## Script giám sát xác thực

Các script giám sát xác thực được tài liệu hóa tại đây:
[/automation/auth-monitoring](/automation/auth-monitoring)

## Khi thêm script

- Giữ script tập trung và có tài liệu.
- Thêm một mục ngắn trong tài liệu liên quan (hoặc tạo mới nếu chưa có).
