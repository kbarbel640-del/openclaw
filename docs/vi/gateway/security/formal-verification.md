---
title: Xác minh hình thức (Mô hình bảo mật)
summary: Các mô hình bảo mật được kiểm tra bằng máy cho những luồng rủi ro cao nhất của OpenClaw.
permalink: /security/formal-verification/
x-i18n:
  source_path: gateway/security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:30Z
---

# Xác minh hình thức (Mô hình bảo mật)

Trang này theo dõi các **mô hình bảo mật hình thức** của OpenClaw (hiện tại là TLA+/TLC; sẽ bổ sung khi cần).

> Lưu ý: một số liên kết cũ có thể tham chiếu tên dự án trước đây.

**Mục tiêu (kim chỉ nam):** cung cấp một lập luận được kiểm tra bằng máy cho thấy OpenClaw thực thi
chính sách bảo mật dự định (ủy quyền, cô lập phiên, chặn công cụ, và
an toàn trước cấu hình sai), dưới các giả định được nêu rõ.

**Hiện nay đây là gì:** một **bộ hồi quy bảo mật** có thể thực thi, theo hướng kẻ tấn công:

- Mỗi khẳng định đều có một lần kiểm tra mô hình có thể chạy trên không gian trạng thái hữu hạn.
- Nhiều khẳng định có **mô hình âm** đi kèm, tạo ra vết phản ví dụ cho một lớp lỗi thực tế.

**Hiện nay chưa phải là:** một chứng minh rằng “OpenClaw an toàn ở mọi khía cạnh” hoặc rằng toàn bộ triển khai TypeScript là đúng.

## Nơi lưu các mô hình

Các mô hình được duy trì trong một repo riêng: [vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models).

## Lưu ý quan trọng

- Đây là **mô hình**, không phải toàn bộ triển khai TypeScript. Có thể có độ lệch giữa mô hình và mã.
- Kết quả bị giới hạn bởi không gian trạng thái mà TLC khám phá; “xanh” không đồng nghĩa với an toàn vượt ra ngoài các giả định và giới hạn đã mô hình hóa.
- Một số khẳng định dựa trên các giả định môi trường tường minh (ví dụ: triển khai đúng, đầu vào cấu hình đúng).

## Tái tạo kết quả

Hiện tại, kết quả được tái tạo bằng cách clone repo mô hình về máy và chạy TLC (xem bên dưới). Một phiên bản tương lai có thể cung cấp:

- Các mô hình chạy trong CI với tạo tác công khai (vết phản ví dụ, log chạy)
- Quy trình “chạy mô hình này” được lưu trữ cho các kiểm tra nhỏ, có giới hạn

Bắt đầu:

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Phơi bày Gateway và cấu hình sai Gateway mở

**Khẳng định:** bind vượt ngoài loopback khi không có auth có thể khiến thỏa hiệp từ xa trở nên khả thi / làm tăng mức phơi bày; token/mật khẩu chặn kẻ tấn công chưa được ủy quyền (theo các giả định của mô hình).

- Chạy xanh:
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- Đỏ (kỳ vọng):
  - `make gateway-exposure-v2-negative`

Xem thêm: `docs/gateway-exposure-matrix.md` trong repo mô hình.

### Pipeline Nodes.run (năng lực rủi ro cao nhất)

**Khẳng định:** `nodes.run` yêu cầu (a) allowlist lệnh của node cùng các lệnh đã khai báo và (b) phê duyệt trực tiếp khi được cấu hình; phê duyệt được gắn token để ngăn phát lại (trong mô hình).

- Chạy xanh:
  - `make nodes-pipeline`
  - `make approvals-token`
- Đỏ (kỳ vọng):
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### Kho ghép cặp (chặn DM)

**Khẳng định:** các yêu cầu ghép cặp tuân thủ TTL và giới hạn số yêu cầu đang chờ.

- Chạy xanh:
  - `make pairing`
  - `make pairing-cap`
- Đỏ (kỳ vọng):
  - `make pairing-negative`
  - `make pairing-cap-negative`

### Chặn ingress (mention + bỏ qua lệnh điều khiển)

**Khẳng định:** trong bối cảnh nhóm yêu cầu mention, một “lệnh điều khiển” chưa được ủy quyền không thể bỏ qua chặn theo mention.

- Xanh:
  - `make ingress-gating`
- Đỏ (kỳ vọng):
  - `make ingress-gating-negative`

### Cô lập định tuyến/khóa phiên

**Khẳng định:** DM từ các đối tác khác nhau không bị gộp vào cùng một phiên trừ khi được liên kết/cấu hình một cách tường minh.

- Xanh:
  - `make routing-isolation`
- Đỏ (kỳ vọng):
  - `make routing-isolation-negative`

## v1++: các mô hình có giới hạn bổ sung (đồng thời, retry, tính đúng đắn của trace)

Đây là các mô hình tiếp theo nhằm tăng độ trung thực quanh các chế độ lỗi ngoài đời thực (cập nhật không nguyên tử, retry, và fan-out thông điệp).

### Đồng thời / tính bất biến (idempotency) của kho ghép cặp

**Khẳng định:** kho ghép cặp phải thực thi `MaxPending` và tính idempotent ngay cả dưới các xen kẽ (tức là “check-then-write” phải nguyên tử / có khóa; refresh không nên tạo bản ghi trùng).

Ý nghĩa:

- Dưới các yêu cầu đồng thời, bạn không thể vượt quá `MaxPending` cho một kênh.
- Các yêu cầu/refresh lặp lại cho cùng `(channel, sender)` không được tạo các hàng đang chờ trùng lặp.

- Chạy xanh:
  - `make pairing-race` (kiểm tra giới hạn nguyên tử/có khóa)
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- Đỏ (kỳ vọng):
  - `make pairing-race-negative` (race giới hạn begin/commit không nguyên tử)
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### Tương quan trace ingress / idempotency

**Khẳng định:** ingestion phải giữ tương quan trace qua fan-out và idempotent dưới các lần retry của provider.

Ý nghĩa:

- Khi một sự kiện bên ngoài trở thành nhiều thông điệp nội bộ, mọi phần đều giữ cùng danh tính trace/sự kiện.
- Retry không dẫn đến xử lý kép.
- Nếu thiếu ID sự kiện của provider, dedupe quay về một khóa an toàn (ví dụ: ID trace) để tránh làm rơi các sự kiện khác biệt.

- Xanh:
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- Đỏ (kỳ vọng):
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### Ưu tiên dmScope trong định tuyến + identityLinks

**Khẳng định:** định tuyến phải giữ các phiên DM được cô lập theo mặc định, và chỉ gộp phiên khi được cấu hình tường minh (ưu tiên theo kênh + liên kết danh tính).

Ý nghĩa:

- Ghi đè dmScope theo kênh phải thắng các mặc định toàn cục.
- identityLinks chỉ nên gộp trong các nhóm liên kết tường minh, không gộp giữa các đối tác không liên quan.

- Xanh:
  - `make routing-precedence`
  - `make routing-identitylinks`
- Đỏ (kỳ vọng):
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
