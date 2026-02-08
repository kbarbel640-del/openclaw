---
summary: "Giao thức Bridge (các node legacy): TCP JSONL, ghép cặp, RPC theo phạm vi"
read_when:
  - Xây dựng hoặc gỡ lỗi client node (chế độ node iOS/Android/macOS)
  - Điều tra lỗi ghép cặp hoặc xác thực bridge
  - Kiểm tra bề mặt node được Gateway phơi bày
title: "Giao thức Bridge"
x-i18n:
  source_path: gateway/bridge-protocol.md
  source_hash: 789bcf3cbc6841fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:11Z
---

# Giao thức Bridge (vận chuyển node legacy)

Giao thức Bridge là một cơ chế vận chuyển node **legacy** (TCP JSONL). Các client
node mới nên dùng giao thức WebSocket Gateway thống nhất thay thế.

Nếu bạn đang xây dựng operator hoặc client node, hãy dùng
[giao thức Gateway](/gateway/protocol).

**Lưu ý:** Các bản dựng OpenClaw hiện tại không còn kèm theo TCP bridge listener; tài liệu này được giữ lại cho mục đích tham khảo lịch sử.
Các khóa cấu hình legacy `bridge.*` không còn nằm trong schema cấu hình.

## Vì sao tồn tại cả hai

- **Ranh giới bảo mật**: bridge chỉ phơi bày một danh sách cho phép nhỏ thay vì
  toàn bộ bề mặt API của gateway.
- **Ghép cặp + danh tính node**: việc cho phép node tham gia do gateway quản lý và
  gắn với token theo từng node.
- **UX khám phá**: node có thể khám phá gateway qua Bonjour trên LAN, hoặc kết nối
  trực tiếp qua tailnet.
- **WS loopback**: mặt phẳng điều khiển WS đầy đủ được giữ cục bộ trừ khi được
  chuyển tiếp qua SSH.

## Vận chuyển

- TCP, mỗi dòng là một đối tượng JSON (JSONL).
- TLS tùy chọn (khi `bridge.tls.enabled` là true).
- Cổng listener mặc định legacy là `18790` (các bản dựng hiện tại không khởi chạy TCP bridge).

Khi bật TLS, bản ghi TXT cho discovery bao gồm `bridgeTls=1` cùng
`bridgeTlsSha256` để node có thể ghim chứng chỉ.

## Bắt tay + ghép cặp

1. Client gửi `hello` với metadata của node + token (nếu đã ghép cặp).
2. Nếu chưa ghép cặp, gateway trả lời `error` (`NOT_PAIRED`/`UNAUTHORIZED`).
3. Client gửi `pair-request`.
4. Gateway chờ phê duyệt, sau đó gửi `pair-ok` và `hello-ok`.

`hello-ok` trả về `serverName` và có thể bao gồm `canvasHostUrl`.

## Khung (Frames)

Client → Gateway:

- `req` / `res`: RPC gateway theo phạm vi (chat, sessions, config, health, voicewake, skills.bins)
- `event`: tín hiệu node (bản chép lời giọng nói, yêu cầu tác tử, đăng ký chat, vòng đời exec)

Gateway → Client:

- `invoke` / `invoke-res`: lệnh node (`canvas.*`, `camera.*`, `screen.record`,
  `location.get`, `sms.send`)
- `event`: cập nhật chat cho các phiên đã đăng ký
- `ping` / `pong`: keepalive

Cơ chế thực thi allowlist legacy nằm trong `src/gateway/server-bridge.ts` (đã loại bỏ).

## Sự kiện vòng đời exec

Node có thể phát sự kiện `exec.finished` hoặc `exec.denied` để phơi bày hoạt động system.run.
Các sự kiện này được ánh xạ thành sự kiện hệ thống trong gateway. (Node legacy vẫn có thể phát `exec.started`.)

Các trường payload (tất cả đều tùy chọn trừ khi có ghi chú):

- `sessionKey` (bắt buộc): phiên tác tử để nhận sự kiện hệ thống.
- `runId`: id exec duy nhất để nhóm.
- `command`: chuỗi lệnh thô hoặc đã định dạng.
- `exitCode`, `timedOut`, `success`, `output`: chi tiết hoàn tất (chỉ khi finished).
- `reason`: lý do từ chối (chỉ khi denied).

## Sử dụng tailnet

- Gắn bridge vào IP tailnet: `bridge.bind: "tailnet"` trong
  `~/.openclaw/openclaw.json`.
- Client kết nối qua tên MagicDNS hoặc IP tailnet.
- Bonjour **không** băng qua các mạng; khi cần, hãy dùng host/cổng thủ công hoặc DNS‑SD diện rộng.

## Phiên bản hóa

Bridge hiện là **v1 ngầm định** (không có thương lượng min/max). Dự kiến duy trì tương thích ngược; hãy thêm trường phiên bản giao thức bridge trước bất kỳ thay đổi phá vỡ nào.
