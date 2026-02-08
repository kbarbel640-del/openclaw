---
summary: "Trạng thái hỗ trợ bot Telegram, khả năng và cấu hình"
read_when:
  - Làm việc với các tính năng Telegram hoặc webhook
title: "Telegram"
x-i18n:
  source_path: channels/telegram.md
  source_hash: 5f75bd20da52c8f0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:13Z
---

# Telegram (Bot API)

Trạng thái: sẵn sàng cho sản xuất đối với DM bot + nhóm qua grammY. Mặc định dùng long-polling; webhook là tùy chọn.

## Quick setup (beginner)

1. Tạo bot với **@BotFather** ([liên kết trực tiếp](https://t.me/BotFather)). Xác nhận handle chính xác là `@BotFather`, sau đó sao chép token.
2. Thiết lập token:
   - Env: `TELEGRAM_BOT_TOKEN=...`
   - Hoặc config: `channels.telegram.botToken: "..."`.
   - Nếu cả hai đều được thiết lập, config sẽ được ưu tiên (env chỉ là dự phòng cho tài khoản mặc định).
3. Khởi động Gateway.
4. Quyền truy cập DM mặc định là ghép cặp; phê duyệt mã ghép cặp ở lần liên hệ đầu tiên.

Cấu hình tối thiểu:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
    },
  },
}
```

## What it is

- Một kênh Telegram Bot API do Gateway sở hữu.
- Định tuyến xác định: phản hồi quay lại Telegram; mô hình không bao giờ tự chọn kênh.
- DM dùng chung phiên chính của tác tử; nhóm được tách biệt (`agent:<agentId>:telegram:group:<chatId>`).

## Setup (fast path)

### 1) Tạo bot token (BotFather)

1. Mở Telegram và chat với **@BotFather** ([liên kết trực tiếp](https://t.me/BotFather)). Xác nhận handle chính xác là `@BotFather`.
2. Chạy `/newbot`, sau đó làm theo hướng dẫn (tên + username kết thúc bằng `bot`).
3. Sao chép token và lưu trữ an toàn.

Thiết lập BotFather tùy chọn:

- `/setjoingroups` — cho phép/từ chối thêm bot vào nhóm.
- `/setprivacy` — kiểm soát việc bot có thấy tất cả tin nhắn trong nhóm hay không.

### 2) Cấu hình token (env hoặc config)

Ví dụ:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    },
  },
}
```

Tùy chọn env: `TELEGRAM_BOT_TOKEN=...` (hoạt động cho tài khoản mặc định).
Nếu cả env và config đều được thiết lập, config được ưu tiên.

Hỗ trợ đa tài khoản: dùng `channels.telegram.accounts` với token theo từng tài khoản và `name` tùy chọn. Xem [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) để biết mô hình dùng chung.

3. Khởi động Gateway. Telegram sẽ bắt đầu khi token được xác định (ưu tiên config, env là dự phòng).
4. Truy cập DM mặc định là ghép cặp. Phê duyệt mã khi bot được liên hệ lần đầu.
5. Với nhóm: thêm bot, quyết định hành vi quyền riêng tư/quản trị (bên dưới), sau đó thiết lập `channels.telegram.groups` để kiểm soát yêu cầu nhắc tên + allowlist.

## Token + privacy + permissions (phía Telegram)

### Tạo token (BotFather)

- `/newbot` tạo bot và trả về token (giữ bí mật).
- Nếu token bị lộ, thu hồi/tạo lại qua @BotFather và cập nhật cấu hình.

### Khả năng nhìn thấy tin nhắn nhóm (Privacy Mode)

Bot Telegram mặc định bật **Privacy Mode**, giới hạn những tin nhắn nhóm mà bot nhận được.
Nếu bot cần thấy _tất cả_ tin nhắn nhóm, bạn có hai lựa chọn:

- Tắt privacy mode bằng `/setprivacy` **hoặc**
- Thêm bot làm **admin** của nhóm (bot admin nhận tất cả tin nhắn).

**Lưu ý:** Khi bạn bật/tắt privacy mode, Telegram yêu cầu xóa + thêm lại bot
vào từng nhóm để thay đổi có hiệu lực.

### Quyền nhóm (quyền admin)

Trạng thái admin được thiết lập trong nhóm (UI Telegram). Bot admin luôn nhận tất cả
tin nhắn nhóm, vì vậy hãy dùng admin nếu cần toàn bộ khả năng quan sát.

## How it works (behavior)

