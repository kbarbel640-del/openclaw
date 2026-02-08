---
summary: "Chrome extension: cho phép OpenClaw điều khiển tab Chrome hiện có của bạn"
read_when:
  - Bạn muốn tác tử điều khiển một tab Chrome hiện có (nút trên thanh công cụ)
  - Bạn cần Gateway từ xa + tự động hóa trình duyệt cục bộ qua Tailscale
  - Bạn muốn hiểu các tác động bảo mật của việc chiếm quyền điều khiển trình duyệt
title: "Chrome Extension"
x-i18n:
  source_path: tools/chrome-extension.md
  source_hash: 3b77bdad7d3dab6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:44Z
---

# Chrome extension (browser relay)

Chrome extension của OpenClaw cho phép tác tử điều khiển **các tab Chrome hiện có** (cửa sổ Chrome thông thường của bạn) thay vì khởi chạy một hồ sơ Chrome riêng do openclaw quản lý.

Việc gắn/tách được thực hiện thông qua **một nút duy nhất trên thanh công cụ Chrome**.

## Nó là gì (khái niệm)

Có ba phần:

- **Browser control service** (Gateway hoặc node): API mà tác tử/công cụ gọi (thông qua Gateway)
- **Local relay server** (loopback CDP): cầu nối giữa máy chủ điều khiển và extension (`http://127.0.0.1:18792` theo mặc định)
- **Chrome MV3 extension**: gắn vào tab đang hoạt động bằng `chrome.debugger` và chuyển tiếp các thông điệp CDP tới relay

Sau đó OpenClaw điều khiển tab đã gắn thông qua bề mặt công cụ `browser` tiêu chuẩn (chọn đúng hồ sơ).

## Cài đặt / tải (unpacked)

1. Cài đặt extension vào một đường dẫn cục bộ ổn định:

```bash
openclaw browser extension install
```

2. In ra đường dẫn thư mục extension đã cài đặt:

```bash
openclaw browser extension path
```

3. Chrome → `chrome://extensions`

- Bật “Developer mode”
- “Load unpacked” → chọn thư mục đã in ở trên

4. Ghim extension.

## Cập nhật (không có bước build)

Extension được đóng gói bên trong bản phát hành OpenClaw (gói npm) dưới dạng các tệp tĩnh. Không có bước “build” riêng.

Sau khi nâng cấp OpenClaw:

- Chạy lại `openclaw browser extension install` để làm mới các tệp đã cài dưới thư mục trạng thái OpenClaw của bạn.
- Chrome → `chrome://extensions` → nhấp “Reload” trên extension.

## Sử dụng (không cần cấu hình thêm)

OpenClaw đi kèm một hồ sơ trình duyệt tích hợp có tên `chrome` nhắm tới extension relay trên cổng mặc định.

Sử dụng như sau:

- CLI: `openclaw browser --browser-profile chrome tabs`
- Công cụ tác tử: `browser` với `profile="chrome"`

Nếu bạn muốn tên khác hoặc cổng relay khác, hãy tạo hồ sơ của riêng bạn:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

## Gắn / tách (nút trên thanh công cụ)

- Mở tab mà bạn muốn OpenClaw điều khiển.
- Nhấp vào biểu tượng extension.
  - Huy hiệu hiển thị `ON` khi đã gắn.
- Nhấp lại để tách.

## Nó điều khiển tab nào?

- Nó **không** tự động điều khiển “bất kỳ tab nào bạn đang xem”.
- Nó chỉ điều khiển **những tab bạn đã gắn rõ ràng** bằng cách nhấp nút trên thanh công cụ.
- Để chuyển: mở tab khác và nhấp biểu tượng extension tại đó.

## Huy hiệu + lỗi thường gặp

- `ON`: đã gắn; OpenClaw có thể điều khiển tab đó.
- `…`: đang kết nối tới relay cục bộ.
- `!`: không thể truy cập relay (phổ biến nhất: máy chủ browser relay không chạy trên máy này).

Nếu bạn thấy `!`:

- Đảm bảo Gateway đang chạy cục bộ (thiết lập mặc định), hoặc chạy một node host trên máy này nếu Gateway chạy ở nơi khác.
- Mở trang Options của extension; trang này hiển thị relay có thể truy cập hay không.

