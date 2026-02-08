---
summary: "Giao diện Terminal (TUI): kết nối tới Gateway từ bất kỳ máy nào"
read_when:
  - Bạn muốn một hướng dẫn thân thiện cho người mới về TUI
  - Bạn cần danh sách đầy đủ các tính năng, lệnh và phím tắt của TUI
title: "TUI"
x-i18n:
  source_path: web/tui.md
  source_hash: 6ab8174870e4722d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:15Z
---

# TUI (Terminal UI)

## Khởi động nhanh

1. Khởi động Gateway.

```bash
openclaw gateway
```

2. Mở TUI.

```bash
openclaw tui
```

3. Gõ một tin nhắn và nhấn Enter.

Gateway từ xa:

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

Dùng `--password` nếu Gateway của bạn dùng xác thực bằng mật khẩu.

## Những gì bạn thấy

- Header: URL kết nối, tác tử hiện tại, phiên hiện tại.
- Chat log: tin nhắn người dùng, phản hồi của trợ lý, thông báo hệ thống, thẻ công cụ.
- Status line: trạng thái kết nối/chạy (đang kết nối, đang chạy, đang streaming, nhàn rỗi, lỗi).
- Footer: trạng thái kết nối + tác tử + phiên + mô hình + think/verbose/reasoning + số token + deliver.
- Input: trình soạn thảo văn bản có tự động hoàn thành.

## Mô hình tư duy: tác tử + phiên

- Tác tử là các slug duy nhất (ví dụ: `main`, `research`). Gateway cung cấp danh sách này.
- Phiên thuộc về tác tử hiện tại.
- Khóa phiên được lưu dưới dạng `agent:<agentId>:<sessionKey>`.
  - Nếu bạn gõ `/session main`, TUI sẽ mở rộng thành `agent:<currentAgent>:main`.
  - Nếu bạn gõ `/session agent:other:main`, bạn chuyển sang phiên của tác tử đó một cách tường minh.
- Phạm vi phiên:
  - `per-sender` (mặc định): mỗi tác tử có nhiều phiên.
  - `global`: TUI luôn dùng phiên `global` (bộ chọn có thể trống).
- Tác tử + phiên hiện tại luôn hiển thị ở footer.

## Gửi + phân phối

- Tin nhắn được gửi tới Gateway; việc phân phối tới các nhà cung cấp mặc định là tắt.
- Bật phân phối:
  - `/deliver on`
  - hoặc bảng Cài đặt
  - hoặc khởi động với `openclaw tui --deliver`

## Bộ chọn + lớp phủ

- Bộ chọn mô hình: liệt kê các mô hình khả dụng và đặt ghi đè cho phiên.
- Bộ chọn tác tử: chọn tác tử khác.
- Bộ chọn phiên: chỉ hiển thị các phiên của tác tử hiện tại.
- Cài đặt: bật/tắt phân phối, mở rộng đầu ra công cụ, và hiển thị suy nghĩ.

## Phím tắt bàn phím

- Enter: gửi tin nhắn
- Esc: hủy lần chạy đang hoạt động
- Ctrl+C: xóa nội dung nhập (nhấn hai lần để thoát)
- Ctrl+D: thoát
- Ctrl+L: bộ chọn mô hình
- Ctrl+G: bộ chọn tác tử
- Ctrl+P: bộ chọn phiên
- Ctrl+O: bật/tắt mở rộng đầu ra công cụ
- Ctrl+T: bật/tắt hiển thị suy nghĩ (tải lại lịch sử)

## Lệnh gạch chéo

Cốt lõi:

- `/help`
- `/status`
- `/agent <id>` (hoặc `/agents`)
- `/session <key>` (hoặc `/sessions`)
- `/model <provider/model>` (hoặc `/models`)

