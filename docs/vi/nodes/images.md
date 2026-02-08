---
summary: "Quy tắc xử lý hình ảnh và media cho gửi, Gateway và phản hồi của tác tử"
read_when:
  - Sửa đổi pipeline media hoặc tệp đính kèm
title: "Hỗ trợ Hình ảnh và Media"
x-i18n:
  source_path: nodes/images.md
  source_hash: 971aed398ea01078
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:42Z
---

# Hỗ trợ Hình ảnh & Media — 2025-12-05

Kênh WhatsApp chạy qua **Baileys Web**. Tài liệu này ghi lại các quy tắc xử lý media hiện tại cho gửi, Gateway và phản hồi của tác tử.

## Mục tiêu

- Gửi media kèm chú thích tùy chọn qua `openclaw message send --media`.
- Cho phép trả lời tự động từ hộp thư web bao gồm media cùng với văn bản.
- Giữ các giới hạn theo loại ở mức hợp lý và dễ dự đoán.

## Bề mặt CLI

- `openclaw message send --media <path-or-url> [--message <caption>]`
  - `--media` là tùy chọn; chú thích có thể để trống khi chỉ gửi media.
  - `--dry-run` in ra payload đã được phân giải; `--json` phát ra `{ channel, to, messageId, mediaUrl, caption }`.

## Hành vi kênh WhatsApp Web

- Đầu vào: đường dẫn tệp cục bộ **hoặc** URL HTTP(S).
- Luồng: tải vào Buffer, phát hiện loại media và xây dựng payload phù hợp:
  - **Hình ảnh:** thay đổi kích thước & nén lại sang JPEG (cạnh dài tối đa 2048px) nhắm tới `agents.defaults.mediaMaxMb` (mặc định 5 MB), giới hạn ở 6 MB.
  - **Âm thanh/Giọng nói/Video:** chuyển tiếp nguyên trạng đến 16 MB; âm thanh được gửi dưới dạng ghi chú giọng nói (`ptt: true`).
  - **Tài liệu:** mọi loại khác, tối đa 100 MB, giữ nguyên tên tệp khi có.
- Phát lại kiểu GIF của WhatsApp: gửi MP4 với `gifPlayback: true` (CLI: `--gif-playback`) để ứng dụng di động lặp nội tuyến.
- Phát hiện MIME ưu tiên magic bytes, sau đó header, rồi phần mở rộng tệp.
- Chú thích lấy từ `--message` hoặc `reply.text`; cho phép chú thích trống.
- Ghi log: chế độ không verbose hiển thị `↩️`/`✅`; chế độ verbose bao gồm kích thước và đường dẫn/URL nguồn.

## Pipeline Trả lời Tự động

- `getReplyFromConfig` trả về `{ text?, mediaUrl?, mediaUrls? }`.
- Khi có media, bộ gửi web phân giải đường dẫn cục bộ hoặc URL bằng cùng pipeline như `openclaw message send`.
- Nếu cung cấp nhiều mục media, chúng sẽ được gửi tuần tự.

## Media đến cho Lệnh (Pi)

- Khi tin nhắn web đến có media, OpenClaw tải xuống một tệp tạm và cung cấp các biến templating:
  - `{{MediaUrl}}` pseudo-URL cho media đến.
  - `{{MediaPath}}` đường dẫn tạm cục bộ được ghi trước khi chạy lệnh.
- Khi bật sandbox Docker theo từng phiên, media đến được sao chép vào workspace của sandbox và `MediaPath`/`MediaUrl` được ghi lại thành đường dẫn tương đối như `media/inbound/<filename>`.
- Hiểu media (nếu được cấu hình qua `tools.media.*` hoặc `tools.media.models` dùng chung) chạy trước templating và có thể chèn các khối `[Image]`, `[Audio]` và `[Video]` vào `Body`.
  - Âm thanh đặt `{{Transcript}}` và dùng bản chép lời để phân tích lệnh, vì vậy các lệnh slash vẫn hoạt động.
  - Mô tả video và hình ảnh giữ nguyên mọi văn bản chú thích để phân tích lệnh.
- Mặc định chỉ xử lý tệp đính kèm hình ảnh/âm thanh/video khớp đầu tiên; đặt `tools.media.<cap>.attachments` để xử lý nhiều tệp đính kèm.

## Giới hạn & Lỗi

**Giới hạn gửi ra (gửi qua WhatsApp web)**

- Hình ảnh: giới hạn ~6 MB sau khi nén lại.
- Âm thanh/giọng nói/video: giới hạn 16 MB; tài liệu: giới hạn 100 MB.
- Media quá lớn hoặc không đọc được → lỗi rõ ràng trong log và bỏ qua phản hồi.

**Giới hạn hiểu media (phiên âm/mô tả)**

- Hình ảnh mặc định: 10 MB (`tools.media.image.maxBytes`).
- Âm thanh mặc định: 20 MB (`tools.media.audio.maxBytes`).
- Video mặc định: 50 MB (`tools.media.video.maxBytes`).
- Media quá lớn sẽ bỏ qua bước hiểu, nhưng phản hồi vẫn được gửi với nội dung gốc.

## Ghi chú cho Kiểm thử

- Bao phủ các luồng gửi + trả lời cho các trường hợp hình ảnh/âm thanh/tài liệu.
- Xác thực việc nén lại cho hình ảnh (ràng buộc kích thước) và cờ ghi chú giọng nói cho âm thanh.
- Đảm bảo phản hồi đa media được tách ra thành các lần gửi tuần tự.
