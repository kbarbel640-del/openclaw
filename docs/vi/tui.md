---
summary: "Terminal UI (TUI): kết nối tới Gateway từ bất kỳ máy nào"
read_when:
  - Bạn muốn một hướng dẫn thân thiện cho người mới về TUI
  - Bạn cần danh sách đầy đủ các tính năng, lệnh và phím tắt của TUI
title: "TUI"
x-i18n:
  source_path: tui.md
  source_hash: 1eb111456fe0aab6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:55Z
---

# TUI (Terminal UI)

## Khoi dong nhanh

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

- Header: URL kết nối, agent hiện tại, session hiện tại.
- Chat log: tin nhắn người dùng, phản hồi của trợ lý, thông báo hệ thống, thẻ công cụ.
- Status line: trạng thái kết nối/chạy (connecting, running, streaming, idle, error).
- Footer: trạng thái kết nối + agent + session + model + think/verbose/reasoning + số token + deliver.
- Input: trình soạn thảo văn bản có tự động hoàn thành.

## Mô hình tư duy: agents + sessions

- Agents là các slug duy nhất (ví dụ: `main`, `research`). Gateway cung cấp danh sách này.
- Sessions thuộc về agent hiện tại.
- Khóa session được lưu dưới dạng `agent:<agentId>:<sessionKey>`.
  - Nếu bạn gõ `/session main`, TUI sẽ mở rộng thành `agent:<currentAgent>:main`.
  - Nếu bạn gõ `/session agent:other:main`, bạn sẽ chuyển sang session của agent đó một cách tường minh.
- Phạm vi session:
  - `per-sender` (mặc định): mỗi agent có nhiều session.
  - `global`: TUI luôn dùng session `global` (trình chọn có thể trống).
- Agent + session hiện tại luôn hiển thị ở footer.

## Gửi + chuyển phát

- Tin nhắn được gửi tới Gateway; việc chuyển phát tới các provider mặc định là tắt.
- Bật chuyển phát:
  - `/deliver on`
  - hoặc bảng Settings
  - hoặc khởi động với `openclaw tui --deliver`

## Trình chọn + lớp phủ

- Trình chọn model: liệt kê các model khả dụng và đặt ghi đè cho session.
- Trình chọn agent: chọn agent khác.
- Trình chọn session: chỉ hiển thị các session của agent hiện tại.
- Settings: bật/tắt deliver, mở rộng đầu ra công cụ, và hiển thị suy nghĩ.

## Phím tắt

- Enter: gửi tin nhắn
- Esc: hủy lần chạy đang hoạt động
- Ctrl+C: xóa input (nhấn hai lần để thoát)
- Ctrl+D: thoát
- Ctrl+L: trình chọn model
- Ctrl+G: trình chọn agent
- Ctrl+P: trình chọn session
- Ctrl+O: bật/tắt mở rộng đầu ra công cụ
- Ctrl+T: bật/tắt hiển thị suy nghĩ (tải lại lịch sử)

## Lệnh gạch chéo

Cốt lõi:

- `/help`
- `/status`
- `/agent <id>` (hoặc `/agents`)
- `/session <key>` (hoặc `/sessions`)
- `/model <provider/model>` (hoặc `/models`)

Điều khiển session:

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>` (bí danh: `/elev`)
- `/activation <mention|always>`
- `/deliver <on|off>`

Vòng đời session:

- `/new` hoặc `/reset` (đặt lại session)
- `/abort` (hủy lần chạy đang hoạt động)
- `/settings`
- `/exit`

Các lệnh gạch chéo khác của Gateway (ví dụ, `/context`) được chuyển tiếp tới Gateway và hiển thị như đầu ra hệ thống. Xem [Slash commands](/tools/slash-commands).

## Lệnh shell cục bộ

- Tiền tố một dòng bằng `!` để chạy lệnh shell cục bộ trên máy chủ TUI.
- TUI hỏi xác nhận một lần mỗi session để cho phép thực thi cục bộ; từ chối sẽ giữ `!` bị vô hiệu cho session.
- Lệnh chạy trong một shell mới, không tương tác, trong thư mục làm việc của TUI (không có `cd`/env tồn tại).
- Một `!` đơn lẻ được gửi như tin nhắn bình thường; khoảng trắng đầu dòng không kích hoạt thực thi cục bộ.

## Đầu ra công cụ

- Các lời gọi công cụ hiển thị dưới dạng thẻ với args + kết quả.
- Ctrl+O chuyển giữa chế độ thu gọn/mở rộng.
- Khi công cụ chạy, các cập nhật từng phần được stream vào cùng một thẻ.

## Lịch sử + streaming

- Khi kết nối, TUI tải lịch sử mới nhất (mặc định 200 tin nhắn).
- Phản hồi dạng streaming cập nhật tại chỗ cho đến khi hoàn tất.
- TUI cũng lắng nghe các sự kiện công cụ của agent để có thẻ công cụ phong phú hơn.

## Chi tiết kết nối

- TUI đăng ký với Gateway dưới dạng `mode: "tui"`.
- Khi kết nối lại sẽ hiển thị thông báo hệ thống; các khoảng trống sự kiện được thể hiện trong log.

## Tùy chọn

- `--url <url>`: URL WebSocket của Gateway (mặc định từ cấu hình hoặc `ws://127.0.0.1:<port>`)
- `--token <token>`: token Gateway (nếu yêu cầu)
- `--password <password>`: mật khẩu Gateway (nếu yêu cầu)
- `--session <key>`: khóa session (mặc định: `main`, hoặc `global` khi phạm vi là global)
- `--deliver`: chuyển phát phản hồi của trợ lý tới provider (mặc định tắt)
- `--thinking <level>`: ghi đè mức suy nghĩ cho các lần gửi
- `--timeout-ms <ms>`: thời gian chờ agent tính bằng ms (mặc định `agents.defaults.timeoutSeconds`)

Lưu ý: khi bạn đặt `--url`, TUI không dùng dự phòng từ cấu hình hoặc thông tin xác thực môi trường.
Hãy truyền `--token` hoặc `--password` một cách tường minh. Thiếu thông tin xác thực tường minh là lỗi.

## Xử lý sự cố

Không có đầu ra sau khi gửi tin nhắn:

- Chạy `/status` trong TUI để xác nhận Gateway đã kết nối và đang idle/busy.
- Kiểm tra log của Gateway: `openclaw logs --follow`.
- Xác nhận agent có thể chạy: `openclaw status` và `openclaw models status`.
- Nếu bạn mong đợi tin nhắn trong một kênh chat, hãy bật chuyển phát (`/deliver on` hoặc `--deliver`).
- `--history-limit <n>`: số mục lịch sử cần tải (mặc định 200)

## Xử lý sự cố

- `disconnected`: đảm bảo Gateway đang chạy và `--url/--token/--password` của bạn là chính xác.
- Không có agent trong trình chọn: kiểm tra `openclaw agents list` và cấu hình định tuyến của bạn.
- Trình chọn session trống: có thể bạn đang ở phạm vi global hoặc chưa có session nào.
