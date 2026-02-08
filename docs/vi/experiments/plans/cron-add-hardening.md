---
summary: "Gia cố xử lý đầu vào cron.add, đồng bộ schema và cải thiện công cụ UI/tác tử cho cron"
owner: "openclaw"
status: "complete"
last_updated: "2026-01-05"
title: "Gia cố Cron Add"
x-i18n:
  source_path: experiments/plans/cron-add-hardening.md
  source_hash: d7e469674bd9435b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:06Z
---

# Gia cố Cron Add & Đồng bộ Schema

## Bối cảnh

Log Gateway gần đây cho thấy các lỗi `cron.add` lặp lại với tham số không hợp lệ (thiếu `sessionTarget`, `wakeMode`, `payload`, và `schedule` bị sai định dạng). Điều này cho thấy ít nhất một client (nhiều khả năng là đường gọi công cụ của tác tử) đang gửi payload công việc được bọc hoặc chỉ định không đầy đủ. Ngoài ra, còn có sự lệch pha giữa các enum nhà cung cấp cron trong TypeScript, schema Gateway, cờ CLI và kiểu form UI, cùng với sự không khớp UI cho `cron.status` (kỳ vọng `jobCount` trong khi Gateway trả về `jobs`).

## Mục tiêu

- Chặn spam `cron.add` INVALID_REQUEST bằng cách chuẩn hóa các payload bọc phổ biến và suy luận các trường `kind` còn thiếu.
- Đồng bộ danh sách nhà cung cấp cron trên schema Gateway, các kiểu cron, tài liệu CLI và form UI.
- Làm rõ schema công cụ cron của tác tử để LLM tạo payload công việc đúng.
- Sửa hiển thị số lượng job trạng thái cron trong Control UI.
- Bổ sung test để bao phủ chuẩn hóa và hành vi công cụ.

## Ngoài phạm vi

- Thay đổi ngữ nghĩa lập lịch cron hoặc hành vi thực thi job.
- Thêm loại lịch mới hoặc phân tích biểu thức cron.
- Đại tu UI/UX cho cron ngoài các chỉnh sửa trường cần thiết.

## Phát hiện (khoảng trống hiện tại)

- `CronPayloadSchema` trong Gateway loại trừ `signal` + `imessage`, trong khi kiểu TS có bao gồm.
- Control UI CronStatus kỳ vọng `jobCount`, nhưng Gateway trả về `jobs`.
- Schema công cụ cron của tác tử cho phép các đối tượng `job` tùy ý, dẫn đến đầu vào bị sai.
- Gateway xác thực nghiêm ngặt `cron.add` mà không chuẩn hóa, nên các payload bọc bị thất bại.

## Thay đổi đã thực hiện

- `cron.add` và `cron.update` giờ chuẩn hóa các dạng bọc phổ biến và suy luận các trường `kind` còn thiếu.
- Schema công cụ cron của tác tử khớp với schema Gateway, giúp giảm payload không hợp lệ.
- Enum nhà cung cấp được đồng bộ trên Gateway, CLI, UI và bộ chọn macOS.
- Control UI sử dụng trường đếm `jobs` của Gateway cho trạng thái.

## Hành vi hiện tại

- **Chuẩn hóa:** các payload `data`/`job` được bọc sẽ được gỡ bọc; `schedule.kind` và `payload.kind` được suy luận khi an toàn.
- **Mặc định:** áp dụng giá trị mặc định an toàn cho `wakeMode` và `sessionTarget` khi thiếu.
- **Nhà cung cấp:** Discord/Slack/Signal/iMessage giờ được hiển thị nhất quán trên CLI/UI.

Xem [Cron jobs](/automation/cron-jobs) để biết dạng chuẩn hóa và ví dụ.

## Xác minh

- Theo dõi log Gateway để thấy giảm lỗi `cron.add` INVALID_REQUEST.
- Xác nhận Control UI hiển thị số lượng job trạng thái cron sau khi làm mới.

## Theo dõi tùy chọn

- Smoke test Control UI thủ công: thêm một cron job cho mỗi nhà cung cấp + xác minh số lượng job trạng thái.

## Câu hỏi mở

- Có nên cho phép `cron.add` chấp nhận `state` tường minh từ client (hiện bị schema cấm)?
- Có nên cho phép `webchat` như một nhà cung cấp chuyển phát tường minh (hiện bị lọc trong quá trình phân giải chuyển phát)?
