---
summary: "Cú pháp chỉ thị cho /think + /verbose và cách chúng ảnh hưởng đến suy luận của mô hình"
read_when:
  - Điều chỉnh việc phân tích cú pháp hoặc mặc định của chỉ thị thinking hoặc verbose
title: "Các Mức Thinking"
x-i18n:
  source_path: tools/thinking.md
  source_hash: 0ae614147675be32
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:54Z
---

# Các Mức Thinking (/think directives)

## Chức năng

- Chỉ thị nội tuyến trong bất kỳ nội dung đến nào: `/t <level>`, `/think:<level>`, hoặc `/thinking <level>`.
- Các mức (bí danh): `off | minimal | low | medium | high | xhigh` (chỉ dành cho mô hình GPT-5.2 + Codex)
  - minimal → “think”
  - low → “think hard”
  - medium → “think harder”
  - high → “ultrathink” (ngân sách tối đa)
  - xhigh → “ultrathink+” (chỉ dành cho mô hình GPT-5.2 + Codex)
  - `x-high`, `x_high`, `extra-high`, `extra high`, và `extra_high` ánh xạ tới `xhigh`.
  - `highest`, `max` ánh xạ tới `high`.
- Ghi chú theo nha cung cap:
  - Z.AI (`zai/*`) chỉ hỗ trợ thinking nhị phân (`on`/`off`). Bất kỳ mức không phải `off` đều được xử lý như `on` (ánh xạ tới `low`).

## Thứ tự phân giải

1. Chỉ thị nội tuyến trên thông điệp (chỉ áp dụng cho thông điệp đó).
2. Ghi đè theo phien (đặt bằng cách gửi một thông điệp chỉ có chỉ thị).
3. Mặc định toàn cục (`agents.defaults.thinkingDefault` trong cau hinh).
4. Dự phòng: low cho các mô hình có khả năng suy luận; tắt đối với các mô hình khác.

## Đặt mặc định cho phien

- Gửi một thông điệp **chỉ** gồm chỉ thị (cho phép khoảng trắng), ví dụ: `/think:medium` hoặc `/t high`.
- Thiết lập này có hiệu lực cho phien hiện tại (mặc định theo từng người gửi); được xóa bởi `/think:off` hoặc khi phien bị đặt lại do nhàn rỗi.
- Hệ thống gửi phản hồi xác nhận (`Thinking level set to high.` / `Thinking disabled.`). Nếu mức không hợp lệ (ví dụ: `/thinking big`), lệnh sẽ bị từ chối kèm gợi ý và trạng thái phien giữ nguyên.
- Gửi `/think` (hoặc `/think:`) không kèm đối số để xem mức thinking hiện tại.

## Áp dụng theo tac tu

- **Pi nhúng**: mức đã phân giải được truyền vào runtime tac tu Pi trong tiến trình.

## Chỉ thị verbose (/verbose hoặc /v)

- Các mức: `on` (minimal) | `full` | `off` (mặc định).
- Thông điệp chỉ có chỉ thị sẽ bật/tắt verbose cho phien và phản hồi `Verbose logging enabled.` / `Verbose logging disabled.`; mức không hợp lệ sẽ trả về gợi ý mà không thay đổi trạng thái.
- `/verbose off` lưu một ghi đè phien rõ ràng; xóa nó qua UI Sessions bằng cách chọn `inherit`.
- Chỉ thị nội tuyến chỉ ảnh hưởng đến thông điệp đó; các mặc định theo phien/toàn cục áp dụng trong các trường hợp khác.
- Gửi `/verbose` (hoặc `/verbose:`) không kèm đối số để xem mức verbose hiện tại.
- Khi bật verbose, các tac tu phát ra kết quả công cụ có cấu trúc (Pi, các tac tu JSON khác) sẽ gửi lại mỗi lần gọi cong cu như một thông điệp chỉ có metadata riêng, được tiền tố bằng `<emoji> <tool-name>: <arg>` khi có (đường dẫn/lệnh). Các tóm tắt công cụ này được gửi ngay khi mỗi cong cu bắt đầu (các bong bóng riêng), không phải dưới dạng delta streaming.
- Khi verbose là `full`, đầu ra công cụ cũng được chuyển tiếp sau khi hoàn tất (bong bóng riêng, cắt bớt về độ dài an toàn). Nếu bạn chuyển `/verbose on|full|off` khi một lượt chạy đang diễn ra, các bong bóng công cụ tiếp theo sẽ tuân theo thiết lập mới.

## Hiển thị suy luận (/reasoning)

- Các mức: `on|off|stream`.
- Thông điệp chỉ có chỉ thị sẽ bật/tắt việc hiển thị các khối thinking trong phản hồi.
- Khi bật, suy luận được gửi như một **thông điệp riêng** với tiền tố `Reasoning:`.
- `stream` (chỉ Telegram): phát trực tiếp suy luận vào bong bóng bản nháp Telegram trong khi phản hồi đang được tạo, sau đó gửi câu trả lời cuối cùng không kèm suy luận.
- Bí danh: `/reason`.
- Gửi `/reasoning` (hoặc `/reasoning:`) không kèm đối số để xem mức suy luận hiện tại.

## Liên quan

- Tài liệu chế độ nâng cao có tại [Elevated mode](/tools/elevated).

## Heartbeats

- Nội dung thăm dò heartbeat là prompt heartbeat đã được cấu hình (mặc định: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`). Các chỉ thị nội tuyến trong thông điệp heartbeat áp dụng như bình thường (nhưng tránh thay đổi mặc định phien từ heartbeat).
- Việc gửi heartbeat mặc định chỉ gửi payload cuối cùng. Để cũng gửi thông điệp `Reasoning:` riêng (khi có), đặt `agents.defaults.heartbeat.includeReasoning: true` hoặc theo tac tu `agents.list[].heartbeat.includeReasoning: true`.

## Giao diện chat web

- Bộ chọn thinking trên giao diện chat web phản chiếu mức đã lưu của phien từ kho phien/cau hinh đến khi trang tải.
- Chọn một mức khác chỉ áp dụng cho thông điệp kế tiếp (`thinkingOnce`); sau khi gửi, bộ chọn sẽ quay lại mức phien đã lưu.
- Để thay đổi mặc định của phien, gửi một chỉ thị `/think:<level>` (như trước); bộ chọn sẽ phản ánh thay đổi sau lần tải lại tiếp theo.
