---
summary: "Thiết lập Slack cho chế độ socket hoặc HTTP webhook"
read_when: "Thiết lập Slack hoặc gỡ lỗi chế độ socket/HTTP của Slack"
title: "Slack"
x-i18n:
  source_path: channels/slack.md
  source_hash: 703b4b4333bebfef
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:45Z
---

# Slack

## Chế độ Socket (mặc định)

### Thiết lập nhanh (người mới)

1. Tạo một ứng dụng Slack và bật **Socket Mode**.
2. Tạo **App Token** (`xapp-...`) và **Bot Token** (`xoxb-...`).
3. Đặt các token cho OpenClaw và khởi động gateway.

Cấu hình tối thiểu:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### Thiết lập

1. Tạo một ứng dụng Slack (From scratch) tại https://api.slack.com/apps.
2. **Socket Mode** → bật. Sau đó vào **Basic Information** → **App-Level Tokens** → **Generate Token and Scopes** với scope `connections:write`. Sao chép **App Token** (`xapp-...`).
3. **OAuth & Permissions** → thêm các bot token scopes (dùng manifest bên dưới). Nhấp **Install to Workspace**. Sao chép **Bot User OAuth Token** (`xoxb-...`).
4. Tùy chọn: **OAuth & Permissions** → thêm **User Token Scopes** (xem danh sách chỉ đọc bên dưới). Cài đặt lại ứng dụng và sao chép **User OAuth Token** (`xoxp-...`).
5. **Event Subscriptions** → bật events và đăng ký:
   - `message.*` (bao gồm chỉnh sửa/xóa/phát trong thread)
   - `app_mention`
   - `reaction_added`, `reaction_removed`
   - `member_joined_channel`, `member_left_channel`
   - `channel_rename`
   - `pin_added`, `pin_removed`
6. Mời bot vào các kênh bạn muốn nó đọc.
7. Slash Commands → tạo `/openclaw` nếu bạn dùng `channels.slack.slashCommand`. Nếu bật native commands, thêm một slash command cho mỗi lệnh tích hợp (cùng tên với `/help`). Native mặc định tắt cho Slack trừ khi bạn đặt `channels.slack.commands.native: true` (giá trị toàn cục `commands.native` là `"auto"` khiến Slack bị tắt).
8. App Home → bật **Messages Tab** để người dùng có thể DM bot.

Dùng manifest bên dưới để các scopes và events luôn đồng bộ.

Hỗ trợ nhiều tài khoản: dùng `channels.slack.accounts` với token theo từng tài khoản và `name` tùy chọn. Xem [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) cho mẫu dùng chung.

### Cấu hình OpenClaw (tối thiểu)

Đặt token qua biến môi trường (khuyến nghị):

- `SLACK_APP_TOKEN=xapp-...`
- `SLACK_BOT_TOKEN=xoxb-...`

Hoặc qua cấu hình:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### User token (tùy chọn)

OpenClaw có thể dùng Slack user token (`xoxp-...`) cho các thao tác đọc (lịch sử,
ghim, phản ứng, emoji, thông tin thành viên). Mặc định là chỉ đọc: các thao tác đọc
ưu tiên user token khi có, còn ghi vẫn dùng bot token trừ khi
bạn chủ động bật. Ngay cả với `userTokenReadOnly: false`, bot token vẫn
được ưu tiên cho ghi khi có sẵn.

User token được cấu hình trong file cấu hình (không hỗ trợ biến môi trường). Với
nhiều tài khoản, đặt `channels.slack.accounts.<id>.userToken`.

Ví dụ với bot + app + user tokens:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
    },
  },
}
```

Ví dụ với userTokenReadOnly được đặt rõ ràng (cho phép ghi bằng user token):

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
      userTokenReadOnly: false,
    },
  },
}
```

#### Cách dùng token

- Thao tác đọc (lịch sử, danh sách phản ứng, danh sách ghim, danh sách emoji, thông tin thành viên,
  tìm kiếm) ưu tiên user token khi được cấu hình, nếu không thì dùng bot token.
- Thao tác ghi (gửi/sửa/xóa tin nhắn, thêm/xóa phản ứng, ghim/bỏ ghim,
  tải lên tệp) mặc định dùng bot token. Nếu `userTokenReadOnly: false` và
  không có bot token, OpenClaw sẽ dùng user token.

