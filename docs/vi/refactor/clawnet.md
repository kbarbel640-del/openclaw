---
summary: "Refactor Clawnet: hợp nhất giao thức mạng, vai trò, xác thực, phê duyệt và danh tính"
read_when:
  - Lập kế hoạch một giao thức mạng hợp nhất cho node + client operator
  - Làm lại phê duyệt, ghép cặp, TLS và presence trên nhiều thiết bị
title: "Refactor Clawnet"
x-i18n:
  source_path: refactor/clawnet.md
  source_hash: 719b219c3b326479
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:36Z
---

# Refactor Clawnet (hợp nhất giao thức + xác thực)

## Chào

Chào Peter — hướng đi rất tốt; điều này mở ra UX đơn giản hơn + bảo mật mạnh hơn.

## Mục đích

Một tài liệu duy nhất, chặt chẽ cho:

- Trạng thái hiện tại: giao thức, luồng, ranh giới tin cậy.
- Điểm đau: phê duyệt, định tuyến nhiều hop, trùng lặp UI.
- Trạng thái mới đề xuất: một giao thức, vai trò có phạm vi, xác thực/ghép cặp hợp nhất, TLS pinning.
- Mô hình danh tính: ID ổn định + slug dễ thương.
- Kế hoạch migration, rủi ro, câu hỏi mở.

## Mục tiêu (từ thảo luận)

- Một giao thức cho tất cả client (app mac, CLI, iOS, Android, node headless).
- Mọi thành phần trong mạng đều được xác thực + ghép cặp.
- Phân định vai trò rõ ràng: node vs operator.
- Phê duyệt tập trung, được định tuyến tới nơi người dùng đang ở.
- Mã hóa TLS + pinning tùy chọn cho mọi lưu lượng từ xa.
- Tối thiểu hóa trùng lặp mã.
- Một máy chỉ xuất hiện một lần (không trùng mục UI/node).

## Không phải mục tiêu (nêu rõ)

- Loại bỏ phân tách năng lực (vẫn cần nguyên tắc đặc quyền tối thiểu).
- Mở toàn bộ control plane của gateway mà không kiểm tra scope.
- Khiến xác thực phụ thuộc vào nhãn con người (slug không mang tính bảo mật).

---

# Trạng thái hiện tại (as‑is)

## Hai giao thức

### 1) Gateway WebSocket (control plane)

- Bề mặt API đầy đủ: config, channels, models, sessions, agent runs, logs, nodes, v.v.
- Bind mặc định: loopback. Truy cập từ xa qua SSH/Tailscale.
- Xác thực: token/mật khẩu qua `connect`.
- Không có TLS pinning (dựa vào loopback/tunnel).
- Mã nguồn:
  - `src/gateway/server/ws-connection/message-handler.ts`
  - `src/gateway/client.ts`
  - `docs/gateway/protocol.md`

### 2) Bridge (vận chuyển node)

- Bề mặt allowlist hẹp, danh tính node + ghép cặp.
- JSONL qua TCP; TLS tùy chọn + pinning fingerprint chứng chỉ.
- TLS quảng bá fingerprint trong discovery TXT.
- Mã nguồn:
  - `src/infra/bridge/server/connection.ts`
  - `src/gateway/server-bridge.ts`
  - `src/node-host/bridge-client.ts`
  - `docs/gateway/bridge-protocol.md`

## Client control plane hiện nay

- CLI → Gateway WS qua `callGateway` (`src/gateway/call.ts`).
- UI app macOS → Gateway WS (`GatewayConnection`).
- Web Control UI → Gateway WS.
- ACP → Gateway WS.
- Điều khiển từ trình duyệt dùng HTTP control server riêng.

## Node hiện nay

- App macOS ở chế độ node kết nối tới Gateway bridge (`MacNodeBridgeSession`).
- App iOS/Android kết nối tới Gateway bridge.
- Ghép cặp + token theo từng node được lưu trên gateway.

## Luồng phê duyệt hiện tại (exec)