- Tin nhắn đến được chuẩn hóa vào phong bì kênh dùng chung với ngữ cảnh trả lời và placeholder media.
- Trả lời trong nhóm mặc định yêu cầu nhắc tên (native @mention hoặc `agents.list[].groupChat.mentionPatterns` / `messages.groupChat.mentionPatterns`).
- Ghi đè đa tác tử: thiết lập pattern theo từng tác tử tại `agents.list[].groupChat.mentionPatterns`.
- Phản hồi luôn quay lại cùng cuộc chat Telegram.
- Long-polling dùng grammY runner với tuần tự theo từng chat; mức song song tổng thể bị giới hạn bởi `agents.defaults.maxConcurrent`.
- Telegram Bot API không hỗ trợ xác nhận đã đọc; không có tùy chọn `sendReadReceipts`.

## Draft streaming

OpenClaw có thể stream phản hồi từng phần trong DM Telegram bằng `sendMessageDraft`.

Yêu cầu:

- Bật Threaded Mode cho bot trong @BotFather (forum topic mode).
- Chỉ áp dụng cho luồng chat riêng tư (Telegram bao gồm `message_thread_id` trong tin nhắn đến).
- `channels.telegram.streamMode` không được đặt thành `"off"` (mặc định: `"partial"`, `"block"` bật cập nhật draft theo khối).

Draft streaming chỉ áp dụng cho DM; Telegram không hỗ trợ trong nhóm hoặc kênh.

## Formatting (Telegram HTML)

- Văn bản gửi ra Telegram dùng `parse_mode: "HTML"` (tập con thẻ được Telegram hỗ trợ).
- Đầu vào dạng Markdown-ish được render thành **HTML an toàn cho Telegram** (đậm/nghiêng/gạch/xóa/code/liên kết); các phần tử khối được làm phẳng thành văn bản với xuống dòng/dấu đầu dòng.
- HTML thô từ mô hình được escape để tránh lỗi parse của Telegram.
- Nếu Telegram từ chối payload HTML, OpenClaw sẽ gửi lại cùng thông điệp dưới dạng plain text.

## Commands (native + custom)

OpenClaw đăng ký các lệnh native (như `/status`, `/reset`, `/model`) với menu bot của Telegram khi khởi động.
Bạn có thể thêm lệnh tùy chỉnh vào menu qua config:

```json5
{
  channels: {
    telegram: {
      customCommands: [
        { command: "backup", description: "Git backup" },
        { command: "generate", description: "Create an image" },
      ],
    },
  },
}
```

## Troubleshooting

- `setMyCommands failed` trong log thường có nghĩa là HTTPS/DNS outbound bị chặn tới `api.telegram.org`.
- Nếu thấy lỗi `sendMessage` hoặc `sendChatAction`, hãy kiểm tra định tuyến IPv6 và DNS.

Xem thêm: [Channel troubleshooting](/channels/troubleshooting).

Ghi chú:

- Lệnh tùy chỉnh **chỉ là mục menu**; OpenClaw không triển khai chúng trừ khi bạn xử lý ở nơi khác.
- Tên lệnh được chuẩn hóa (loại bỏ `/` ở đầu, chuyển sang chữ thường) và phải khớp `a-z`, `0-9`, `_` (1–32 ký tự).
- Lệnh tùy chỉnh **không thể ghi đè lệnh native**. Xung đột sẽ bị bỏ qua và ghi log.
- Nếu `commands.native` bị tắt, chỉ các lệnh tùy chỉnh được đăng ký (hoặc bị xóa nếu không có).

## Limits

- Văn bản gửi ra được chia khối tới `channels.telegram.textChunkLimit` (mặc định 4000).
- Tùy chọn chia theo dòng trống: đặt `channels.telegram.chunkMode="newline"` để tách theo đoạn (ranh giới đoạn) trước khi chia theo độ dài.
- Tải xuống/tải lên media bị giới hạn bởi `channels.telegram.mediaMaxMb` (mặc định 5).
- Yêu cầu Telegram Bot API timeout sau `channels.telegram.timeoutSeconds` (mặc định 500 qua grammY). Đặt thấp hơn để tránh treo lâu.
- Ngữ cảnh lịch sử nhóm dùng `channels.telegram.historyLimit` (hoặc `channels.telegram.accounts.*.historyLimit`), dự phòng là `messages.groupChat.historyLimit`. Đặt `0` để tắt (mặc định 50).
- Lịch sử DM có thể giới hạn bằng `channels.telegram.dmHistoryLimit` (lượt người dùng). Ghi đè theo từng người dùng: `channels.telegram.dms["<user_id>"].historyLimit`.

## Group activation modes

Mặc định, bot chỉ phản hồi khi được nhắc tên trong nhóm (`@botname` hoặc pattern trong `agents.list[].groupChat.mentionPatterns`). Để thay đổi hành vi này:

### Via config (recommended)

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": { requireMention: false }, // always respond in this group
      },
    },
  },
}
```

**Quan trọng:** Thiết lập `channels.telegram.groups` tạo **allowlist** — chỉ các nhóm được liệt kê (hoặc `"*"`) mới được chấp nhận.
Forum topic kế thừa cấu hình nhóm cha (allowFrom, requireMention, skills, prompts) trừ khi bạn thêm ghi đè theo từng topic dưới `channels.telegram.groups.<groupId>.topics.<topicId>`.

Cho phép tất cả nhóm với luôn phản hồi:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: false }, // all groups, always respond
      },
    },
  },
}
```

Giữ chế độ chỉ nhắc tên cho tất cả nhóm (mặc định):

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: true }, // or omit groups entirely
      },
    },
  },
}
```

### Via command (session-level)

Gửi trong nhóm:

- `/activation always` - phản hồi tất cả tin nhắn
- `/activation mention` - yêu cầu nhắc tên (mặc định)

**Lưu ý:** Lệnh chỉ cập nhật trạng thái phiên. Để duy trì qua khởi động lại, hãy dùng config.

### Getting the group chat ID

Chuyển tiếp bất kỳ tin nhắn nào từ nhóm tới `@userinfobot` hoặc `@getidsbot` trên Telegram để xem chat ID (số âm như `-1001234567890`).

**Mẹo:** Để lấy user ID của bạn, DM bot và bot sẽ trả lời với user ID (tin nhắn ghép cặp), hoặc dùng `/whoami` khi lệnh đã được bật.

**Lưu ý về quyền riêng tư:** `@userinfobot` là bot bên thứ ba. Nếu bạn muốn, hãy thêm bot vào nhóm, gửi một tin nhắn, và dùng `openclaw logs --follow` để đọc `chat.id`, hoặc dùng Bot API `getUpdates`.

## Config writes

Mặc định, Telegram được phép ghi cập nhật cấu hình do sự kiện kênh hoặc `/config set|unset` kích hoạt.

Điều này xảy ra khi:

- Nhóm được nâng cấp lên supergroup và Telegram phát `migrate_to_chat_id` (chat ID thay đổi). OpenClaw có thể tự động migrate `channels.telegram.groups`.
- Bạn chạy `/config set` hoặc `/config unset` trong chat Telegram (yêu cầu `commands.config: true`).

Tắt bằng:

```json5
{
  channels: { telegram: { configWrites: false } },
}
```

## Topics (forum supergroups)

Forum topic Telegram bao gồm một `message_thread_id` cho mỗi tin nhắn. OpenClaw:

- Gắn `:topic:<threadId>` vào khóa phiên nhóm Telegram để mỗi topic được tách biệt.
- Gửi chỉ báo đang gõ và phản hồi với `message_thread_id` để câu trả lời nằm trong topic.
- Topic chung (thread id `1`) là đặc biệt: gửi tin nhắn bỏ qua `message_thread_id` (Telegram từ chối), nhưng chỉ báo đang gõ vẫn bao gồm nó.
- Hiển thị `MessageThreadId` + `IsForum` trong ngữ cảnh template để định tuyến/templating.
- Cấu hình theo topic có tại `channels.telegram.groups.<chatId>.topics.<threadId>` (skills, allowlist, auto-reply, system prompts, disable).
- Cấu hình topic kế thừa thiết lập nhóm (requireMention, allowlists, skills, prompts, enabled) trừ khi bị ghi đè theo topic.

Chat riêng tư đôi khi có thể bao gồm `message_thread_id` trong một số trường hợp rìa. OpenClaw giữ nguyên khóa phiên DM, nhưng vẫn dùng thread id cho phản hồi/draft streaming khi có.

## Inline Buttons

Telegram hỗ trợ bàn phím inline với các nút callback.

```json5
{
  channels: {
    telegram: {
      capabilities: {
        inlineButtons: "allowlist",
      },
    },
  },
}
```

Cấu hình theo từng tài khoản:

```json5
{
  channels: {
    telegram: {
      accounts: {
        main: {
          capabilities: {
            inlineButtons: "allowlist",
          },
        },
      },
    },
  },
}
```

Phạm vi:

- `off` — tắt inline buttons
- `dm` — chỉ DMs (chặn mục tiêu nhóm)
- `group` — chỉ nhóm (chặn mục tiêu DM)
- `all` — DMs + nhóm
- `allowlist` — DMs + nhóm, nhưng chỉ cho phép người gửi theo `allowFrom`/`groupAllowFrom` (quy tắc giống lệnh điều khiển)

Mặc định: `allowlist`.
Legacy: `capabilities: ["inlineButtons"]` = `inlineButtons: "all"`.

### Sending buttons

Dùng message tool với tham số `buttons`:

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  message: "Choose an option:",
  buttons: [
    [
      { text: "Yes", callback_data: "yes" },
      { text: "No", callback_data: "no" },
    ],
    [{ text: "Cancel", callback_data: "cancel" }],
  ],
}
```

