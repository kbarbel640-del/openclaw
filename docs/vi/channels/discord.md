---
summary: "Trạng thái hỗ trợ bot Discord, các khả năng và cấu hình"
read_when:
  - Làm việc trên các tính năng kênh Discord
title: "Discord"
x-i18n:
  source_path: channels/discord.md
  source_hash: 9bebfe8027ff1972
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:54Z
---

# Discord (Bot API)

Trạng thái: sẵn sàng cho DM và các kênh văn bản trong guild thông qua gateway bot Discord chính thức.

## Thiết lập nhanh (cho người mới)

1. Tạo một bot Discord và sao chép bot token.
2. Trong cài đặt ứng dụng Discord, bật **Message Content Intent** (và **Server Members Intent** nếu bạn dự định dùng allowlist hoặc tra cứu tên).
3. Đặt token cho OpenClaw:
   - Env: `DISCORD_BOT_TOKEN=...`
   - Hoặc config: `channels.discord.token: "..."`.
   - Nếu cả hai đều được đặt, config sẽ được ưu tiên (env fallback chỉ áp dụng cho tài khoản mặc định).
4. Mời bot vào server của bạn với quyền nhắn tin (tạo server riêng nếu bạn chỉ muốn dùng DM).
5. Khởi động Gateway.
6. Truy cập DM được ghép cặp theo mặc định; phê duyệt mã ghép cặp khi liên hệ lần đầu.

Cấu hình tối thiểu:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

## Mục tiêu

- Trò chuyện với OpenClaw qua Discord DM hoặc các kênh guild.
- Các cuộc chat trực tiếp sẽ gộp vào phiên chính của tác tử (mặc định `agent:main:main`); các kênh guild được tách riêng thành `agent:<agentId>:discord:channel:<channelId>` (tên hiển thị dùng `discord:<guildSlug>#<channelSlug>`).
- Group DM bị bỏ qua theo mặc định; bật bằng `channels.discord.dm.groupEnabled` và có thể hạn chế thêm bằng `channels.discord.dm.groupChannels`.
- Giữ định tuyến mang tính quyết định: phản hồi luôn quay lại đúng kênh đã nhận.

## Cách hoạt động

1. Tạo ứng dụng Discord → Bot, bật các intent cần thiết (DM + tin nhắn guild + nội dung tin nhắn), và lấy bot token.
2. Mời bot vào server với các quyền cần để đọc/gửi tin nhắn ở nơi bạn muốn sử dụng.
3. Cấu hình OpenClaw với `channels.discord.token` (hoặc `DISCORD_BOT_TOKEN` làm phương án dự phòng).
4. Chạy Gateway; nó tự động khởi động kênh Discord khi có token (ưu tiên config, env làm fallback) và `channels.discord.enabled` không phải `false`.
   - Nếu bạn thích dùng env vars, đặt `DISCORD_BOT_TOKEN` (khối config là tùy chọn).
5. Chat trực tiếp: dùng `user:<id>` (hoặc một mention `<@id>`) khi gửi; mọi lượt đều vào phiên chia sẻ `main`. ID số trần là mơ hồ và sẽ bị từ chối.
6. Kênh guild: dùng `channel:<channelId>` để gửi. Mention là bắt buộc theo mặc định và có thể đặt theo từng guild hoặc từng kênh.
7. Chat trực tiếp: được bảo mật theo mặc định qua `channels.discord.dm.policy` (mặc định: `"pairing"`). Người gửi chưa biết sẽ nhận mã ghép cặp (hết hạn sau 1 giờ); phê duyệt qua `openclaw pairing approve discord <code>`.
   - Để giữ hành vi cũ “mở cho mọi người”: đặt `channels.discord.dm.policy="open"` và `channels.discord.dm.allowFrom=["*"]`.
   - Để dùng allowlist cứng: đặt `channels.discord.dm.policy="allowlist"` và liệt kê người gửi trong `channels.discord.dm.allowFrom`.
   - Để bỏ qua tất cả DM: đặt `channels.discord.dm.enabled=false` hoặc `channels.discord.dm.policy="disabled"`.