- Agent dùng `system.run` qua Gateway.
- Gateway gọi node qua bridge.
- Runtime của node quyết định phê duyệt.
- UI prompt hiển thị bởi app mac (khi node == app mac).
- Node trả `invoke-res` về Gateway.
- Nhiều hop, UI gắn chặt với host của node.

## Presence + danh tính hiện nay

- Gateway có entry presence từ client WS.
- Node có entry presence từ bridge.
- App mac có thể hiển thị hai entry cho cùng một máy (UI + node).
- Danh tính node lưu trong pairing store; danh tính UI tách biệt.

---

# Vấn đề / điểm đau

- Hai stack giao thức cần bảo trì (WS + Bridge).
- Phê duyệt trên node từ xa: prompt xuất hiện trên host của node, không phải nơi người dùng đang ở.
- TLS pinning chỉ có ở bridge; WS phụ thuộc vào SSH/Tailscale.
- Trùng lặp danh tính: cùng một máy hiển thị như nhiều instance.
- Vai trò mơ hồ: khả năng của UI + node + CLI không tách bạch rõ.

---

# Trạng thái mới đề xuất (Clawnet)

## Một giao thức, hai vai trò

Một giao thức WS duy nhất với role + scope.

- **Role: node** (host năng lực)
- **Role: operator** (control plane)
- **Scope** tùy chọn cho operator:
  - `operator.read` (trạng thái + xem)
  - `operator.write` (chạy agent, gửi)
  - `operator.admin` (config, channels, models)

### Hành vi theo vai trò

**Node**

- Có thể đăng ký capability (`caps`, `commands`, quyền).
- Có thể nhận lệnh `invoke` (`system.run`, `camera.*`, `canvas.*`, `screen.record`, v.v.).
- Có thể gửi sự kiện: `voice.transcript`, `agent.request`, `chat.subscribe`.
- Không thể gọi các API control plane về config/models/channels/sessions/agent.

**Operator**

- Toàn bộ API control plane, được chặn theo scope.
- Nhận tất cả các phê duyệt.
- Không trực tiếp thực thi hành động OS; định tuyến tới node.

### Quy tắc then chốt

Role là theo từng kết nối, không phải theo thiết bị. Một thiết bị có thể mở cả hai role, tách biệt.

---

# Xác thực + ghép cặp hợp nhất

## Danh tính client

Mỗi client cung cấp:

- `deviceId` (ổn định, suy ra từ khóa thiết bị).
- `displayName` (tên cho con người).
- `role` + `scope` + `caps` + `commands`.

## Luồng ghép cặp (hợp nhất)

- Client kết nối chưa xác thực.
- Gateway tạo **yêu cầu ghép cặp** cho `deviceId` đó.
- Operator nhận prompt; chấp thuận/từ chối.
- Gateway cấp thông tin xác thực gắn với:
  - khóa công khai của thiết bị
  - role
  - scope
  - capability/lệnh
- Client lưu token, kết nối lại đã xác thực.

## Xác thực gắn với thiết bị (tránh replay bearer token)

Ưu tiên: cặp khóa thiết bị.

- Thiết bị tạo keypair một lần.
- `deviceId = fingerprint(publicKey)`.
- Gateway gửi nonce; thiết bị ký; gateway xác minh.
- Token được cấp cho khóa công khai (proof‑of‑possession), không phải chuỗi.

Phương án khác:

- mTLS (client cert): mạnh nhất, nhưng phức tạp vận hành hơn.
- Bearer token ngắn hạn chỉ dùng tạm (xoay vòng + thu hồi sớm).

## Phê duyệt im lặng (heuristic SSH)

Định nghĩa chính xác để tránh điểm yếu. Ưu tiên một trong:

- **Chỉ local**: tự động ghép cặp khi client kết nối qua loopback/Unix socket.
- **Thử thách qua SSH**: gateway phát nonce; client chứng minh SSH bằng cách lấy nonce.
- **Cửa sổ hiện diện vật lý**: sau khi phê duyệt local trên UI host gateway, cho phép auto‑pair trong thời gian ngắn (ví dụ 10 phút).

