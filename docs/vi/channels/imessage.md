---
summary: "Hỗ trợ iMessage kế thừa thông qua imsg (JSON-RPC qua stdio). Thiết lập mới nên dùng BlueBubbles."
read_when:
  - Thiết lập hỗ trợ iMessage
  - Gỡ lỗi gửi/nhận iMessage
title: iMessage
x-i18n:
  source_path: channels/imessage.md
  source_hash: 7c8c276701528b8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:20Z
---

# iMessage (kế thừa: imsg)

> **Khuyến nghị:** Dùng [BlueBubbles](/channels/bluebubbles) cho các thiết lập iMessage mới.
>
> Kênh `imsg` là tích hợp CLI bên ngoài dạng kế thừa và có thể bị loại bỏ trong một bản phát hành tương lai.

Trạng thái: tích hợp CLI bên ngoài kế thừa. Gateway khởi chạy `imsg rpc` (JSON-RPC qua stdio).

## Thiết lập nhanh (người mới)

1. Đảm bảo Messages đã đăng nhập trên máy Mac này.
2. Cài đặt `imsg`:
   - `brew install steipete/tap/imsg`
3. Cấu hình OpenClaw với `channels.imessage.cliPath` và `channels.imessage.dbPath`.
4. Khởi động Gateway và chấp thuận các lời nhắc của macOS (Automation + Full Disk Access).

Cấu hình tối thiểu:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "/usr/local/bin/imsg",
      dbPath: "/Users/<you>/Library/Messages/chat.db",
    },
  },
}
```

## Nó là gì

- Kênh iMessage dựa trên `imsg` trên macOS.
- Định tuyến xác định: phản hồi luôn quay lại iMessage.
- Tin nhắn trực tiếp dùng chung phiên chính của tác tử; nhóm được cô lập (`agent:<agentId>:imessage:group:<chat_id>`).
- Nếu một luồng nhiều người tham gia đến với `is_group=false`, bạn vẫn có thể cô lập nó bằng cách `chat_id` sử dụng `channels.imessage.groups` (xem “Luồng kiểu nhóm” bên dưới).

## Ghi cấu hình

Theo mặc định, iMessage được phép ghi các cập nhật cấu hình kích hoạt bởi `/config set|unset` (yêu cầu `commands.config: true`).

Tắt bằng:

```json5
{
  channels: { imessage: { configWrites: false } },
}
```

## Yêu cầu

- macOS đã đăng nhập Messages.
- Full Disk Access cho OpenClaw + `imsg` (truy cập DB Messages).
- Quyền Automation khi gửi.
- `channels.imessage.cliPath` có thể trỏ tới bất kỳ lệnh nào proxy stdin/stdout (ví dụ: script bao bọc SSH sang máy Mac khác và chạy `imsg rpc`).

## Thiết lập (đường nhanh)

1. Đảm bảo Messages đã đăng nhập trên máy Mac này.
2. Cấu hình iMessage và khởi động Gateway.

### Người dùng macOS dành riêng cho bot (để tách danh tính)

Nếu bạn muốn bot gửi từ **một danh tính iMessage riêng** (và giữ Messages cá nhân gọn gàng), hãy dùng một Apple ID riêng + một người dùng macOS riêng.

1. Tạo một Apple ID riêng (ví dụ: `my-cool-bot@icloud.com`).
   - Apple có thể yêu cầu số điện thoại để xác minh / 2FA.
2. Tạo một người dùng macOS (ví dụ: `openclawhome`) và đăng nhập vào đó.
3. Mở Messages trong người dùng macOS đó và đăng nhập iMessage bằng Apple ID của bot.
4. Bật Remote Login (System Settings → General → Sharing → Remote Login).
5. Cài đặt `imsg`:
   - `brew install steipete/tap/imsg`
6. Thiết lập SSH để `ssh <bot-macos-user>@localhost true` hoạt động không cần mật khẩu.
7. Trỏ `channels.imessage.accounts.bot.cliPath` tới một wrapper SSH chạy `imsg` dưới người dùng bot.

Lưu ý lần chạy đầu: việc gửi/nhận có thể cần chấp thuận GUI (Automation + Full Disk Access) trong _người dùng macOS của bot_. Nếu `imsg rpc` có vẻ bị treo hoặc thoát, hãy đăng nhập vào người dùng đó (Screen Sharing rất hữu ích), chạy một lần `imsg chats --limit 1` / `imsg send ...`, chấp thuận các lời nhắc, rồi thử lại.

Wrapper ví dụ (`chmod +x`). Thay `<bot-macos-user>` bằng tên người dùng macOS thực tế của bạn:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run an interactive SSH once first to accept host keys:
#   ssh <bot-macos-user>@localhost true
exec /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -T <bot-macos-user>@localhost \
  "/usr/local/bin/imsg" "$@"
```

