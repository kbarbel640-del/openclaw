---
summary: "Quy tắc định tuyến theo từng kênh (WhatsApp, Telegram, Discord, Slack) và ngữ cảnh dùng chung"
read_when:
  - Thay đổi định tuyến kênh hoặc hành vi hộp thư đến
title: "Định tuyến kênh"
x-i18n:
  source_path: channels/channel-routing.md
  source_hash: cfc2cade2984225d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:02Z
---

# Kênh & định tuyến

OpenClaw định tuyến phản hồi **trở lại đúng kênh mà thông điệp đến từ đó**. Mô hình
không chọn kênh; việc định tuyến là xác định và được kiểm soát bởi cấu hình của host.

## Thuật ngữ chính

- **Channel**: `whatsapp`, `telegram`, `discord`, `slack`, `signal`, `imessage`, `webchat`.
- **AccountId**: phiên bản tài khoản theo kênh (khi được hỗ trợ).
- **AgentId**: một không gian làm việc + kho phiên độc lập (“bộ não”).
- **SessionKey**: khóa bucket dùng để lưu ngữ cảnh và kiểm soát đồng thời.

## Dạng khóa phiên (ví dụ)

Tin nhắn trực tiếp gộp về phiên **chính** của tác tử:

- `agent:<agentId>:<mainKey>` (mặc định: `agent:main:main`)

Nhóm và kênh vẫn tách biệt theo từng kênh:

- Nhóm: `agent:<agentId>:<channel>:group:<id>`
- Kênh/phòng: `agent:<agentId>:<channel>:channel:<id>`

Luồng (thread):

- Luồng Slack/Discord thêm `:thread:<threadId>` vào khóa cơ sở.
- Chủ đề diễn đàn Telegram nhúng `:topic:<topicId>` trong khóa nhóm.

Ví dụ:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Quy tắc định tuyến (cách chọn tác tử)

Định tuyến chọn **một tác tử** cho mỗi thông điệp đến:

1. **Khớp peer chính xác** (`bindings` với `peer.kind` + `peer.id`).
2. **Khớp guild** (Discord) qua `guildId`.
3. **Khớp team** (Slack) qua `teamId`.
4. **Khớp account** (`accountId` trên kênh).
5. **Khớp kênh** (bất kỳ account nào trên kênh đó).
6. **Tác tử mặc định** (`agents.list[].default`, nếu không thì mục đầu tiên trong danh sách, dự phòng về `main`).

Tác tử được khớp sẽ quyết định không gian làm việc và kho phiên được sử dụng.

## Nhóm phát (chạy nhiều tác tử)

Nhóm phát cho phép bạn chạy **nhiều tác tử** cho cùng một peer **khi OpenClaw thường sẽ phản hồi** (ví dụ: trong nhóm WhatsApp, sau khi qua bước nhắc tên/kích hoạt).

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

Xem: [Broadcast Groups](/channels/broadcast-groups).

## Tổng quan cấu hình

- `agents.list`: định nghĩa tác tử theo tên (không gian làm việc, mô hình, v.v.).
- `bindings`: ánh xạ kênh/account/peer đầu vào tới các tác tử.

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
- Bản ghi JSONL nằm cùng vị trí với kho

Bạn có thể ghi đè đường dẫn kho qua `session.store` và mẫu `{agentId}`.

## Hành vi WebChat

WebChat gắn vào **tác tử được chọn** và mặc định dùng phiên chính của tác tử.
Vì vậy, WebChat cho phép bạn xem ngữ cảnh xuyên kênh của tác tử đó tại một nơi.

## Ngữ cảnh phản hồi

Phản hồi đầu vào bao gồm:

- `ReplyToId`, `ReplyToBody` và `ReplyToSender` khi có sẵn.
- Ngữ cảnh được trích dẫn được thêm vào `Body` dưới dạng một khối `[Replying to ...]`.

Điều này nhất quán trên các kênh.
