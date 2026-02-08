---
summary: "Lối tắt xử lý sự cố theo từng kênh (Discord/Telegram/WhatsApp)"
read_when:
  - Kênh kết nối nhưng tin nhắn không luân chuyển
  - Điều tra cấu hình kênh sai (intents, quyền, chế độ riêng tư)
title: "Xử lý sự cố kênh"
x-i18n:
  source_path: channels/troubleshooting.md
  source_hash: 6542ee86b3e50929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:09Z
---

# Xử lý sự cố kênh

Bắt đầu với:

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` in ra cảnh báo khi có thể phát hiện các cấu hình kênh sai phổ biến, và bao gồm các kiểm tra trực tiếp nhỏ (thông tin xác thực, một số quyền/thành viên).

## Các kênh

- Discord: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Sửa nhanh cho Telegram

- Log hiển thị `HttpError: Network request for 'sendMessage' failed` hoặc `sendChatAction` → kiểm tra DNS IPv6. Nếu `api.telegram.org` phân giải sang IPv6 trước và máy chủ không có đường ra IPv6, hãy buộc IPv4 hoặc bật IPv6. Xem [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting).
- Log hiển thị `setMyCommands failed` → kiểm tra khả năng truy cập HTTPS outbound và DNS tới `api.telegram.org` (thường gặp trên VPS bị khóa chặt hoặc proxy).
