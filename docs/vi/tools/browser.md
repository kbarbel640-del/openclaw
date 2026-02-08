---
summary: "Dịch vụ điều khiển trình duyệt tích hợp + các lệnh hành động"
read_when:
  - Thêm tự động hóa trình duyệt do agent điều khiển
  - Gỡ lỗi vì sao openclaw đang can thiệp vào Chrome của bạn
  - Triển khai cài đặt + vòng đời trình duyệt trong ứng dụng macOS
title: "Browser (do OpenClaw quản lý)"
x-i18n:
  source_path: tools/browser.md
  source_hash: a868d040183436a1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:09:19Z
---

# Browser (openclaw-managed)

OpenClaw có thể chạy một **hồ sơ Chrome/Brave/Edge/Chromium chuyên dụng** do agent điều khiển.
Nó được tách biệt khỏi trình duyệt cá nhân của bạn và được quản lý thông qua một
dịch vụ điều khiển cục bộ nhỏ bên trong Gateway (chỉ loopback).

Góc nhìn cho người mới:

- Hãy nghĩ về nó như một **trình duyệt riêng, chỉ dành cho agent**.
- Hồ sơ `openclaw` **không** chạm vào hồ sơ trình duyệt cá nhân của bạn.
- Agent có thể **mở tab, đọc trang, nhấp và gõ** trong một làn an toàn.
- Hồ sơ mặc định `chrome` sử dụng **trình duyệt Chromium mặc định của hệ thống** qua
  extension relay; chuyển sang `openclaw` để dùng trình duyệt được quản lý, cách ly.

## Những gì bạn nhận được

- Một hồ sơ trình duyệt riêng tên **openclaw** (mặc định có điểm nhấn màu cam).
- Điều khiển tab xác định (liệt kê/mở/tập trung/đóng).
- Hành động của agent (nhấp/gõ/kéo/chọn), snapshot, ảnh chụp màn hình, PDF.
- Hỗ trợ đa hồ sơ tùy chọn (`openclaw`, `work`, `remote`, ...).

Trình duyệt này **không** phải là trình duyệt dùng hằng ngày. Nó là một bề mặt an toàn, cách ly
cho tự động hóa và xác minh bởi agent.

## Khoi dong nhanh

```bash
openclaw browser --browser-profile openclaw status
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

Nếu bạn thấy “Browser disabled”, hãy bật nó trong cấu hình (xem bên dưới) và khởi động lại
Gateway.

## Hồ sơ: `openclaw` vs `chrome`

- `openclaw`: trình duyệt được quản lý, cách ly (không cần extension).
- `chrome`: extension relay tới **trình duyệt hệ thống** của bạn (yêu cầu extension OpenClaw
  được gắn vào một tab).

Đặt `browser.defaultProfile: "openclaw"` nếu bạn muốn chế độ managed làm mặc định.

## Cấu hình

Cài đặt trình duyệt nằm trong `~/.openclaw/openclaw.json`.

```json5
{
  browser: {
    enabled: true, // default: true
    // cdpUrl: "http://127.0.0.1:18792", // legacy single-profile override
    remoteCdpTimeoutMs: 1500, // remote CDP HTTP timeout (ms)
    remoteCdpHandshakeTimeoutMs: 3000, // remote CDP WebSocket handshake timeout (ms)
    defaultProfile: "chrome",
    color: "#FF4500",
    headless: false,
    noSandbox: false,
    attachOnly: false,
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    profiles: {
      openclaw: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" },
    },
  },
}
```

Ghi chú:

- Dịch vụ điều khiển trình duyệt bind vào loopback trên một cổng suy ra từ `gateway.port`
  (mặc định: `18791`, tức gateway + 2). Relay dùng cổng kế tiếp (`18792`).
- Nếu bạn ghi đè cổng Gateway (`gateway.port` hoặc `OPENCLAW_GATEWAY_PORT`),
  các cổng trình duyệt suy ra sẽ dịch chuyển để vẫn nằm trong cùng “họ”.
- `cdpUrl` mặc định là cổng relay khi không được đặt.
- `remoteCdpTimeoutMs` áp dụng cho kiểm tra khả năng truy cập CDP từ xa (không loopback).
- `remoteCdpHandshakeTimeoutMs` áp dụng cho kiểm tra khả năng truy cập WebSocket CDP từ xa.
- `attachOnly: true` nghĩa là “không bao giờ khởi chạy trình duyệt cục bộ; chỉ gắn nếu nó đã chạy.”
- `color` + `color` theo từng hồ sơ tô màu UI trình duyệt để bạn biết hồ sơ nào đang hoạt động.
- Hồ sơ mặc định là `chrome` (extension relay). Dùng `defaultProfile: "openclaw"` cho trình duyệt được quản lý.
- Thứ tự tự phát hiện: trình duyệt mặc định hệ thống nếu là Chromium; nếu không thì Chrome → Brave → Edge → Chromium → Chrome Canary.
- Các hồ sơ `openclaw` cục bộ tự gán `cdpPort`/`cdpUrl` — chỉ đặt các giá trị này cho CDP từ xa.

## Dùng Brave (hoặc trình duyệt dựa trên Chromium khác)

Nếu trình duyệt **mặc định của hệ thống** là Chromium (Chrome/Brave/Edge/etc),
OpenClaw sẽ tự động dùng nó. Đặt `browser.executablePath` để ghi đè
tự phát hiện:

Ví dụ CLI:

```bash
openclaw config set browser.executablePath "/usr/bin/google-chrome"
```

```json5
// macOS
{
  browser: {
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  }
}

