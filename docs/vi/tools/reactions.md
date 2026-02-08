---
summary: "Ngữ nghĩa phản ứng được chia sẻ trên các kênh"
read_when:
  - Làm việc với phản ứng trên bất kỳ kênh nào
title: "Phản ứng"
x-i18n:
  source_path: tools/reactions.md
  source_hash: 0f11bff9adb4bd02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:43Z
---

# Công cụ phản ứng

Ngữ nghĩa phản ứng dùng chung trên các kênh:

- `emoji` là bắt buộc khi thêm một phản ứng.
- `emoji=""` loại bỏ phản ứng của bot khi được hỗ trợ.
- `remove: true` loại bỏ emoji được chỉ định khi được hỗ trợ (yêu cầu `emoji`).

Ghi chú theo kênh:

- **Discord/Slack**: `emoji` rỗng sẽ loại bỏ tất cả phản ứng của bot trên thông điệp; `remove: true` chỉ loại bỏ emoji đó.
- **Google Chat**: `emoji` rỗng sẽ loại bỏ phản ứng của ứng dụng trên thông điệp; `remove: true` chỉ loại bỏ emoji đó.
- **Telegram**: `emoji` rỗng sẽ loại bỏ phản ứng của bot; `remove: true` cũng loại bỏ phản ứng nhưng vẫn yêu cầu `emoji` không rỗng để kiểm tra hợp lệ của công cụ.
- **WhatsApp**: `emoji` rỗng sẽ loại bỏ phản ứng của bot; `remove: true` ánh xạ tới emoji rỗng (vẫn yêu cầu `emoji`).
- **Signal**: thông báo phản ứng đến sẽ phát ra sự kiện hệ thống khi `channels.signal.reactionNotifications` được bật.