Điều khiển phiên:

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>` (bí danh: `/elev`)
- `/activation <mention|always>`
- `/deliver <on|off>`

Vòng đời phiên:

- `/new` hoặc `/reset` (đặt lại phiên)
- `/abort` (hủy lần chạy đang hoạt động)
- `/settings`
- `/exit`

Các lệnh gạch chéo khác của Gateway (ví dụ, `/context`) được chuyển tiếp tới Gateway và hiển thị như đầu ra hệ thống. Xem [Slash commands](/tools/slash-commands).

## Lệnh shell cục bộ

- Thêm tiền tố `!` ở đầu dòng để chạy lệnh shell cục bộ trên máy chủ TUI.
- TUI sẽ hỏi một lần mỗi phiên để cho phép thực thi cục bộ; từ chối sẽ giữ `!` bị vô hiệu cho phiên đó.
- Lệnh chạy trong một shell mới, không tương tác, trong thư mục làm việc của TUI (không có `cd`/env tồn tại).
- Một `!` đơn lẻ được gửi như tin nhắn bình thường; khoảng trắng ở đầu dòng không kích hoạt thực thi cục bộ.

## Đầu ra công cụ

- Các lần gọi công cụ hiển thị dưới dạng thẻ với tham số + kết quả.
- Ctrl+O chuyển đổi giữa chế độ thu gọn/mở rộng.
- Khi công cụ chạy, các cập nhật từng phần sẽ stream vào cùng một thẻ.

## Lịch sử + streaming

- Khi kết nối, TUI tải lịch sử mới nhất (mặc định 200 tin nhắn).
- Phản hồi streaming được cập nhật tại chỗ cho đến khi hoàn tất.
- TUI cũng lắng nghe các sự kiện công cụ của tác tử để có thẻ công cụ phong phú hơn.

## Chi tiết kết nối

- TUI đăng ký với Gateway dưới dạng `mode: "tui"`.
- Việc kết nối lại sẽ hiển thị thông báo hệ thống; các khoảng trống sự kiện được thể hiện trong log.

## Tùy chọn

- `--url <url>`: URL WebSocket của Gateway (mặc định từ cấu hình hoặc `ws://127.0.0.1:<port>`)
- `--token <token>`: Token Gateway (nếu cần)
- `--password <password>`: Mật khẩu Gateway (nếu cần)
- `--session <key>`: Khóa phiên (mặc định: `main`, hoặc `global` khi phạm vi là global)
- `--deliver`: Phân phối phản hồi của trợ lý tới nhà cung cấp (mặc định tắt)
- `--thinking <level>`: Ghi đè mức suy nghĩ khi gửi
- `--timeout-ms <ms>`: Thời gian chờ của tác tử tính bằng ms (mặc định `agents.defaults.timeoutSeconds`)

Lưu ý: khi bạn đặt `--url`, TUI sẽ không quay về cấu hình hoặc thông tin xác thực từ biến môi trường.
Hãy truyền `--token` hoặc `--password` một cách tường minh. Thiếu thông tin xác thực tường minh là lỗi.

## Xử lý sự cố

Không có đầu ra sau khi gửi tin nhắn:

- Chạy `/status` trong TUI để xác nhận Gateway đã kết nối và đang nhàn rỗi/bận.
- Kiểm tra log của Gateway: `openclaw logs --follow`.
- Xác nhận tác tử có thể chạy: `openclaw status` và `openclaw models status`.
- Nếu bạn mong đợi tin nhắn trong một kênh chat, hãy bật phân phối (`/deliver on` hoặc `--deliver`).
- `--history-limit <n>`: Số mục lịch sử cần tải (mặc định 200)

## Xử lý sự cố kết nối

- `disconnected`: đảm bảo Gateway đang chạy và `--url/--token/--password` của bạn là chính xác.
- Không có tác tử trong bộ chọn: kiểm tra `openclaw agents list` và cấu hình định tuyến của bạn.
- Bộ chọn phiên trống: có thể bạn đang ở phạm vi global hoặc chưa có phiên nào.
