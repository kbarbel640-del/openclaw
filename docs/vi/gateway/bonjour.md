---
summary: "Kham pha Bonjour/mDNS + gỡ lỗi (beacon Gateway, client và các chế độ lỗi phổ biến)"
read_when:
  - Gỡ lỗi các vấn đề khám phá Bonjour trên macOS/iOS
  - Thay đổi loại dịch vụ mDNS, bản ghi TXT hoặc UX khám phá
title: "Kham pha Bonjour"
x-i18n:
  source_path: gateway/bonjour.md
  source_hash: 47569da55f0c0523
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:15Z
---

# Kham pha Bonjour / mDNS

OpenClaw sử dụng Bonjour (mDNS / DNS‑SD) như một **tiện ích chỉ trong LAN** để khám phá
một Gateway đang hoạt động (điểm cuối WebSocket). Cơ chế này mang tính best‑effort và **không**
thay thế cho SSH hay kết nối dựa trên Tailnet.

## Bonjour phạm vi rộng (Unicast DNS‑SD) qua Tailscale

Nếu node và Gateway ở trên các mạng khác nhau, multicast mDNS sẽ không vượt qua
ranh giới mạng. Bạn có thể giữ nguyên UX khám phá bằng cách chuyển sang **unicast DNS‑SD**
("Wide‑Area Bonjour") qua Tailscale.

Các bước ở mức cao:

1. Chạy một máy chủ DNS trên máy host Gateway (có thể truy cập qua Tailnet).
2. Xuất bản các bản ghi DNS‑SD cho `_openclaw-gw._tcp` dưới một zone riêng
   (ví dụ: `openclaw.internal.`).
3. Cấu hình **split DNS** của Tailscale để domain đã chọn được phân giải qua
   máy chủ DNS đó cho client (bao gồm iOS).

OpenClaw hỗ trợ mọi domain khám phá; `openclaw.internal.` chỉ là ví dụ.
Các node iOS/Android duyệt cả `local.` và domain phạm vi rộng bạn đã cấu hình.

### Cau hinh Gateway (khuyến nghị)

```json5
{
  gateway: { bind: "tailnet" }, // tailnet-only (recommended)
  discovery: { wideArea: { enabled: true } }, // enables wide-area DNS-SD publishing
}
```

### Thiết lập máy chủ DNS một lần (máy host Gateway)

```bash
openclaw dns setup --apply
```

Thao tác này cài đặt CoreDNS và cấu hình để:

- lắng nghe cổng 53 chỉ trên các giao diện Tailscale của Gateway
- phục vụ domain đã chọn (ví dụ: `openclaw.internal.`) từ `~/.openclaw/dns/<domain>.db`

Xác thực từ một máy đã kết nối tailnet:

```bash
dns-sd -B _openclaw-gw._tcp openclaw.internal.
dig @<TAILNET_IPV4> -p 53 _openclaw-gw._tcp.openclaw.internal PTR +short
```

### Cài đặt DNS của Tailscale

Trong bảng điều khiển quản trị Tailscale:

- Thêm một nameserver trỏ tới IP tailnet của Gateway (UDP/TCP 53).
- Thêm split DNS để domain khám phá của bạn dùng nameserver đó.

Khi client chấp nhận DNS của tailnet, các node iOS có thể duyệt
`_openclaw-gw._tcp` trong domain khám phá của bạn mà không cần multicast.

### Bảo mật listener của Gateway (khuyến nghị)

Cổng WS của Gateway (mặc định `18789`) mặc định bind vào loopback. Để truy cập LAN/tailnet,
hãy bind rõ ràng và giữ bật xác thực.

Đối với thiết lập chỉ tailnet:

- Đặt `gateway.bind: "tailnet"` trong `~/.openclaw/openclaw.json`.
- Khởi động lại Gateway (hoặc khởi động lại ứng dụng menubar trên macOS).

## Thành phần quảng bá

Chỉ Gateway quảng bá `_openclaw-gw._tcp`.

## Loại dịch vụ

- `_openclaw-gw._tcp` — beacon vận chuyển của Gateway (được dùng bởi các node macOS/iOS/Android).

## Khóa TXT (gợi ý không bí mật)

