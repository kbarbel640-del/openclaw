---
summary: "Tham chiếu: các quy tắc làm sạch và sửa transcript theo từng nhà cung cấp"
read_when:
  - Bạn đang gỡ lỗi việc nhà cung cấp từ chối yêu cầu do hình dạng transcript
  - Bạn đang thay đổi logic làm sạch transcript hoặc sửa tool-call
  - Bạn đang điều tra việc không khớp id tool-call giữa các nhà cung cấp
title: "Vệ sinh Transcript"
x-i18n:
  source_path: reference/transcript-hygiene.md
  source_hash: 43ed460827d514a8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:29Z
---

# Vệ sinh Transcript (Sửa lỗi theo Nhà cung cấp)

Tài liệu này mô tả **các bản sửa theo từng nhà cung cấp** được áp dụng cho transcript trước khi chạy
(xây dựng ngữ cảnh cho mô hình). Đây là các điều chỉnh **trong bộ nhớ** dùng để đáp ứng các yêu cầu nghiêm ngặt
của nhà cung cấp. Các bước vệ sinh này **không** ghi đè transcript JSONL đã lưu trên đĩa; tuy nhiên,
một lượt sửa file phiên riêng biệt có thể ghi lại các file JSONL bị lỗi bằng cách loại bỏ các dòng
không hợp lệ trước khi phiên được tải. Khi có sửa chữa, file gốc sẽ được sao lưu cùng với file phiên.

Phạm vi bao gồm:

- Làm sạch id tool-call
- Xác thực đầu vào tool-call
- Sửa ghép cặp kết quả tool
- Xác thực / sắp xếp lượt
- Dọn dẹp chữ ký suy nghĩ
- Làm sạch payload hình ảnh

Nếu bạn cần chi tiết về lưu trữ transcript, xem:

- [/reference/session-management-compaction](/reference/session-management-compaction)

---

## Chạy ở đâu

Toàn bộ vệ sinh transcript được tập trung trong embedded runner:

- Chọn chính sách: `src/agents/transcript-policy.ts`
- Áp dụng làm sạch/sửa chữa: `sanitizeSessionHistory` trong `src/agents/pi-embedded-runner/google.ts`

Chính sách sử dụng `provider`, `modelApi` và `modelId` để quyết định áp dụng những gì.

Tách biệt với vệ sinh transcript, các file phiên được sửa (nếu cần) trước khi tải:

- `repairSessionFileIfNeeded` trong `src/agents/session-file-repair.ts`
- Được gọi từ `run/attempt.ts` và `compact.ts` (embedded runner)

---

## Quy tắc toàn cục: làm sạch hình ảnh

Payload hình ảnh luôn được làm sạch để ngăn việc nhà cung cấp từ chối do giới hạn
kích thước (giảm kích thước/nén lại các ảnh base64 quá lớn).

Triển khai:

- `sanitizeSessionMessagesImages` trong `src/agents/pi-embedded-helpers/images.ts`
- `sanitizeContentBlocksImages` trong `src/agents/tool-images.ts`

---

## Quy tắc toàn cục: tool-call bị lỗi

Các khối tool-call của assistant thiếu cả `input` và `arguments` sẽ bị loại bỏ
trước khi xây dựng ngữ cảnh mô hình. Điều này ngăn việc nhà cung cấp từ chối do các tool-call
được lưu dở dang (ví dụ, sau khi lỗi rate limit).

Triển khai:

- `sanitizeToolCallInputs` trong `src/agents/session-transcript-repair.ts`
- Áp dụng trong `sanitizeSessionHistory` tại `src/agents/pi-embedded-runner/google.ts`

---

## Ma trận nhà cung cấp (hành vi hiện tại)

**OpenAI / OpenAI Codex**

- Chỉ làm sạch hình ảnh.
- Khi chuyển mô hình sang OpenAI Responses/Codex, loại bỏ các chữ ký suy luận mồ côi (các mục suy luận độc lập không có khối nội dung theo sau).
- Không làm sạch id tool-call.
- Không sửa ghép cặp kết quả tool.
- Không xác thực hay sắp xếp lại lượt.
- Không tạo kết quả tool tổng hợp.
- Không loại bỏ chữ ký suy nghĩ.

**Google (Generative AI / Gemini CLI / Antigravity)**

- Làm sạch id tool-call: chữ và số nghiêm ngặt.
- Sửa ghép cặp kết quả tool và tạo kết quả tool tổng hợp.
- Xác thực lượt (luân phiên lượt kiểu Gemini).
- Sửa thứ tự lượt của Google (chèn một bootstrap người dùng rất nhỏ nếu lịch sử bắt đầu bằng assistant).
- Antigravity Claude: chuẩn hóa chữ ký suy nghĩ; loại bỏ các khối suy nghĩ không có chữ ký.

**Anthropic / Minimax (tương thích Anthropic)**

- Sửa ghép cặp kết quả tool và tạo kết quả tool tổng hợp.
- Xác thực lượt (gộp các lượt người dùng liên tiếp để đáp ứng luân phiên nghiêm ngặt).

**Mistral (bao gồm phát hiện dựa trên model-id)**

- Làm sạch id tool-call: strict9 (chữ và số, độ dài 9).

**OpenRouter Gemini**

- Dọn dẹp chữ ký suy nghĩ: loại bỏ các giá trị `thought_signature` không phải base64 (giữ base64).

**Các trường hợp khác**

- Chỉ làm sạch hình ảnh.

---

## Hành vi lịch sử (trước 2026.1.22)

Trước bản phát hành 2026.1.22, OpenClaw áp dụng nhiều lớp vệ sinh transcript:

- Một **transcript-sanitize extension** chạy trên mỗi lần xây dựng ngữ cảnh và có thể:
  - Sửa ghép cặp sử dụng/kết quả tool.
  - Làm sạch id tool-call (bao gồm chế độ không nghiêm ngặt giữ lại `_`/`-`).
- Runner cũng thực hiện làm sạch theo từng nhà cung cấp, gây trùng lặp công việc.
- Các biến đổi bổ sung xảy ra ngoài chính sách nhà cung cấp, bao gồm:
  - Loại bỏ các thẻ `<final>` khỏi văn bản assistant trước khi lưu.
  - Loại bỏ các lượt lỗi assistant rỗng.
  - Cắt bớt nội dung assistant sau các tool-call.

Độ phức tạp này gây ra các hồi quy chéo nhà cung cấp (đáng chú ý là ghép cặp
`openai-responses` `call_id|fc_id`). Đợt dọn dẹp 2026.1.22 đã loại bỏ extension,
tập trung logic vào runner, và khiến OpenAI **không can thiệp** ngoài việc làm sạch hình ảnh.