Khi người dùng bấm nút, dữ liệu callback được gửi về tác tử như một tin nhắn với định dạng:
`callback_data: value`

### Configuration options

Khả năng Telegram có thể cấu hình ở hai mức (dạng object như trên; mảng chuỗi legacy vẫn được hỗ trợ):

- `channels.telegram.capabilities`: Cấu hình khả năng mặc định toàn cục áp dụng cho tất cả tài khoản Telegram trừ khi bị ghi đè.
- `channels.telegram.accounts.<account>.capabilities`: Khả năng theo từng tài khoản ghi đè mặc định toàn cục cho tài khoản đó.

Dùng thiết lập toàn cục khi tất cả bot/tài khoản Telegram cần hành vi giống nhau. Dùng cấu hình theo tài khoản khi các bot khác nhau cần hành vi khác nhau (ví dụ, một tài khoản chỉ xử lý DM trong khi tài khoản khác được phép trong nhóm).

## Access control (DMs + groups)

### DM access

- Mặc định: `channels.telegram.dmPolicy = "pairing"`. Người gửi chưa biết nhận mã ghép cặp; tin nhắn bị bỏ qua cho đến khi được phê duyệt (mã hết hạn sau 1 giờ).
- Phê duyệt qua:
  - `openclaw pairing list telegram`
  - `openclaw pairing approve telegram <CODE>`
- Ghép cặp là cơ chế trao đổi token mặc định cho DM Telegram. Chi tiết: [Pairing](/start/pairing)
- `channels.telegram.allowFrom` chấp nhận user ID dạng số (khuyến nghị) hoặc mục `@username`. Đây **không** phải username của bot; hãy dùng ID của người gửi. Trình wizard chấp nhận `@username` và cố gắng chuyển sang ID số khi có thể.

#### Finding your Telegram user ID

An toàn hơn (không dùng bot bên thứ ba):

1. Khởi động Gateway và DM bot của bạn.
2. Chạy `openclaw logs --follow` và tìm `from.id`.

Cách khác (Bot API chính thức):

1. DM bot của bạn.
2. Lấy updates bằng token bot và đọc `message.from.id`:
   ```bash
   curl "https://api.telegram.org/bot<bot_token>/getUpdates"
   ```

Bên thứ ba (kém riêng tư hơn):

- DM `@userinfobot` hoặc `@getidsbot` và dùng user id được trả về.

### Group access

Hai cơ chế kiểm soát độc lập:

**1. Nhóm nào được phép** (allowlist nhóm qua `channels.telegram.groups`):

- Không có cấu hình `groups` = cho phép tất cả nhóm
- Có cấu hình `groups` = chỉ cho phép các nhóm được liệt kê hoặc `"*"`
- Ví dụ: `"groups": { "-1001234567890": {}, "*": {} }` cho phép tất cả nhóm

**2. Người gửi nào được phép** (lọc người gửi qua `channels.telegram.groupPolicy`):

- `"open"` = mọi người gửi trong nhóm được phép đều có thể nhắn
- `"allowlist"` = chỉ người gửi trong `channels.telegram.groupAllowFrom` mới được nhắn
- `"disabled"` = không chấp nhận tin nhắn nhóm nào
  Mặc định là `groupPolicy: "allowlist"` (bị chặn trừ khi bạn thêm `groupAllowFrom`).

Phần lớn người dùng muốn: `groupPolicy: "allowlist"` + `groupAllowFrom` + các nhóm cụ thể được liệt kê trong `channels.telegram.groups`

