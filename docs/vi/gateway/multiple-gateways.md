---
summary: "Chạy nhiều OpenClaw Gateway trên một máy chủ (cách ly, cổng và hồ sơ)"
read_when:
  - Chạy nhiều hơn một Gateway trên cùng một máy
  - Bạn cần cấu hình/trạng thái/cổng được cách ly cho từng Gateway
title: "Nhiều Gateway"
x-i18n:
  source_path: gateway/multiple-gateways.md
  source_hash: 09b5035d4e5fb97c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:11Z
---

# Nhiều Gateway (cùng máy chủ)

Hầu hết các thiết lập chỉ nên dùng một Gateway vì một Gateway có thể xử lý nhiều kết nối nhắn tin và nhiều tác tử. Nếu bạn cần mức cách ly hoặc dự phòng cao hơn (ví dụ: bot cứu hộ), hãy chạy các Gateway riêng biệt với hồ sơ/cổng được cách ly.

## Danh sách kiểm tra cách ly (bắt buộc)

- `OPENCLAW_CONFIG_PATH` — tệp cấu hình cho từng phiên bản
- `OPENCLAW_STATE_DIR` — phiên, thông tin xác thực, bộ nhớ đệm cho từng phiên bản
- `agents.defaults.workspace` — thư mục gốc workspace cho từng phiên bản
- `gateway.port` (hoặc `--port`) — duy nhất cho từng phiên bản
- Các cổng phát sinh (trình duyệt/canvas) không được trùng nhau

Nếu những phần này được chia sẻ, bạn sẽ gặp xung đột cấu hình và xung đột cổng.

## Khuyến nghị: hồ sơ (`--profile`)

Hồ sơ tự động phạm vi `OPENCLAW_STATE_DIR` + `OPENCLAW_CONFIG_PATH` và thêm hậu tố cho tên dịch vụ.

```bash
# main
openclaw --profile main setup
openclaw --profile main gateway --port 18789

# rescue
openclaw --profile rescue setup
openclaw --profile rescue gateway --port 19001
```

Dịch vụ theo từng hồ sơ:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

## Hướng dẫn bot cứu hộ

Chạy Gateway thứ hai trên cùng máy chủ với các thành phần riêng của nó:

- hồ sơ/cấu hình
- thư mục trạng thái
- workspace
- cổng cơ sở (cộng thêm các cổng phát sinh)

Điều này giữ cho bot cứu hộ được cách ly khỏi bot chính để nó có thể gỡ lỗi hoặc áp dụng thay đổi cấu hình nếu bot chính bị ngừng hoạt động.

Khoảng cách cổng: chừa ít nhất 20 cổng giữa các cổng cơ sở để các cổng trình duyệt/canvas/CDP phát sinh không bao giờ va chạm.

### Cách cài đặt (bot cứu hộ)

```bash
# Main bot (existing or fresh, without --profile param)
# Runs on port 18789 + Chrome CDC/Canvas/... Ports
openclaw onboard
openclaw gateway install

# Rescue bot (isolated profile + ports)
openclaw --profile rescue onboard
# Notes:
# - workspace name will be postfixed with -rescue per default
# - Port should be at least 18789 + 20 Ports,
#   better choose completely different base port, like 19789,
# - rest of the onboarding is the same as normal

# To install the service (if not happened automatically during onboarding)
openclaw --profile rescue gateway install
```

## Ánh xạ cổng (phát sinh)

Cổng cơ sở = `gateway.port` (hoặc `OPENCLAW_GATEWAY_PORT` / `--port`).

- cổng dịch vụ điều khiển trình duyệt = cổng cơ sở + 2 (chỉ local loopback)
- `canvasHost.port = base + 4`
- Các cổng CDP hồ sơ trình duyệt tự động cấp phát từ `browser.controlPort + 9 .. + 108`

Nếu bạn ghi đè bất kỳ mục nào trong số này bằng cấu hình hoặc biến môi trường, bạn phải giữ chúng là duy nhất cho từng phiên bản.

## Lưu ý về Trình duyệt/CDP (bẫy thường gặp)

- **Không** cố định `browser.cdpUrl` vào cùng một giá trị trên nhiều phiên bản.
- Mỗi phiên bản cần cổng điều khiển trình duyệt và dải CDP riêng (phát sinh từ cổng gateway của nó).
- Nếu bạn cần cổng CDP tường minh, hãy đặt `browser.profiles.<name>.cdpPort` cho từng phiên bản.
- Chrome từ xa: dùng `browser.profiles.<name>.cdpUrl` (theo từng hồ sơ, từng phiên bản).

## Ví dụ env thủ công

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/main.json \
OPENCLAW_STATE_DIR=~/.openclaw-main \
openclaw gateway --port 18789

OPENCLAW_CONFIG_PATH=~/.openclaw/rescue.json \
OPENCLAW_STATE_DIR=~/.openclaw-rescue \
openclaw gateway --port 19001
```

## Kiểm tra nhanh

```bash
openclaw --profile main status
openclaw --profile rescue status
openclaw --profile rescue browser status
```