### Ngữ cảnh lịch sử

- `channels.slack.historyLimit` (hoặc `channels.slack.accounts.*.historyLimit`) kiểm soát số lượng tin nhắn gần đây của kênh/nhóm được đưa vào prompt.
- Dùng `messages.groupChat.historyLimit` khi không có. Đặt `0` để tắt (mặc định 50).

## Chế độ HTTP (Events API)

Dùng chế độ HTTP webhook khi Gateway của bạn có thể được Slack truy cập qua HTTPS (phổ biến với triển khai máy chủ).
Chế độ HTTP dùng Events API + Interactivity + Slash Commands với một URL yêu cầu dùng chung.

### Thiết lập

1. Tạo một ứng dụng Slack và **tắt Socket Mode** (tùy chọn nếu bạn chỉ dùng HTTP).
2. **Basic Information** → sao chép **Signing Secret**.
3. **OAuth & Permissions** → cài đặt ứng dụng và sao chép **Bot User OAuth Token** (`xoxb-...`).
4. **Event Subscriptions** → bật events và đặt **Request URL** tới đường dẫn webhook của gateway (mặc định `/slack/events`).
5. **Interactivity & Shortcuts** → bật và đặt cùng **Request URL**.
6. **Slash Commands** → đặt cùng **Request URL** cho các lệnh của bạn.

Ví dụ Request URL:
`https://gateway-host/slack/events`