Để cho phép **bất kỳ thành viên nhóm** nào trò chuyện trong một nhóm cụ thể (trong khi vẫn giữ lệnh điều khiển bị giới hạn cho người gửi được ủy quyền), hãy đặt ghi đè theo nhóm:

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": {
          groupPolicy: "open",
          requireMention: false,
        },
      },
    },
  },
}
```

## Long-polling vs webhook

- Mặc định: long-polling (không cần URL công khai).
- Chế độ webhook: đặt `channels.telegram.webhookUrl` và `channels.telegram.webhookSecret` (tùy chọn `channels.telegram.webhookPath`).
  - Listener cục bộ bind tới `0.0.0.0:8787` và phục vụ `POST /telegram-webhook` theo mặc định.
  - Nếu URL công khai khác, dùng reverse proxy và trỏ `channels.telegram.webhookUrl` tới endpoint công khai.

## Reply threading

Telegram hỗ trợ trả lời theo luồng bằng thẻ:

- `[[reply_to_current]]` -- trả lời tin nhắn kích hoạt.
- `[[reply_to:<id>]]` -- trả lời một message id cụ thể.

Được điều khiển bởi `channels.telegram.replyToMode`:

- `first` (mặc định), `all`, `off`.

## Audio messages (voice vs file)

Telegram phân biệt **voice notes** (bong bóng tròn) và **audio files** (thẻ metadata).
OpenClaw mặc định dùng audio files để tương thích ngược.

Để buộc gửi voice note trong phản hồi của tác tử, hãy chèn thẻ này ở bất kỳ đâu trong phản hồi:

- `[[audio_as_voice]]` — gửi audio dưới dạng voice note thay vì file.

Thẻ sẽ bị loại bỏ khỏi văn bản gửi đi. Các kênh khác bỏ qua thẻ này.

Với message tool, đặt `asVoice: true` với URL audio tương thích voice `media`
(`message` là tùy chọn khi có media):

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  media: "https://example.com/voice.ogg",
  asVoice: true,
}
```

## Stickers

OpenClaw hỗ trợ nhận và gửi sticker Telegram với bộ nhớ đệm thông minh.

### Receiving stickers

Khi người dùng gửi sticker, OpenClaw xử lý tùy theo loại sticker:

- **Sticker tĩnh (WEBP):** Tải xuống và xử lý qua vision. Sticker xuất hiện dưới dạng placeholder `<media:sticker>` trong nội dung tin nhắn.
- **Sticker động (TGS):** Bỏ qua (định dạng Lottie không được hỗ trợ xử lý).
- **Sticker video (WEBM):** Bỏ qua (định dạng video không được hỗ trợ xử lý).

Trường ngữ cảnh template khả dụng khi nhận sticker:

- `Sticker` — object với:
  - `emoji` — emoji gắn với sticker
  - `setName` — tên bộ sticker
  - `fileId` — Telegram file ID (gửi lại cùng sticker)
  - `fileUniqueId` — ID ổn định để tra cứu cache
  - `cachedDescription` — mô tả vision đã cache khi có

### Sticker cache

Sticker được xử lý qua khả năng vision của AI để tạo mô tả. Vì cùng một sticker thường được gửi lặp lại, OpenClaw cache các mô tả này để tránh gọi API dư thừa.

**Cách hoạt động:**

1. **Lần gặp đầu tiên:** Ảnh sticker được gửi tới AI để phân tích vision. AI tạo mô tả (ví dụ: "Một chú mèo hoạt hình vẫy tay nhiệt tình").
2. **Lưu cache:** Mô tả được lưu cùng file ID, emoji và tên bộ sticker.
3. **Các lần sau:** Khi thấy lại sticker, mô tả trong cache được dùng trực tiếp. Ảnh không được gửi tới AI.

**Vị trí cache:** `~/.openclaw/telegram/sticker-cache.json`

**Định dạng mục cache:**

```json
{
  "fileId": "CAACAgIAAxkBAAI...",
  "fileUniqueId": "AgADBAADb6cxG2Y",
  "emoji": "👋",
  "setName": "CoolCats",
  "description": "A cartoon cat waving enthusiastically",
  "cachedAt": "2026-01-15T10:30:00.000Z"
}
```

**Lợi ích:**

- Giảm chi phí API bằng cách tránh gọi vision lặp lại cho cùng sticker
- Thời gian phản hồi nhanh hơn cho sticker đã cache (không có độ trễ xử lý vision)
- Cho phép tìm kiếm sticker dựa trên mô tả đã cache

Cache được tạo tự động khi nhận sticker. Không cần quản lý thủ công.

### Sending stickers

Tác tử có thể gửi và tìm sticker bằng các action `sticker` và `sticker-search`. Chúng bị tắt mặc định và phải bật trong config:

```json5
{
  channels: {
    telegram: {
      actions: {
        sticker: true,
      },
    },
  },
}
```

**Gửi sticker:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "123456789",
  fileId: "CAACAgIAAxkBAAI...",
}
```

Tham số:

- `fileId` (bắt buộc) — Telegram file ID của sticker. Lấy từ `Sticker.fileId` khi nhận sticker, hoặc từ kết quả `sticker-search`.
- `replyTo` (tùy chọn) — message ID để trả lời.
- `threadId` (tùy chọn) — message thread ID cho forum topic.

**Tìm sticker:**

Tác tử có thể tìm sticker đã cache theo mô tả, emoji hoặc tên bộ:

```json5
{
  action: "sticker-search",
  channel: "telegram",
  query: "cat waving",
  limit: 5,
}
```

Trả về các sticker khớp từ cache:

```json5
{
  ok: true,
  count: 2,
  stickers: [
    {
      fileId: "CAACAgIAAxkBAAI...",
      emoji: "👋",
      description: "A cartoon cat waving enthusiastically",
      setName: "CoolCats",
    },
  ],
}
```

Tìm kiếm dùng so khớp mờ trên văn bản mô tả, ký tự emoji và tên bộ.

**Ví dụ với threading:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "-1001234567890",
  fileId: "CAACAgIAAxkBAAI...",
  replyTo: 42,
  threadId: 123,
}
```