// Windows
{
  browser: {
    executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
  }
}

// Linux
{
  browser: {
    executablePath: "/usr/bin/brave-browser"
  }
}
```

## Điều khiển cục bộ vs từ xa

- **Điều khiển cục bộ (mặc định):** Gateway khởi động dịch vụ điều khiển loopback và có thể mở trình duyệt cục bộ.
- **Điều khiển từ xa (node host):** chạy node host trên máy có trình duyệt; Gateway proxy các hành động trình duyệt tới đó.
- **CDP từ xa:** đặt `browser.profiles.<name>.cdpUrl` (hoặc `browser.cdpUrl`) để
  gắn vào một trình duyệt dựa trên Chromium chạy từ xa. Trong trường hợp này, OpenClaw sẽ không khởi chạy trình duyệt cục bộ.

URL CDP từ xa có thể bao gồm xác thực:

- Token trong query (ví dụ: `https://provider.example?token=<token>`)
- HTTP Basic auth (ví dụ: `https://user:pass@provider.example`)

OpenClaw giữ nguyên xác thực khi gọi các endpoint `/json/*` và khi kết nối
tới WebSocket CDP. Ưu tiên dùng biến môi trường hoặc trình quản lý bí mật cho
token thay vì commit chúng vào file cấu hình.

## Node browser proxy (mặc định zero-config)

Nếu bạn chạy **node host** trên máy có trình duyệt, OpenClaw có thể
tự động định tuyến các lời gọi công cụ trình duyệt tới node đó mà không cần cấu hình thêm.
Đây là đường đi mặc định cho gateway từ xa.

Ghi chú:

- Node host phơi bày máy chủ điều khiển trình duyệt cục bộ của nó thông qua một **proxy command**.
- Hồ sơ lấy từ cấu hình `browser.profiles` của chính node (giống như cục bộ).
- Tắt nếu bạn không muốn:
  - Trên node: `nodeHost.browserProxy.enabled=false`
  - Trên gateway: `gateway.nodes.browser.mode="off"`

## Browserless (CDP từ xa được lưu trữ)

