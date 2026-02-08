---
summary: "Công cụ gỡ lỗi: chế độ watch, luồng mô hình thô và theo dõi rò rỉ lập luận"
read_when:
  - Bạn cần kiểm tra đầu ra mô hình thô để phát hiện rò rỉ lập luận
  - Bạn muốn chạy Gateway ở chế độ watch trong khi lặp lại
  - Bạn cần một quy trình gỡ lỗi có thể lặp lại
title: "Gỡ lỗi"
x-i18n:
  source_path: help/debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:04Z
---

# Gỡ lỗi

Trang này bao quát các trợ giúp gỡ lỗi cho đầu ra dạng streaming, đặc biệt khi một
nhà cung cấp trộn phần lập luận vào văn bản bình thường.

## Ghi đè gỡ lỗi khi chạy

Dùng `/debug` trong chat để đặt các ghi đè cấu hình **chỉ trong lúc chạy** (trong bộ nhớ, không ghi đĩa).
`/debug` bị tắt theo mặc định; bật bằng `commands.debug: true`.
Cách này hữu ích khi bạn cần bật/tắt các thiết lập ít dùng mà không phải chỉnh sửa `openclaw.json`.

Ví dụ:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` xóa tất cả các ghi đè và quay lại cấu hình trên đĩa.

## Chế độ watch của Gateway

Để lặp nhanh, chạy gateway dưới trình theo dõi tệp:

```bash
pnpm gateway:watch --force
```

Ánh xạ tương đương:

```bash
tsx watch src/entry.ts gateway --force
```

Thêm bất kỳ cờ CLI của gateway nào sau `gateway:watch` và chúng sẽ được chuyển tiếp
mỗi lần khởi động lại.

## Hồ sơ dev + gateway dev (--dev)

Dùng hồ sơ dev để cô lập trạng thái và khởi tạo một thiết lập an toàn, có thể bỏ đi cho
gỡ lỗi. Có **hai** cờ `--dev`:

- **`--dev` toàn cục (profile):** cô lập trạng thái dưới `~/.openclaw-dev` và
  đặt cổng gateway mặc định là `19001` (các cổng dẫn xuất dịch chuyển theo).
- **`gateway --dev`: yêu cầu Gateway tự tạo cấu hình mặc định +
  workspace** khi thiếu (và bỏ qua BOOTSTRAP.md).

Luồng khuyến nghị (hồ sơ dev + bootstrap dev):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

Nếu bạn chưa cài đặt toàn cục, hãy chạy CLI qua `pnpm openclaw ...`.

Những gì thao tác này thực hiện:

1. **Cô lập hồ sơ** (`--dev` toàn cục)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (trình duyệt/canvas dịch chuyển tương ứng)

2. **Bootstrap dev** (`gateway --dev`)
   - Ghi một cấu hình tối thiểu nếu thiếu (`gateway.mode=local`, bind loopback).
   - Đặt `agent.workspace` thành workspace dev.
   - Đặt `agent.skipBootstrap=true` (không có BOOTSTRAP.md).
   - Gieo các tệp workspace nếu thiếu:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - Danh tính mặc định: **C3‑PO** (droid giao thức).
   - Bỏ qua các nhà cung cấp kênh ở chế độ dev (`OPENCLAW_SKIP_CHANNELS=1`).

Luồng đặt lại (khởi đầu mới):

```bash
pnpm gateway:dev:reset
```

Lưu ý: `--dev` là cờ hồ sơ **toàn cục** và bị một số trình chạy “ăn mất”.
Nếu bạn cần ghi rõ, hãy dùng dạng biến môi trường:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` xóa cấu hình, thông tin xác thực, phiên và workspace dev (dùng
`trash`, không phải `rm`), rồi tạo lại thiết lập dev mặc định.

Mẹo: nếu một gateway không-dev đang chạy sẵn (launchd/systemd), hãy dừng nó trước:

```bash
openclaw gateway stop
```

## Ghi log luồng thô (OpenClaw)

OpenClaw có thể ghi log **luồng trợ lý thô** trước mọi lọc/định dạng.
Đây là cách tốt nhất để xem liệu phần lập luận có đến dưới dạng delta văn bản thuần
(hay là các khối suy nghĩ tách riêng).

Bật qua CLI:

```bash
pnpm gateway:watch --force --raw-stream
```

Tùy chọn ghi đè đường dẫn:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

Biến môi trường tương đương:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

Tệp mặc định:

`~/.openclaw/logs/raw-stream.jsonl`

## Ghi log chunk thô (pi-mono)

Để thu thập **các chunk tương thích OpenAI thô** trước khi được phân tích thành khối,
pi-mono cung cấp một logger riêng:

```bash
PI_RAW_STREAM=1
```

Đường dẫn tùy chọn:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

Tệp mặc định:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> Lưu ý: chỉ được phát ra bởi các tiến trình dùng nhà cung cấp
> `openai-completions` của pi-mono.

## Lưu ý an toàn

- Log luồng thô có thể bao gồm toàn bộ prompt, đầu ra công cụ và dữ liệu người dùng.
- Giữ log cục bộ và xóa chúng sau khi gỡ lỗi.
- Nếu chia sẻ log, hãy loại bỏ bí mật và PII trước.