### Cấu hình OpenClaw (tối thiểu)

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "http",
      botToken: "xoxb-...",
      signingSecret: "your-signing-secret",
      webhookPath: "/slack/events",
    },
  },
}
```

Chế độ HTTP nhiều tài khoản: đặt `channels.slack.accounts.<id>.mode = "http"` và cung cấp
`webhookPath` riêng cho mỗi tài khoản để mỗi ứng dụng Slack trỏ tới URL riêng.

### Manifest (tùy chọn)

Dùng manifest ứng dụng Slack này để tạo ứng dụng nhanh chóng (điều chỉnh tên/lệnh nếu muốn). Bao gồm
user scopes nếu bạn dự định cấu hình user token.

```json
{
  "display_information": {
    "name": "OpenClaw",
    "description": "Slack connector for OpenClaw"
  },
  "features": {
    "bot_user": {
      "display_name": "OpenClaw",
      "always_online": false
    },
    "app_home": {
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "slash_commands": [
      {
        "command": "/openclaw",
        "description": "Send a message to OpenClaw",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "chat:write",
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "groups:write",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "users:read",
        "app_mentions:read",
        "reactions:read",
        "reactions:write",
        "pins:read",
        "pins:write",
        "emoji:read",
        "commands",
        "files:read",
        "files:write"
      ],
      "user": [
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "mpim:history",
        "mpim:read",
        "users:read",
        "reactions:read",
        "pins:read",
        "emoji:read",
        "search:read"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim",
        "reaction_added",
        "reaction_removed",
        "member_joined_channel",
        "member_left_channel",
        "channel_rename",
        "pin_added",
        "pin_removed"
      ]
    }
  }
}
```

Nếu bạn bật native commands, thêm một mục `slash_commands` cho mỗi lệnh muốn hiển thị (khớp danh sách `/help`). Ghi đè bằng `channels.slack.commands.native`.

## Scopes (hiện tại vs tùy chọn)

Conversations API của Slack phân theo loại: bạn chỉ cần scopes cho các
loại hội thoại bạn thực sự dùng (channels, groups, im, mpim). Xem
https://docs.slack.dev/apis/web-api/using-the-conversations-api/ để biết tổng quan.

### Bot token scopes (bắt buộc)

- `chat:write` (gửi/cập nhật/xóa tin nhắn qua `chat.postMessage`)
  https://docs.slack.dev/reference/methods/chat.postMessage
- `im:write` (mở DMs qua `conversations.open` cho DM người dùng)
  https://docs.slack.dev/reference/methods/conversations.open
- `channels:history`, `groups:history`, `im:history`, `mpim:history`
  https://docs.slack.dev/reference/methods/conversations.history
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
  https://docs.slack.dev/reference/methods/conversations.info
- `users:read` (tra cứu người dùng)
  https://docs.slack.dev/reference/methods/users.info
- `reactions:read`, `reactions:write` (`reactions.get` / `reactions.add`)
  https://docs.slack.dev/reference/methods/reactions.get
  https://docs.slack.dev/reference/methods/reactions.add
- `pins:read`, `pins:write` (`pins.list` / `pins.add` / `pins.remove`)
  https://docs.slack.dev/reference/scopes/pins.read
  https://docs.slack.dev/reference/scopes/pins.write
- `emoji:read` (`emoji.list`)
  https://docs.slack.dev/reference/scopes/emoji.read
- `files:write` (tải lên qua `files.uploadV2`)
  https://docs.slack.dev/messaging/working-with-files/#upload

### User token scopes (tùy chọn, mặc định chỉ đọc)

Thêm các mục này dưới **User Token Scopes** nếu bạn cấu hình `channels.slack.userToken`.

- `channels:history`, `groups:history`, `im:history`, `mpim:history`
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
- `users:read`
- `reactions:read`
- `pins:read`
- `emoji:read`
- `search:read`

### Chưa cần hôm nay (nhưng có thể trong tương lai)

- `mpim:write` (chỉ khi thêm mở group-DM/bắt đầu DM qua `conversations.open`)
- `groups:write` (chỉ khi thêm quản lý kênh riêng tư: tạo/đổi tên/mời/lưu trữ)
- `chat:write.public` (chỉ khi muốn đăng vào kênh bot chưa tham gia)
  https://docs.slack.dev/reference/scopes/chat.write.public
- `users:read.email` (chỉ khi cần trường email từ `users.info`)
  https://docs.slack.dev/changelog/2017-04-narrowing-email-access
- `files:read` (chỉ khi bắt đầu liệt kê/đọc metadata tệp)

## Cấu hình

Slack chỉ dùng Socket Mode (không có máy chủ HTTP webhook). Cung cấp cả hai token:

```json
{
  "slack": {
    "enabled": true,
    "botToken": "xoxb-...",
    "appToken": "xapp-...",
    "groupPolicy": "allowlist",
    "dm": {
      "enabled": true,
      "policy": "pairing",
      "allowFrom": ["U123", "U456", "*"],
      "groupEnabled": false,
      "groupChannels": ["G123"],
      "replyToMode": "all"
    },
    "channels": {
      "C123": { "allow": true, "requireMention": true },
      "#general": {
        "allow": true,
        "requireMention": true,
        "users": ["U123"],
        "skills": ["search", "docs"],
        "systemPrompt": "Keep answers short."
      }
    },
    "reactionNotifications": "own",
    "reactionAllowlist": ["U123"],
    "replyToMode": "off",
    "actions": {
      "reactions": true,
      "messages": true,
      "pins": true,
      "memberInfo": true,
      "emojiList": true
    },
    "slashCommand": {
      "enabled": true,
      "name": "openclaw",
      "sessionPrefix": "slack:slash",
      "ephemeral": true
    },
    "textChunkLimit": 4000,
    "mediaMaxMb": 20
  }
}
```

Token cũng có thể cung cấp qua biến môi trường:

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`

Phản ứng xác nhận (ack) được điều khiển toàn cục qua `messages.ackReaction` +
`messages.ackReactionScope`. Dùng `messages.removeAckAfterReply` để xóa
phản ứng ack sau khi bot trả lời.

## Giới hạn

- Văn bản gửi ra được chia khối tới `channels.slack.textChunkLimit` (mặc định 4000).
- Tùy chọn chia theo dòng mới: đặt `channels.slack.chunkMode="newline"` để tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- Tải lên media bị giới hạn bởi `channels.slack.mediaMaxMb` (mặc định 20).

## Thread trả lời

Mặc định, OpenClaw trả lời ở kênh chính. Dùng `channels.slack.replyToMode` để điều khiển threading tự động:

| Mode    | Hành vi                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `off`   | **Mặc định.** Trả lời ở kênh chính. Chỉ tạo thread nếu tin nhắn kích hoạt đã ở trong thread.                                   |
| `first` | Lần trả lời đầu vào thread (dưới tin nhắn kích hoạt), các lần sau vào kênh chính. Hữu ích để giữ ngữ cảnh mà tránh rối thread. |
| `all`   | Tất cả trả lời vào thread. Giữ hội thoại gọn nhưng có thể giảm khả năng hiển thị.                                              |

Chế độ áp dụng cho cả auto-replies và lời gọi công cụ của tác tử (`slack sendMessage`).

### Threading theo loại chat

Bạn có thể cấu hình hành vi threading khác nhau theo từng loại chat bằng cách đặt `channels.slack.replyToModeByChatType`:

```json5
{
  channels: {
    slack: {
      replyToMode: "off", // default for channels
      replyToModeByChatType: {
        direct: "all", // DMs always thread
        group: "first", // group DMs/MPIM thread first reply
      },
    },
  },
}
```

Các loại chat được hỗ trợ:

- `direct`: DMs 1:1 (Slack `im`)
- `group`: group DMs / MPIMs (Slack `mpim`)
- `channel`: kênh tiêu chuẩn (công khai/riêng tư)

Thứ tự ưu tiên:

1. `replyToModeByChatType.<chatType>`
2. `replyToMode`
3. Mặc định của nhà cung cấp (`off`)

`channels.slack.dm.replyToMode` cũ vẫn được chấp nhận làm phương án dự phòng cho `direct` khi không có ghi đè theo loại chat.

Ví dụ:

Chỉ thread DMs:

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { direct: "all" },
    },
  },
}
```

Thread group DMs nhưng giữ kênh ở gốc:

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { group: "first" },
    },
  },
}
```