[Browserless](https://browserless.io) là một dịch vụ Chromium được lưu trữ, cung cấp
các endpoint CDP qua HTTPS. Bạn có thể trỏ một hồ sơ trình duyệt OpenClaw tới
endpoint khu vực của Browserless và xác thực bằng API key của bạn.

Ví dụ:

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "browserless",
    remoteCdpTimeoutMs: 2000,
    remoteCdpHandshakeTimeoutMs: 4000,
    profiles: {
      browserless: {
        cdpUrl: "https://production-sfo.browserless.io?token=<BROWSERLESS_API_KEY>",
        color: "#00AA00",
      },
    },
  },
}
```

Ghi chú:

- Thay `<BROWSERLESS_API_KEY>` bằng token Browserless thật của bạn.
- Chọn endpoint khu vực phù hợp với tài khoản Browserless của bạn (xem tài liệu của họ).

## Bảo mật

Ý chính:

- Điều khiển trình duyệt chỉ qua loopback; truy cập đi qua xác thực của Gateway hoặc ghép cặp node.
- Giữ Gateway và mọi node host trong mạng riêng (Tailscale); tránh phơi ra công khai.
- Coi URL/token CDP từ xa là bí mật; ưu tiên biến môi trường hoặc trình quản lý bí mật.

Mẹo CDP từ xa:

- Ưu tiên endpoint HTTPS và token ngắn hạn khi có thể.
- Tránh nhúng token dài hạn trực tiếp vào file cấu hình.

## Hồ sơ (đa trình duyệt)

OpenClaw hỗ trợ nhiều hồ sơ được đặt tên (cấu hình định tuyến). Hồ sơ có thể là:

- **openclaw-managed**: một phiên trình duyệt dựa trên Chromium chuyên dụng với thư mục dữ liệu người dùng + cổng CDP riêng
- **remote**: một URL CDP tường minh (trình duyệt dựa trên Chromium chạy ở nơi khác)
- **extension relay**: các tab Chrome hiện có của bạn thông qua relay cục bộ + extension Chrome

Mặc định:

- Hồ sơ `openclaw` được tự động tạo nếu thiếu.
- Hồ sơ `chrome` được tích hợp sẵn cho Chrome extension relay (mặc định trỏ tới `http://127.0.0.1:18792`).
- Cổng CDP cục bộ cấp phát từ **18800–18899** theo mặc định.
- Xóa một hồ sơ sẽ chuyển thư mục dữ liệu cục bộ của nó vào Thùng rác.

Tất cả endpoint điều khiển chấp nhận `?profile=<name>`; CLI dùng `--browser-profile`.

## Chrome extension relay (dùng Chrome hiện có của bạn)

OpenClaw cũng có thể điều khiển **các tab Chrome hiện có của bạn** (không có phiên Chrome “openclaw” riêng) thông qua relay CDP cục bộ + một extension Chrome.

Hướng dẫn đầy đủ: [Chrome extension](/tools/chrome-extension)

Luồng:

- Gateway chạy cục bộ (cùng máy) hoặc node host chạy trên máy có trình duyệt.
- Một **máy chủ relay** cục bộ lắng nghe tại một `cdpUrl` loopback (mặc định: `http://127.0.0.1:18792`).
- Bạn nhấp biểu tượng extension **OpenClaw Browser Relay** trên một tab để gắn (nó không tự gắn).
- Agent điều khiển tab đó qua công cụ `browser` thông thường, bằng cách chọn đúng hồ sơ.

Nếu Gateway chạy ở nơi khác, hãy chạy node host trên máy có trình duyệt để Gateway có thể proxy các hành động trình duyệt.

### Phiên trong sandbox

Nếu phiên agent nằm trong sandbox, công cụ `browser` có thể mặc định là `target="sandbox"` (trình duyệt sandbox).
Việc takeover Chrome extension relay yêu cầu điều khiển trình duyệt host, vì vậy hoặc:

- chạy phiên không sandbox, hoặc
- đặt `agents.defaults.sandbox.browser.allowHostControl: true` và dùng `target="host"` khi gọi công cụ.

### Thiết lập

1. Tải extension (dev/unpacked):

```bash
openclaw browser extension install
```

- Chrome → `chrome://extensions` → bật “Developer mode”
- “Load unpacked” → chọn thư mục được in bởi `openclaw browser extension path`
- Ghim extension, sau đó nhấp vào nó trên tab bạn muốn điều khiển (huy hiệu hiển thị `ON`).

2. Sử dụng:

- CLI: `openclaw browser --browser-profile chrome tabs`
- Công cụ agent: `browser` với `profile="chrome"`

Tùy chọn: nếu bạn muốn tên khác hoặc cổng relay khác, hãy tạo hồ sơ riêng:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

Ghi chú:

- Chế độ này dựa vào Playwright-on-CDP cho hầu hết thao tác (ảnh chụp/snapshot/hành động).
- Tháo gắn bằng cách nhấp lại biểu tượng extension.

## Bảo đảm cách ly

- **Thư mục dữ liệu người dùng riêng**: không bao giờ chạm vào hồ sơ trình duyệt cá nhân của bạn.
- **Cổng riêng**: tránh `9222` để ngăn va chạm với luồng dev.
- **Điều khiển tab xác định**: nhắm tab bằng `targetId`, không phải “tab cuối”.

## Chọn trình duyệt

Khi khởi chạy cục bộ, OpenClaw chọn cái đầu tiên khả dụng:

1. Chrome
2. Brave
3. Edge
4. Chromium
5. Chrome Canary

Bạn có thể ghi đè bằng `browser.executablePath`.

Nền tảng:

- macOS: kiểm tra `/Applications` và `~/Applications`.
- Linux: tìm `google-chrome`, `brave`, `microsoft-edge`, `chromium`, v.v.
- Windows: kiểm tra các vị trí cài đặt phổ biến.

## Control API (tùy chọn)

Chỉ cho tích hợp cục bộ, Gateway cung cấp một HTTP API loopback nhỏ:

- Trạng thái/bắt đầu/dừng: `GET /`, `POST /start`, `POST /stop`
- Tab: `GET /tabs`, `POST /tabs/open`, `POST /tabs/focus`, `DELETE /tabs/:targetId`
- Snapshot/ảnh chụp: `GET /snapshot`, `POST /screenshot`
- Hành động: `POST /navigate`, `POST /act`
- Hooks: `POST /hooks/file-chooser`, `POST /hooks/dialog`
- Tải xuống: `POST /download`, `POST /wait/download`
- Gỡ lỗi: `GET /console`, `POST /pdf`
- Gỡ lỗi: `GET /errors`, `GET /requests`, `POST /trace/start`, `POST /trace/stop`, `POST /highlight`
- Mạng: `POST /response/body`
- Trạng thái: `GET /cookies`, `POST /cookies/set`, `POST /cookies/clear`
- Trạng thái: `GET /storage/:kind`, `POST /storage/:kind/set`, `POST /storage/:kind/clear`
- Cài đặt: `POST /set/offline`, `POST /set/headers`, `POST /set/credentials`, `POST /set/geolocation`, `POST /set/media`, `POST /set/timezone`, `POST /set/locale`, `POST /set/device`

Tất cả endpoint chấp nhận `?profile=<name>`.

### Yêu cầu Playwright

Một số tính năng (điều hướng/hành động/AI snapshot/role snapshot, ảnh chụp phần tử, PDF) yêu cầu
Playwright. Nếu Playwright chưa được cài, các endpoint đó trả về lỗi 501 rõ ràng.
ARIA snapshot và ảnh chụp cơ bản vẫn hoạt động cho Chrome do openclaw quản lý.
Đối với driver Chrome extension relay, ARIA snapshot và ảnh chụp yêu cầu Playwright.

Nếu bạn thấy `Playwright is not available in this gateway build`, hãy cài gói
Playwright đầy đủ (không phải `playwright-core`) và khởi động lại gateway, hoặc cài lại
OpenClaw với hỗ trợ trình duyệt.

#### Cài Playwright cho Docker

Nếu Gateway của bạn chạy trong Docker, tránh `npx playwright` (xung đột override npm).
Hãy dùng CLI đi kèm:

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Để lưu trữ tải xuống của trình duyệt, đặt `PLAYWRIGHT_BROWSERS_PATH` (ví dụ,
`/home/node/.cache/ms-playwright`) và đảm bảo `/home/node` được persist thông qua
`OPENCLAW_HOME_VOLUME` hoặc bind mount. Xem [Docker](/install/docker).

