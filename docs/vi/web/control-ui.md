---
summary: "Giao diện điều khiển trên trình duyệt cho Gateway (chat, node, cau hinh)"
read_when:
  - Bạn muốn vận hành Gateway từ trình duyệt
  - Bạn muốn truy cập Tailnet mà không cần SSH tunnel
title: "Control UI"
x-i18n:
  source_path: web/control-ui.md
  source_hash: ad239e4a4354999a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:06Z
---

# Control UI (trình duyệt)

Control UI là một ứng dụng một trang **Vite + Lit** nhỏ được Gateway phục vụ:

- mặc định: `http://<host>:18789/`
- tiền tố tùy chọn: đặt `gateway.controlUi.basePath` (ví dụ: `/openclaw`)

Nó giao tiếp **trực tiếp với Gateway WebSocket** trên cùng một cổng.

## Mở nhanh (local)

Nếu Gateway đang chạy trên cùng máy, hãy mở:

- http://127.0.0.1:18789/ (hoặc http://localhost:18789/)

Nếu trang không tải được, hãy khởi động Gateway trước: `openclaw gateway`.

Xác thực được cung cấp trong quá trình bắt tay WebSocket qua:

- `connect.params.auth.token`
- `connect.params.auth.password`
  Bảng cài đặt dashboard cho phép bạn lưu token; mật khẩu không được lưu trữ.
  Trình hướng dẫn onboarding tạo token gateway theo mặc định, vì vậy hãy dán token này tại đây khi kết nối lần đầu.

## Ghép nối thiết bị (kết nối lần đầu)

Khi bạn kết nối Control UI từ một trình duyệt hoặc thiết bị mới, Gateway
yêu cầu **phê duyệt ghép nối một lần** — ngay cả khi bạn đang ở cùng Tailnet
với `gateway.auth.allowTailscale: true`. Đây là biện pháp bảo mật để ngăn
truy cập trái phép.

**Những gì bạn sẽ thấy:** "disconnected (1008): pairing required"

**Để phê duyệt thiết bị:**

```bash
# List pending requests
openclaw devices list

# Approve by request ID
openclaw devices approve <requestId>
```

Sau khi được phê duyệt, thiết bị sẽ được ghi nhớ và không cần phê duyệt lại trừ khi
bạn thu hồi bằng `openclaw devices revoke --device <id> --role <role>`. Xem
[Devices CLI](/cli/devices) để biết về xoay vòng và thu hồi token.

**Ghi chú:**

- Kết nối local (`127.0.0.1`) được tự động phê duyệt.
- Kết nối từ xa (LAN, Tailnet, v.v.) cần phê duyệt rõ ràng.
- Mỗi hồ sơ trình duyệt tạo một ID thiết bị duy nhất, vì vậy việc đổi trình duyệt hoặc
  xóa dữ liệu trình duyệt sẽ yêu cầu ghép nối lại.

## Những gì nó có thể làm (hiện tại)

- Chat với model qua Gateway WS (`chat.history`, `chat.send`, `chat.abort`, `chat.inject`)
- Phát trực tuyến các lệnh gọi tool + thẻ đầu ra tool trực tiếp trong Chat (sự kiện agent)
- Kênh: trạng thái WhatsApp/Telegram/Discord/Slack + kênh plugin (Mattermost, v.v.) + đăng nhập QR + cau hinh theo từng kênh (`channels.status`, `web.login.*`, `config.patch`)
- Instance: danh sách hiện diện + làm mới (`system-presence`)
- Session: danh sách + ghi đè thinking/verbose theo từng session (`sessions.list`, `sessions.patch`)
- Cron jobs: liệt kê/thêm/chạy/bật/tắt + lịch sử chạy (`cron.*`)
- Skills: trạng thái, bật/tắt, cài đặt, cập nhật khóa API (`skills.*`)
- Node: danh sách + khả năng (`node.list`)
- Phê duyệt exec: chỉnh sửa allowlist gateway hoặc node + hỏi policy cho `exec host=gateway/node` (`exec.approvals.*`)
- Cau hinh: xem/chỉnh sửa `~/.openclaw/openclaw.json` (`config.get`, `config.set`)
- Cau hinh: áp dụng + khởi động lại với xác thực (`config.apply`) và đánh thức session hoạt động gần nhất
- Ghi cau hinh bao gồm cơ chế bảo vệ base-hash để tránh ghi đè các chỉnh sửa đồng thời
- Schema cau hinh + render form (`config.schema`, bao gồm schema plugin + kênh); trình chỉnh sửa Raw JSON vẫn khả dụng
- Debug: snapshot trạng thái/sức khỏe/model + nhật ký sự kiện + gọi RPC thủ công (`status`, `health`, `models.list`)
- Logs: theo dõi trực tiếp file log gateway với lọc/xuất (`logs.tail`)
- Cập nhật: chạy cập nhật package/git + khởi động lại (`update.run`) với báo cáo khởi động lại

Ghi chú bảng Cron jobs:

- Với các job cô lập, phân phối mặc định là thông báo tóm tắt. Bạn có thể chuyển sang none nếu chỉ muốn chạy nội bộ.
- Các trường kênh/đích sẽ xuất hiện khi chọn announce.

## Hành vi Chat