Luôn ghi log + lưu lại auto‑approval.

---

# TLS ở mọi nơi (dev + prod)

## Tái sử dụng TLS của bridge hiện có

Dùng runtime TLS hiện tại + pinning fingerprint:

- `src/infra/bridge/server/tls.ts`
- logic kiểm tra fingerprint trong `src/node-host/bridge-client.ts`

## Áp dụng cho WS

- WS server hỗ trợ TLS với cùng cert/key + fingerprint.
- WS client có thể pin fingerprint (tùy chọn).
- Discovery quảng bá TLS + fingerprint cho mọi endpoint.
  - Discovery chỉ là gợi ý định vị; không bao giờ là trust anchor.

## Lý do

- Giảm phụ thuộc vào SSH/Tailscale cho tính bảo mật.
- Kết nối di động từ xa an toàn theo mặc định.

---

# Thiết kế lại phê duyệt (tập trung)

## Hiện tại

Phê duyệt diễn ra trên host của node (runtime node của app mac). Prompt xuất hiện nơi node chạy.

## Đề xuất

Phê duyệt được **host tại gateway**, UI gửi tới client operator.

### Luồng mới

1. Gateway nhận intent `system.run` (agent).
2. Gateway tạo bản ghi phê duyệt: `approval.requested`.
3. UI operator hiển thị prompt.
4. Quyết định phê duyệt gửi về gateway: `approval.resolve`.
5. Gateway gọi lệnh node nếu được duyệt.
6. Node thực thi, trả `invoke-res`.

### Ngữ nghĩa phê duyệt (gia cố)

- Phát tới tất cả operator; chỉ UI đang active hiển thị modal (các UI khác nhận toast).
- Quyết định đầu tiên thắng; gateway từ chối các quyết định sau vì đã được xử lý.
- Timeout mặc định: từ chối sau N giây (ví dụ 60s), ghi log lý do.
- Việc resolve yêu cầu scope `operator.approvals`.

## Lợi ích

- Prompt xuất hiện nơi người dùng đang ở (mac/điện thoại).
- Phê duyệt nhất quán cho node từ xa.
- Runtime node giữ headless; không phụ thuộc UI.

---

# Ví dụ phân định vai trò

## App iPhone

- **Node role** cho: mic, camera, voice chat, vị trí, push‑to‑talk.
- **operator.read** tùy chọn cho trạng thái và xem chat.
- **operator.write/admin** tùy chọn chỉ khi bật rõ ràng.

## App macOS

- Operator role mặc định (UI điều khiển).
- Node role khi bật “Mac node” (system.run, screen, camera).
- Cùng deviceId cho cả hai kết nối → gộp thành một entry UI.

## CLI

- Luôn là operator role.
- Scope suy ra theo subcommand:
  - `status`, `logs` → read
  - `agent`, `message` → write
  - `config`, `channels` → admin
  - approvals + pairing → `operator.approvals` / `operator.pairing`

---

# Danh tính + slug

## ID ổn định

Bắt buộc cho xác thực; không bao giờ thay đổi.
Ưu tiên:

- Fingerprint của keypair (hash khóa công khai).

## Slug dễ thương (chủ đề tôm hùm)

Chỉ là nhãn cho con người.

- Ví dụ: `scarlet-claw`, `saltwave`, `mantis-pinch`.
- Lưu trong registry của gateway, có thể chỉnh sửa.
- Xử lý trùng: `-2`, `-3`.

## Nhóm trong UI

Cùng `deviceId` qua các role → một dòng “Instance” duy nhất:

- Badge: `operator`, `node`.
- Hiển thị capability + lần thấy gần nhất.

---

# Chiến lược migration

## Phase 0: Tài liệu + căn chỉnh

- Công bố tài liệu này.
- Kiểm kê tất cả các call giao thức + luồng phê duyệt.

## Phase 1: Thêm role/scope cho WS

- Mở rộng tham số `connect` với `role`, `scope`, `deviceId`.
- Thêm chặn allowlist cho node role.

## Phase 2: Tương thích bridge

