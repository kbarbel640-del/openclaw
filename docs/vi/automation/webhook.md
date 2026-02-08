---
summary: "Webhook đầu vào để đánh thức và chạy tác tử cô lập"
read_when:
  - Thêm hoặc thay đổi các endpoint webhook
  - Kết nối các hệ thống bên ngoài vào OpenClaw
title: "Webhooks"
x-i18n:
  source_path: automation/webhook.md
  source_hash: f26b88864567be82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:03Z
---

# Webhooks

Gateway có thể phơi bày một endpoint webhook HTTP nhỏ cho các kích hoạt bên ngoài.

## Kích hoạt

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
  },
}
```

Ghi chú:

- `hooks.token` là bắt buộc khi `hooks.enabled=true`.
- `hooks.path` mặc định là `/hooks`.

## Xác thực

Mọi yêu cầu phải bao gồm hook token. Ưu tiên dùng header:

- `Authorization: Bearer <token>` (khuyến nghị)
- `x-openclaw-token: <token>`
- `?token=<token>` (đã ngừng dùng; ghi log cảnh báo và sẽ bị loại bỏ trong bản major tương lai)

## Endpoints

### `POST /hooks/wake`

Payload:

```json
{ "text": "System line", "mode": "now" }
```

- `text` **bắt buộc** (string): Mô tả của sự kiện (ví dụ: "New email received").
- `mode` tùy chọn (`now` | `next-heartbeat`): Có kích hoạt heartbeat ngay lập tức hay chờ lần kiểm tra định kỳ tiếp theo (mặc định `now`).

Tác động:

- Đưa một sự kiện hệ thống vào hàng đợi cho phiên **chính**
- Nếu `mode=now`, kích hoạt heartbeat ngay lập tức

### `POST /hooks/agent`

Payload:

```json
{
  "message": "Run this",
  "name": "Email",
  "sessionKey": "hook:email:msg-123",
  "wakeMode": "now",
  "deliver": true,
  "channel": "last",
  "to": "+15551234567",
  "model": "openai/gpt-5.2-mini",
  "thinking": "low",
  "timeoutSeconds": 120
}
```

- `message` **bắt buộc** (string): Prompt hoặc thông điệp để tác tử xử lý.
- `name` tùy chọn (string): Tên dễ đọc cho hook (ví dụ: "GitHub"), dùng làm tiền tố trong tóm tắt phiên.
- `sessionKey` tùy chọn (string): Khóa dùng để nhận diện phiên của tác tử. Mặc định là một `hook:<uuid>` ngẫu nhiên. Dùng khóa nhất quán cho phép hội thoại nhiều lượt trong ngữ cảnh hook.
- `wakeMode` tùy chọn (`now` | `next-heartbeat`): Có kích hoạt heartbeat ngay lập tức hay chờ lần kiểm tra định kỳ tiếp theo (mặc định `now`).
- `deliver` tùy chọn (boolean): Nếu `true`, phản hồi của tác tử sẽ được gửi tới kênh nhắn tin. Mặc định `true`. Các phản hồi chỉ là xác nhận heartbeat sẽ tự động bị bỏ qua.
- `channel` tùy chọn (string): Kênh nhắn tin để gửi. Một trong: `last`, `whatsapp`, `telegram`, `discord`, `slack`, `mattermost` (plugin), `signal`, `imessage`, `msteams`. Mặc định là `last`.
- `to` tùy chọn (string): Định danh người nhận cho kênh (ví dụ: số điện thoại cho WhatsApp/Signal, chat ID cho Telegram, channel ID cho Discord/Slack/Mattermost (plugin), conversation ID cho MS Teams). Mặc định là người nhận gần nhất trong phiên chính.
- `model` tùy chọn (string): Ghi đè mô hình (ví dụ: `anthropic/claude-3-5-sonnet` hoặc một alias). Phải nằm trong danh sách mô hình được phép nếu có hạn chế.
- `thinking` tùy chọn (string): Ghi đè mức độ suy nghĩ (ví dụ: `low`, `medium`, `high`).
- `timeoutSeconds` tùy chọn (number): Thời lượng tối đa cho lần chạy tác tử tính bằng giây.

Tác động:

- Chạy một lượt tác tử **cô lập** (khóa phiên riêng)
- Luôn đăng một bản tóm tắt vào phiên **chính**
- Nếu `wakeMode=now`, kích hoạt heartbeat ngay lập tức

### `POST /hooks/<name>` (mapped)

Tên hook tùy chỉnh được phân giải qua `hooks.mappings` (xem cấu hình). Một mapping có thể
chuyển các payload tùy ý thành hành động `wake` hoặc `agent`, với template hoặc
biến đổi bằng mã tùy chọn.

Tùy chọn mapping (tóm tắt):

- `hooks.presets: ["gmail"]` bật mapping Gmail tích hợp sẵn.
- `hooks.mappings` cho phép bạn định nghĩa `match`, `action`, và template trong cấu hình.
- `hooks.transformsDir` + `transform.module` tải một module JS/TS cho logic tùy chỉnh.
- Dùng `match.source` để giữ một endpoint ingest chung (định tuyến theo payload).
- Biến đổi TS yêu cầu một TS loader (ví dụ: `bun` hoặc `tsx`) hoặc `.js` đã biên dịch sẵn tại runtime.
- Đặt `deliver: true` + `channel`/`to` trên mapping để định tuyến phản hồi tới bề mặt chat
  (`channel` mặc định là `last` và sẽ fallback sang WhatsApp).
- `allowUnsafeExternalContent: true` vô hiệu wrapper an toàn nội dung bên ngoài cho hook đó
  (nguy hiểm; chỉ dùng cho nguồn nội bộ đáng tin cậy).
- `openclaw webhooks gmail setup` ghi cấu hình `hooks.gmail` cho `openclaw webhooks gmail run`.
  Xem [Gmail Pub/Sub](/automation/gmail-pubsub) để biết toàn bộ luồng watch của Gmail.

## Phản hồi

- `200` cho `/hooks/wake`
- `202` cho `/hooks/agent` (đã bắt đầu chạy async)
- `401` khi xác thực thất bại
- `400` khi payload không hợp lệ
- `413` khi payload quá lớn

## Ví dụ

```bash
curl -X POST http://127.0.0.1:18789/hooks/wake \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"text":"New email received","mode":"now"}'
```

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","wakeMode":"next-heartbeat"}'
```

### Dùng mô hình khác

Thêm `model` vào payload của tác tử (hoặc mapping) để ghi đè mô hình cho lần chạy đó:

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","model":"openai/gpt-5.2-mini"}'
```

Nếu bạn áp dụng `agents.defaults.models`, hãy đảm bảo mô hình ghi đè có trong danh sách đó.

```bash
curl -X POST http://127.0.0.1:18789/hooks/gmail \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"source":"gmail","messages":[{"from":"Ada","subject":"Hello","snippet":"Hi"}]}'
```

## Bảo mật

- Giữ các endpoint hook phía sau loopback, tailnet, hoặc reverse proxy đáng tin cậy.
- Dùng hook token chuyên dụng; không tái sử dụng token xác thực gateway.
- Tránh đưa payload thô nhạy cảm vào log webhook.
- Payload hook được xem là không đáng tin cậy và mặc định được bọc bởi các ranh giới an toàn.
  Nếu bắt buộc phải tắt cho một hook cụ thể, hãy đặt `allowUnsafeExternalContent: true`
  trong mapping của hook đó (nguy hiểm).
