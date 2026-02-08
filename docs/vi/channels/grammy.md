---
summary: "Tích hợp Telegram Bot API thông qua grammY kèm ghi chú thiết lập"
read_when:
  - Làm việc với các luồng Telegram hoặc grammY
title: grammY
x-i18n:
  source_path: channels/grammy.md
  source_hash: ea7ef23e6d77801f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:05Z
---

# Tích hợp grammY (Telegram Bot API)

# Vì sao chọn grammY

- Client Bot API ưu tiên TS với hỗ trợ sẵn long-poll + webhook, middleware, xử lý lỗi, bộ giới hạn tốc độ.
- Trình trợ giúp media gọn gàng hơn so với tự viết fetch + FormData; hỗ trợ đầy đủ các phương thức Bot API.
- Có thể mở rộng: hỗ trợ proxy qua fetch tùy chỉnh, session middleware (tùy chọn), context an toàn kiểu.

# Những gì chúng tôi đã triển khai

- **Đường client duy nhất:** loại bỏ triển khai dựa trên fetch; grammY hiện là client Telegram duy nhất (gửi + gateway) với bộ throttler của grammY được bật mặc định.
- **Gateway:** `monitorTelegramProvider` xây dựng một grammY `Bot`, kết nối cơ chế chặn mention/allowlist, tải media qua `getFile`/`download`, và gửi phản hồi bằng `sendMessage/sendPhoto/sendVideo/sendAudio/sendDocument`. Hỗ trợ long-poll hoặc webhook qua `webhookCallback`.
- **Proxy:** `channels.telegram.proxy` (tùy chọn) dùng `undici.ProxyAgent` thông qua `client.baseFetch` của grammY.
- **Hỗ trợ webhook:** `webhook-set.ts` bọc `setWebhook/deleteWebhook`; `webhook.ts` lưu trữ callback với kiểm tra sức khỏe + tắt máy an toàn. Gateway bật chế độ webhook khi `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` được đặt (nếu không sẽ dùng long-poll).
- **Sessions:** chat trực tiếp gộp vào phiên chính của tác tử (`agent:<agentId>:<mainKey>`); nhóm dùng `agent:<agentId>:telegram:group:<chatId>`; phản hồi được định tuyến trở lại cùng một kênh.
- **Tùy chọn cấu hình:** `channels.telegram.botToken`, `channels.telegram.dmPolicy`, `channels.telegram.groups` (mặc định allowlist + mention), `channels.telegram.allowFrom`, `channels.telegram.groupAllowFrom`, `channels.telegram.groupPolicy`, `channels.telegram.mediaMaxMb`, `channels.telegram.linkPreview`, `channels.telegram.proxy`, `channels.telegram.webhookSecret`, `channels.telegram.webhookUrl`.
- **Streaming bản nháp:** `channels.telegram.streamMode` (tùy chọn) dùng `sendMessageDraft` trong các chat chủ đề riêng tư (Bot API 9.3+). Phần này tách biệt với streaming khối kênh.
- **Kiểm thử:** mock grammY bao phủ chặn mention trong DM + nhóm và gửi ra ngoài; vẫn hoan nghênh thêm fixture cho media/webhook.

Câu hỏi còn mở

- Plugin grammY (throttler) tùy chọn nếu gặp Bot API 429.
- Bổ sung thêm kiểm thử media có cấu trúc (sticker, ghi chú giọng nói).
- Cho phép cấu hình cổng lắng nghe webhook (hiện cố định 8787 trừ khi được nối qua gateway).