- Giữ bridge chạy.
- Thêm hỗ trợ node qua WS song song.
- Chặn tính năng sau cờ config.

## Phase 3: Phê duyệt tập trung

- Thêm sự kiện yêu cầu + resolve phê duyệt trong WS.
- Cập nhật UI app mac để prompt + phản hồi.
- Runtime node ngừng hiển thị UI prompt.

## Phase 4: Hợp nhất TLS

- Thêm cấu hình TLS cho WS dùng runtime TLS của bridge.
- Thêm pinning cho client.

## Phase 5: Loại bỏ bridge

- Chuyển iOS/Android/mac node sang WS.
- Giữ bridge làm fallback; loại bỏ khi ổn định.

## Phase 6: Xác thực gắn thiết bị

- Yêu cầu danh tính dựa trên khóa cho mọi kết nối không‑local.
- Thêm UI thu hồi + xoay vòng.

---

# Ghi chú bảo mật

- Role/allowlist được thực thi tại ranh giới gateway.
- Không client nào có “full” API nếu không có operator scope.
- Bắt buộc ghép cặp cho _mọi_ kết nối.
- TLS + pinning giảm rủi ro MITM cho mobile.
- Silent approval qua SSH là tiện lợi; vẫn được ghi lại + có thể thu hồi.
- Discovery không bao giờ là trust anchor.
- Claim capability được xác minh với allowlist phía server theo nền tảng/loại.

# Streaming + payload lớn (media node)

WS control plane ổn cho thông điệp nhỏ, nhưng node còn làm:

- clip camera
- ghi màn hình
- stream âm thanh

Phương án:

1. WS binary frames + chunking + quy tắc backpressure.
2. Endpoint streaming riêng (vẫn TLS + auth).
3. Giữ bridge lâu hơn cho lệnh nặng media, migrate sau cùng.

Chọn một trước khi triển khai để tránh lệch hướng.

# Chính sách capability + command

- Capability/lệnh do node báo cáo được xem là **claim**.
- Gateway thực thi allowlist theo từng nền tảng.
- Lệnh mới cần phê duyệt operator hoặc thay đổi allowlist rõ ràng.
- Audit thay đổi với timestamp.

# Audit + rate limiting

- Ghi log: yêu cầu ghép cặp, phê duyệt/từ chối, cấp/xoay vòng/thu hồi token.
- Giới hạn tốc độ spam ghép cặp và prompt phê duyệt.

# Vệ sinh giao thức

- Phiên bản giao thức + mã lỗi rõ ràng.
- Quy tắc reconnect + heartbeat.
- TTL presence và ngữ nghĩa last‑seen.

---

# Câu hỏi mở

1. Một thiết bị chạy cả hai role: mô hình token
   - Khuyến nghị token riêng cho mỗi role (node vs operator).
   - Cùng deviceId; scope khác nhau; thu hồi rõ ràng hơn.

2. Độ chi tiết scope operator
   - read/write/admin + approvals + pairing (mức tối thiểu khả thi).
   - Cân nhắc scope theo tính năng sau.

3. UX xoay vòng + thu hồi token
   - Tự động xoay khi đổi role.
   - UI thu hồi theo deviceId + role.

4. Discovery
   - Mở rộng Bonjour TXT hiện tại để gồm WS TLS fingerprint + gợi ý role.
   - Chỉ coi là gợi ý định vị.

5. Phê duyệt xuyên mạng
   - Phát tới mọi client operator; UI active hiển thị modal.
   - Phản hồi đầu tiên thắng; gateway đảm bảo tính nguyên tử.

---

# Tóm tắt (TL;DR)

- Hiện tại: WS control plane + Bridge cho node transport.
- Vấn đề: phê duyệt + trùng lặp + hai stack.
- Đề xuất: một giao thức WS với role + scope rõ ràng, ghép cặp hợp nhất + TLS pinning, phê duyệt host tại gateway, device ID ổn định + slug dễ thương.
- Kết quả: UX đơn giản hơn, bảo mật mạnh hơn, ít trùng lặp, định tuyến mobile tốt hơn.