8. Group DM bị bỏ qua theo mặc định; bật bằng `channels.discord.dm.groupEnabled` và có thể hạn chế bằng `channels.discord.dm.groupChannels`.
9. Quy tắc guild tùy chọn: đặt `channels.discord.guilds` theo guild id (ưu tiên) hoặc slug, với quy tắc theo kênh.
10. Lệnh gốc (native) tùy chọn: `commands.native` mặc định là `"auto"` (bật cho Discord/Telegram, tắt cho Slack). Ghi đè bằng `channels.discord.commands.native: true|false|"auto"`; `false` sẽ xóa các lệnh đã đăng ký trước đó. Lệnh dạng văn bản được điều khiển bởi `commands.text` và phải gửi dưới dạng thông điệp `/...` độc lập. Dùng `commands.useAccessGroups: false` để bỏ qua kiểm tra nhóm truy cập cho lệnh.
    - Danh sách lệnh đầy đủ + cấu hình: [Slash commands](/tools/slash-commands)
11. Lịch sử ngữ cảnh guild tùy chọn: đặt `channels.discord.historyLimit` (mặc định 20, fallback sang `messages.groupChat.historyLimit`) để đưa N tin nhắn guild gần nhất làm ngữ cảnh khi trả lời một mention. Đặt `0` để tắt.
12. Reaction: tác tử có thể kích hoạt reaction qua công cụ `discord` (được kiểm soát bởi `channels.discord.actions.*`).
    - Ngữ nghĩa gỡ reaction: xem [/tools/reactions](/tools/reactions).
    - Công cụ `discord` chỉ được mở khi kênh hiện tại là Discord.
13. Lệnh gốc dùng khóa phiên cô lập (`agent:<agentId>:discord:slash:<userId>`) thay vì phiên chia sẻ `main`.

Lưu ý: Phân giải tên → id dùng tìm kiếm thành viên guild và yêu cầu Server Members Intent; nếu bot không thể tìm thành viên, hãy dùng id hoặc mention `<@id>`.
Lưu ý: Slug là chữ thường với khoảng trắng được thay bằng `-`. Tên kênh được slug hóa không có ký tự `#` ở đầu.
Lưu ý: Các dòng ngữ cảnh guild `[from:]` bao gồm `author.tag` + `id` để dễ tạo phản hồi có thể ping.

## Ghi cấu hình

Theo mặc định, Discord được phép ghi cập nhật cấu hình được kích hoạt bởi `/config set|unset` (yêu cầu `commands.config: true`).

Tắt bằng:

```json5
{
  channels: { discord: { configWrites: false } },
}
```

## Cách tạo bot của riêng bạn

Đây là thiết lập trong “Discord Developer Portal” để chạy OpenClaw trong một kênh server (guild) như `#help`.

### 1) Tạo ứng dụng Discord + bot user

1. Discord Developer Portal → **Applications** → **New Application**
2. Trong ứng dụng của bạn:
   - **Bot** → **Add Bot**
   - Sao chép **Bot Token** (đây là thứ bạn đặt vào `DISCORD_BOT_TOKEN`)

### 2) Bật các gateway intent mà OpenClaw cần

Discord chặn các “privileged intents” trừ khi bạn bật rõ ràng.

Trong **Bot** → **Privileged Gateway Intents**, bật:

- **Message Content Intent** (bắt buộc để đọc nội dung tin nhắn trong hầu hết guild; nếu không bạn sẽ thấy “Used disallowed intents” hoặc bot kết nối nhưng không phản hồi)
- **Server Members Intent** (khuyến nghị; cần cho một số tra cứu thành viên/người dùng và khớp allowlist trong guild)

Bạn thường **không** cần **Presence Intent**. Việc đặt presence của chính bot (hành động `setPresence`) dùng gateway OP3 và không yêu cầu intent này; chỉ cần nếu bạn muốn nhận cập nhật presence của các thành viên khác.

### 3) Tạo URL mời (OAuth2 URL Generator)

Trong ứng dụng của bạn: **OAuth2** → **URL Generator**

**Scopes**

- ✅ `bot`
- ✅ `applications.commands` (bắt buộc cho lệnh gốc)

**Bot Permissions** (mức tối thiểu)

- ✅ View Channels
- ✅ Send Messages
- ✅ Read Message History
- ✅ Embed Links
- ✅ Attach Files
- ✅ Add Reactions (tùy chọn nhưng khuyến nghị)
- ✅ Use External Emojis / Stickers (tùy chọn; chỉ khi bạn muốn)