Làm kênh thành thread, giữ DMs ở gốc:

```json5
{
  channels: {
    slack: {
      replyToMode: "first",
      replyToModeByChatType: { direct: "off", group: "off" },
    },
  },
}
```

### Thẻ threading thủ công

Để kiểm soát chi tiết, dùng các thẻ này trong phản hồi của tác tử:

- `[[reply_to_current]]` — trả lời tin nhắn kích hoạt (bắt đầu/tiếp tục thread).
- `[[reply_to:<id>]]` — trả lời một message id cụ thể.

## Phiên + định tuyến

- DMs dùng chung phiên `main` (giống WhatsApp/Telegram).
- Kênh ánh xạ tới các phiên `agent:<agentId>:slack:channel:<channelId>`.
- Slash commands dùng các phiên `agent:<agentId>:slack:slash:<userId>` (tiền tố cấu hình qua `channels.slack.slashCommand.sessionPrefix`).
- Nếu Slack không cung cấp `channel_type`, OpenClaw suy ra từ tiền tố ID kênh (`D`, `C`, `G`) và mặc định `channel` để giữ khóa phiên ổn định.
- Đăng ký native command dùng `commands.native` (mặc định toàn cục `"auto"` → Slack tắt) và có thể ghi đè theo workspace bằng `channels.slack.commands.native`. Lệnh văn bản yêu cầu tin nhắn `/...` độc lập và có thể tắt bằng `commands.text: false`. Slack slash commands được quản lý trong ứng dụng Slack và không tự động xóa. Dùng `commands.useAccessGroups: false` để bỏ qua kiểm tra nhóm truy cập cho lệnh.
- Danh sách lệnh đầy đủ + cấu hình: [Slash commands](/tools/slash-commands)

## Bảo mật DM (ghép cặp)

- Mặc định: `channels.slack.dm.policy="pairing"` — người gửi DM chưa biết sẽ nhận mã ghép cặp (hết hạn sau 1 giờ).
- Phê duyệt qua: `openclaw pairing approve slack <code>`.
- Cho phép tất cả: đặt `channels.slack.dm.policy="open"` và `channels.slack.dm.allowFrom=["*"]`.
- `channels.slack.dm.allowFrom` chấp nhận user IDs, @handles, hoặc email (được phân giải khi khởi động nếu token cho phép). Trình wizard chấp nhận username và phân giải sang id trong quá trình thiết lập khi token cho phép.

## Chính sách nhóm

- `channels.slack.groupPolicy` kiểm soát xử lý kênh (`open|disabled|allowlist`).
- `allowlist` yêu cầu kênh phải có trong `channels.slack.channels`.
- Nếu bạn chỉ đặt `SLACK_BOT_TOKEN`/`SLACK_APP_TOKEN` và không bao giờ tạo mục `channels.slack`,
  mặc định khi chạy `groupPolicy` là `open`. Thêm `channels.slack.groupPolicy`,
  `channels.defaults.groupPolicy`, hoặc danh sách cho phép kênh để khóa chặt.
