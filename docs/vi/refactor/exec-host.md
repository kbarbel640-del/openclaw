---
summary: "Kế hoạch refactor: định tuyến exec host, phê duyệt node và runner headless"
read_when:
  - Thiết kế định tuyến exec host hoặc phê duyệt exec
  - Triển khai node runner + UI IPC
  - Thêm các chế độ bảo mật exec host và slash commands
title: "Refactor Exec Host"
x-i18n:
  source_path: refactor/exec-host.md
  source_hash: 53a9059cbeb1f3f1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:29Z
---

# Kế hoạch refactor exec host

## Mục tiêu

- Thêm `exec.host` + `exec.security` để định tuyến thực thi giữa **sandbox**, **gateway** và **node**.
- Giữ mặc định **an toàn**: không thực thi chéo host trừ khi được bật rõ ràng.
- Tách thực thi thành **dịch vụ runner headless** với UI tùy chọn (ứng dụng macOS) qua IPC cục bộ.
- Cung cấp chính sách **theo từng agent**, allowlist, chế độ hỏi (ask), và ràng buộc node.
- Hỗ trợ **ask modes** hoạt động _có_ hoặc _không_ với allowlist.
- Đa nền tảng: Unix socket + xác thực token (tương đương macOS/Linux/Windows).

## Không nằm trong phạm vi

- Không di chuyển allowlist cũ hoặc hỗ trợ schema cũ.
- Không có PTY/streaming cho exec trên node (chỉ đầu ra tổng hợp).
- Không thêm lớp mạng mới ngoài Bridge + Gateway hiện có.

## Quyết định (đã khóa)

- **Khóa cấu hình:** `exec.host` + `exec.security` (cho phép override theo agent).
- **Nâng quyền:** giữ `/elevated` như một alias cho toàn quyền gateway.
- **Mặc định hỏi:** `on-miss`.
- **Kho phê duyệt:** `~/.openclaw/exec-approvals.json` (JSON, không migrate legacy).
- **Runner:** dịch vụ hệ thống headless; ứng dụng UI host một Unix socket cho phê duyệt.
- **Định danh node:** dùng `nodeId` hiện có.
- **Xác thực socket:** Unix socket + token (đa nền tảng); tách sau nếu cần.
- **Trạng thái host node:** `~/.openclaw/node.json` (node id + pairing token).
- **Exec host macOS:** chạy `system.run` bên trong ứng dụng macOS; dịch vụ host node chuyển tiếp yêu cầu qua IPC cục bộ.
- **Không dùng XPC helper:** giữ Unix socket + token + kiểm tra peer.

## Khái niệm chính

### Host

- `sandbox`: Docker exec (hành vi hiện tại).
- `gateway`: exec trên host gateway.
- `node`: exec trên node runner qua Bridge (`system.run`).

### Chế độ bảo mật

- `deny`: luôn chặn.
- `allowlist`: chỉ cho phép các khớp.
- `full`: cho phép tất cả (tương đương nâng quyền).

### Chế độ hỏi (Ask mode)

- `off`: không bao giờ hỏi.
- `on-miss`: chỉ hỏi khi allowlist không khớp.
- `always`: hỏi mọi lần.

Ask **độc lập** với allowlist; allowlist có thể dùng với `always` hoặc `on-miss`.

### Phân giải chính sách (mỗi lần exec)

1. Phân giải `exec.host` (tham số tool → override theo agent → mặc định toàn cục).
2. Phân giải `exec.security` và `exec.ask` (cùng thứ tự ưu tiên).
3. Nếu host là `sandbox`, tiếp tục exec sandbox cục bộ.
4. Nếu host là `gateway` hoặc `node`, áp dụng chính sách bảo mật + hỏi trên host đó.

## An toàn mặc định

- Mặc định `exec.host = sandbox`.
- Mặc định `exec.security = deny` cho `gateway` và `node`.
- Mặc định `exec.ask = on-miss` (chỉ liên quan nếu bảo mật cho phép).
- Nếu không đặt ràng buộc node, **agent có thể nhắm bất kỳ node nào**, nhưng chỉ khi chính sách cho phép.

## Bề mặt cấu hình

### Tham số tool