- `chat.send` là **không chặn**: nó xác nhận ngay với `{ runId, status: "started" }` và phản hồi được stream qua các sự kiện `chat`.
- Gửi lại với cùng `idempotencyKey` sẽ trả về `{ status: "in_flight" }` khi đang chạy, và `{ status: "ok" }` sau khi hoàn tất.
- `chat.inject` thêm một ghi chú assistant vào bản ghi session và phát sự kiện `chat` cho các cập nhật chỉ dành cho UI (không chạy agent, không gửi tới kênh).
- Dừng:
  - Nhấp **Stop** (gọi `chat.abort`)
  - Gõ `/stop` (hoặc `stop|esc|abort|wait|exit|interrupt`) để hủy ngoài băng
  - `chat.abort` hỗ trợ `{ sessionKey }` (không có `runId`) để hủy tất cả các lần chạy đang hoạt động cho session đó

## Truy cập Tailnet (khuyến nghị)

### Tailscale Serve tích hợp (ưu tiên)

Giữ Gateway trên loopback và để Tailscale Serve proxy với HTTPS:

```bash
openclaw gateway --tailscale serve
```

Mở:

- `https://<magicdns>/` (hoặc `gateway.controlUi.basePath` đã cấu hình của bạn)

Theo mặc định, các yêu cầu Serve có thể xác thực qua header định danh Tailscale
(`tailscale-user-login`) khi `gateway.auth.allowTailscale` là `true`. OpenClaw
xác minh danh tính bằng cách phân giải địa chỉ `x-forwarded-for` với
`tailscale whois` và đối chiếu với header, và chỉ chấp nhận các yêu cầu này khi
yêu cầu chạm loopback với các header `x-forwarded-*` của Tailscale. Đặt
`gateway.auth.allowTailscale: false` (hoặc buộc `gateway.auth.mode: "password"`)
nếu bạn muốn yêu cầu token/mật khẩu ngay cả với lưu lượng Serve.

### Bind vào tailnet + token

```bash
openclaw gateway --bind tailnet --token "$(openssl rand -hex 32)"
```

Sau đó mở:

- `http://<tailscale-ip>:18789/` (hoặc `gateway.controlUi.basePath` đã cấu hình của bạn)

Dán token vào phần cài đặt UI (được gửi dưới dạng `connect.params.auth.token`).

## HTTP không an toàn

Nếu bạn mở dashboard qua HTTP thuần (`http://<lan-ip>` hoặc `http://<tailscale-ip>`),
trình duyệt chạy trong **ngữ cảnh không an toàn** và chặn WebCrypto. Theo mặc định,
OpenClaw **chặn** các kết nối Control UI không có định danh thiết bị.

**Cách khắc phục khuyến nghị:** dùng HTTPS (Tailscale Serve) hoặc mở UI cục bộ:

- `https://<magicdns>/` (Serve)
- `http://127.0.0.1:18789/` (trên máy chủ gateway)

**Ví dụ hạ cấp (chỉ token qua HTTP):**

```json5
{
  gateway: {
    controlUi: { allowInsecureAuth: true },
    bind: "tailnet",
    auth: { mode: "token", token: "replace-me" },
  },
}
```

Điều này vô hiệu hóa định danh thiết bị + ghép nối cho Control UI (kể cả trên HTTPS). Chỉ sử dụng
nếu bạn tin cậy mạng.

Xem [Tailscale](/gateway/tailscale) để biết hướng dẫn thiết lập HTTPS.

## Build UI

Gateway phục vụ các file tĩnh từ `dist/control-ui`. Build chúng bằng:

```bash
pnpm ui:build # auto-installs UI deps on first run
```

Base tuyệt đối tùy chọn (khi bạn muốn URL tài nguyên cố định):

```bash
OPENCLAW_CONTROL_UI_BASE_PATH=/openclaw/ pnpm ui:build
```

Để phát triển local (máy chủ dev riêng):

```bash
pnpm ui:dev # auto-installs UI deps on first run
```

Sau đó trỏ UI tới URL Gateway WS của bạn (ví dụ: `ws://127.0.0.1:18789`).

## Debug/kiểm thử: dev server + Gateway từ xa

Control UI là các file tĩnh; đích WebSocket có thể cấu hình và có thể
khác với HTTP origin. Điều này hữu ích khi bạn muốn chạy Vite dev server
cục bộ nhưng Gateway chạy ở nơi khác.

1. Khởi động UI dev server: `pnpm ui:dev`
2. Mở một URL như:

```text
http://localhost:5173/?gatewayUrl=ws://<gateway-host>:18789
```

Xác thực một lần tùy chọn (nếu cần):

```text
http://localhost:5173/?gatewayUrl=wss://<gateway-host>:18789&token=<gateway-token>
```

Ghi chú:

- `gatewayUrl` được lưu trong localStorage sau khi tải và bị xóa khỏi URL.
- `token` được lưu trong localStorage; `password` chỉ được giữ trong bộ nhớ.
- Khi `gatewayUrl` được đặt, UI không dự phòng sang thông tin xác thực từ cau hinh hoặc biến môi trường.
  Cung cấp `token` (hoặc `password`) một cách rõ ràng. Thiếu thông tin xác thực rõ ràng là lỗi.
- Sử dụng `wss://` khi Gateway ở sau TLS (Tailscale Serve, proxy HTTPS, v.v.).
- `gatewayUrl` chỉ được chấp nhận trong cửa sổ cấp cao nhất (không nhúng) để ngăn clickjacking.
- Với các thiết lập dev cross-origin (ví dụ: `pnpm ui:dev` tới một Gateway từ xa), hãy thêm origin của UI
  vào `gateway.controlUi.allowedOrigins`.

Ví dụ:

```json5
{
  gateway: {
    controlUi: {
      allowedOrigins: ["http://localhost:5173"],
    },
  },
}
```

Chi tiết thiết lập truy cập từ xa: [Remote access](/gateway/remote).
