---
title: Xác minh hình thức (Mô hình bảo mật)
summary: Các mô hình bảo mật được kiểm chứng bằng máy cho những luồng rủi ro cao nhất của OpenClaw.
permalink: /security/formal-verification/
x-i18n:
  source_path: security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:35Z
---

# Xác minh hình thức (Mô hình bảo mật)

Trang này theo dõi các **mô hình bảo mật hình thức** của OpenClaw (hiện tại là TLA+/TLC; sẽ bổ sung khi cần).

> Lưu ý: một số liên kết cũ có thể tham chiếu đến tên dự án trước đây.

**Mục tiêu (north star):** cung cấp một lập luận được kiểm chứng bằng máy rằng OpenClaw thực thi
chính sách bảo mật dự định của mình (phân quyền, cô lập phiên, kiểm soát công cụ, và
an toàn trước cấu hình sai), dưới các giả định được nêu rõ.

**Hiện tại đây là gì:** một **bộ hồi quy bảo mật** có thể thực thi, định hướng theo kẻ tấn công:

- Mỗi khẳng định đều có kiểm tra mô hình có thể chạy trên một không gian trạng thái hữu hạn.
- Nhiều khẳng định có **mô hình âm** đi kèm, tạo ra vết phản ví dụ cho một lớp lỗi thực tế.

**Chưa phải (hiện tại):** một chứng minh rằng “OpenClaw an toàn trong mọi khía cạnh” hoặc rằng toàn bộ triển khai TypeScript là đúng.

## Nơi lưu các mô hình

Các mô hình được duy trì trong một repo riêng: [vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models).

## Các lưu ý quan trọng

- Đây là **các mô hình**, không phải toàn bộ triển khai TypeScript. Có thể có độ lệch giữa mô hình và mã.
- Kết quả bị giới hạn bởi không gian trạng thái mà TLC khám phá; “xanh” không ngụ ý an toàn vượt ra ngoài các giả định và giới hạn đã mô hình hóa.
- Một số khẳng định dựa trên các giả định môi trường tường minh (ví dụ: triển khai đúng, đầu vào cấu hình đúng).

## Tái tạo kết quả

Hiện tại, kết quả được tái tạo bằng cách clone repo mô hình về máy cục bộ và chạy TLC (xem bên dưới). Một phiên bản tương lai có thể cung cấp:

- Các mô hình chạy trên CI với hiện vật công khai (vết phản ví dụ, nhật ký chạy)
- Một quy trình “chạy mô hình này” được lưu trữ cho các kiểm tra nhỏ, có giới hạn

Bắt đầu:

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Phơi bày Gateway và cấu hình sai gateway mở

**Khẳng định:** bind vượt quá loopback mà không có xác thực có thể khiến việc xâm nhập từ xa trở nên khả thi / tăng mức phơi bày; token/mật khẩu chặn kẻ tấn công chưa xác thực (theo các giả định của mô hình).

- Chạy xanh:
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- Đỏ (kỳ vọng):
  - `make gateway-exposure-v2-negative`

Xem thêm: `docs/gateway-exposure-matrix.md` trong repo mô hình.

### Pipeline Nodes.run (năng lực rủi ro cao nhất)

**Khẳng định:** `nodes.run` yêu cầu (a) danh sách cho phép lệnh của node cùng các lệnh đã khai báo và (b) phê duyệt trực tiếp khi được cấu hình; các phê duyệt được gắn token để ngăn phát lại (trong mô hình).

- Chạy xanh:
  - `make nodes-pipeline`
  - `make approvals-token`
- Đỏ (kỳ vọng):
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### Kho ghép cặp (kiểm soát Tin nhan truc tiep)

**Khẳng định:** các yêu cầu ghép cặp tuân thủ TTL và giới hạn số yêu cầu đang chờ.

- Chạy xanh:
  - `make pairing`
  - `make pairing-cap`
- Đỏ (kỳ vọng):
  - `make pairing-negative`
  - `make pairing-cap-negative`

### Kiểm soát ingress (đề cập + bỏ qua lệnh điều khiển)

**Khẳng định:** trong ngữ cảnh nhóm yêu cầu đề cập, một “lệnh điều khiển” trái phép không thể bỏ qua kiểm soát đề cập.

- Xanh:
  - `make ingress-gating`
- Đỏ (kỳ vọng):
  - `make ingress-gating-negative`

### Định tuyến / cô lập khóa phiên

**Khẳng định:** Tin nhan truc tiep từ các bên khác nhau không bị gộp vào cùng một phiên trừ khi được liên kết/cấu hình một cách tường minh.

- Xanh:
  - `make routing-isolation`
- Đỏ (kỳ vọng):
  - `make routing-isolation-negative`

## v1++: các mô hình có giới hạn bổ sung (đồng thời, thử lại, tính đúng đắn của vết)

Đây là các mô hình tiếp theo nhằm tăng độ trung thực quanh các chế độ lỗi thực tế (cập nhật không nguyên tử, thử lại, và fan-out thông điệp).

### Đồng thời / tính bất biến (idempotency) của kho ghép cặp

**Khẳng định:** một kho ghép cặp nên thực thi `MaxPending` và tính bất biến ngay cả dưới các xen kẽ (tức là “kiểm tra-rồi-ghi” phải là nguyên tử / có khóa; làm mới không nên tạo bản sao).

Ý nghĩa:

- Dưới các yêu cầu đồng thời, bạn không thể vượt quá `MaxPending` cho một kênh.
- Các yêu cầu/làm mới lặp lại cho cùng `(channel, sender)` không nên tạo các hàng đang chờ trùng lặp.

- Chạy xanh:
  - `make pairing-race` (kiểm tra giới hạn nguyên tử/có khóa)
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- Đỏ (kỳ vọng):
  - `make pairing-race-negative` (đua giới hạn begin/commit không nguyên tử)
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### Tương quan vết ingress / tính bất biến

**Khẳng định:** quá trình nhập nên bảo toàn tương quan vết qua fan-out và là bất biến dưới các lần thử lại của nhà cung cấp.

Ý nghĩa:

- Khi một sự kiện bên ngoài trở thành nhiều thông điệp nội bộ, mọi phần đều giữ cùng một danh tính vết/sự kiện.
- Thử lại không dẫn đến xử lý trùng lặp.
- Nếu thiếu ID sự kiện của nhà cung cấp, khử trùng lặp sẽ quay về một khóa an toàn (ví dụ: ID vết) để tránh loại bỏ các sự kiện khác nhau.

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

### Định tuyến: ưu tiên dmScope + identityLinks

**Khẳng định:** định tuyến phải giữ các phiên Tin nhan truc tiep được cô lập theo mặc định, và chỉ gộp phiên khi được cấu hình một cách tường minh (ưu tiên kênh + liên kết danh tính).

Ý nghĩa:

- Các ghi đè dmScope theo kênh phải thắng các mặc định toàn cục.
- identityLinks chỉ nên gộp trong các nhóm được liên kết tường minh, không gộp giữa các bên không liên quan.

- Xanh:
  - `make routing-precedence`
  - `make routing-identitylinks`
- Đỏ (kỳ vọng):
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
