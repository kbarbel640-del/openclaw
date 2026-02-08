---
summary: "Chạy cầu nối ACP cho các tích hợp IDE"
read_when:
  - Thiết lập các tích hợp IDE dựa trên ACP
  - Gỡ lỗi định tuyến phiên ACP tới Gateway
title: "acp"
x-i18n:
  source_path: cli/acp.md
  source_hash: 0c09844297da250b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:15Z
---

# acp

Chạy cầu nối ACP (Agent Client Protocol) giao tiếp với một OpenClaw Gateway.

Lệnh này nói chuyện ACP qua stdio cho các IDE và chuyển tiếp prompt tới Gateway
qua WebSocket. Nó giữ các phiên ACP được ánh xạ với các khóa phiên của Gateway.

## Usage

```bash
openclaw acp

# Remote Gateway
openclaw acp --url wss://gateway-host:18789 --token <token>

# Attach to an existing session key
openclaw acp --session agent:main:main

# Attach by label (must already exist)
openclaw acp --session-label "support inbox"

# Reset the session key before the first prompt
openclaw acp --session agent:main:main --reset-session
```

## ACP client (debug)

Sử dụng ACP client tích hợp sẵn để kiểm tra nhanh cầu nối mà không cần IDE.
Nó khởi chạy cầu nối ACP và cho phép bạn nhập prompt tương tác.

```bash
openclaw acp client

# Point the spawned bridge at a remote Gateway
openclaw acp client --server-args --url wss://gateway-host:18789 --token <token>

# Override the server command (default: openclaw)
openclaw acp client --server "node" --server-args openclaw.mjs acp --url ws://127.0.0.1:19001
```

## Cách sử dụng

Sử dụng ACP khi một IDE (hoặc client khác) nói Agent Client Protocol và bạn muốn
nó điều khiển một phiên OpenClaw Gateway.

1. Đảm bảo Gateway đang chạy (cục bộ hoặc từ xa).
2. Cấu hình đích Gateway (qua cấu hình hoặc cờ).
3. Trỏ IDE của bạn chạy `openclaw acp` qua stdio.

Ví dụ cấu hình (được lưu):

```bash
openclaw config set gateway.remote.url wss://gateway-host:18789
openclaw config set gateway.remote.token <token>
```

Ví dụ chạy trực tiếp (không ghi cấu hình):

```bash
openclaw acp --url wss://gateway-host:18789 --token <token>
```

## Chọn agent

ACP không chọn agent trực tiếp. Nó định tuyến theo khóa phiên Gateway.

Sử dụng khóa phiên theo phạm vi agent để nhắm tới một agent cụ thể:

```bash
openclaw acp --session agent:main:main
openclaw acp --session agent:design:main
openclaw acp --session agent:qa:bug-123
```

Mỗi phiên ACP ánh xạ tới một khóa phiên Gateway duy nhất. Một agent có thể có
nhiều phiên; ACP mặc định dùng một phiên `acp:<uuid>` tách biệt trừ khi bạn
ghi đè khóa hoặc nhãn.

## Thiết lập Zed editor

Thêm một ACP agent tùy chỉnh trong `~/.config/zed/settings.json` (hoặc dùng UI Settings của Zed):

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

Để nhắm tới một Gateway hoặc agent cụ thể:

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": [
        "acp",
        "--url",
        "wss://gateway-host:18789",
        "--token",
        "<token>",
        "--session",
        "agent:design:main"
      ],
      "env": {}
    }
  }
}
```

Trong Zed, mở bảng Agent và chọn “OpenClaw ACP” để bắt đầu một luồng.

## Ánh xạ phiên

Theo mặc định, các phiên ACP nhận một khóa phiên Gateway tách biệt với tiền tố `acp:`.
Để tái sử dụng một phiên đã biết, truyền khóa phiên hoặc nhãn:

- `--session <key>`: dùng một khóa phiên Gateway cụ thể.
- `--session-label <label>`: phân giải một phiên hiện có theo nhãn.
- `--reset-session`: tạo một id phiên mới cho khóa đó (cùng khóa, bản ghi mới).

Nếu ACP client của bạn hỗ trợ metadata, bạn có thể ghi đè theo từng phiên:

```json
{
  "_meta": {
    "sessionKey": "agent:main:main",
    "sessionLabel": "support inbox",
    "resetSession": true
  }
}
```

Tìm hiểu thêm về khóa phiên tại [/concepts/session](/concepts/session).

## Options

- `--url <url>`: URL WebSocket của Gateway (mặc định là gateway.remote.url khi đã cấu hình).
- `--token <token>`: token xác thực Gateway.
- `--password <password>`: mật khẩu xác thực Gateway.
- `--session <key>`: khóa phiên mặc định.
- `--session-label <label>`: nhãn phiên mặc định để phân giải.
- `--require-existing`: thất bại nếu khóa/nhãn phiên không tồn tại.
- `--reset-session`: đặt lại khóa phiên trước lần sử dụng đầu tiên.
- `--no-prefix-cwd`: không thêm tiền tố thư mục làm việc vào prompt.
- `--verbose, -v`: ghi log chi tiết ra stderr.

### Các tùy chọn `acp client`

- `--cwd <dir>`: thư mục làm việc cho phiên ACP.
- `--server <command>`: lệnh máy chủ ACP (mặc định: `openclaw`).
- `--server-args <args...>`: các đối số bổ sung truyền cho máy chủ ACP.
- `--server-verbose`: bật ghi log chi tiết trên máy chủ ACP.
- `--verbose, -v`: ghi log chi tiết phía client.
