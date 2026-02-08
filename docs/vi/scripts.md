---
summary: "Các script trong kho lưu trữ: mục đích, phạm vi và lưu ý an toàn"
read_when:
  - Chạy script từ kho lưu trữ
  - Thêm hoặc thay đổi script trong ./scripts
title: "Scripts"
x-i18n:
  source_path: scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:20Z
---

# Scripts

Thư mục `scripts/` chứa các script hỗ trợ cho quy trình làm việc cục bộ và các tác vụ vận hành.
Hãy sử dụng chúng khi một tác vụ gắn trực tiếp với một script; nếu không, hãy ưu tiên CLI.

## Quy ước

- Script là **tùy chọn** trừ khi được tham chiếu trong tài liệu hoặc checklist phát hành.
- Ưu tiên các bề mặt CLI khi đã tồn tại (ví dụ: giám sát xác thực sử dụng `openclaw models status --check`).
- Giả định script phụ thuộc vào máy chủ; hãy đọc kỹ trước khi chạy trên một máy mới.

## Script giám sát xác thực

Các script giám sát xác thực được ghi lại tại đây:
[/automation/auth-monitoring](/automation/auth-monitoring)

## Khi thêm script

- Giữ script tập trung và có tài liệu.
- Thêm một mục ngắn trong tài liệu liên quan (hoặc tạo mới nếu chưa có).
