---
summary: "Luồng ứng dụng macOS để điều khiển một Gateway OpenClaw từ xa qua SSH"
read_when:
  - Thiet lap hoac xu ly su co dieu khien mac tu xa
title: "Dieu Khien Tu Xa"
x-i18n:
  source_path: platforms/mac/remote.md
  source_hash: 61b43707250d5515
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:00Z
---

# OpenClaw tu xa (macOS ⇄ may chu tu xa)

Luồng này cho phép ứng dụng macOS hoạt động như một bộ điều khiển từ xa đầy đủ cho một Gateway OpenClaw chạy trên máy khác (desktop/server). Đây là tính năng **Remote over SSH** (chạy từ xa) của ứng dụng. Tất cả tính năng—kiểm tra tình trạng, chuyển tiếp Voice Wake và Web Chat—đều dùng chung cấu hình SSH từ xa trong _Settings → General_.

## Chế độ

- **Local (this Mac)**: Mọi thứ chạy trên laptop. Không dùng SSH.
- **Remote over SSH (default)**: Các lệnh OpenClaw được thực thi trên máy từ xa. Ứng dụng mac mở kết nối SSH với `-o BatchMode` cùng danh tính/khóa bạn chọn và một chuyển tiếp cổng cục bộ.
- **Remote direct (ws/wss)**: Không có đường hầm SSH. Ứng dụng mac kết nối trực tiếp tới URL của gateway (ví dụ qua Tailscale Serve hoặc một reverse proxy HTTPS công khai).

## Truyền tải từ xa

Chế độ remote hỗ trợ hai kiểu truyền tải:

- **SSH tunnel** (mặc định): Dùng `ssh -N -L ...` để chuyển tiếp cổng gateway về localhost. Gateway sẽ thấy IP của node là `127.0.0.1` vì đường hầm là loopback.
- **Direct (ws/wss)**: Kết nối thẳng tới URL gateway. Gateway thấy IP client thật.

## Yêu cầu trước trên máy từ xa

1. Cài Node + pnpm và build/cài OpenClaw CLI (`pnpm install && pnpm build && pnpm link --global`).
2. Đảm bảo `openclaw` có trên PATH cho shell không tương tác (symlink vào `/usr/local/bin` hoặc `/opt/homebrew/bin` nếu cần).
3. Mở SSH với xác thực bằng khóa. Khuyến nghị dùng IP **Tailscale** để có khả năng truy cập ổn định ngoài LAN.

## Thiết lập ứng dụng macOS

1. Mở _Settings → General_.
2. Ở **OpenClaw runs**, chọn **Remote over SSH** và thiết lập:
   - **Transport**: **SSH tunnel** hoặc **Direct (ws/wss)**.
   - **SSH target**: `user@host` (tùy chọn `:port`).
     - Nếu gateway ở cùng LAN và quảng bá Bonjour, hãy chọn từ danh sách được phát hiện để tự động điền trường này.
   - **Gateway URL** (chỉ Direct): `wss://gateway.example.ts.net` (hoặc `ws://...` cho local/LAN).
   - **Identity file** (nâng cao): đường dẫn tới khóa của bạn.
   - **Project root** (nâng cao): đường dẫn checkout từ xa dùng cho các lệnh.
   - **CLI path** (nâng cao): đường dẫn tùy chọn tới entrypoint/binary `openclaw` có thể chạy (tự điền khi được quảng bá).
3. Nhấn **Test remote**. Thành công cho biết `openclaw status --json` từ xa chạy đúng. Thất bại thường do PATH/CLI; exit 127 nghĩa là không tìm thấy CLI trên máy từ xa.
4. Kiểm tra tình trạng và Web Chat giờ sẽ tự động chạy qua đường hầm SSH này.

## Web Chat

- **SSH tunnel**: Web Chat kết nối tới gateway qua cổng điều khiển WebSocket được chuyển tiếp (mặc định 18789).
- **Direct (ws/wss)**: Web Chat kết nối thẳng tới URL gateway đã cấu hình.
- Không còn máy chủ HTTP WebChat riêng biệt nữa.

## Quyền hạn

- Máy từ xa cần các phê duyệt TCC giống như local (Automation, Accessibility, Screen Recording, Microphone, Speech Recognition, Notifications). Chạy onboarding trên máy đó để cấp một lần.
- Các node quảng bá trạng thái quyền của chúng qua `node.list` / `node.describe` để các agent biết những gì khả dụng.

## Ghi chú bảo mật

- Ưu tiên bind loopback trên máy từ xa và kết nối qua SSH hoặc Tailscale.
- Nếu bạn bind Gateway vào một interface không phải loopback, hãy yêu cầu xác thực bằng token/mật khẩu.
- Xem [Security](/gateway/security) và [Tailscale](/gateway/tailscale).

## Luồng đăng nhập WhatsApp (remote)

- Chạy `openclaw channels login --verbose` **trên máy từ xa**. Quét QR bằng WhatsApp trên điện thoại của bạn.
- Chạy lại đăng nhập trên máy đó nếu xác thực hết hạn. Kiểm tra tình trạng sẽ hiển thị vấn đề liên kết.

## Xu ly su co

- **exit 127 / not found**: `openclaw` không có trên PATH cho shell không đăng nhập. Thêm nó vào `/etc/paths`, rc của shell, hoặc symlink vào `/usr/local/bin`/`/opt/homebrew/bin`.
- **Health probe failed**: kiểm tra khả năng kết nối SSH, PATH, và rằng Baileys đã đăng nhập (`openclaw status --json`).
- **Web Chat bị treo**: xác nhận gateway đang chạy trên máy từ xa và cổng được chuyển tiếp khớp với cổng WS của gateway; UI yêu cầu kết nối WS khỏe mạnh.
- **Node IP hiển thị 127.0.0.1**: điều này là bình thường với SSH tunnel. Chuyển **Transport** sang **Direct (ws/wss)** nếu bạn muốn gateway thấy IP client thật.
- **Voice Wake**: các cụm kích hoạt được chuyển tiếp tự động ở chế độ remote; không cần forwarder riêng.

## Âm thanh thông báo

Chọn âm thanh cho từng thông báo từ script với `openclaw` và `node.invoke`, ví dụ:

```bash
openclaw nodes notify --node <id> --title "Ping" --body "Remote gateway ready" --sound Glass
```

Không còn công tắc “default sound” toàn cục trong ứng dụng; bên gọi chọn âm thanh (hoặc không) cho mỗi yêu cầu.
