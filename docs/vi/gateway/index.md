---
summary: "Sổ tay vận hành cho dịch vụ Gateway, vòng đời và hoạt động"
read_when:
  - Khi chạy hoặc gỡ lỗi tiến trình gateway
title: "Sổ Tay Vận Hành Gateway"
x-i18n:
  source_path: gateway/index.md
  source_hash: 497d58090faaa6bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:43Z
---

# Sổ tay vận hành dịch vụ Gateway

Cập nhật lần cuối: 2025-12-09

## Gateway là gì

- Tiến trình luôn chạy, sở hữu kết nối Baileys/Telegram duy nhất và mặt phẳng điều khiển/sự kiện.
- Thay thế lệnh kế thừa `gateway`. Điểm vào CLI: `openclaw gateway`.
- Chạy cho đến khi bị dừng; thoát với mã khác 0 khi có lỗi nghiêm trọng để supervisor khởi động lại.

## Cách chạy (local)

```bash
openclaw gateway --port 18789
# for full debug/trace logs in stdio:
openclaw gateway --port 18789 --verbose
# if the port is busy, terminate listeners then start:
openclaw gateway --force
# dev loop (auto-reload on TS changes):
pnpm gateway:watch
```

- Hot reload cấu hình theo dõi `~/.openclaw/openclaw.json` (hoặc `OPENCLAW_CONFIG_PATH`).
  - Chế độ mặc định: `gateway.reload.mode="hybrid"` (áp dụng nóng các thay đổi an toàn, khởi động lại khi критical).
  - Hot reload dùng khởi động lại trong tiến trình qua **SIGUSR1** khi cần.
  - Tắt bằng `gateway.reload.mode="off"`.
- Bind mặt phẳng điều khiển WebSocket tới `127.0.0.1:<port>` (mặc định 18789).
- Cùng cổng đó cũng phục vụ HTTP (UI điều khiển, hooks, A2UI). Ghép kênh một cổng.
  - OpenAI Chat Completions (HTTP): [`/v1/chat/completions`](/gateway/openai-http-api).
  - OpenResponses (HTTP): [`/v1/responses`](/gateway/openresponses-http-api).
  - Tools Invoke (HTTP): [`/tools/invoke`](/gateway/tools-invoke-http-api).
- Mặc định khởi động máy chủ file Canvas trên `canvasHost.port` (mặc định `18793`), phục vụ `http://<gateway-host>:18793/__openclaw__/canvas/` từ `~/.openclaw/workspace/canvas`. Tắt bằng `canvasHost.enabled=false` hoặc `OPENCLAW_SKIP_CANVAS_HOST=1`.
- Ghi log ra stdout; dùng launchd/systemd để giữ tiến trình sống và xoay vòng log.
- Truyền `--verbose` để mirror log debug (handshake, req/res, sự kiện) từ file log ra stdio khi xử lý sự cố.
- `--force` dùng `lsof` để tìm listener trên cổng đã chọn, gửi SIGTERM, ghi log những gì bị dừng, rồi khởi động gateway (fail fast nếu thiếu `lsof`).
- Nếu chạy dưới supervisor (launchd/systemd/chế độ tiến trình con của app mac), việc dừng/khởi động lại thường gửi **SIGTERM**; các bản build cũ có thể hiển thị dưới dạng `pnpm` `ELIFECYCLE` với mã thoát **143** (SIGTERM), đây là tắt bình thường, không phải crash.
- **SIGUSR1** kích hoạt khởi động lại trong tiến trình khi được ủy quyền (áp dụng/cập nhật tool/cấu hình gateway, hoặc bật `commands.restart` cho khởi động lại thủ công).
- Mặc định yêu cầu xác thực Gateway: đặt `gateway.auth.token` (hoặc `OPENCLAW_GATEWAY_TOKEN`) hoặc `gateway.auth.password`. Client phải gửi `connect.params.auth.token/password` trừ khi dùng Tailscale Serve identity.
- Trình wizard hiện tạo token theo mặc định, kể cả trên loopback.
- Thứ tự ưu tiên cổng: `--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > mặc định `18789`.

## Truy cập từ xa

- Ưu tiên Tailscale/VPN; nếu không thì dùng SSH tunnel:
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- Client sau đó kết nối tới `ws://127.0.0.1:18789` thông qua tunnel.
- Nếu có cấu hình token, client phải kèm token trong `connect.params.auth.token` ngay cả khi qua tunnel.