## Gateway từ xa (sử dụng node host)

### Gateway cục bộ (cùng máy với Chrome) — thường **không cần bước bổ sung**

Nếu Gateway chạy trên cùng máy với Chrome, nó sẽ khởi động browser control service trên loopback
và tự động khởi động relay server. Extension nói chuyện với relay cục bộ; các lệnh CLI/công cụ được gửi tới Gateway.

### Gateway từ xa (Gateway chạy ở nơi khác) — **chạy một node host**

Nếu Gateway của bạn chạy trên máy khác, hãy khởi động một node host trên máy chạy Chrome.
Gateway sẽ chuyển tiếp các hành động trình duyệt tới node đó; extension + relay vẫn ở cục bộ trên máy trình duyệt.

Nếu có nhiều node được kết nối, hãy ghim một node bằng `gateway.nodes.browser.node` hoặc đặt `gateway.nodes.browser.mode`.

## Sandboxing (tool containers)

Nếu phiên tác tử của bạn được sandboxed (`agents.defaults.sandbox.mode != "off"`), công cụ `browser` có thể bị hạn chế:

- Theo mặc định, các phiên sandboxed thường nhắm tới **sandbox browser** (`target="sandbox"`), không phải Chrome trên host của bạn.
- Việc chiếm quyền điều khiển Chrome extension relay yêu cầu kiểm soát browser control server của **host**.

Các lựa chọn:

- Dễ nhất: sử dụng extension từ một phiên/tác tử **không sandboxed**.
- Hoặc cho phép kiểm soát trình duyệt host cho các phiên sandboxed:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

Sau đó đảm bảo công cụ không bị chặn bởi chính sách công cụ, và (nếu cần) gọi `browser` với `target="host"`.

Gỡ lỗi: `openclaw sandbox explain`

## Mẹo truy cập từ xa

- Giữ Gateway và node host trên cùng một tailnet; tránh phơi bày các cổng relay ra LAN hoặc Internet công cộng.
- Ghép cặp node một cách có chủ ý; tắt định tuyến proxy trình duyệt nếu bạn không muốn điều khiển từ xa (`gateway.nodes.browser.mode="off"`).

## Cách hoạt động của “extension path”

`openclaw browser extension path` in ra thư mục **đã cài đặt** trên đĩa chứa các tệp extension.

CLI cố ý **không** in ra một đường dẫn `node_modules`. Luôn chạy `openclaw browser extension install` trước để sao chép extension tới một vị trí ổn định dưới thư mục trạng thái OpenClaw của bạn.

Nếu bạn di chuyển hoặc xóa thư mục cài đặt đó, Chrome sẽ đánh dấu extension là bị hỏng cho đến khi bạn tải lại từ một đường dẫn hợp lệ.

## Tác động bảo mật (hãy đọc)

Điều này rất mạnh mẽ và rủi ro. Hãy coi nó như việc trao cho mô hình “đôi tay trên trình duyệt của bạn”.

- Extension sử dụng debugger API của Chrome (`chrome.debugger`). Khi đã gắn, mô hình có thể:
  - nhấp/gõ/điều hướng trong tab đó
  - đọc nội dung trang
  - truy cập mọi thứ mà phiên đăng nhập của tab đó có thể truy cập
- **Điều này không được cô lập** như hồ sơ openclaw-managed chuyên dụng.
  - Nếu bạn gắn vào hồ sơ/tab dùng hằng ngày, bạn đang cấp quyền truy cập vào trạng thái tài khoản đó.

Khuyến nghị:

- Ưu tiên một hồ sơ Chrome chuyên dụng (tách biệt với việc duyệt cá nhân) cho việc sử dụng extension relay.
- Giữ Gateway và mọi node host chỉ trong tailnet; dựa vào xác thực Gateway + ghép cặp node.
- Tránh phơi bày các cổng relay qua LAN (`0.0.0.0`) và tránh Funnel (công khai).
- Relay chặn các origin không phải extension và yêu cầu một token xác thực nội bộ cho các CDP client.

Liên quan:

- Tổng quan công cụ trình duyệt: [Browser](/tools/browser)
- Kiểm toán bảo mật: [Security](/gateway/security)
- Thiết lập Tailscale: [Tailscale](/gateway/tailscale)
