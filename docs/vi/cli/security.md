---
summary: "Tham chiếu CLI cho `openclaw security` (kiểm tra và khắc phục các bẫy bảo mật phổ biến)"
read_when:
  - Bạn muốn chạy kiểm tra bảo mật nhanh trên cấu hình/trạng thái
  - Bạn muốn áp dụng các đề xuất “sửa” an toàn (chmod, siết chặt mặc định)
title: "bao mat"
x-i18n:
  source_path: cli/security.md
  source_hash: 96542b4784e53933
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:33Z
---

# `openclaw security`

Công cụ bảo mật (kiểm tra + các bản sửa tùy chọn).

Liên quan:

- Hướng dẫn bảo mật: [Bảo mật](/gateway/security)

## Kiểm tra

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

Bản kiểm tra sẽ cảnh báo khi nhiều người gửi Tin nhắn trực tiếp chia sẻ phiên chính và khuyến nghị **chế độ DM an toàn**: `session.dmScope="per-channel-peer"` (hoặc `per-account-channel-peer` cho các kênh đa tài khoản) đối với hộp thư dùng chung.
Nó cũng cảnh báo khi các mô hình nhỏ (`<=300B`) được sử dụng mà không có sandboxing và khi các công cụ web/trình duyệt được bật.
