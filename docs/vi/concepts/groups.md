---
summary: "Hành vi trò chuyện nhóm trên các nền tảng (WhatsApp/Telegram/Discord/Slack/Signal/iMessage/Microsoft Teams)"
read_when:
  - Thay đổi hành vi trò chuyện nhóm hoặc cơ chế chặn theo đề cập
title: "Nhóm"
x-i18n:
  source_path: concepts/groups.md
  source_hash: b727a053edf51f6e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:58Z
---

# Nhóm

OpenClaw xử lý các cuộc trò chuyện nhóm nhất quán trên mọi nền tảng: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Microsoft Teams.

## Giới thiệu cho người mới (2 phút)

OpenClaw “sống” trên chính các tài khoản nhắn tin của bạn. Không có người dùng bot WhatsApp riêng.
Nếu **bạn** ở trong một nhóm, OpenClaw có thể thấy nhóm đó và phản hồi ngay trong đó.

Hành vi mặc định:

- Nhóm bị hạn chế (`groupPolicy: "allowlist"`).
- Phản hồi yêu cầu có đề cập trừ khi bạn chủ động tắt chặn theo đề cập.

Diễn giải: những người gửi trong danh sách cho phép có thể kích hoạt OpenClaw bằng cách đề cập đến nó.

> TL;DR
>
> - **Quyền DM** được kiểm soát bởi `*.allowFrom`.
> - **Quyền nhóm** được kiểm soát bởi `*.groupPolicy` + danh sách cho phép (`*.groups`, `*.groupAllowFrom`).
> - **Kích hoạt phản hồi** được kiểm soát bởi chặn theo đề cập (`requireMention`, `/activation`).

Luồng nhanh (điều gì xảy ra với một tin nhắn nhóm):

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

![Luồng tin nhắn nhóm](/images/groups-flow.svg)

Nếu bạn muốn...
| Mục tiêu | Cài đặt |
|------|-------------|
| Cho phép mọi nhóm nhưng chỉ trả lời khi có @đề cập | `groups: { "*": { requireMention: true } }` |
| Tắt toàn bộ phản hồi nhóm | `groupPolicy: "disabled"` |
| Chỉ các nhóm cụ thể | `groups: { "<group-id>": { ... } }` (không có khóa `"*"`) |
| Chỉ bạn mới có thể kích hoạt trong nhóm | `groupPolicy: "allowlist"`, `groupAllowFrom: ["+1555..."]` |

## Khóa phiên

- Phiên nhóm dùng khóa phiên `agent:<agentId>:<channel>:group:<id>` (phòng/kênh dùng `agent:<agentId>:<channel>:channel:<id>`).
- Chủ đề diễn đàn Telegram thêm `:topic:<threadId>` vào ID nhóm để mỗi chủ đề có phiên riêng.
- Trò chuyện trực tiếp dùng phiên chính (hoặc theo người gửi nếu được cấu hình).
- Heartbeat được bỏ qua cho các phiên nhóm.

## Mẫu: DM cá nhân + nhóm công khai (một tác tử)

Có — cách này hoạt động tốt nếu lưu lượng “cá nhân” của bạn là **DM** và lưu lượng “công khai” là **nhóm**.

Lý do: ở chế độ một tác tử, DM thường rơi vào khóa phiên **chính** (`agent:main:main`), còn nhóm luôn dùng các khóa phiên **không phải chính** (`agent:main:<channel>:group:<id>`). Nếu bạn bật sandboxing với `mode: "non-main"`, các phiên nhóm sẽ chạy trong Docker trong khi phiên DM chính vẫn chạy trên host.

Điều này cho bạn một “bộ não” tác tử (không gian làm việc + bộ nhớ dùng chung), nhưng hai tư thế thực thi:

- **DM**: đầy đủ công cụ (host)
- **Nhóm**: sandbox + công cụ bị hạn chế (Docker)

> Nếu bạn cần không gian làm việc/nhân dạng thực sự tách biệt (“cá nhân” và “công khai” không bao giờ trộn), hãy dùng tác tử thứ hai + bindings. Xem [Định tuyến đa tác tử](/concepts/multi-agent).

Ví dụ (DM trên host, nhóm trong sandbox + chỉ công cụ nhắn tin):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // groups/channels are non-main -> sandboxed
        scope: "session", // strongest isolation (one container per group/channel)
        workspaceAccess: "none",
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        // If allow is non-empty, everything else is blocked (deny still wins).
        allow: ["group:messaging", "group:sessions"],
        deny: ["group:runtime", "group:fs", "group:ui", "nodes", "cron", "gateway"],
      },
    },
  },
}
```

Muốn “nhóm chỉ thấy thư mục X” thay vì “không truy cập host”? Giữ `workspaceAccess: "none"` và chỉ mount các đường dẫn trong danh sách cho phép vào sandbox:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
        docker: {
          binds: [
            // hostPath:containerPath:mode
            "~/FriendsShared:/data:ro",
          ],
        },
      },
    },
  },
}
```