Tránh **Administrator** trừ khi bạn đang debug và hoàn toàn tin tưởng bot.

Sao chép URL được tạo, mở nó, chọn server của bạn và cài bot.

### 4) Lấy các id (guild/user/channel)

Discord dùng id số ở khắp nơi; cấu hình OpenClaw ưu tiên id.

1. Discord (desktop/web) → **User Settings** → **Advanced** → bật **Developer Mode**
2. Nhấp chuột phải:
   - Tên server → **Copy Server ID** (guild id)
   - Kênh (ví dụ `#help`) → **Copy Channel ID**
   - Người dùng của bạn → **Copy User ID**

### 5) Cấu hình OpenClaw

#### Token

Đặt bot token qua env var (khuyến nghị trên server):

- `DISCORD_BOT_TOKEN=...`

Hoặc qua config:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

Hỗ trợ đa tài khoản: dùng `channels.discord.accounts` với token theo từng tài khoản và `name` tùy chọn. Xem [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) để biết mẫu dùng chung.

#### Allowlist + định tuyến kênh

Ví dụ “một server, chỉ cho phép tôi, chỉ cho phép #help”:

```json5
{
  channels: {
    discord: {
      enabled: true,
      dm: { enabled: false },
      guilds: {
        YOUR_GUILD_ID: {
          users: ["YOUR_USER_ID"],
          requireMention: true,
          channels: {
            help: { allow: true, requireMention: true },
          },
        },
      },
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

Ghi chú:

- `requireMention: true` nghĩa là bot chỉ trả lời khi được mention (khuyến nghị cho kênh dùng chung).
- `agents.list[].groupChat.mentionPatterns` (hoặc `messages.groupChat.mentionPatterns`) cũng được tính là mention cho tin nhắn guild.
- Ghi đè đa tác tử: đặt mẫu theo từng tác tử trong `agents.list[].groupChat.mentionPatterns`.
- Nếu có `channels`, mọi kênh không được liệt kê sẽ bị từ chối theo mặc định.
- Dùng một mục kênh `"*"` để áp dụng mặc định cho tất cả kênh; mục kênh cụ thể sẽ ghi đè wildcard.
- Thread kế thừa cấu hình kênh cha (allowlist, `requireMention`, skills, prompt, v.v.) trừ khi bạn thêm id kênh thread một cách rõ ràng.
- Gợi ý chủ sở hữu: khi một allowlist `users` theo guild hoặc kênh khớp với người gửi, OpenClaw coi người đó là chủ sở hữu trong system prompt. Để có chủ sở hữu toàn cục trên mọi kênh, đặt `commands.ownerAllowFrom`.
- Tin nhắn do bot tạo bị bỏ qua theo mặc định; đặt `channels.discord.allowBots=true` để cho phép (tin nhắn của chính bot vẫn bị lọc).
- Cảnh báo: Nếu bạn cho phép trả lời bot khác (`channels.discord.allowBots=true`), hãy ngăn vòng lặp bot‑to‑bot bằng `requireMention`, allowlist `channels.discord.guilds.*.channels.<id>.users`, và/hoặc xóa guardrail trong `AGENTS.md` và `SOUL.md`.

### 6) Xác minh hoạt động

1. Khởi động Gateway.
2. Trong kênh server của bạn, gửi: `@Krill hello` (hoặc tên bot của bạn).
3. Nếu không có gì xảy ra: xem **Troubleshooting** bên dưới.

### Troubleshooting

- Trước tiên: chạy `openclaw doctor` và `openclaw channels status --probe` (cảnh báo có thể hành động + kiểm tra nhanh).
- **“Used disallowed intents”**: bật **Message Content Intent** (và có thể cả **Server Members Intent**) trong Developer Portal, sau đó khởi động lại Gateway.
- **Bot kết nối nhưng không bao giờ trả lời trong kênh guild**:
  - Thiếu **Message Content Intent**, hoặc
  - Bot thiếu quyền kênh (View/Send/Read History), hoặc
  - Cấu hình yêu cầu mention và bạn chưa mention, hoặc
  - Allowlist guild/kênh từ chối kênh/người dùng.
- **`requireMention: false` nhưng vẫn không có phản hồi**:
- `channels.discord.groupPolicy` mặc định là **allowlist**; đặt nó thành `"open"` hoặc thêm mục guild dưới `channels.discord.guilds` (tùy chọn liệt kê kênh dưới `channels.discord.guilds.<id>.channels` để hạn chế).
  - Nếu bạn chỉ đặt `DISCORD_BOT_TOKEN` và không bao giờ tạo phần `channels.discord`, runtime
    sẽ mặc định `groupPolicy` thành `open`. Thêm `channels.discord.groupPolicy`,
    `channels.defaults.groupPolicy`, hoặc allowlist guild/kênh để khóa chặt.
- `requireMention` phải nằm dưới `channels.discord.guilds` (hoặc một kênh cụ thể). `channels.discord.requireMention` ở cấp cao nhất sẽ bị bỏ qua.
- **Kiểm tra quyền** (`channels status --probe`) chỉ kiểm tra id kênh số. Nếu bạn dùng slug/tên làm khóa `channels.discord.guilds.*.channels`, kiểm tra không thể xác minh quyền.
- **DM không hoạt động**: `channels.discord.dm.enabled=false`, `channels.discord.dm.policy="disabled"`, hoặc bạn chưa được phê duyệt (`channels.discord.dm.policy="pairing"`).
- **Phê duyệt exec trong Discord**: Discord hỗ trợ **UI nút** cho phê duyệt exec trong DM (Cho phép một lần / Luôn cho phép / Từ chối). `/approve <id> ...` chỉ dành cho phê duyệt được chuyển tiếp và sẽ không giải quyết các prompt nút của Discord. Nếu bạn thấy `❌ Failed to submit approval: Error: unknown approval id` hoặc UI không bao giờ hiện, hãy kiểm tra:
  - `channels.discord.execApprovals.enabled: true` trong config của bạn.
  - Discord user ID của bạn có nằm trong `channels.discord.execApprovals.approvers` (UI chỉ gửi cho người phê duyệt).
  - Dùng các nút trong DM (**Allow once**, **Always allow**, **Deny**).
  - Xem [Exec approvals](/tools/exec-approvals) và [Slash commands](/tools/slash-commands) để hiểu luồng phê duyệt và lệnh rộng hơn.

## Khả năng & giới hạn

- DM và kênh văn bản guild (thread được xem là kênh riêng; không hỗ trợ voice).
- Chỉ báo đang gõ được gửi theo best‑effort; chia nhỏ tin nhắn dùng `channels.discord.textChunkLimit` (mặc định 2000) và tách phản hồi dài theo số dòng (`channels.discord.maxLinesPerMessage`, mặc định 17).
- Chia nhỏ theo dòng trống tùy chọn: đặt `channels.discord.chunkMode="newline"` để tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- Hỗ trợ tải file lên đến `channels.discord.mediaMaxMb` đã cấu hình (mặc định 8 MB).
- Trả lời trong guild bị chặn bởi mention theo mặc định để tránh bot ồn ào.
- Ngữ cảnh trả lời được chèn khi tin nhắn tham chiếu tin nhắn khác (nội dung trích dẫn + id).
- Thread trả lời gốc **tắt theo mặc định**; bật bằng `channels.discord.replyToMode` và reply tags.

## Chính sách retry

Các lời gọi Discord API outbound sẽ retry khi gặp rate limit (429) bằng `retry_after` của Discord khi có, với backoff theo hàm mũ và jitter. Cấu hình qua `channels.discord.retry`. Xem [Retry policy](/concepts/retry).

## Cấu hình

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "abc.123",
      groupPolicy: "allowlist",
      guilds: {
        "*": {
          channels: {
            general: { allow: true },
          },
        },
      },
      mediaMaxMb: 8,
      actions: {
        reactions: true,
        stickers: true,
        emojiUploads: true,
        stickerUploads: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        channels: true,
        voiceStatus: true,
        events: true,
        moderation: false,
        presence: false,
      },
      replyToMode: "off",
      dm: {
        enabled: true,
        policy: "pairing", // pairing | allowlist | open | disabled
        allowFrom: ["123456789012345678", "steipete"],
        groupEnabled: false,
        groupChannels: ["openclaw-dm"],
      },
      guilds: {
        "*": { requireMention: true },
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          reactionNotifications: "own",
          users: ["987654321098765432", "steipete"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["search", "docs"],
              systemPrompt: "Keep answers short.",
            },
          },
        },
      },
    },
  },
}
```

