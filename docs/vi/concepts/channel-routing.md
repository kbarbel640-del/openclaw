---
summary: "Quy tắc định tuyến theo từng kênh (WhatsApp, Telegram, Discord, Slack) và ngữ cảnh dùng chung"
read_when:
  - Thay đổi định tuyến kênh hoặc hành vi hộp thư đến
title: "Định tuyến kênh"
x-i18n:
  source_path: concepts/channel-routing.md
  source_hash: 1a322b5187e32c82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:42Z
---

# Kênh & định tuyến

OpenClaw định tuyến phản hồi **trở lại đúng kênh nơi tin nhắn được gửi đến**. Mô hình
không chọn kênh; việc định tuyến là xác định và được kiểm soát bởi cấu hình của host.

## Thuật ngữ chính

- **Channel**: `whatsapp`, `telegram`, `discord`, `slack`, `signal`, `imessage`, `webchat`.
- **AccountId**: phiên bản tài khoản theo kênh (khi được hỗ trợ).
- **AgentId**: một không gian làm việc + kho phiên độc lập (“bộ não”).
- **SessionKey**: khóa dùng để lưu ngữ cảnh và kiểm soát tính đồng thời.

## Dạng SessionKey (ví dụ)

Tin nhắn trực tiếp được gộp vào phiên **chính** của agent:

- `agent:<agentId>:<mainKey>` (mặc định: `agent:main:main`)

Nhóm và kênh vẫn được cô lập theo từng kênh:

- Nhóm: `agent:<agentId>:<channel>:group:<id>`
- Kênh/phòng: `agent:<agentId>:<channel>:channel:<id>`

Luồng (threads):

- Luồng Slack/Discord thêm `:thread:<threadId>` vào khóa cơ sở.
- Chủ đề forum của Telegram nhúng `:topic:<topicId>` vào khóa nhóm.

Ví dụ:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Quy tắc định tuyến (cách chọn agent)

Định tuyến chọn **một agent** cho mỗi tin nhắn đến:

1. **Khớp peer chính xác** (`bindings` với `peer.kind` + `peer.id`).
2. **Khớp guild** (Discord) qua `guildId`.
3. **Khớp team** (Slack) qua `teamId`.
4. **Khớp tài khoản** (`accountId` trên kênh).
5. **Khớp kênh** (bất kỳ tài khoản nào trên kênh đó).
6. **Agent mặc định** (`agents.list[].default`, nếu không thì mục đầu tiên trong danh sách, dự phòng về `main`).

Agent được khớp sẽ quyết định không gian làm việc và kho phiên được sử dụng.

## Nhóm phát (chạy nhiều agent)

Nhóm phát cho phép bạn chạy **nhiều agent** cho cùng một peer **khi OpenClaw thông thường sẽ phản hồi** (ví dụ: trong các nhóm WhatsApp, sau khi qua bước nhắc tên/kích hoạt).

Cấu hình:

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

Xem thêm: [Broadcast Groups](/broadcast-groups).

## Tổng quan cấu hình

- `agents.list`: các định nghĩa agent được đặt tên (không gian làm việc, mô hình, v.v.).
- `bindings`: ánh xạ kênh/tài khoản/peer đến agent.

Ví dụ:

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## Lưu trữ phiên

Kho phiên nằm dưới thư mục trạng thái (mặc định `~/.openclaw`):

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- Bản ghi JSONL nằm cùng thư mục với kho

Bạn có thể ghi đè đường dẫn kho thông qua `session.store` và tạo mẫu `{agentId}`.

## Hành vi WebChat

WebChat gắn với **agent được chọn** và mặc định sử dụng phiên chính của agent.
Vì vậy, WebChat cho phép bạn xem ngữ cảnh xuyên kênh của agent đó tại một nơi.

## Ngữ cảnh phản hồi

Phản hồi đến bao gồm:

- `ReplyToId`, `ReplyToBody` và `ReplyToSender` khi có sẵn.
- Ngữ cảnh được trích dẫn được nối vào `Body` dưới dạng một khối `[Replying to ...]`.

Điều này nhất quán trên mọi kênh.