## Cách hoạt động (nội bộ)

Luồng cấp cao:

- Một **máy chủ điều khiển** nhỏ nhận các yêu cầu HTTP.
- Nó kết nối tới các trình duyệt dựa trên Chromium (Chrome/Brave/Edge/Chromium) qua **CDP**.
- Với các hành động nâng cao (nhấp/gõ/snapshot/PDF), nó dùng **Playwright** chồng lên CDP.
- Khi thiếu Playwright, chỉ các thao tác không dùng Playwright khả dụng.

Thiết kế này giữ cho agent có một giao diện ổn định, xác định trong khi cho phép
bạn hoán đổi trình duyệt và hồ sơ cục bộ/từ xa.

## Tham chiếu nhanh CLI

Tất cả lệnh chấp nhận `--browser-profile <name>` để nhắm một hồ sơ cụ thể.
Tất cả lệnh cũng chấp nhận `--json` cho đầu ra có thể đọc bằng máy (payload ổn định).

Cơ bản:

- `openclaw browser status`
- `openclaw browser start`
- `openclaw browser stop`
- `openclaw browser tabs`
- `openclaw browser tab`
- `openclaw browser tab new`
- `openclaw browser tab select 2`
- `openclaw browser tab close 2`
- `openclaw browser open https://example.com`
- `openclaw browser focus abcd1234`
- `openclaw browser close abcd1234`

Kiểm tra:

- `openclaw browser screenshot`
- `openclaw browser screenshot --full-page`
- `openclaw browser screenshot --ref 12`
- `openclaw browser screenshot --ref e12`
- `openclaw browser snapshot`
- `openclaw browser snapshot --format aria --limit 200`
- `openclaw browser snapshot --interactive --compact --depth 6`
- `openclaw browser snapshot --efficient`
- `openclaw browser snapshot --labels`
- `openclaw browser snapshot --selector "#main" --interactive`
- `openclaw browser snapshot --frame "iframe#main" --interactive`
- `openclaw browser console --level error`
- `openclaw browser errors --clear`
- `openclaw browser requests --filter api --clear`
- `openclaw browser pdf`
- `openclaw browser responsebody "**/api" --max-chars 5000`

Hành động:

- `openclaw browser navigate https://example.com`
- `openclaw browser resize 1280 720`
- `openclaw browser click 12 --double`
- `openclaw browser click e12 --double`
- `openclaw browser type 23 "hello" --submit`
- `openclaw browser press Enter`
- `openclaw browser hover 44`
- `openclaw browser scrollintoview e12`
- `openclaw browser drag 10 11`
- `openclaw browser select 9 OptionA OptionB`
- `openclaw browser download e12 /tmp/report.pdf`
- `openclaw browser waitfordownload /tmp/report.pdf`
- `openclaw browser upload /tmp/file.pdf`
- `openclaw browser fill --fields '[{"ref":"1","type":"text","value":"Ada"}]'`
- `openclaw browser dialog --accept`
- `openclaw browser wait --text "Done"`
- `openclaw browser wait "#main" --url "**/dash" --load networkidle --fn "window.ready===true"`
- `openclaw browser evaluate --fn '(el) => el.textContent' --ref 7`
- `openclaw browser highlight e12`
- `openclaw browser trace start`
- `openclaw browser trace stop`

Trạng thái:

- `openclaw browser cookies`
- `openclaw browser cookies set session abc123 --url "https://example.com"`
- `openclaw browser cookies clear`
- `openclaw browser storage local get`
- `openclaw browser storage local set theme dark`
- `openclaw browser storage session clear`
- `openclaw browser set offline on`
- `openclaw browser set headers --json '{"X-Debug":"1"}'`
- `openclaw browser set credentials user pass`
- `openclaw browser set credentials --clear`
- `openclaw browser set geo 37.7749 -122.4194 --origin "https://example.com"`
- `openclaw browser set geo --clear`
- `openclaw browser set media dark`
- `openclaw browser set timezone America/New_York`
- `openclaw browser set locale en-US`
- `openclaw browser set device "iPhone 14"`