Ack reaction được điều khiển toàn cục qua `messages.ackReaction` +
`messages.ackReactionScope`. Dùng `messages.removeAckAfterReply` để xóa
ack reaction sau khi bot trả lời.

- `dm.enabled`: đặt `false` để bỏ qua tất cả DM (mặc định `true`).
- `dm.policy`: kiểm soát truy cập DM (`pairing` được khuyến nghị). `"open"` yêu cầu `dm.allowFrom=["*"]`.
- `dm.allowFrom`: allowlist DM (user id hoặc tên). Được dùng bởi `dm.policy="allowlist"` và để xác thực `dm.policy="open"`. Trình wizard chấp nhận username và phân giải sang id khi bot có thể tìm thành viên.
- `dm.groupEnabled`: bật group DM (mặc định `false`).
- `dm.groupChannels`: allowlist tùy chọn cho id hoặc slug kênh group DM.
- `groupPolicy`: điều khiển xử lý kênh guild (`open|disabled|allowlist`); `allowlist` yêu cầu allowlist kênh.
- `guilds`: quy tắc theo guild, khóa bằng guild id (ưu tiên) hoặc slug.
- `guilds."*"`: cài đặt mặc định theo guild áp dụng khi không có mục rõ ràng.
- `guilds.<id>.slug`: slug thân thiện tùy chọn dùng cho tên hiển thị.
- `guilds.<id>.users`: allowlist người dùng theo guild tùy chọn (id hoặc tên).
- `guilds.<id>.tools`: ghi đè chính sách tool theo guild tùy chọn (`allow`/`deny`/`alsoAllow`) dùng khi thiếu ghi đè theo kênh.
- `guilds.<id>.toolsBySender`: ghi đè chính sách tool theo người gửi ở cấp guild (áp dụng khi thiếu ghi đè theo kênh; hỗ trợ wildcard `"*"`).
- `guilds.<id>.channels.<channel>.allow`: cho phép/từ chối kênh khi `groupPolicy="allowlist"`.
- `guilds.<id>.channels.<channel>.requireMention`: chặn theo mention cho kênh.
- `guilds.<id>.channels.<channel>.tools`: ghi đè chính sách tool theo kênh tùy chọn (`allow`/`deny`/`alsoAllow`).
- `guilds.<id>.channels.<channel>.toolsBySender`: ghi đè chính sách tool theo người gửi trong kênh tùy chọn (hỗ trợ wildcard `"*"`).
- `guilds.<id>.channels.<channel>.users`: allowlist người dùng theo kênh tùy chọn.
- `guilds.<id>.channels.<channel>.skills`: bộ lọc skill (bỏ trống = tất cả skills, rỗng = không skill nào).
- `guilds.<id>.channels.<channel>.systemPrompt`: system prompt bổ sung cho kênh. Chủ đề kênh Discord được chèn như ngữ cảnh **không tin cậy** (không phải system prompt).
- `guilds.<id>.channels.<channel>.enabled`: đặt `false` để vô hiệu hóa kênh.
- `guilds.<id>.channels`: quy tắc kênh (khóa là slug hoặc id kênh).
- `guilds.<id>.requireMention`: yêu cầu mention theo guild (có thể ghi đè theo kênh).
- `guilds.<id>.reactionNotifications`: chế độ sự kiện hệ thống reaction (`off`, `own`, `all`, `allowlist`).
- `textChunkLimit`: kích thước chia nhỏ văn bản outbound (ký tự). Mặc định: 2000.
- `chunkMode`: `length` (mặc định) chỉ tách khi vượt `textChunkLimit`; `newline` tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- `maxLinesPerMessage`: số dòng tối đa mềm cho mỗi tin nhắn. Mặc định: 17.
- `mediaMaxMb`: giới hạn media inbound lưu xuống đĩa.
- `historyLimit`: số tin nhắn guild gần đây đưa vào ngữ cảnh khi trả lời mention (mặc định 20; fallback sang `messages.groupChat.historyLimit`; `0` tắt).
- `dmHistoryLimit`: giới hạn lịch sử DM theo lượt người dùng. Ghi đè theo người dùng: `dms["<user_id>"].historyLimit`.
- `retry`: chính sách retry cho lời gọi Discord API outbound (attempts, minDelayMs, maxDelayMs, jitter).
- `pluralkit`: phân giải tin nhắn được proxy bởi PluralKit để các system member xuất hiện như người gửi riêng biệt.
- `actions`: cổng tool theo hành động; bỏ trống để cho phép tất cả (đặt `false` để tắt).
  - `reactions` (bao gồm react + đọc reaction)
  - `stickers`, `emojiUploads`, `stickerUploads`, `polls`, `permissions`, `messages`, `threads`, `pins`, `search`
  - `memberInfo`, `roleInfo`, `channelInfo`, `voiceStatus`, `events`
  - `channels` (tạo/sửa/xóa kênh + danh mục + quyền)
  - `roles` (thêm/xóa role, mặc định `false`)
  - `moderation` (timeout/kick/ban, mặc định `false`)
  - `presence` (trạng thái/hoạt động bot, mặc định `false`)
