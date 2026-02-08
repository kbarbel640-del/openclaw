---
summary: "Ứng dụng đồng hành OpenClaw trên macOS (menu bar + gateway broker)"
read_when:
  - Triển khai các tính năng ứng dụng macOS
  - Thay đổi vòng đời Gateway hoặc kết nối node trên macOS
title: "Ứng dụng macOS"
x-i18n:
  source_path: platforms/macos.md
  source_hash: a5b1c02e5905e4cb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:08Z
---

# OpenClaw macOS Companion (menu bar + gateway broker)

Ứng dụng macOS là **ứng dụng đồng hành trên thanh menu** cho OpenClaw. Ứng dụng này quản lý quyền,
quản lý/gắn với Gateway cục bộ (launchd hoặc thủ công), và phơi bày các khả năng của macOS cho tác tử dưới dạng một node.

## Chức năng

- Hiển thị thông báo gốc và trạng thái trên thanh menu.
- Quản lý các lời nhắc TCC (Thông báo, Trợ năng, Ghi màn hình, Microphone,
  Nhận dạng giọng nói, Tự động hóa/AppleScript).
- Chạy hoặc kết nối tới Gateway (cục bộ hoặc từ xa).
- Phơi bày các công cụ chỉ có trên macOS (Canvas, Camera, Screen Recording, `system.run`).
- Khởi động dịch vụ node host cục bộ ở chế độ **remote** (launchd), và dừng ở chế độ **local**.
- Tùy chọn lưu trữ **PeekabooBridge** cho tự động hóa UI.
- Cài đặt CLI toàn cục (`openclaw`) qua npm/pnpm theo yêu cầu (không khuyến nghị bun cho runtime Gateway).

## Chế độ local vs remote

- **Local** (mặc định): ứng dụng gắn vào Gateway cục bộ đang chạy nếu có;
  nếu không, ứng dụng kích hoạt dịch vụ launchd qua `openclaw gateway install`.
- **Remote**: ứng dụng kết nối tới Gateway qua SSH/Tailscale và không bao giờ khởi động
  tiến trình cục bộ.
  Ứng dụng khởi động **dịch vụ node host** cục bộ để Gateway từ xa có thể truy cập Mac này.
  Ứng dụng không spawn Gateway như một tiến trình con.

## Điều khiển launchd

Ứng dụng quản lý một LaunchAgent theo người dùng với nhãn `bot.molt.gateway`
(hoặc `bot.molt.<profile>` khi dùng `--profile`/`OPENCLAW_PROFILE`; bản legacy `com.openclaw.*` vẫn có thể unload).

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

Thay nhãn bằng `bot.molt.<profile>` khi chạy một profile có tên.

Nếu LaunchAgent chưa được cài, hãy bật từ ứng dụng hoặc chạy
`openclaw gateway install`.

## Khả năng của node (mac)

Ứng dụng macOS tự trình bày như một node. Các lệnh phổ biến:

- Canvas: `canvas.present`, `canvas.navigate`, `canvas.eval`, `canvas.snapshot`, `canvas.a2ui.*`
- Camera: `camera.snap`, `camera.clip`
- Screen: `screen.record`
- System: `system.run`, `system.notify`

Node báo cáo một bản đồ `permissions` để các tác tử quyết định điều gì được phép.

Dịch vụ node + IPC của ứng dụng:

- Khi dịch vụ node host headless đang chạy (chế độ remote), nó kết nối tới Gateway WS như một node.
- `system.run` thực thi trong ứng dụng macOS (ngữ cảnh UI/TCC) qua Unix socket cục bộ; lời nhắc + đầu ra ở lại trong ứng dụng.

Sơ đồ (SCI):

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + TCC + system.run)
```

## Phê duyệt exec (system.run)

`system.run` được kiểm soát bởi **Exec approvals** trong ứng dụng macOS (Settings → Exec approvals).
Bảo mật + hỏi + allowlist được lưu cục bộ trên Mac tại:

```
~/.openclaw/exec-approvals.json
```

Ví dụ:

```json
{
  "version": 1,
  "defaults": {
    "security": "deny",
    "ask": "on-miss"
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [{ "pattern": "/opt/homebrew/bin/rg" }]
    }
  }
}
```

Ghi chú:

- Các mục `allowlist` là mẫu glob cho đường dẫn binary đã được resolve.
- Chọn “Always Allow” trong lời nhắc sẽ thêm lệnh đó vào allowlist.
- Các ghi đè môi trường `system.run` được lọc (loại bỏ `PATH`, `DYLD_*`, `LD_*`, `NODE_OPTIONS`, `PYTHON*`, `PERL*`, `RUBYOPT`) rồi hợp nhất với môi trường của ứng dụng.

## Deep links

Ứng dụng đăng ký scheme URL `openclaw://` cho các hành động cục bộ.

