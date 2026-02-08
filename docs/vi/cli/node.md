---
summary: "Tham chiếu CLI cho `openclaw node` (máy chủ node headless)"
read_when:
  - Chạy máy chủ node headless
  - Ghép cặp một node không phải macOS cho system.run
title: "node"
x-i18n:
  source_path: cli/node.md
  source_hash: a8b1a57712663e22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:33Z
---

# `openclaw node`

Chạy một **máy chủ node headless** kết nối tới Gateway WebSocket và cung cấp
`system.run` / `system.which` trên máy này.

## Vì sao dùng máy chủ node?

Dùng máy chủ node khi bạn muốn các agent **chạy lệnh trên những máy khác** trong
mạng của bạn mà không cần cài đặt ứng dụng đồng hành macOS đầy đủ trên đó.

Các trường hợp sử dụng phổ biến:

- Chạy lệnh trên các máy Linux/Windows từ xa (máy build, máy phòng thí nghiệm, NAS).
- Giữ việc exec **trong sandbox** trên Gateway, nhưng ủy quyền các lần chạy đã được phê duyệt cho các host khác.
- Cung cấp một đích thực thi gọn nhẹ, headless cho tự động hóa hoặc các node CI.

Việc thực thi vẫn được bảo vệ bằng **phê duyệt exec** và allowlist theo từng agent
trên máy chủ node, vì vậy bạn có thể giữ quyền truy cập lệnh được giới hạn và rõ ràng.

## Browser proxy (không cần cấu hình)

Các máy chủ node tự động quảng bá một browser proxy nếu `browser.enabled` không bị
tắt trên node. Điều này cho phép agent dùng tự động hóa trình duyệt trên node đó
mà không cần cấu hình bổ sung.

Nếu cần, hãy tắt nó trên node:

```json5
{
  nodeHost: {
    browserProxy: {
      enabled: false,
    },
  },
}
```

## Chạy (tiền cảnh)

```bash
openclaw node run --host <gateway-host> --port 18789
```

Tùy chọn:

- `--host <host>`: Host Gateway WebSocket (mặc định: `127.0.0.1`)
- `--port <port>`: Cổng Gateway WebSocket (mặc định: `18789`)
- `--tls`: Dùng TLS cho kết nối Gateway
- `--tls-fingerprint <sha256>`: Dấu vân tay chứng chỉ TLS dự kiến (sha256)
- `--node-id <id>`: Ghi đè node id (xóa token ghép cặp)
- `--display-name <name>`: Ghi đè tên hiển thị của node

## Dịch vụ (chạy nền)

Cài đặt một máy chủ node headless như một dịch vụ người dùng.

```bash
openclaw node install --host <gateway-host> --port 18789
```

Tùy chọn:

- `--host <host>`: Host Gateway WebSocket (mặc định: `127.0.0.1`)
- `--port <port>`: Cổng Gateway WebSocket (mặc định: `18789`)
- `--tls`: Dùng TLS cho kết nối Gateway
- `--tls-fingerprint <sha256>`: Dấu vân tay chứng chỉ TLS dự kiến (sha256)
- `--node-id <id>`: Ghi đè node id (xóa token ghép cặp)
- `--display-name <name>`: Ghi đè tên hiển thị của node
- `--runtime <runtime>`: Runtime của dịch vụ (`node` hoặc `bun`)
- `--force`: Cài đặt lại/ghi đè nếu đã được cài

Quản lý dịch vụ:

```bash
openclaw node status
openclaw node stop
openclaw node restart
openclaw node uninstall
```

Dùng `openclaw node run` cho máy chủ node chạy tiền cảnh (không dùng dịch vụ).

Các lệnh dịch vụ chấp nhận `--json` để xuất đầu ra có thể đọc bằng máy.

## Ghép cặp

Kết nối đầu tiên tạo một yêu cầu ghép cặp node đang chờ trên Gateway.
Phê duyệt thông qua:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

Máy chủ node lưu node id, token, tên hiển thị và thông tin kết nối Gateway trong
`~/.openclaw/node.json`.

## Phê duyệt exec

`system.run` được kiểm soát bởi các phê duyệt exec cục bộ:

- `~/.openclaw/exec-approvals.json`
- [Phê duyệt exec](/tools/exec-approvals)
- `openclaw approvals --node <id|name|ip>` (chỉnh sửa từ Gateway)