- `execApprovals`: DM phê duyệt exec chỉ cho Discord (UI nút). Hỗ trợ `enabled`, `approvers`, `agentFilter`, `sessionFilter`.

Thông báo reaction dùng `guilds.<id>.reactionNotifications`:

- `off`: không có sự kiện reaction.
- `own`: reaction trên tin nhắn của chính bot (mặc định).
- `all`: tất cả reaction trên mọi tin nhắn.
- `allowlist`: reaction từ `guilds.<id>.users` trên mọi tin nhắn (danh sách rỗng sẽ tắt).

### Hỗ trợ PluralKit (PK)

Bật tra cứu PK để các tin nhắn proxy được phân giải về system + member gốc.
Khi bật, OpenClaw dùng danh tính member cho allowlist và gắn nhãn
người gửi là `Member (PK:System)` để tránh ping Discord ngoài ý muốn.

```json5
{
  channels: {
    discord: {
      pluralkit: {
        enabled: true,
        token: "pk_live_...", // optional; required for private systems
      },
    },
  },
}
```

Ghi chú allowlist (khi bật PK):

- Dùng `pk:<memberId>` trong `dm.allowFrom`, `guilds.<id>.users`, hoặc `users` theo kênh.
- Tên hiển thị member cũng được khớp theo tên/slug.
- Tra cứu dùng ID tin nhắn Discord **gốc** (trước proxy), vì vậy PK API chỉ phân giải trong cửa sổ 30 phút của nó.
- Nếu tra cứu PK thất bại (ví dụ system riêng tư không có token), tin nhắn proxy được coi là tin nhắn bot và sẽ bị loại trừ trừ khi `channels.discord.allowBots=true`.