### `openclaw://agent`

Kích hoạt một yêu cầu Gateway `agent`.

```bash
open 'openclaw://agent?message=Hello%20from%20deep%20link'
```

Tham số truy vấn:

- `message` (bắt buộc)
- `sessionKey` (tùy chọn)
- `thinking` (tùy chọn)
- `deliver` / `to` / `channel` (tùy chọn)
- `timeoutSeconds` (tùy chọn)
- `key` (khóa chế độ không giám sát, tùy chọn)

An toàn:

- Không có `key`, ứng dụng sẽ yêu cầu xác nhận.
- Với `key` hợp lệ, lần chạy là không giám sát (dành cho tự động hóa cá nhân).

## Quy trình onboarding (điển hình)

1. Cài đặt và khởi chạy **OpenClaw.app**.
2. Hoàn tất danh sách kiểm tra quyền (lời nhắc TCC).
3. Đảm bảo chế độ **Local** đang hoạt động và Gateway đang chạy.
4. Cài đặt CLI nếu bạn muốn truy cập từ terminal.

## Quy trình build & dev (native)

- `cd apps/macos && swift build`
- `swift run OpenClaw` (hoặc Xcode)
- Đóng gói ứng dụng: `scripts/package-mac-app.sh`

## Gỡ lỗi kết nối Gateway (macOS CLI)

Sử dụng debug CLI để kiểm tra cùng quy trình bắt tay WebSocket Gateway và logic khám phá
mà ứng dụng macOS dùng, mà không cần khởi chạy ứng dụng.

```bash
cd apps/macos
swift run openclaw-mac connect --json
swift run openclaw-mac discover --timeout 3000 --json
```

Tùy chọn kết nối:

- `--url <ws://host:port>`: ghi đè cấu hình
- `--mode <local|remote>`: resolve từ cấu hình (mặc định: config hoặc local)
- `--probe`: buộc kiểm tra sức khỏe mới
- `--timeout <ms>`: timeout yêu cầu (mặc định: `15000`)
- `--json`: đầu ra có cấu trúc để so sánh diff

Tùy chọn khám phá:

- `--include-local`: bao gồm các gateway vốn sẽ bị lọc là “local”
- `--timeout <ms>`: cửa sổ khám phá tổng thể (mặc định: `2000`)
- `--json`: đầu ra có cấu trúc để so sánh diff

Mẹo: so sánh với `openclaw gateway discover --json` để xem liệu pipeline khám phá của ứng dụng macOS (NWBrowser + fallback DNS‑SD của tailnet) có khác với khám phá dựa trên `dns-sd` của Node CLI hay không.

## Hệ thống kết nối từ xa (SSH tunnels)

Khi ứng dụng macOS chạy ở chế độ **Remote**, nó mở một đường hầm SSH để các thành phần UI cục bộ
có thể giao tiếp với Gateway từ xa như thể nó đang ở localhost.

### Control tunnel (cổng WebSocket của Gateway)

- **Mục đích:** kiểm tra sức khỏe, trạng thái, Web Chat, cấu hình và các gọi control-plane khác.
- **Cổng local:** cổng Gateway (mặc định `18789`), luôn ổn định.
- **Cổng remote:** cùng cổng Gateway trên máy chủ từ xa.
- **Hành vi:** không dùng cổng local ngẫu nhiên; ứng dụng tái sử dụng đường hầm khỏe mạnh hiện có
  hoặc khởi động lại nếu cần.
- **Hình thức SSH:** `ssh -N -L <local>:127.0.0.1:<remote>` với BatchMode +
  ExitOnForwardFailure + các tùy chọn keepalive.
- **Báo cáo IP:** đường hầm SSH dùng loopback, nên gateway sẽ thấy IP node là `127.0.0.1`. Dùng transport **Direct (ws/wss)** nếu bạn muốn IP client thực xuất hiện (xem [macOS remote access](/platforms/mac/remote)).

Các bước thiết lập xem tại [macOS remote access](/platforms/mac/remote). Chi tiết giao thức xem [Gateway protocol](/gateway/protocol).

## Tài liệu liên quan

- [Gateway runbook](/gateway)
- [Gateway (macOS)](/platforms/mac/bundled-gateway)
- [macOS permissions](/platforms/mac/permissions)
- [Canvas](/platforms/mac/canvas)