## Streaming (drafts)

Telegram có thể stream **bong bóng draft** trong khi tác tử đang tạo phản hồi.
OpenClaw dùng Bot API `sendMessageDraft` (không phải tin nhắn thật) rồi gửi
phản hồi cuối cùng như tin nhắn bình thường.

Yêu cầu (Telegram Bot API 9.3+):

- **Chat riêng tư có bật topics** (forum topic mode cho bot).
- Tin nhắn đến phải bao gồm `message_thread_id` (private topic thread).
- Streaming bị bỏ qua cho nhóm/supergroup/kênh.

Cấu hình:

- `channels.telegram.streamMode: "off" | "partial" | "block"` (mặc định: `partial`)
  - `partial`: cập nhật bong bóng draft với văn bản stream mới nhất.
  - `block`: cập nhật bong bóng draft theo khối lớn hơn (chunked).
  - `off`: tắt draft streaming.
- Tùy chọn (chỉ cho `streamMode: "block"`):
  - `channels.telegram.draftChunk: { minChars?, maxChars?, breakPreference? }`
    - mặc định: `minChars: 200`, `maxChars: 800`, `breakPreference: "paragraph"` (giới hạn tới `channels.telegram.textChunkLimit`).

Lưu ý: draft streaming tách biệt với **block streaming** (tin nhắn kênh).
Block streaming mặc định tắt và cần `channels.telegram.blockStreaming: true`
nếu bạn muốn gửi tin nhắn Telegram sớm thay vì cập nhật draft.

Reasoning stream (chỉ Telegram):

- `/reasoning stream` stream phần lập luận vào bong bóng draft trong khi tạo phản hồi,
  sau đó gửi câu trả lời cuối cùng không kèm lập luận.
- Nếu `channels.telegram.streamMode` là `off`, reasoning stream bị tắt.
  Thêm ngữ cảnh: [Streaming + chunking](/concepts/streaming).

## Retry policy

Các lệnh gọi Telegram API outbound sẽ retry khi lỗi mạng tạm thời/429 với backoff lũy tiến và jitter. Cấu hình qua `channels.telegram.retry`. Xem [Retry policy](/concepts/retry).

## Agent tool (messages + reactions)

- Tool: `telegram` với action `sendMessage` (`to`, `content`, tùy chọn `mediaUrl`, `replyToMessageId`, `messageThreadId`).
- Tool: `telegram` với action `react` (`chatId`, `messageId`, `emoji`).
- Tool: `telegram` với action `deleteMessage` (`chatId`, `messageId`).
- Ngữ nghĩa xóa reaction: xem [/tools/reactions](/tools/reactions).
- Kiểm soát tool: `channels.telegram.actions.reactions`, `channels.telegram.actions.sendMessage`, `channels.telegram.actions.deleteMessage` (mặc định: bật), và `channels.telegram.actions.sticker` (mặc định: tắt).

## Reaction notifications

**Cách reactions hoạt động:**
Reaction Telegram đến dưới dạng **sự kiện `message_reaction` riêng biệt**, không phải thuộc tính trong payload tin nhắn. Khi người dùng thêm reaction, OpenClaw:

1. Nhận update `message_reaction` từ Telegram API
2. Chuyển đổi thành **system event** với định dạng: `"Telegram reaction added: {emoji} by {user} on msg {id}"`
3. Xếp hàng system event bằng **cùng khóa phiên** với tin nhắn thường
4. Khi tin nhắn tiếp theo đến trong cuộc hội thoại đó, các system event được rút ra và chèn lên đầu ngữ cảnh của tác tử

Tác tử thấy reactions như **thông báo hệ thống** trong lịch sử hội thoại, không phải metadata của tin nhắn.

**Cấu hình:**

- `channels.telegram.reactionNotifications`: Kiểm soát reaction nào kích hoạt thông báo
  - `"off"` — bỏ qua tất cả reactions
  - `"own"` — thông báo khi người dùng react vào tin nhắn của bot (best-effort; trong bộ nhớ) (mặc định)
  - `"all"` — thông báo cho tất cả reactions

