---
summary: "Tham chiếu CLI cho `openclaw channels` (tài khoản, trạng thái, đăng nhập/đăng xuất, nhật ký)"
read_when:
  - Bạn muốn thêm/xóa tài khoản kênh (WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (plugin)/Signal/iMessage)
  - Bạn muốn kiểm tra trạng thái kênh hoặc theo dõi nhật ký kênh
title: "channels"
x-i18n:
  source_path: cli/channels.md
  source_hash: 16ab1642f247bfa9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:19Z
---

# `openclaw channels`

Quản lý các tài khoản kênh chat và trạng thái thời gian chạy của chúng trên Gateway.

Tài liệu liên quan:

- Hướng dẫn kênh: [Channels](/channels/index)
- Cấu hình Gateway: [Configuration](/gateway/configuration)

## Các lệnh phổ biến

```bash
openclaw channels list
openclaw channels status
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels logs --channel all
```

## Thêm / xóa tài khoản

```bash
openclaw channels add --channel telegram --token <bot-token>
openclaw channels remove --channel telegram --delete
```

Mẹo: `openclaw channels add --help` hiển thị các cờ theo từng kênh (token, app token, đường dẫn signal-cli, v.v.).

## Đăng nhập / đăng xuất (tương tác)

```bash
openclaw channels login --channel whatsapp
openclaw channels logout --channel whatsapp
```

## Xử lý sự cố

- Chạy `openclaw status --deep` để thăm dò tổng quát.
- Dùng `openclaw doctor` cho các bước sửa lỗi có hướng dẫn.
- `openclaw channels list` in ra `Claude: HTTP 403 ... user:profile` → ảnh chụp mức sử dụng cần phạm vi `user:profile`. Dùng `--no-usage`, hoặc cung cấp khóa phiên claude.ai (`CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`), hoặc xác thực lại qua Claude Code CLI.

## Thăm dò khả năng

Lấy gợi ý khả năng của nhà cung cấp (intents/phạm vi khi có) cùng với hỗ trợ tính năng tĩnh:

```bash
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
```

Ghi chú:

- `--channel` là tùy chọn; bỏ qua để liệt kê mọi kênh (bao gồm cả phần mở rộng).
- `--target` chấp nhận `channel:<id>` hoặc ID kênh dạng số thô và chỉ áp dụng cho Discord.
- Việc thăm dò phụ thuộc vào từng nhà cung cấp: intents Discord + quyền kênh tùy chọn; phạm vi bot + người dùng Slack; cờ bot Telegram + webhook; phiên bản daemon Signal; app token MS Teams + vai trò/phạm vi Graph (được chú thích khi biết). Các kênh không có thăm dò sẽ báo cáo `Probe: unavailable`.

## Phân giải tên sang ID

Phân giải tên kênh/người dùng sang ID bằng thư mục của nhà cung cấp:

```bash
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels resolve --channel discord "My Server/#support" "@someone"
openclaw channels resolve --channel matrix "Project Room"
```

Ghi chú:

- Dùng `--kind user|group|auto` để buộc kiểu mục tiêu.
- Việc phân giải ưu tiên các kết quả đang hoạt động khi có nhiều mục trùng tên.