### Mặc định hành động tool

| Nhóm hành động | Mặc định | Ghi chú                                |
| -------------- | -------- | -------------------------------------- |
| reactions      | enabled  | React + liệt kê reaction + emojiList   |
| stickers       | enabled  | Gửi sticker                            |
| emojiUploads   | enabled  | Tải emoji lên                          |
| stickerUploads | enabled  | Tải sticker lên                        |
| polls          | enabled  | Tạo poll                               |
| permissions    | enabled  | Snapshot quyền kênh                    |
| messages       | enabled  | Đọc/gửi/sửa/xóa                        |
| threads        | enabled  | Tạo/liệt kê/trả lời                    |
| pins           | enabled  | Ghim/bỏ ghim/liệt kê                   |
| search         | enabled  | Tìm kiếm tin nhắn (tính năng preview)  |
| memberInfo     | enabled  | Thông tin thành viên                   |
| roleInfo       | enabled  | Danh sách role                         |
| channelInfo    | enabled  | Thông tin + danh sách kênh             |
| channels       | enabled  | Quản lý kênh/danh mục                  |
| voiceStatus    | enabled  | Tra cứu trạng thái voice               |
| events         | enabled  | Liệt kê/tạo sự kiện đã lên lịch        |
| roles          | disabled | Thêm/xóa role                          |
| moderation     | disabled | Timeout/kick/ban                       |
| presence       | disabled | Trạng thái/hoạt động bot (setPresence) |