Cấu hình ví dụ:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      accounts: {
        bot: {
          name: "Bot",
          enabled: true,
          cliPath: "/path/to/imsg-bot",
          dbPath: "/Users/<bot-macos-user>/Library/Messages/chat.db",
        },
      },
    },
  },
}
```

Với thiết lập một tài khoản, dùng các tùy chọn phẳng (`channels.imessage.cliPath`, `channels.imessage.dbPath`) thay cho map `accounts`.

### Biến thể Remote/SSH (tùy chọn)

Nếu bạn muốn iMessage chạy trên một máy Mac khác, đặt `channels.imessage.cliPath` tới một wrapper chạy `imsg` trên máy macOS từ xa qua SSH. OpenClaw chỉ cần stdio.

Wrapper ví dụ:

```bash
#!/usr/bin/env bash
exec ssh -T gateway-host imsg "$@"
```

**Tệp đính kèm từ xa:** Khi `cliPath` trỏ tới host từ xa qua SSH, đường dẫn tệp đính kèm trong cơ sở dữ liệu Messages tham chiếu tới các tệp trên máy từ xa. OpenClaw có thể tự động tải chúng qua SCP bằng cách đặt `channels.imessage.remoteHost`:

```json5
{
  channels: {
    imessage: {
      cliPath: "~/imsg-ssh", // SSH wrapper to remote Mac
      remoteHost: "user@gateway-host", // for SCP file transfer
      includeAttachments: true,
    },
  },
}
```

Nếu `remoteHost` không được đặt, OpenClaw sẽ cố gắng tự phát hiện bằng cách phân tích lệnh SSH trong script wrapper của bạn. Khuyến nghị cấu hình tường minh để tăng độ tin cậy.

#### Mac từ xa qua Tailscale (ví dụ)

Nếu Gateway chạy trên host/VM Linux nhưng iMessage phải chạy trên Mac, Tailscale là cầu nối đơn giản nhất: Gateway nói chuyện với Mac qua tailnet, chạy `imsg` qua SSH và SCP tệp đính kèm về.

Kiến trúc:

```
┌──────────────────────────────┐          SSH (imsg rpc)          ┌──────────────────────────┐
│ Gateway host (Linux/VM)      │──────────────────────────────────▶│ Mac with Messages + imsg │
│ - openclaw gateway           │          SCP (attachments)        │ - Messages signed in     │
│ - channels.imessage.cliPath  │◀──────────────────────────────────│ - Remote Login enabled   │
└──────────────────────────────┘                                   └──────────────────────────┘
              ▲
              │ Tailscale tailnet (hostname or 100.x.y.z)
              ▼
        user@gateway-host
```

Ví dụ cấu hình cụ thể (hostname Tailscale):

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "bot@mac-mini.tailnet-1234.ts.net",
      includeAttachments: true,
      dbPath: "/Users/bot/Library/Messages/chat.db",
    },
  },
}
```

Wrapper ví dụ (`~/.openclaw/scripts/imsg-ssh`):

```bash
#!/usr/bin/env bash
exec ssh -T bot@mac-mini.tailnet-1234.ts.net imsg "$@"
```

Ghi chú:

- Đảm bảo Mac đã đăng nhập Messages và bật Remote Login.
- Dùng khóa SSH để `ssh bot@mac-mini.tailnet-1234.ts.net` hoạt động không cần nhắc.
- `remoteHost` nên khớp với đích SSH để SCP có thể tải tệp đính kèm.

Hỗ trợ nhiều tài khoản: dùng `channels.imessage.accounts` với cấu hình theo từng tài khoản và `name` tùy chọn. Xem [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) để biết mẫu dùng chung. Đừng commit `~/.openclaw/openclaw.json` (thường chứa token).

## Kiểm soát truy cập (DMs + nhóm)

DMs:

- Mặc định: `channels.imessage.dmPolicy = "pairing"`.
- Người gửi chưa biết sẽ nhận mã ghép cặp; tin nhắn bị bỏ qua cho đến khi được phê duyệt (mã hết hạn sau 1 giờ).
- Phê duyệt qua:
  - `openclaw pairing list imessage`
  - `openclaw pairing approve imessage <CODE>`
- Ghép cặp là cơ chế trao đổi token mặc định cho DMs iMessage. Chi tiết: [Pairing](/start/pairing)

Nhóm:

