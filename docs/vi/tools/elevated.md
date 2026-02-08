---
summary: "Chế độ exec nâng quyền và các chỉ thị /elevated"
read_when:
  - Điều chỉnh mặc định chế độ nâng quyền, allowlist, hoặc hành vi lệnh gạch chéo
title: "Chế độ Nâng quyền"
x-i18n:
  source_path: tools/elevated.md
  source_hash: 83767a0160930402
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:48Z
---

# Chế độ Nâng quyền (/elevated directives)

## Chức năng

- `/elevated on` chạy trên host của Gateway và giữ phê duyệt exec (giống `/elevated ask`).
- `/elevated full` chạy trên host của Gateway **và** tự động phê duyệt exec (bỏ qua phê duyệt exec).
- `/elevated ask` chạy trên host của Gateway nhưng vẫn giữ phê duyệt exec (giống `/elevated on`).
- `on`/`ask` **không** ép buộc `exec.security=full`; chính sách bảo mật/ask đã cấu hình vẫn áp dụng.
- Chỉ thay đổi hành vi khi agent ở trạng thái **sandboxed** (nếu không thì exec đã chạy trên host).
- Dạng chỉ thị: `/elevated on|off|ask|full`, `/elev on|off|ask|full`.
- Chỉ chấp nhận `on|off|ask|full`; mọi giá trị khác trả về gợi ý và không thay đổi trạng thái.

## Phạm vi kiểm soát (và những gì không)

- **Cổng khả dụng**: `tools.elevated` là mức nền toàn cục. `agents.list[].tools.elevated` có thể hạn chế nâng quyền thêm theo từng agent (cả hai đều phải cho phép).
- **Trạng thái theo phiên**: `/elevated on|off|ask|full` đặt mức nâng quyền cho khóa phiên hiện tại.
- **Chỉ thị nội tuyến**: `/elevated on|ask|full` trong một tin nhắn chỉ áp dụng cho tin nhắn đó.
- **Nhóm**: Trong chat nhóm, chỉ thị nâng quyền chỉ được tôn trọng khi agent được nhắc đến. Tin nhắn chỉ có lệnh bỏ qua yêu cầu nhắc đến được xem là đã nhắc đến.
- **Thực thi trên host**: nâng quyền ép `exec` chạy trên host của Gateway; `full` cũng đặt `security=full`.
- **Phê duyệt**: `full` bỏ qua phê duyệt exec; `on`/`ask` vẫn tôn trọng khi các quy tắc allowlist/ask yêu cầu.
- **Agent không sandboxed**: không tác động đến vị trí chạy; chỉ ảnh hưởng đến gating, logging và trạng thái.
- **Chính sách công cụ vẫn áp dụng**: nếu `exec` bị từ chối bởi chính sách công cụ, không thể dùng nâng quyền.
- **Tách biệt với `/exec`**: `/exec` điều chỉnh mặc định theo phiên cho người gửi được ủy quyền và không yêu cầu nâng quyền.

## Thứ tự phân giải

1. Chỉ thị nội tuyến trong tin nhắn (chỉ áp dụng cho tin nhắn đó).
2. Ghi đè theo phiên (đặt bằng cách gửi một tin nhắn chỉ có chỉ thị).
3. Mặc định toàn cục (`agents.defaults.elevatedDefault` trong cấu hình).

## Đặt mặc định cho phiên

- Gửi một tin nhắn **chỉ** chứa chỉ thị (cho phép khoảng trắng), ví dụ `/elevated full`.
- Hệ thống gửi phản hồi xác nhận (`Elevated mode set to full...` / `Elevated mode disabled.`).
- Nếu quyền nâng quyền bị vô hiệu hóa hoặc người gửi không nằm trong allowlist được phê duyệt, chỉ thị sẽ trả về lỗi có hướng dẫn và không thay đổi trạng thái phiên.
- Gửi `/elevated` (hoặc `/elevated:`) không kèm đối số để xem mức nâng quyền hiện tại.

## Khả dụng + allowlist

- Cổng tính năng: `tools.elevated.enabled` (mặc định có thể tắt qua cấu hình ngay cả khi mã nguồn hỗ trợ).
- Allowlist người gửi: `tools.elevated.allowFrom` với allowlist theo từng provider (ví dụ `discord`, `whatsapp`).
- Cổng theo agent: `agents.list[].tools.elevated.enabled` (tùy chọn; chỉ có thể hạn chế thêm).
- Allowlist theo agent: `agents.list[].tools.elevated.allowFrom` (tùy chọn; khi đặt, người gửi phải khớp **cả** allowlist toàn cục + theo agent).
- Dự phòng Discord: nếu `tools.elevated.allowFrom.discord` bị bỏ qua, danh sách `channels.discord.dm.allowFrom` được dùng làm dự phòng. Đặt `tools.elevated.allowFrom.discord` (kể cả `[]`) để ghi đè. Allowlist theo agent **không** dùng cơ chế dự phòng.
- Tất cả các cổng phải vượt qua; nếu không, nâng quyền được coi là không khả dụng.

## Ghi log + trạng thái

- Các lần gọi exec nâng quyền được ghi log ở mức info.
- Trạng thái phiên bao gồm chế độ nâng quyền (ví dụ `elevated=ask`, `elevated=full`).
