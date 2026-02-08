---
summary: "Tham chiếu CLI cho `openclaw directory` (bản thân, peers, nhóm)"
read_when:
  - Bạn muốn tra cứu ID liên hệ/nhóm/bản thân cho một kênh
  - Bạn đang phát triển một bộ điều hợp thư mục kênh
title: "directory"
x-i18n:
  source_path: cli/directory.md
  source_hash: 7c878d9013aeaa22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:26Z
---

# `openclaw directory`

Tra cứu thư mục cho các kênh có hỗ trợ (liên hệ/peers, nhóm và “tôi”).

## Các cờ dùng chung

- `--channel <name>`: id/alias của kênh (bắt buộc khi có nhiều kênh được cấu hình; tự động khi chỉ có một kênh)
- `--account <id>`: id tài khoản (mặc định: theo mặc định của kênh)
- `--json`: xuất JSON

## Ghi chú

- `directory` được thiết kế để giúp bạn tìm các ID có thể dán vào các lệnh khác (đặc biệt là `openclaw message send --target ...`).
- Với nhiều kênh, kết quả dựa trên cấu hình (allowlists / các nhóm đã cấu hình) thay vì thư mục của nhà cung cấp theo thời gian thực.
- Đầu ra mặc định là `id` (và đôi khi `name`) được phân tách bằng tab; dùng `--json` cho scripting.

## Sử dụng kết quả với `message send`

```bash
openclaw directory peers list --channel slack --query "U0"
openclaw message send --channel slack --target user:U012ABCDEF --message "hello"
```

## Định dạng ID (theo kênh)

- WhatsApp: `+15551234567` (DM), `1234567890-1234567890@g.us` (nhóm)
- Telegram: `@username` hoặc chat id dạng số; nhóm dùng id số
- Slack: `user:U…` và `channel:C…`
- Discord: `user:<id>` và `channel:<id>`
- Matrix (plugin): `user:@user:server`, `room:!roomId:server` hoặc `#alias:server`
- Microsoft Teams (plugin): `user:<id>` và `conversation:<id>`
- Zalo (plugin): user id (Bot API)
- Zalo Personal / `zalouser` (plugin): thread id (DM/nhóm) từ `zca` (`me`, `friend list`, `group list`)

## Bản thân (“tôi”)

```bash
openclaw directory self --channel zalouser
```

## Peers (liên hệ/người dùng)

```bash
openclaw directory peers list --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory peers list --channel zalouser --limit 50
```

## Nhóm

```bash
openclaw directory groups list --channel zalouser
openclaw directory groups list --channel zalouser --query "work"
openclaw directory groups members --channel zalouser --group-id <id>
```
