---
summary: "Gia cố allowlist Telegram: tiền tố + chuẩn hóa khoảng trắng"
read_when:
  - Xem lại các thay đổi allowlist Telegram trong lịch sử
title: "Gia Cố Allowlist Telegram"
x-i18n:
  source_path: experiments/plans/group-policy-hardening.md
  source_hash: a2eca5fcc8537694
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:58Z
---

# Gia Cố Allowlist Telegram

**Ngày**: 2026-01-05  
**Trạng thái**: Hoàn tất  
**PR**: #216

## Tóm tắt

Allowlist Telegram hiện chấp nhận các tiền tố `telegram:` và `tg:` không phân biệt hoa/thường, và chịu được
khoảng trắng vô tình. Điều này căn chỉnh kiểm tra allowlist đầu vào với chuẩn hóa khi gửi đi.

## Những thay đổi

- Các tiền tố `telegram:` và `tg:` được xử lý như nhau (không phân biệt hoa/thường).
- Các mục trong allowlist được cắt khoảng trắng; các mục rỗng sẽ bị bỏ qua.

## Ví dụ

Tất cả các giá trị sau đều được chấp nhận cho cùng một ID:

- `telegram:123456`
- `TG:123456`
- `tg:123456`

## Vì sao quan trọng

Sao chép/dán từ log hoặc ID chat thường bao gồm tiền tố và khoảng trắng. Chuẩn hóa giúp tránh
âm tính giả khi quyết định có phản hồi trong Tin nhan truc tiep hay nhóm hay không.

## Tài liệu liên quan

- [Group Chats](/concepts/groups)
- [Telegram Provider](/channels/telegram)
