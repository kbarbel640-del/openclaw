---
summary: "Ghép cặp node do Gateway sở hữu (Tùy chọn B) cho iOS và các node từ xa khác"
read_when:
  - Triển khai phê duyệt ghép cặp node mà không cần UI macOS
  - Thêm các luồng CLI để phê duyệt node từ xa
  - Mở rộng giao thức gateway với quản lý node
title: "Ghép cặp do Gateway sở hữu"
x-i18n:
  source_path: gateway/pairing.md
  source_hash: 1f5154292a75ea2c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:18Z
---

# Ghép cặp do Gateway sở hữu (Tùy chọn B)

Trong mô hình ghép cặp do Gateway sở hữu, **Gateway** là nguồn chân lý xác định những node nào được phép tham gia. Các UI (ứng dụng macOS, các client trong tương lai) chỉ là frontend để phê duyệt hoặc từ chối các yêu cầu đang chờ.

**Quan trọng:** Các node WS sử dụng **ghép cặp thiết bị** (vai trò `node`) trong `connect`.
`node.pair.*` là một kho ghép cặp riêng và **không** kiểm soát bắt tay WS.
Chỉ các client gọi rõ ràng `node.pair.*` mới sử dụng luồng này.

## Khái niệm

- **Yêu cầu đang chờ**: một node yêu cầu tham gia; cần được phê duyệt.
- **Node đã ghép cặp**: node đã được phê duyệt và được cấp token xác thực.
- **Vận chuyển**: endpoint WS của Gateway chuyển tiếp yêu cầu nhưng không quyết định
  tư cách thành viên. (Hỗ trợ cầu nối TCP cũ đã bị ngừng/loại bỏ.)

## Cách ghép cặp hoạt động

1. Một node kết nối tới WS của Gateway và yêu cầu ghép cặp.
2. Gateway lưu một **yêu cầu đang chờ** và phát `node.pair.requested`.
3. Bạn phê duyệt hoặc từ chối yêu cầu (CLI hoặc UI).
4. Khi phê duyệt, Gateway phát hành **token mới** (token được xoay vòng khi ghép cặp lại).
5. Node kết nối lại bằng token và lúc này đã “được ghép cặp”.

Các yêu cầu đang chờ sẽ tự động hết hạn sau **5 phút**.

## Quy trình CLI (thân thiện với headless)

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes reject <requestId>
openclaw nodes status
openclaw nodes rename --node <id|name|ip> --name "Living Room iPad"
```

`nodes status` hiển thị các node đã ghép cặp/đang kết nối và các khả năng của chúng.

## Bề mặt API (giao thức gateway)

Sự kiện:

- `node.pair.requested` — phát ra khi một yêu cầu đang chờ mới được tạo.
- `node.pair.resolved` — phát ra khi một yêu cầu được phê duyệt/từ chối/hết hạn.

Phương thức:

- `node.pair.request` — tạo hoặc tái sử dụng một yêu cầu đang chờ.
- `node.pair.list` — liệt kê các node đang chờ + đã ghép cặp.
- `node.pair.approve` — phê duyệt một yêu cầu đang chờ (phát hành token).
- `node.pair.reject` — từ chối một yêu cầu đang chờ.
- `node.pair.verify` — xác minh `{ nodeId, token }`.

Ghi chú:

- `node.pair.request` là idempotent theo node: các lần gọi lặp lại trả về cùng một
  yêu cầu đang chờ.
- Việc phê duyệt **luôn** tạo token mới; không có token nào từng được trả về từ
  `node.pair.request`.
- Yêu cầu có thể bao gồm `silent: true` như một gợi ý cho các luồng tự động phê duyệt.

## Tự động phê duyệt (ứng dụng macOS)

Ứng dụng macOS có thể tùy chọn thử **phê duyệt im lặng** khi:

- yêu cầu được đánh dấu `silent`, và
- ứng dụng có thể xác minh kết nối SSH tới máy chủ gateway bằng cùng người dùng.

Nếu phê duyệt im lặng thất bại, nó sẽ quay về lời nhắc “Phê duyệt/Từ chối” thông thường.

## Lưu trữ (cục bộ, riêng tư)

Trạng thái ghép cặp được lưu dưới thư mục trạng thái của Gateway (mặc định `~/.openclaw`):

- `~/.openclaw/nodes/paired.json`
- `~/.openclaw/nodes/pending.json`

Nếu bạn ghi đè `OPENCLAW_STATE_DIR`, thư mục `nodes/` sẽ di chuyển theo.

Ghi chú bảo mật:

- Token là bí mật; hãy coi `paired.json` là nhạy cảm.
- Xoay vòng token yêu cầu phê duyệt lại (hoặc xóa mục node).

## Hành vi vận chuyển

- Vận chuyển là **không trạng thái**; nó không lưu trữ tư cách thành viên.
- Nếu Gateway ngoại tuyến hoặc ghép cặp bị vô hiệu hóa, các node không thể ghép cặp.
- Nếu Gateway ở chế độ từ xa, việc ghép cặp vẫn diễn ra dựa trên kho của Gateway từ xa.