Liên quan:

- Khóa cấu hình và mặc định: [Cấu hình Gateway](/gateway/configuration#agentsdefaultssandbox)
- Gỡ lỗi vì sao một công cụ bị chặn: [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)
- Chi tiết bind mounts: [Sandboxing](/gateway/sandboxing#custom-bind-mounts)

## Nhãn hiển thị

- Nhãn UI dùng `displayName` khi có, định dạng là `<channel>:<token>`.
- `#room` dành riêng cho phòng/kênh; trò chuyện nhóm dùng `g-<slug>` (chữ thường, khoảng trắng -> `-`, giữ `#@+._-`).

## Chính sách nhóm

Kiểm soát cách xử lý tin nhắn nhóm/phòng theo từng kênh:

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "disabled", // "open" | "disabled" | "allowlist"
      groupAllowFrom: ["+15551234567"],
    },
    telegram: {
      groupPolicy: "disabled",
      groupAllowFrom: ["123456789", "@username"],
    },
    signal: {
      groupPolicy: "disabled",
      groupAllowFrom: ["+15551234567"],
    },
    imessage: {
      groupPolicy: "disabled",
      groupAllowFrom: ["chat_id:123"],
    },
    msteams: {
      groupPolicy: "disabled",
      groupAllowFrom: ["user@org.com"],
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        GUILD_ID: { channels: { help: { allow: true } } },
      },
    },
    slack: {
      groupPolicy: "allowlist",
      channels: { "#general": { allow: true } },
    },
    matrix: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["@owner:example.org"],
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
    },
  },
}
```

| Chính sách    | Hành vi                                                          |
| ------------- | ---------------------------------------------------------------- |
| `"open"`      | Nhóm bỏ qua danh sách cho phép; chặn theo đề cập vẫn áp dụng.    |
| `"disabled"`  | Chặn hoàn toàn mọi tin nhắn nhóm.                                |
| `"allowlist"` | Chỉ cho phép các nhóm/phòng khớp danh sách cho phép đã cấu hình. |

Ghi chú:

- `groupPolicy` tách biệt với chặn theo đề cập (yêu cầu @đề cập).
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams: dùng `groupAllowFrom` (dự phòng: `allowFrom` rõ ràng).
- Discord: danh sách cho phép dùng `channels.discord.guilds.<id>.channels`.
- Slack: danh sách cho phép dùng `channels.slack.channels`.
- Matrix: danh sách cho phép dùng `channels.matrix.groups` (ID phòng, bí danh hoặc tên). Dùng `channels.matrix.groupAllowFrom` để hạn chế người gửi; cũng hỗ trợ danh sách cho phép theo phòng `users`.
- DM nhóm được kiểm soát riêng (`channels.discord.dm.*`, `channels.slack.dm.*`).
- Danh sách cho phép Telegram có thể khớp ID người dùng (`"123456789"`, `"telegram:123456789"`, `"tg:123456789"`) hoặc tên người dùng (`"@alice"` hoặc `"alice"`); tiền tố không phân biệt hoa/thường.
- Mặc định là `groupPolicy: "allowlist"`; nếu danh sách cho phép nhóm trống, tin nhắn nhóm sẽ bị chặn.

Mô hình tư duy nhanh (thứ tự đánh giá cho tin nhắn nhóm):

1. `groupPolicy` (mở/tắt/danh sách cho phép)
2. danh sách cho phép nhóm (`*.groups`, `*.groupAllowFrom`, danh sách cho phép theo kênh)
3. chặn theo đề cập (`requireMention`, `/activation`)

## Chặn theo đề cập (mặc định)

Tin nhắn nhóm yêu cầu có đề cập trừ khi được ghi đè theo từng nhóm. Mặc định nằm theo từng phân hệ dưới `*.groups."*"`.

Trả lời một tin nhắn của bot được tính là đề cập ngầm (khi kênh hỗ trợ metadata trả lời). Áp dụng cho Telegram, WhatsApp, Slack, Discord và Microsoft Teams.

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
        "123@g.us": { requireMention: false },
      },
    },
    telegram: {
      groups: {
        "*": { requireMention: true },
        "123456789": { requireMention: false },
      },
    },
    imessage: {
      groups: {
        "*": { requireMention: true },
        "123": { requireMention: false },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw", "\\+15555550123"],
          historyLimit: 50,
        },
      },
    ],
  },
}
```

Ghi chú:

- `mentionPatterns` là regex không phân biệt hoa/thường.
- Các nền tảng có đề cập rõ ràng vẫn được chấp nhận; pattern chỉ là dự phòng.
- Ghi đè theo tác tử: `agents.list[].groupChat.mentionPatterns` (hữu ích khi nhiều tác tử dùng chung một nhóm).
- Chặn theo đề cập chỉ được áp dụng khi có thể phát hiện đề cập (đề cập gốc hoặc đã cấu hình `mentionPatterns`).
- Mặc định Discord nằm trong `channels.discord.guilds."*"` (có thể ghi đè theo guild/kênh).
- Ngữ cảnh lịch sử nhóm được bọc đồng nhất giữa các kênh và là **chỉ-pending** (các tin bị bỏ qua do chặn theo đề cập); dùng `messages.groupChat.historyLimit` cho mặc định toàn cục và `channels.<channel>.historyLimit` (hoặc `channels.<channel>.accounts.*.historyLimit`) để ghi đè. Đặt `0` để tắt.

## Hạn chế công cụ theo nhóm/kênh (tùy chọn)

Một số cấu hình kênh hỗ trợ hạn chế công cụ khả dụng **bên trong một nhóm/phòng/kênh cụ thể**.

- `tools`: cho phép/từ chối công cụ cho toàn bộ nhóm.
- `toolsBySender`: ghi đè theo người gửi trong nhóm (khóa là ID người gửi/tên người dùng/email/số điện thoại tùy kênh). Dùng `"*"` làm ký tự đại diện.

Thứ tự phân giải (cụ thể hơn thắng):

1. khớp `toolsBySender` theo nhóm/kênh
2. `tools` theo nhóm/kênh
3. mặc định (`"*"`) khớp `toolsBySender`
4. mặc định (`"*"`) `tools`

Ví dụ (Telegram):

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { tools: { deny: ["exec"] } },
        "-1001234567890": {
          tools: { deny: ["exec", "read", "write"] },
          toolsBySender: {
            "123456789": { alsoAllow: ["exec"] },
          },
        },
      },
    },
  },
}
```

Ghi chú:

- Hạn chế công cụ theo nhóm/kênh được áp dụng bổ sung ngoài chính sách công cụ toàn cục/theo tác tử (deny vẫn thắng).
- Một số kênh dùng cách lồng khác cho phòng/kênh (ví dụ: Discord `guilds.*.channels.*`, Slack `channels.*`, MS Teams `teams.*.channels.*`).

## Danh sách cho phép nhóm

Khi cấu hình `channels.whatsapp.groups`, `channels.telegram.groups` hoặc `channels.imessage.groups`, các khóa này hoạt động như danh sách cho phép nhóm. Dùng `"*"` để cho phép mọi nhóm trong khi vẫn đặt hành vi đề cập mặc định.

Ý định phổ biến (sao chép/dán):

1. Tắt toàn bộ phản hồi nhóm

```json5
{
  channels: { whatsapp: { groupPolicy: "disabled" } },
}
```

2. Chỉ cho phép các nhóm cụ thể (WhatsApp)

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "123@g.us": { requireMention: true },
        "456@g.us": { requireMention: false },
      },
    },
  },
}
```

3. Cho phép mọi nhóm nhưng yêu cầu đề cập (tường minh)

```json5
{
  channels: {
    whatsapp: {
      groups: { "*": { requireMention: true } },
    },
  },
}
```

4. Chỉ chủ sở hữu mới có thể kích hoạt trong nhóm (WhatsApp)

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## Kích hoạt (chỉ chủ sở hữu)

Chủ sở hữu nhóm có thể bật/tắt kích hoạt theo từng nhóm:

- `/activation mention`
- `/activation always`

Chủ sở hữu được xác định bởi `channels.whatsapp.allowFrom` (hoặc E.164 tự thân của bot khi không đặt). Gửi lệnh như một tin nhắn độc lập. Các nền tảng khác hiện bỏ qua `/activation`.

## Trường ngữ cảnh

Payload vào của nhóm thiết lập:

- `ChatType=group`
- `GroupSubject` (nếu biết)
- `GroupMembers` (nếu biết)
- `WasMentioned` (kết quả chặn theo đề cập)
- Chủ đề diễn đàn Telegram cũng bao gồm `MessageThreadId` và `IsForum`.

System prompt của tác tử bao gồm phần giới thiệu nhóm ở lượt đầu của một phiên nhóm mới. Nó nhắc mô hình phản hồi như con người, tránh bảng Markdown, và tránh gõ literal các chuỗi `\n`.

## Chi tiết iMessage

- Ưu tiên `chat_id:<id>` khi định tuyến hoặc cho phép.
- Liệt kê cuộc trò chuyện: `imsg chats --limit 20`.
- Phản hồi nhóm luôn quay lại cùng `chat_id`.

## Chi tiết WhatsApp

Xem [Tin nhắn nhóm](/concepts/group-messages) để biết hành vi chỉ dành cho WhatsApp (chèn lịch sử, chi tiết xử lý đề cập).