- `channels.imessage.groupPolicy = open | allowlist | disabled`.
- `channels.imessage.groupAllowFrom` kiểm soát ai có thể kích hoạt trong nhóm khi `allowlist` được đặt.
- Chặn theo đề cập dùng `agents.list[].groupChat.mentionPatterns` (hoặc `messages.groupChat.mentionPatterns`) vì iMessage không có metadata đề cập gốc.
- Ghi đè đa tác tử: đặt pattern theo từng tác tử trên `agents.list[].groupChat.mentionPatterns`.

## Cách hoạt động (hành vi)

- `imsg` stream các sự kiện tin nhắn; Gateway chuẩn hóa chúng vào phong bì kênh dùng chung.
- Phản hồi luôn định tuyến về cùng chat id hoặc handle.

## Luồng kiểu nhóm (`is_group=false`)

Một số luồng iMessage có nhiều người tham gia nhưng vẫn đến với `is_group=false` tùy theo cách Messages lưu trữ định danh cuộc trò chuyện.

Nếu bạn cấu hình tường minh một `chat_id` dưới `channels.imessage.groups`, OpenClaw coi luồng đó là “nhóm” cho:

- cô lập phiên (khóa phiên `agent:<agentId>:imessage:group:<chat_id>` riêng)
- hành vi allowlist nhóm / chặn theo đề cập

Ví dụ:

```json5
{
  channels: {
    imessage: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "42": { requireMention: false },
      },
    },
  },
}
```

Điều này hữu ích khi bạn muốn một tính cách/mô hình cô lập cho một luồng cụ thể (xem [Multi-agent routing](/concepts/multi-agent)). Để cô lập theo hệ thống tệp, xem [Sandboxing](/gateway/sandboxing).

## Media + giới hạn

- Nhập tệp đính kèm tùy chọn qua `channels.imessage.includeAttachments`.
- Giới hạn media qua `channels.imessage.mediaMaxMb`.

## Giới hạn

- Văn bản gửi ra được chia khúc tới `channels.imessage.textChunkLimit` (mặc định 4000).
- Chia khúc theo dòng mới tùy chọn: đặt `channels.imessage.chunkMode="newline"` để tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- Tải lên media bị giới hạn bởi `channels.imessage.mediaMaxMb` (mặc định 16).

## Địa chỉ / đích gửi

Ưu tiên `chat_id` để định tuyến ổn định:

- `chat_id:123` (ưu tiên)
- `chat_guid:...`
- `chat_identifier:...`
- handle trực tiếp: `imessage:+1555` / `sms:+1555` / `user@example.com`

Liệt kê cuộc trò chuyện:

```
imsg chats --limit 20
```

## Tham chiếu cấu hình (iMessage)

Cấu hình đầy đủ: [Configuration](/gateway/configuration)

Tùy chọn provider:

- `channels.imessage.enabled`: bật/tắt khởi động kênh.
- `channels.imessage.cliPath`: đường dẫn tới `imsg`.
- `channels.imessage.dbPath`: đường dẫn DB Messages.
- `channels.imessage.remoteHost`: host SSH cho việc chuyển tệp đính kèm qua SCP khi `cliPath` trỏ tới Mac từ xa (ví dụ: `user@gateway-host`). Tự phát hiện từ wrapper SSH nếu không đặt.
- `channels.imessage.service`: `imessage | sms | auto`.
- `channels.imessage.region`: vùng SMS.
- `channels.imessage.dmPolicy`: `pairing | allowlist | open | disabled` (mặc định: ghép cặp).
- `channels.imessage.allowFrom`: allowlist DM (handle, email, số E.164, hoặc `chat_id:*`). `open` yêu cầu `"*"`. iMessage không có username; dùng handle hoặc đích chat.
- `channels.imessage.groupPolicy`: `open | allowlist | disabled` (mặc định: allowlist).
- `channels.imessage.groupAllowFrom`: allowlist người gửi trong nhóm.
- `channels.imessage.historyLimit` / `channels.imessage.accounts.*.historyLimit`: số tin nhắn nhóm tối đa đưa vào ngữ cảnh (0 để tắt).
- `channels.imessage.dmHistoryLimit`: giới hạn lịch sử DM theo lượt người dùng. Ghi đè theo người dùng: `channels.imessage.dms["<handle>"].historyLimit`.
- `channels.imessage.groups`: mặc định theo nhóm + allowlist (dùng `"*"` cho mặc định toàn cục).
- `channels.imessage.includeAttachments`: nhập tệp đính kèm vào ngữ cảnh.
- `channels.imessage.mediaMaxMb`: giới hạn media vào/ra (MB).
- `channels.imessage.textChunkLimit`: kích thước khúc gửi ra (ký tự).
- `channels.imessage.chunkMode`: `length` (mặc định) hoặc `newline` để tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.

Tùy chọn toàn cục liên quan:

- `agents.list[].groupChat.mentionPatterns` (hoặc `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.