- `replyToMode`: `off` (mặc định), `first`, hoặc `all`. Chỉ áp dụng khi model có reply tag.

## Reply tags

Để yêu cầu trả lời theo thread, model có thể bao gồm một tag trong output:

- `[[reply_to_current]]` — trả lời tin nhắn Discord đã kích hoạt.
- `[[reply_to:<id>]]` — trả lời một message id cụ thể từ ngữ cảnh/lịch sử.
  Message id hiện tại được thêm vào prompt dưới dạng `[message_id: …]`; các mục lịch sử đã bao gồm id.

Hành vi được điều khiển bởi `channels.discord.replyToMode`:

- `off`: bỏ qua tag.
- `first`: chỉ chunk/đính kèm outbound đầu tiên là trả lời.
- `all`: mọi chunk/đính kèm outbound đều là trả lời.

Ghi chú khớp allowlist:

- `allowFrom`/`users`/`groupChannels` chấp nhận id, tên, tag, hoặc mention như `<@id>`.
- Hỗ trợ tiền tố như `discord:`/`user:` (người dùng) và `channel:` (group DM).
- Dùng `*` để cho phép mọi người gửi/kênh.
- Khi có `guilds.<id>.channels`, các kênh không liệt kê sẽ bị từ chối theo mặc định.
- Khi `guilds.<id>.channels` bị bỏ qua, tất cả kênh trong guild được allowlist đều được phép.
- Để **không cho phép kênh nào**, đặt `channels.discord.groupPolicy: "disabled"` (hoặc giữ allowlist rỗng).
- Trình wizard cấu hình chấp nhận tên `Guild/Channel` (công khai + riêng tư) và phân giải sang ID khi có thể.
- Khi khởi động, OpenClaw phân giải tên kênh/người dùng trong allowlist sang ID (khi bot có thể tìm thành viên)
  và ghi log ánh xạ; các mục không phân giải được sẽ giữ nguyên như đã nhập.

Ghi chú về lệnh gốc:

- Các lệnh đã đăng ký phản chiếu các lệnh chat của OpenClaw.
- Lệnh gốc tuân theo cùng allowlist như DM/tin nhắn guild (`channels.discord.dm.allowFrom`, `channels.discord.guilds`, quy tắc theo kênh).
- Slash command có thể vẫn hiển thị trong UI Discord cho người không có trong allowlist; OpenClaw sẽ thực thi kiểm soát allowlist và trả lời “không được phép”.

## Hành động tool

Tác tử có thể gọi `discord` với các hành động như:

- `react` / `reactions` (thêm hoặc liệt kê reaction)
- `sticker`, `poll`, `permissions`
- `readMessages`, `sendMessage`, `editMessage`, `deleteMessage`
- Payload đọc/tìm kiếm/ghim bao gồm `timestampMs` đã chuẩn hóa (UTC epoch ms) và `timestampUtc` cùng với `timestamp` thô của Discord.
- `threadCreate`, `threadList`, `threadReply`
- `pinMessage`, `unpinMessage`, `listPins`
- `searchMessages`, `memberInfo`, `roleInfo`, `roleAdd`, `roleRemove`, `emojiList`
- `channelInfo`, `channelList`, `voiceStatus`, `eventList`, `eventCreate`
- `timeout`, `kick`, `ban`
- `setPresence` (hoạt động bot và trạng thái online)

ID tin nhắn Discord được đưa ra trong ngữ cảnh được chèn (`[discord message id: …]` và các dòng lịch sử) để tác tử có thể nhắm mục tiêu.
Emoji có thể là unicode (ví dụ `✅`) hoặc cú pháp emoji tùy chỉnh như `<:party_blob:1234567890>`.

## An toàn & vận hành

- Xem bot token như mật khẩu; ưu tiên env var `DISCORD_BOT_TOKEN` trên các host được giám sát hoặc khóa quyền truy cập file config.
- Chỉ cấp cho bot các quyền cần thiết (thường là Read/Send Messages).
- Nếu bot bị treo hoặc dính rate limit, hãy khởi động lại Gateway (`openclaw gateway --force`) sau khi xác nhận không có tiến trình nào khác đang sở hữu phiên Discord.