- Trình wizard cấu hình chấp nhận tên `#channel` và phân giải sang ID khi có thể
  (công khai + riêng tư); nếu có nhiều kết quả, ưu tiên kênh đang hoạt động.
- Khi khởi động, OpenClaw phân giải tên kênh/người dùng trong allowlist sang ID (khi token cho phép)
  và ghi log ánh xạ; các mục không phân giải được sẽ giữ nguyên như đã nhập.
- Để **không cho phép kênh nào**, đặt `channels.slack.groupPolicy: "disabled"` (hoặc giữ allowlist rỗng).

Tùy chọn kênh (`channels.slack.channels.<id>` hoặc `channels.slack.channels.<name>`):

- `allow`: cho phép/từ chối kênh khi `groupPolicy="allowlist"`.
- `requireMention`: kiểm soát mention cho kênh.
- `tools`: ghi đè chính sách công cụ theo kênh (`allow`/`deny`/`alsoAllow`).
- `toolsBySender`: ghi đè chính sách công cụ theo người gửi trong kênh (khóa là sender ids/@handles/emails; hỗ trợ wildcard `"*"`).
- `allowBots`: cho phép tin nhắn do bot tạo trong kênh này (mặc định: false).
- `users`: allowlist người dùng theo kênh (tùy chọn).
- `skills`: bộ lọc skill (bỏ qua = tất cả skills, rỗng = không skill nào).
- `systemPrompt`: system prompt bổ sung cho kênh (kết hợp với topic/purpose).
- `enabled`: đặt `false` để vô hiệu hóa kênh.

## Đích gửi

Dùng các mục này với gửi cron/CLI:

- `user:<id>` cho DMs
- `channel:<id>` cho kênh

## Hành động công cụ

Hành động công cụ Slack có thể được kiểm soát bằng `channels.slack.actions.*`:

| Nhóm hành động | Mặc định | Ghi chú                   |
| -------------- | -------- | ------------------------- |
| reactions      | bật      | Phản ứng + liệt kê        |
| messages       | bật      | Đọc/gửi/sửa/xóa           |
| pins           | bật      | Ghim/bỏ ghim/liệt kê      |
| memberInfo     | bật      | Thông tin thành viên      |
| emojiList      | bật      | Danh sách emoji tùy chỉnh |

## Ghi chú bảo mật

- Thao tác ghi mặc định dùng bot token để các hành động thay đổi trạng thái
  luôn nằm trong phạm vi quyền và danh tính của bot ứng dụng.
- Đặt `userTokenReadOnly: false` cho phép dùng user token cho thao tác ghi
  khi không có bot token, nghĩa là hành động chạy với quyền của người cài đặt.
  Hãy coi user token là đặc quyền cao và giữ các cổng hành động và allowlist chặt chẽ.
- Nếu bật ghi bằng user token, hãy đảm bảo user token có các write scopes bạn mong đợi (`chat:write`, `reactions:write`, `pins:write`,
  `files:write`) nếu không các thao tác sẽ thất bại.

## Ghi chú

- Kiểm soát mention được điều khiển qua `channels.slack.channels` (đặt `requireMention` thành `true`); `agents.list[].groupChat.mentionPatterns` (hoặc `messages.groupChat.mentionPatterns`) cũng được tính là mention.
- Ghi đè đa tác tử: đặt các mẫu theo từng tác tử tại `agents.list[].groupChat.mentionPatterns`.
- Thông báo phản ứng tuân theo `channels.slack.reactionNotifications` (dùng `reactionAllowlist` với chế độ `allowlist`).
- Tin nhắn do bot tạo bị bỏ qua theo mặc định; bật qua `channels.slack.allowBots` hoặc `channels.slack.channels.<id>.allowBots`.
- Cảnh báo: Nếu cho phép trả lời bot khác (`channels.slack.allowBots=true` hoặc `channels.slack.channels.<id>.allowBots=true`), hãy ngăn vòng lặp bot-to-bot bằng `requireMention`, allowlist `channels.slack.channels.<id>.users`, và/hoặc các guardrail rõ ràng trong `AGENTS.md` và `SOUL.md`.
- Với công cụ Slack, ngữ nghĩa xóa phản ứng nằm tại [/tools/reactions](/tools/reactions).
- Tệp đính kèm được tải về kho media khi được phép và dưới giới hạn kích thước.