## Nhiều Gateway (cùng máy)

Thường không cần thiết: một Gateway có thể phục vụ nhiều kênh nhắn tin và agent. Chỉ dùng nhiều Gateway cho mục đích dự phòng hoặc cách ly nghiêm ngặt (ví dụ: bot cứu hộ).

Được hỗ trợ nếu bạn cách ly state + cấu hình và dùng các cổng riêng. Hướng dẫn đầy đủ: [Multiple gateways](/gateway/multiple-gateways).

Tên dịch vụ phụ thuộc profile:

- macOS: `bot.molt.<profile>` (bản kế thừa `com.openclaw.*` có thể vẫn tồn tại)
- Linux: `openclaw-gateway-<profile>.service`
- Windows: `OpenClaw Gateway (<profile>)`

Metadata cài đặt được nhúng trong cấu hình dịch vụ:

- `OPENCLAW_SERVICE_MARKER=openclaw`
- `OPENCLAW_SERVICE_KIND=gateway`
- `OPENCLAW_SERVICE_VERSION=<version>`

Mẫu Rescue-Bot: giữ một Gateway thứ hai được cách ly với profile, thư mục state, workspace và khoảng cách base port riêng. Hướng dẫn đầy đủ: [Rescue-bot guide](/gateway/multiple-gateways#rescue-bot-guide).

### Profile dev (`--dev`)

Đường nhanh: chạy một instance dev cách ly hoàn toàn (config/state/workspace) mà không đụng tới thiết lập chính.

```bash
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
# then target the dev instance:
openclaw --dev status
openclaw --dev health
```

Mặc định (có thể ghi đè qua env/flags/config):

- `OPENCLAW_STATE_DIR=~/.openclaw-dev`
- `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
- `OPENCLAW_GATEWAY_PORT=19001` (Gateway WS + HTTP)
- cổng dịch vụ điều khiển trình duyệt = `19003` (suy ra: `gateway.port+2`, chỉ loopback)
- `canvasHost.port=19005` (suy ra: `gateway.port+4`)
- `agents.defaults.workspace` mặc định thành `~/.openclaw/workspace-dev` khi bạn chạy `setup`/`onboard` dưới `--dev`.

Cổng suy ra (quy tắc kinh nghiệm):

- Base port = `gateway.port` (hoặc `OPENCLAW_GATEWAY_PORT` / `--port`)
- cổng dịch vụ điều khiển trình duyệt = base + 2 (chỉ loopback)
- `canvasHost.port = base + 4` (hoặc `OPENCLAW_CANVAS_HOST_PORT` / ghi đè cấu hình)
- Các cổng CDP của profile trình duyệt tự động cấp phát từ `browser.controlPort + 9 .. + 108` (được lưu theo profile).

Checklist cho mỗi instance:

- `gateway.port` duy nhất
- `OPENCLAW_CONFIG_PATH` duy nhất
- `OPENCLAW_STATE_DIR` duy nhất
- `agents.defaults.workspace` duy nhất
- số WhatsApp riêng (nếu dùng WA)

Cài đặt dịch vụ theo profile:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

Ví dụ:

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json OPENCLAW_STATE_DIR=~/.openclaw-a openclaw gateway --port 19001
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json OPENCLAW_STATE_DIR=~/.openclaw-b openclaw gateway --port 19002
```

## Giao thức (góc nhìn vận hành)

- Tài liệu đầy đủ: [Gateway protocol](/gateway/protocol) và [Bridge protocol (legacy)](/gateway/bridge-protocol).
- Frame đầu tiên bắt buộc từ client: `req {type:"req", id, method:"connect", params:{minProtocol,maxProtocol,client:{id,displayName?,version,platform,deviceFamily?,modelIdentifier?,mode,instanceId?}, caps, auth?, locale?, userAgent? } }`.
- Gateway phản hồi `res {type:"res", id, ok:true, payload:hello-ok }` (hoặc `ok:false` kèm lỗi, rồi đóng).
- Sau handshake:
  - Request: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - Event: `{type:"event", event, payload, seq?, stateVersion?}`
- Bản ghi presence có cấu trúc: `{host, ip, version, platform?, deviceFamily?, modelIdentifier?, mode, lastInputSeconds?, ts, reason?, tags?[], instanceId? }` (với client WS, `instanceId` đến từ `connect.client.instanceId`).
- Phản hồi `agent` có hai giai đoạn: đầu tiên ack `res` `{runId,status:"accepted"}`, sau đó là `res` `{runId,status:"ok"|"error",summary}` cuối cùng khi chạy xong; output stream đến dưới dạng `event:"agent"`.

## Methods (tập ban đầu)

- `health` — snapshot sức khỏe đầy đủ (cùng cấu trúc với `openclaw health --json`).
- `status` — tóm tắt ngắn.
- `system-presence` — danh sách presence hiện tại.
- `system-event` — đăng một ghi chú presence/hệ thống (có cấu trúc).
- `send` — gửi tin nhắn qua (các) kênh đang hoạt động.
- `agent` — chạy một lượt agent (stream sự kiện trả về trên cùng kết nối).
- `node.list` — liệt kê node đã ghép cặp + đang kết nối (bao gồm `caps`, `deviceFamily`, `modelIdentifier`, `paired`, `connected`, và `commands` được quảng bá).
- `node.describe` — mô tả một node (khả năng + các lệnh `node.invoke` được hỗ trợ; hoạt động cho node đã ghép cặp và node chưa ghép nhưng đang kết nối).
- `node.invoke` — gọi một lệnh trên node (ví dụ: `canvas.*`, `camera.*`).
- `node.pair.*` — vòng đời ghép cặp (`request`, `list`, `approve`, `reject`, `verify`).

Xem thêm: [Presence](/concepts/presence) để hiểu cách presence được tạo/khử trùng lặp và vì sao `client.instanceId` ổn định lại quan trọng.

## Events

- `agent` — stream sự kiện tool/output từ lượt agent (gắn seq).
- `presence` — cập nhật presence (delta với stateVersion) đẩy tới tất cả client đang kết nối.
- `tick` — keepalive/no-op định kỳ để xác nhận còn sống.
- `shutdown` — Gateway đang thoát; payload gồm `reason` và tùy chọn `restartExpectedMs`. Client nên kết nối lại.

## Tích hợp WebChat

- WebChat là UI SwiftUI gốc, nói chuyện trực tiếp với Gateway WebSocket cho lịch sử, gửi, hủy và sự kiện.
- Dùng từ xa đi qua cùng tunnel SSH/Tailscale; nếu có token gateway, client gửi kèm trong `connect`.
- Ứng dụng macOS kết nối qua một WS duy nhất (kết nối dùng chung); nó hydrate presence từ snapshot ban đầu và lắng nghe sự kiện `presence` để cập nhật UI.

## Đánh kiểu và xác thực

- Server xác thực mọi frame vào bằng AJV theo JSON Schema phát sinh từ định nghĩa giao thức.
- Client (TS/Swift) dùng các kiểu được sinh (TS dùng trực tiếp; Swift qua generator của repo).
- Định nghĩa giao thức là nguồn chân lý; tạo lại schema/model bằng:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`

## Snapshot kết nối

- `hello-ok` bao gồm `snapshot` với `presence`, `health`, `stateVersion` và `uptimeMs` cùng `policy {maxPayload,maxBufferedBytes,tickIntervalMs}` để client render ngay mà không cần request thêm.
- `health`/`system-presence` vẫn có cho làm mới thủ công, nhưng không bắt buộc khi kết nối.

## Mã lỗi (dạng res.error)

- Lỗi dùng `{ code, message, details?, retryable?, retryAfterMs? }`.
- Mã chuẩn:
  - `NOT_LINKED` — WhatsApp chưa xác thực.
  - `AGENT_TIMEOUT` — agent không phản hồi trong thời hạn cấu hình.
  - `INVALID_REQUEST` — xác thực schema/tham số thất bại.
  - `UNAVAILABLE` — Gateway đang tắt hoặc phụ thuộc không sẵn sàng.

## Hành vi keepalive

- Sự kiện `tick` (hoặc WS ping/pong) được phát định kỳ để client biết Gateway còn sống ngay cả khi không có traffic.
- Ack gửi/agent vẫn là phản hồi riêng; không dồn vào tick.

## Replay / khoảng trống

- Sự kiện không được phát lại. Client phát hiện khoảng trống seq và nên refresh (`health` + `system-presence`) trước khi tiếp tục. WebChat và client macOS hiện tự động refresh khi có gap.

## Giám sát (ví dụ macOS)

- Dùng launchd để giữ dịch vụ sống:
  - Program: đường dẫn tới `openclaw`
  - Arguments: `gateway`
  - KeepAlive: true
  - StandardOut/Err: đường dẫn file hoặc `syslog`
- Khi lỗi, launchd sẽ khởi động lại; lỗi cấu hình nghiêm trọng nên tiếp tục thoát để người vận hành nhận ra.
- LaunchAgents theo người dùng và cần phiên đăng nhập; với setup headless hãy dùng LaunchDaemon tùy chỉnh (không đi kèm).
  - `openclaw gateway install` ghi `~/Library/LaunchAgents/bot.molt.gateway.plist`
    (hoặc `bot.molt.<profile>.plist`; bản kế thừa `com.openclaw.*` được dọn dẹp).
  - `openclaw doctor` audit cấu hình LaunchAgent và có thể cập nhật theo mặc định hiện tại.

## Quản lý dịch vụ Gateway (CLI)

Dùng Gateway CLI để cài đặt/bắt đầu/dừng/khởi động lại/trạng thái:

```bash
openclaw gateway status
openclaw gateway install
openclaw gateway stop
openclaw gateway restart
openclaw logs --follow
```

Ghi chú:

- `gateway status` thăm dò Gateway RPC mặc định bằng cổng/cấu hình đã resolve của dịch vụ (ghi đè bằng `--url`).
- `gateway status --deep` thêm quét cấp hệ thống (LaunchDaemons/system units).
- `gateway status --no-probe` bỏ qua thăm dò RPC (hữu ích khi mạng down).
- `gateway status --json` ổn định cho script.
- `gateway status` báo cáo **runtime của supervisor** (launchd/systemd đang chạy) tách biệt với **khả năng truy cập RPC** (kết nối WS + RPC trạng thái).
- `gateway status` in đường dẫn cấu hình + mục tiêu thăm dò để tránh nhầm “localhost vs bind LAN” và lệch profile.
- `gateway status` bao gồm dòng lỗi gateway cuối cùng khi dịch vụ có vẻ đang chạy nhưng cổng bị đóng.
- `logs` tail file log Gateway qua RPC (không cần `tail`/`grep` thủ công).
- Nếu phát hiện dịch vụ kiểu gateway khác, CLI sẽ cảnh báo trừ khi đó là dịch vụ profile OpenClaw.
  Chúng tôi vẫn khuyến nghị **một gateway mỗi máy** cho đa số setup; dùng profile/cổng cách ly cho dự phòng hoặc rescue bot. Xem [Multiple gateways](/gateway/multiple-gateways).
  - Dọn dẹp: `openclaw gateway uninstall` (dịch vụ hiện tại) và `openclaw doctor` (di trú bản cũ).
- `gateway install` là no-op khi đã cài; dùng `openclaw gateway install --force` để cài lại (thay đổi profile/env/path).

Ứng dụng mac đi kèm:

- OpenClaw.app có thể bundle một gateway relay dựa trên Node và cài LaunchAgent theo người dùng với nhãn
  `bot.molt.gateway` (hoặc `bot.molt.<profile>`; nhãn kế thừa `com.openclaw.*` vẫn được unload sạch).
- Để dừng sạch, dùng `openclaw gateway stop` (hoặc `launchctl bootout gui/$UID/bot.molt.gateway`).
- Để khởi động lại, dùng `openclaw gateway restart` (hoặc `launchctl kickstart -k gui/$UID/bot.molt.gateway`).
  - `launchctl` chỉ hoạt động nếu LaunchAgent đã được cài; nếu không hãy dùng `openclaw gateway install` trước.
  - Thay nhãn bằng `bot.molt.<profile>` khi chạy profile có tên.

## Giám sát (systemd user unit)

OpenClaw mặc định cài **systemd user service** trên Linux/WSL2. Chúng tôi
khuyến nghị user service cho máy một người dùng (env đơn giản hơn, cấu hình theo người dùng).
Dùng **system service** cho máy nhiều người dùng hoặc server luôn bật (không cần lingering,
giám sát dùng chung).

`openclaw gateway install` ghi user unit. `openclaw doctor` audit unit và có thể cập nhật
để khớp các mặc định khuyến nghị hiện tại.

Tạo `~/.config/systemd/user/openclaw-gateway[-<profile>].service`:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_TOKEN=
WorkingDirectory=/home/youruser

[Install]
WantedBy=default.target
```

Bật lingering (bắt buộc để user service tồn tại qua logout/idle):

```
sudo loginctl enable-linger youruser
```

Onboarding chạy bước này trên Linux/WSL2 (có thể hỏi sudo; ghi `/var/lib/systemd/linger`).
Sau đó bật dịch vụ:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```

**Phương án thay thế (system service)** – cho server luôn bật hoặc nhiều người dùng,
bạn có thể cài systemd **system** unit thay cho user unit (không cần lingering).
Tạo `/etc/systemd/system/openclaw-gateway[-<profile>].service` (sao chép unit ở trên,
chuyển `WantedBy=multi-user.target`, đặt `User=` + `WorkingDirectory=`), rồi:

```
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway[-<profile>].service
```

## Windows (WSL2)

Cài đặt trên Windows nên dùng **WSL2** và làm theo phần systemd Linux ở trên.

## Kiểm tra vận hành

- Liveness: mở WS và gửi `req:connect` → mong đợi `res` với `payload.type="hello-ok"` (kèm snapshot).
- Readiness: gọi `health` → mong đợi `ok: true` và một kênh được liên kết trong `linkChannel` (khi áp dụng).
- Debug: subscribe các sự kiện `tick` và `presence`; đảm bảo `status` hiển thị tuổi liên kết/xác thực; các entry presence hiển thị host Gateway và client đang kết nối.

## Bảo đảm an toàn

- Mặc định giả định một Gateway mỗi host; nếu chạy nhiều profile, hãy cách ly cổng/state và nhắm đúng instance.
- Không fallback sang kết nối Baileys trực tiếp; nếu Gateway down, gửi sẽ fail fast.
- Frame đầu tiên không phải connect hoặc JSON sai định dạng sẽ bị từ chối và socket bị đóng.
- Tắt graceful: phát sự kiện `shutdown` trước khi đóng; client phải xử lý đóng + kết nối lại.

## CLI helpers

- `openclaw gateway health|status` — yêu cầu health/status qua Gateway WS.
- `openclaw message send --target <num> --message "hi" [--media ...]` — gửi qua Gateway (idempotent cho WhatsApp).
- `openclaw agent --message "hi" --to <num>` — chạy một lượt agent (mặc định chờ kết quả cuối).
- `openclaw gateway call <method> --params '{"k":"v"}'` — gọi method thô để debug.
- `openclaw gateway stop|restart` — dừng/khởi động lại dịch vụ gateway được giám sát (launchd/systemd).
- Các lệnh helper của Gateway giả định gateway đang chạy trên `--url`; chúng không còn tự động spawn nữa.

## Hướng dẫn di trú

- Ngừng dùng `openclaw gateway` và cổng điều khiển TCP kế thừa.
- Cập nhật client để nói giao thức WS với connect bắt buộc và presence có cấu trúc.