- `channels.telegram.reactionLevel`: Kiểm soát khả năng reaction của tác tử
  - `"off"` — tác tử không thể react
  - `"ack"` — bot gửi reaction xác nhận (👀 khi đang xử lý) (mặc định)
  - `"minimal"` — tác tử có thể react hạn chế (hướng dẫn: 1 lần mỗi 5–10 lượt trao đổi)
  - `"extensive"` — tác tử có thể react thoải mái khi phù hợp

**Forum groups:** Reaction trong forum group bao gồm `message_thread_id` và dùng khóa phiên như `agent:main:telegram:group:{chatId}:topic:{threadId}`. Điều này đảm bảo reactions và tin nhắn trong cùng topic đi cùng nhau.

**Ví dụ cấu hình:**

```json5
{
  channels: {
    telegram: {
      reactionNotifications: "all", // See all reactions
      reactionLevel: "minimal", // Agent can react sparingly
    },
  },
}
```

**Yêu cầu:**

- Bot Telegram phải yêu cầu rõ ràng `message_reaction` trong `allowed_updates` (được OpenClaw cấu hình tự động)
- Với chế độ webhook, reactions được bao gồm trong webhook `allowed_updates`
- Với chế độ polling, reactions được bao gồm trong `getUpdates` `allowed_updates`

## Delivery targets (CLI/cron)

- Dùng chat id (`123456789`) hoặc username (`@name`) làm mục tiêu.
- Ví dụ: `openclaw message send --channel telegram --target 123456789 --message "hi"`.

## Troubleshooting

**Bot không phản hồi tin nhắn không nhắc tên trong nhóm:**

- Nếu bạn đặt `channels.telegram.groups.*.requireMention=false`, **privacy mode** của Telegram Bot API phải bị tắt.
  - BotFather: `/setprivacy` → **Disable** (sau đó xóa + thêm lại bot vào nhóm)
- `openclaw channels status` hiển thị cảnh báo khi config mong đợi tin nhắn nhóm không nhắc tên.
- `openclaw channels status --probe` có thể kiểm tra thêm tư cách thành viên cho group ID dạng số cụ thể (không thể audit quy tắc wildcard `"*"`).
- Kiểm tra nhanh: `/activation always` (chỉ cho phiên; dùng config để duy trì)

**Bot không thấy tin nhắn nhóm chút nào:**

- Nếu đặt `channels.telegram.groups`, nhóm phải được liệt kê hoặc dùng `"*"`
- Kiểm tra Privacy Settings trong @BotFather → "Group Privacy" phải **OFF**
- Xác minh bot thực sự là thành viên (không chỉ là admin không có quyền đọc)
- Kiểm tra log Gateway: `openclaw logs --follow` (tìm "skipping group message")

**Bot phản hồi khi nhắc tên nhưng không phản hồi `/activation always`:**

- Lệnh `/activation` cập nhật trạng thái phiên nhưng không lưu vào config
- Để duy trì, thêm nhóm vào `channels.telegram.groups` với `requireMention: false`

**Các lệnh như `/status` không hoạt động:**

- Đảm bảo Telegram user ID của bạn được ủy quyền (qua ghép cặp hoặc `channels.telegram.allowFrom`)
- Lệnh yêu cầu ủy quyền ngay cả trong nhóm có `groupPolicy: "open"`

**Long-polling bị hủy ngay trên Node 22+ (thường với proxy/custom fetch):**

- Node 22+ nghiêm ngặt hơn với instance `AbortSignal`; signal ngoại lai có thể hủy các lệnh gọi `fetch` ngay lập tức.
- Nâng cấp lên bản OpenClaw chuẩn hóa abort signals, hoặc chạy Gateway trên Node 20 cho tới khi nâng cấp được.

**Bot khởi động rồi im lặng không phản hồi (hoặc log `HttpError: Network request ... failed`):**

- Một số host resolve `api.telegram.org` sang IPv6 trước. Nếu server của bạn không có IPv6 egress hoạt động, grammY có thể bị kẹt với yêu cầu chỉ IPv6.
- Khắc phục bằng cách bật IPv6 egress **hoặc** buộc resolve IPv4 cho `api.telegram.org` (ví dụ, thêm mục `/etc/hosts` dùng bản ghi A IPv4, hoặc ưu tiên IPv4 trong DNS OS), rồi khởi động lại Gateway.
- Kiểm tra nhanh: `dig +short api.telegram.org A` và `dig +short api.telegram.org AAAA` để xác nhận DNS trả về gì.

## Configuration reference (Telegram)

Cấu hình đầy đủ: [Configuration](/gateway/configuration)

Tùy chọn provider:

- `channels.telegram.enabled`: bật/tắt khởi động kênh.
- `channels.telegram.botToken`: bot token (BotFather).
- `channels.telegram.tokenFile`: đọc token từ đường dẫn file.
- `channels.telegram.dmPolicy`: `pairing | allowlist | open | disabled` (mặc định: pairing).
- `channels.telegram.allowFrom`: allowlist DM (id/username). `open` yêu cầu `"*"`.
- `channels.telegram.groupPolicy`: `open | allowlist | disabled` (mặc định: allowlist).
- `channels.telegram.groupAllowFrom`: allowlist người gửi trong nhóm (id/username).
- `channels.telegram.groups`: mặc định theo nhóm + allowlist (dùng `"*"` cho mặc định toàn cục).
  - `channels.telegram.groups.<id>.groupPolicy`: ghi đè theo nhóm cho groupPolicy (`open | allowlist | disabled`).
  - `channels.telegram.groups.<id>.requireMention`: mặc định yêu cầu nhắc tên.
  - `channels.telegram.groups.<id>.skills`: lọc skill (bỏ qua = tất cả skills, rỗng = không skill nào).
  - `channels.telegram.groups.<id>.allowFrom`: ghi đè allowlist người gửi theo nhóm.
  - `channels.telegram.groups.<id>.systemPrompt`: system prompt bổ sung cho nhóm.
  - `channels.telegram.groups.<id>.enabled`: tắt nhóm khi `false`.
  - `channels.telegram.groups.<id>.topics.<threadId>.*`: ghi đè theo topic (các trường giống nhóm).
  - `channels.telegram.groups.<id>.topics.<threadId>.groupPolicy`: ghi đè theo topic cho groupPolicy (`open | allowlist | disabled`).
  - `channels.telegram.groups.<id>.topics.<threadId>.requireMention`: ghi đè yêu cầu nhắc tên theo topic.
- `channels.telegram.capabilities.inlineButtons`: `off | dm | group | all | allowlist` (mặc định: allowlist).
- `channels.telegram.accounts.<account>.capabilities.inlineButtons`: ghi đè theo tài khoản.
- `channels.telegram.replyToMode`: `off | first | all` (mặc định: `first`).
- `channels.telegram.textChunkLimit`: kích thước chia khối outbound (ký tự).
- `channels.telegram.chunkMode`: `length` (mặc định) hoặc `newline` để tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- `channels.telegram.linkPreview`: bật/tắt preview liên kết cho tin nhắn outbound (mặc định: true).
- `channels.telegram.streamMode`: `off | partial | block` (draft streaming).
- `channels.telegram.mediaMaxMb`: giới hạn media inbound/outbound (MB).
- `channels.telegram.retry`: retry policy cho lệnh gọi Telegram API outbound (attempts, minDelayMs, maxDelayMs, jitter).
- `channels.telegram.network.autoSelectFamily`: ghi đè Node autoSelectFamily (true=bật, false=tắt). Mặc định tắt trên Node 22 để tránh timeout Happy Eyeballs.
- `channels.telegram.proxy`: URL proxy cho lệnh gọi Bot API (SOCKS/HTTP).
- `channels.telegram.webhookUrl`: bật chế độ webhook (yêu cầu `channels.telegram.webhookSecret`).
- `channels.telegram.webhookSecret`: webhook secret (bắt buộc khi đặt webhookUrl).
- `channels.telegram.webhookPath`: đường dẫn webhook cục bộ (mặc định `/telegram-webhook`).
- `channels.telegram.actions.reactions`: chặn/mở tool reactions Telegram.
- `channels.telegram.actions.sendMessage`: chặn/mở tool gửi tin nhắn Telegram.
- `channels.telegram.actions.deleteMessage`: chặn/mở tool xóa tin nhắn Telegram.
- `channels.telegram.actions.sticker`: chặn/mở action sticker Telegram — gửi và tìm (mặc định: false).
- `channels.telegram.reactionNotifications`: `off | own | all` — kiểm soát reaction nào kích hoạt system event (mặc định: `own` khi không đặt).
- `channels.telegram.reactionLevel`: `off | ack | minimal | extensive` — kiểm soát khả năng reaction của tác tử (mặc định: `minimal` khi không đặt).

Tùy chọn toàn cục liên quan:

- `agents.list[].groupChat.mentionPatterns` (pattern yêu cầu nhắc tên).
- `messages.groupChat.mentionPatterns` (fallback toàn cục).
- `commands.native` (mặc định `"auto"` → bật cho Telegram/Discord, tắt cho Slack), `commands.text`, `commands.useAccessGroups` (hành vi lệnh). Ghi đè bằng `channels.telegram.commands.native`.
- `messages.responsePrefix`, `messages.ackReaction`, `messages.ackReactionScope`, `messages.removeAckAfterReply`.