Ghi chú:

- `upload` và `dialog` là các lệnh **arming**; chạy chúng trước thao tác click/press
  kích hoạt chooser/dialog.
- `upload` cũng có thể đặt trực tiếp file input qua `--input-ref` hoặc `--element`.
- `snapshot`:
  - `--format ai` (mặc định khi Playwright được cài): trả về AI snapshot với ref số (`aria-ref="<n>"`).
  - `--format aria`: trả về cây trợ năng (không có ref; chỉ để kiểm tra).
  - `--efficient` (hoặc `--mode efficient`): preset role snapshot gọn (tương tác + gọn + độ sâu + maxChars thấp).
  - Mặc định cấu hình (chỉ tool/CLI): đặt `browser.snapshotDefaults.mode: "efficient"` để dùng snapshot hiệu quả khi caller không truyền mode (xem [Gateway configuration](/gateway/configuration#browser-openclaw-managed-browser)).
  - Tùy chọn role snapshot (`--interactive`, `--compact`, `--depth`, `--selector`) ép dùng snapshot dựa trên role với ref như `ref=e12`.
  - `--frame "<iframe selector>"` giới hạn role snapshot vào một iframe (kết hợp với role ref như `e12`).
  - `--interactive` xuất danh sách phẳng, dễ chọn các phần tử tương tác (tốt nhất để điều khiển hành động).
  - `--labels` thêm ảnh chụp chỉ viewport với nhãn ref phủ lên (in `MEDIA:<path>`).
- `click`/`type`/v.v. yêu cầu một `ref` từ `snapshot` (hoặc ref số `12` hoặc role ref `e12`).
  Bộ chọn CSS cố ý không được hỗ trợ cho hành động.

## Snapshot và ref

OpenClaw hỗ trợ hai kiểu “snapshot”:

- **AI snapshot (ref số)**: `openclaw browser snapshot` (mặc định; `--format ai`)
  - Đầu ra: snapshot văn bản có bao gồm ref số.
  - Hành động: `openclaw browser click 12`, `openclaw browser type 23 "hello"`.
  - Nội bộ, ref được phân giải qua `aria-ref` của Playwright.

- **Role snapshot (role ref như `e12`)**: `openclaw browser snapshot --interactive` (hoặc `--compact`, `--depth`, `--selector`, `--frame`)
  - Đầu ra: danh sách/cây dựa trên role với `[ref=e12]` (và `[nth=1]` tùy chọn).
  - Hành động: `openclaw browser click e12`, `openclaw browser highlight e12`.
  - Nội bộ, ref được phân giải qua `getByRole(...)` (cộng `nth()` cho trùng lặp).
  - Thêm `--labels` để kèm ảnh chụp viewport với nhãn `e12` phủ lên.

Hành vi ref:

- Ref **không ổn định qua các lần điều hướng**; nếu có lỗi, hãy chạy lại `snapshot` và dùng ref mới.
- Nếu role snapshot được chụp với `--frame`, role ref sẽ bị giới hạn trong iframe đó cho tới role snapshot tiếp theo.

## Power-up chờ

Bạn có thể chờ nhiều thứ hơn chỉ thời gian/văn bản:

- Chờ URL (glob được Playwright hỗ trợ):
  - `openclaw browser wait --url "**/dash"`
- Chờ trạng thái tải:
  - `openclaw browser wait --load networkidle`
- Chờ một predicate JS:
  - `openclaw browser wait --fn "window.ready===true"`
- Chờ một selector trở nên hiển thị:
  - `openclaw browser wait "#main"`

Có thể kết hợp:

```bash
openclaw browser wait "#main" \
  --url "**/dash" \
  --load networkidle \
  --fn "window.ready===true" \
  --timeout-ms 15000
```

## Quy trình gỡ lỗi

Khi một hành động thất bại (ví dụ “không hiển thị”, “vi phạm strict mode”, “bị che”):

1. `openclaw browser snapshot --interactive`
2. Dùng `click <ref>` / `type <ref>` (ưu tiên role ref trong chế độ tương tác)
3. Nếu vẫn lỗi: `openclaw browser highlight <ref>` để xem Playwright đang nhắm vào đâu
4. Nếu trang hoạt động bất thường:
   - `openclaw browser errors --clear`
   - `openclaw browser requests --filter api --clear`
5. Gỡ lỗi sâu: ghi trace:
   - `openclaw browser trace start`
   - tái hiện sự cố
   - `openclaw browser trace stop` (in `TRACE:<path>`)

## Đầu ra JSON

`--json` dành cho scripting và công cụ có cấu trúc.

Ví dụ:

```bash
openclaw browser status --json
openclaw browser snapshot --interactive --json
openclaw browser requests --filter api --json
openclaw browser cookies --json
```

Role snapshot ở dạng JSON bao gồm `refs` cùng một khối `stats` nhỏ (dòng/ký tự/ref/tương tác) để công cụ có thể suy luận kích thước và mật độ payload.

## Núm trạng thái và môi trường

Hữu ích cho các luồng “làm cho site hành xử như X”:

- Cookie: `cookies`, `cookies set`, `cookies clear`
- Lưu trữ: `storage local|session get|set|clear`
- Ngoại tuyến: `set offline on|off`
- Header: `set headers --json '{"X-Debug":"1"}'` (hoặc `--clear`)
- HTTP basic auth: `set credentials user pass` (hoặc `--clear`)
- Định vị: `set geo <lat> <lon> --origin "https://example.com"` (hoặc `--clear`)
- Media: `set media dark|light|no-preference|none`
- Múi giờ / ngôn ngữ: `set timezone ...`, `set locale ...`
- Thiết bị / viewport:
  - `set device "iPhone 14"` (preset thiết bị Playwright)
  - `set viewport 1280 720`

## Bảo mật & quyền riêng tư

- Hồ sơ trình duyệt openclaw có thể chứa phiên đã đăng nhập; hãy coi là nhạy cảm.
- `browser act kind=evaluate` / `openclaw browser evaluate` và `wait --fn`
  thực thi JavaScript tùy ý trong ngữ cảnh trang. Prompt injection có thể điều hướng
  điều này. Tắt bằng `browser.evaluateEnabled=false` nếu bạn không cần.
- Với đăng nhập và ghi chú chống bot (X/Twitter, v.v.), xem [Browser login + X/Twitter posting](/tools/browser-login).
- Giữ Gateway/node host ở chế độ riêng tư (chỉ loopback hoặc trong tailnet).
- Endpoint CDP từ xa rất mạnh; hãy tunnel và bảo vệ chúng.

## Xu ly su co

Với các vấn đề riêng cho Linux (đặc biệt Chromium dạng snap), xem
[Browser troubleshooting](/tools/browser-linux-troubleshooting).

## Công cụ agent + cách điều khiển hoạt động

Agent nhận **một công cụ** cho tự động hóa trình duyệt:

- `browser` — trạng thái/bắt đầu/dừng/tab/mở/tập trung/đóng/snapshot/ảnh chụp/điều hướng/hành động

Ánh xạ:

- `browser snapshot` trả về cây UI ổn định (AI hoặc ARIA).
- `browser act` dùng ID `ref` của snapshot để nhấp/gõ/kéo/chọn.
- `browser screenshot` chụp pixel (toàn trang hoặc phần tử).
- `browser` chấp nhận:
  - `profile` để chọn hồ sơ trình duyệt theo tên (openclaw, chrome, hoặc CDP từ xa).
  - `target` (`sandbox` | `host` | `node`) để chọn nơi trình duyệt tồn tại.
  - Trong phiên sandbox, `target: "host"` yêu cầu `agents.defaults.sandbox.browser.allowHostControl=true`.
  - Nếu bỏ `target`: phiên sandbox mặc định là `sandbox`, phiên không sandbox mặc định là `host`.
  - Nếu có node có khả năng trình duyệt được kết nối, công cụ có thể tự động định tuyến tới đó trừ khi bạn ghim `target="host"` hoặc `target="node"`.

Điều này giữ cho agent mang tính xác định và tránh các selector mong manh.