Gateway quảng bá các gợi ý nhỏ, không bí mật để giúp luồng UI thuận tiện hơn:

- `role=gateway`
- `displayName=<friendly name>`
- `lanHost=<hostname>.local`
- `gatewayPort=<port>` (Gateway WS + HTTP)
- `gatewayTls=1` (chỉ khi TLS được bật)
- `gatewayTlsSha256=<sha256>` (chỉ khi TLS được bật và có fingerprint)
- `canvasPort=<port>` (chỉ khi canvas host được bật; mặc định `18793`)
- `sshPort=<port>` (mặc định là 22 khi không bị ghi đè)
- `transport=gateway`
- `cliPath=<path>` (tùy chọn; đường dẫn tuyệt đối tới một entrypoint `openclaw` có thể chạy)
- `tailnetDns=<magicdns>` (gợi ý tùy chọn khi Tailnet khả dụng)

## Gỡ lỗi trên macOS

Các công cụ tích hợp hữu ích:

- Duyệt các instance:
  ```bash
  dns-sd -B _openclaw-gw._tcp local.
  ```
- Resolve một instance (thay `<instance>`):
  ```bash
  dns-sd -L "<instance>" _openclaw-gw._tcp local.
  ```

Nếu duyệt hoạt động nhưng resolve thất bại, thường là do chính sách LAN hoặc
vấn đề của trình phân giải mDNS.

## Gỡ lỗi trong log của Gateway

Gateway ghi một tệp log cuộn (được in khi khởi động dưới dạng
`gateway log file: ...`). Hãy tìm các dòng `bonjour:`, đặc biệt là:

- `bonjour: advertise failed ...`
- `bonjour: ... name conflict resolved` / `hostname conflict resolved`
- `bonjour: watchdog detected non-announced service ...`

## Gỡ lỗi trên node iOS

Node iOS sử dụng `NWBrowser` để khám phá `_openclaw-gw._tcp`.

Để thu thập log:

- Settings → Gateway → Advanced → **Discovery Debug Logs**
- Settings → Gateway → Advanced → **Discovery Logs** → tái hiện → **Copy**

Log bao gồm các chuyển trạng thái của trình duyệt và thay đổi tập kết quả.

## Các chế độ lỗi thường gặp

- **Bonjour không vượt qua mạng**: dùng Tailnet hoặc SSH.
- **Multicast bị chặn**: một số mạng Wi‑Fi vô hiệu hóa mDNS.
- **Ngủ / thay đổi giao diện**: macOS có thể tạm thời làm rơi kết quả mDNS; hãy thử lại.
- **Duyệt được nhưng resolve thất bại**: giữ tên máy đơn giản (tránh emoji hoặc
  dấu câu), sau đó khởi động lại Gateway. Tên instance dịch vụ được suy ra từ
  tên host, nên các tên quá phức tạp có thể làm rối một số trình phân giải.

## Tên instance đã escape (`\032`)

Bonjour/DNS‑SD thường escape các byte trong tên instance dịch vụ thành các chuỗi
`\DDD` dạng thập phân (ví dụ: dấu cách trở thành `\032`).

- Điều này là bình thường ở mức giao thức.
- UI nên giải mã để hiển thị (iOS dùng `BonjourEscapes.decode`).

## Vô hiệu hóa / cấu hình

- `OPENCLAW_DISABLE_BONJOUR=1` vô hiệu hóa quảng bá (legacy: `OPENCLAW_DISABLE_BONJOUR`).
- `gateway.bind` trong `~/.openclaw/openclaw.json` điều khiển chế độ bind của Gateway.
- `OPENCLAW_SSH_PORT` ghi đè cổng SSH được quảng bá trong TXT (legacy: `OPENCLAW_SSH_PORT`).
- `OPENCLAW_TAILNET_DNS` xuất bản gợi ý MagicDNS trong TXT (legacy: `OPENCLAW_TAILNET_DNS`).
- `OPENCLAW_CLI_PATH` ghi đè đường dẫn CLI được quảng bá (legacy: `OPENCLAW_CLI_PATH`).

## Tài liệu liên quan

- Chính sách khám phá và chọn transport: [Discovery](/gateway/discovery)
- Ghép cặp node + phê duyệt: [Gateway pairing](/gateway/pairing)