- `exec.host` (tùy chọn): `sandbox | gateway | node`.
- `exec.security` (tùy chọn): `deny | allowlist | full`.
- `exec.ask` (tùy chọn): `off | on-miss | always`.
- `exec.node` (tùy chọn): id/tên node dùng khi `host=node`.

### Khóa cấu hình (toàn cục)

- `tools.exec.host`
- `tools.exec.security`
- `tools.exec.ask`
- `tools.exec.node` (ràng buộc node mặc định)

### Khóa cấu hình (theo agent)

- `agents.list[].tools.exec.host`
- `agents.list[].tools.exec.security`
- `agents.list[].tools.exec.ask`
- `agents.list[].tools.exec.node`

### Alias

- `/elevated on` = đặt `tools.exec.host=gateway`, `tools.exec.security=full` cho phiên agent.
- `/elevated off` = khôi phục cài đặt exec trước đó cho phiên agent.

## Kho phê duyệt (JSON)

Đường dẫn: `~/.openclaw/exec-approvals.json`

Mục đích:

- Chính sách cục bộ + allowlist cho **execution host** (gateway hoặc node runner).
- Ask fallback khi không có UI.
- Thông tin xác thực IPC cho client UI.

Schema đề xuất (v1):

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64-opaque-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny"
  },
  "agents": {
    "agent-id-1": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [
        {
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 0,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

Ghi chú:

- Không hỗ trợ định dạng allowlist legacy.
- `askFallback` chỉ áp dụng khi `ask` là bắt buộc và không truy cập được UI.
- Quyền file: `0600`.

## Dịch vụ runner (headless)

### Vai trò

- Thực thi cục bộ `exec.security` + `exec.ask`.
- Chạy lệnh hệ thống và trả về đầu ra.
- Phát sự kiện Bridge cho vòng đời exec (tùy chọn nhưng khuyến nghị).

### Vòng đời dịch vụ

- Launchd/daemon trên macOS; dịch vụ hệ thống trên Linux/Windows.
- JSON phê duyệt là cục bộ với execution host.
- UI host một Unix socket cục bộ; runner kết nối theo nhu cầu.

## Tích hợp UI (ứng dụng macOS)

### IPC

- Unix socket tại `~/.openclaw/exec-approvals.sock` (0600).
- Token lưu tại `exec-approvals.json` (0600).
- Kiểm tra peer: chỉ cùng UID.
- Challenge/response: nonce + HMAC(token, request-hash) để chống replay.
- TTL ngắn (ví dụ 10s) + giới hạn payload + rate limit.

### Luồng hỏi (exec host ứng dụng macOS)

1. Dịch vụ node nhận `system.run` từ gateway.
2. Dịch vụ node kết nối socket cục bộ và gửi prompt/yêu cầu exec.
3. Ứng dụng xác thực peer + token + HMAC + TTL, sau đó hiển thị hộp thoại nếu cần.
4. Ứng dụng thực thi lệnh trong ngữ cảnh UI và trả về đầu ra.
5. Dịch vụ node trả đầu ra về gateway.

Nếu thiếu UI:

- Áp dụng `askFallback` (`deny|allowlist|full`).

### Sơ đồ (SCI)

```
Agent -> Gateway -> Bridge -> Node Service (TS)
                         |  IPC (UDS + token + HMAC + TTL)
                         v
                     Mac App (UI + TCC + system.run)
```

## Định danh + ràng buộc node

- Dùng `nodeId` hiện có từ Bridge pairing.
- Mô hình ràng buộc:
  - `tools.exec.node` giới hạn agent vào một node cụ thể.
  - Nếu không đặt, agent có thể chọn bất kỳ node nào (chính sách vẫn áp dụng mặc định).
- Phân giải chọn node:
  - `nodeId` khớp chính xác
  - `displayName` (chuẩn hóa)
  - `remoteIp`
  - `nodeId` tiền tố (>= 6 ký tự)

## Sự kiện

### Ai thấy sự kiện

- Sự kiện hệ thống là **theo phiên** và hiển thị cho agent ở prompt tiếp theo.
- Lưu trong hàng đợi bộ nhớ của gateway (`enqueueSystemEvent`).

### Nội dung sự kiện

- `Exec started (node=<id>, id=<runId>)`
- `Exec finished (node=<id>, id=<runId>, code=<code>)` + phần đuôi đầu ra tùy chọn
- `Exec denied (node=<id>, id=<runId>, <reason>)`

### Vận chuyển

Tùy chọn A (khuyến nghị):

- Runner gửi frame Bridge `event` `exec.started` / `exec.finished`.
- Gateway `handleBridgeEvent` ánh xạ chúng thành `enqueueSystemEvent`.

Tùy chọn B:

- Gateway `exec` tool xử lý vòng đời trực tiếp (chỉ đồng bộ).

## Luồng exec

### Sandbox host

- Hành vi `exec` hiện có (Docker hoặc host khi không sandbox).
- PTY chỉ hỗ trợ ở chế độ không sandbox.

### Gateway host

- Tiến trình Gateway thực thi trên máy của chính nó.
- Thực thi `exec-approvals.json` cục bộ (bảo mật/hỏi/allowlist).

### Node host

- Gateway gọi `node.invoke` với `system.run`.
- Runner thực thi phê duyệt cục bộ.
- Runner trả về stdout/stderr đã tổng hợp.
- Sự kiện Bridge tùy chọn cho bắt đầu/kết thúc/từ chối.

## Giới hạn đầu ra

- Giới hạn stdout+stderr gộp ở **200k**; giữ **đuôi 20k** cho sự kiện.
- Cắt bớt với hậu tố rõ ràng (ví dụ: `"… (truncated)"`).

## Slash commands

- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>`
- Override theo agent, theo phiên; không bền vững trừ khi lưu qua cấu hình.
- `/elevated on|off|ask|full` vẫn là lối tắt cho `host=gateway security=full` (với `full` bỏ qua phê duyệt).

## Câu chuyện đa nền tảng

- Dịch vụ runner là đích thực thi có thể mang theo.
- UI là tùy chọn; nếu thiếu, áp dụng `askFallback`.
- Windows/Linux hỗ trợ cùng JSON phê duyệt + giao thức socket.

## Các giai đoạn triển khai

### Giai đoạn 1: cấu hình + định tuyến exec

- Thêm schema cấu hình cho `exec.host`, `exec.security`, `exec.ask`, `exec.node`.
- Cập nhật plumbing tool để tôn trọng `exec.host`.
- Thêm slash command `/exec` và giữ alias `/elevated`.

### Giai đoạn 2: kho phê duyệt + thực thi tại gateway

- Triển khai reader/writer `exec-approvals.json`.
- Thực thi allowlist + ask modes cho host `gateway`.
- Thêm giới hạn đầu ra.

### Giai đoạn 3: thực thi tại node runner

- Cập nhật node runner để thực thi allowlist + ask.
- Thêm cầu nối prompt Unix socket tới UI ứng dụng macOS.
- Nối `askFallback`.

### Giai đoạn 4: sự kiện

- Thêm sự kiện Bridge node → gateway cho vòng đời exec.
- Ánh xạ sang `enqueueSystemEvent` cho prompt agent.

### Giai đoạn 5: hoàn thiện UI

- Ứng dụng Mac: trình chỉnh sửa allowlist, chuyển theo agent, UI chính sách hỏi.
- Điều khiển ràng buộc node (tùy chọn).

## Kế hoạch kiểm thử

- Unit tests: khớp allowlist (glob + không phân biệt hoa thường).
- Unit tests: thứ tự ưu tiên phân giải chính sách (tham số tool → override theo agent → toàn cục).
- Integration tests: luồng node runner từ chối/cho phép/hỏi.
- Bridge event tests: sự kiện node → định tuyến sự kiện hệ thống.

## Rủi ro mở

- UI không khả dụng: đảm bảo `askFallback` được tôn trọng.
- Lệnh chạy dài: dựa vào timeout + giới hạn đầu ra.
- Mơ hồ đa node: báo lỗi trừ khi có ràng buộc node hoặc tham số node rõ ràng.

## Tài liệu liên quan

- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)
- [Nodes](/nodes)
- [Elevated mode](/tools/elevated)
