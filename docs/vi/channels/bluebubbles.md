---
summary: "iMessage thông qua máy chủ BlueBubbles macOS (REST gửi/nhận, đang gõ, phản ứng, ghép cặp, hành động nâng cao)."
read_when:
  - Thiết lập kênh BlueBubbles
  - Xử lý sự cố ghép cặp webhook
  - Cấu hình iMessage trên macOS
title: "BlueBubbles"
x-i18n:
  source_path: channels/bluebubbles.md
  source_hash: 1414cf657d347ee7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:22Z
---

# BlueBubbles (macOS REST)

Trạng thái: plugin được đóng gói sẵn, giao tiếp với máy chủ BlueBubbles macOS qua HTTP. **Được khuyến nghị cho tích hợp iMessage** nhờ API phong phú hơn và thiết lập dễ dàng hơn so với kênh imsg kế thừa.

## Tổng quan

- Chạy trên macOS thông qua ứng dụng trợ giúp BlueBubbles ([bluebubbles.app](https://bluebubbles.app)).
- Khuyến nghị/đã kiểm thử: macOS Sequoia (15). macOS Tahoe (26) hoạt động; hiện chỉnh sửa bị lỗi trên Tahoe, và cập nhật biểu tượng nhóm có thể báo thành công nhưng không đồng bộ.
- OpenClaw giao tiếp thông qua REST API của nó (`GET /api/v1/ping`, `POST /message/text`, `POST /chat/:id/*`).
- Tin nhắn đến qua webhook; phản hồi gửi đi, chỉ báo đang gõ, biên nhận đã đọc và tapback là các lệnh gọi REST.
- Tệp đính kèm và sticker được tiếp nhận như media đến (và hiển thị cho tác tử khi có thể).
- Ghép cặp/danh sách cho phép hoạt động giống các kênh khác (`/start/pairing` v.v.) với `channels.bluebubbles.allowFrom` + mã ghép cặp.
- Phản ứng được hiển thị như sự kiện hệ thống giống Slack/Telegram để tác tử có thể “nhắc tới” chúng trước khi trả lời.
- Tính năng nâng cao: chỉnh sửa, thu hồi, luồng trả lời, hiệu ứng tin nhắn, quản lý nhóm.

## Khoi dong nhanh

1. Cài đặt máy chủ BlueBubbles trên Mac của bạn (làm theo hướng dẫn tại [bluebubbles.app/install](https://bluebubbles.app/install)).
2. Trong cấu hình BlueBubbles, bật web API và đặt mật khẩu.
3. Chạy `openclaw onboard` và chọn BlueBubbles, hoặc cấu hình thủ công:
   ```json5
   {
     channels: {
       bluebubbles: {
         enabled: true,
         serverUrl: "http://192.168.1.100:1234",
         password: "example-password",
         webhookPath: "/bluebubbles-webhook",
       },
     },
   }
   ```
4. Trỏ webhook BlueBubbles tới gateway của bạn (ví dụ: `https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`).
5. Khởi động gateway; nó sẽ đăng ký trình xử lý webhook và bắt đầu ghép cặp.

## Giữ Messages.app luôn hoạt động (VM / thiết lập không giao diện)

Một số thiết lập macOS VM / luôn bật có thể khiến Messages.app rơi vào trạng thái “idle” (sự kiện đến dừng lại cho đến khi mở/đưa ứng dụng lên foreground). Một cách khắc phục đơn giản là **“chạm” Messages mỗi 5 phút** bằng AppleScript + LaunchAgent.

### 1) Lưu AppleScript

Lưu tệp với tên:

- `~/Scripts/poke-messages.scpt`

Script ví dụ (không tương tác; không giành tiêu điểm):

```applescript
try
  tell application "Messages"
    if not running then
      launch
    end if

    -- Touch the scripting interface to keep the process responsive.
    set _chatCount to (count of chats)
  end tell
on error
  -- Ignore transient failures (first-run prompts, locked session, etc).
end try
```

### 2) Cài đặt LaunchAgent

Lưu tệp với tên:

- `~/Library/LaunchAgents/com.user.poke-messages.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.user.poke-messages</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>/usr/bin/osascript &quot;$HOME/Scripts/poke-messages.scpt&quot;</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>/tmp/poke-messages.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/poke-messages.err</string>
  </dict>
</plist>
```

Ghi chú:

- Chạy **mỗi 300 giây** và **khi đăng nhập**.
- Lần chạy đầu có thể kích hoạt lời nhắc **Automation** của macOS (`osascript` → Messages). Hãy chấp thuận trong cùng phiên người dùng chạy LaunchAgent.

Tải:

```bash
launchctl unload ~/Library/LaunchAgents/com.user.poke-messages.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.user.poke-messages.plist
```

## Huong Dan Ban Dau

BlueBubbles có sẵn trong trình hướng dẫn thiết lập tương tác:

```
openclaw onboard
```

Trình hướng dẫn sẽ hỏi:

- **Server URL** (bắt buộc): địa chỉ máy chủ BlueBubbles (ví dụ: `http://192.168.1.100:1234`)
- **Password** (bắt buộc): mật khẩu API từ cài đặt BlueBubbles Server
- **Webhook path** (tùy chọn): mặc định là `/bluebubbles-webhook`
- **DM policy**: ghép cặp, danh sách cho phép, mở, hoặc tắt
- **Allow list**: số điện thoại, email, hoặc mục tiêu chat

Bạn cũng có thể thêm BlueBubbles qua CLI:

```
openclaw channels add bluebubbles --http-url http://192.168.1.100:1234 --password <password>
```

## Kiểm soát truy cập (Tin nhan truc tiep + nhóm)

Tin nhan truc tiep:

- Mặc định: `channels.bluebubbles.dmPolicy = "pairing"`.
- Người gửi lạ nhận mã ghép cặp; tin nhắn bị bỏ qua cho đến khi được phê duyệt (mã hết hạn sau 1 giờ).
- Phê duyệt qua:
  - `openclaw pairing list bluebubbles`
  - `openclaw pairing approve bluebubbles <CODE>`
- Ghép cặp là trao đổi token mặc định. Chi tiết: [Pairing](/start/pairing)

Nhóm:

- `channels.bluebubbles.groupPolicy = open | allowlist | disabled` (mặc định: `allowlist`).
- `channels.bluebubbles.groupAllowFrom` kiểm soát ai có thể kích hoạt trong nhóm khi `allowlist` được đặt.

### Chặn theo nhắc tên (nhóm)

BlueBubbles hỗ trợ chặn theo nhắc tên cho chat nhóm, phù hợp hành vi iMessage/WhatsApp:

- Dùng `agents.list[].groupChat.mentionPatterns` (hoặc `messages.groupChat.mentionPatterns`) để phát hiện nhắc tên.
- Khi `requireMention` được bật cho một nhóm, tác tử chỉ phản hồi khi được nhắc tên.
- Lệnh điều khiển từ người gửi được ủy quyền sẽ bỏ qua chặn theo nhắc tên.

Cấu hình theo nhóm:

```json5
{
  channels: {
    bluebubbles: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true }, // default for all groups
        "iMessage;-;chat123": { requireMention: false }, // override for specific group
      },
    },
  },
}
```

### Chặn theo lệnh

- Lệnh điều khiển (ví dụ: `/config`, `/model`) yêu cầu ủy quyền.
- Dùng `allowFrom` và `groupAllowFrom` để xác định ủy quyền lệnh.
- Người gửi được ủy quyền có thể chạy lệnh điều khiển ngay cả khi không nhắc tên trong nhóm.

## Đang gõ + biên nhận đã đọc

- **Chỉ báo đang gõ**: gửi tự động trước và trong khi tạo phản hồi.
- **Biên nhận đã đọc**: điều khiển bởi `channels.bluebubbles.sendReadReceipts` (mặc định: `true`).
- **Chỉ báo đang gõ**: OpenClaw gửi sự kiện bắt đầu gõ; BlueBubbles tự động dừng trạng thái đang gõ khi gửi hoặc hết thời gian (dừng thủ công qua DELETE không đáng tin cậy).

```json5
{
  channels: {
    bluebubbles: {
      sendReadReceipts: false, // disable read receipts
    },
  },
}
```

## Hành động nâng cao

BlueBubbles hỗ trợ các hành động tin nhắn nâng cao khi được bật trong cấu hình:

```json5
{
  channels: {
    bluebubbles: {
      actions: {
        reactions: true, // tapbacks (default: true)
        edit: true, // edit sent messages (macOS 13+, broken on macOS 26 Tahoe)
        unsend: true, // unsend messages (macOS 13+)
        reply: true, // reply threading by message GUID
        sendWithEffect: true, // message effects (slam, loud, etc.)
        renameGroup: true, // rename group chats
        setGroupIcon: true, // set group chat icon/photo (flaky on macOS 26 Tahoe)
        addParticipant: true, // add participants to groups
        removeParticipant: true, // remove participants from groups
        leaveGroup: true, // leave group chats
        sendAttachment: true, // send attachments/media
      },
    },
  },
}
```

Các hành động khả dụng:

- **react**: thêm/gỡ phản ứng tapback (`messageId`, `emoji`, `remove`)
- **edit**: chỉnh sửa tin nhắn đã gửi (`messageId`, `text`)
- **unsend**: thu hồi tin nhắn (`messageId`)
- **reply**: trả lời một tin nhắn cụ thể (`messageId`, `text`, `to`)
- **sendWithEffect**: gửi với hiệu ứng iMessage (`text`, `to`, `effectId`)
- **renameGroup**: đổi tên chat nhóm (`chatGuid`, `displayName`)
- **setGroupIcon**: đặt biểu tượng/ảnh cho chat nhóm (`chatGuid`, `media`) — không ổn định trên macOS 26 Tahoe (API có thể báo thành công nhưng biểu tượng không đồng bộ).
- **addParticipant**: thêm người vào nhóm (`chatGuid`, `address`)
- **removeParticipant**: xóa người khỏi nhóm (`chatGuid`, `address`)
- **leaveGroup**: rời chat nhóm (`chatGuid`)
- **sendAttachment**: gửi media/tệp (`to`, `buffer`, `filename`, `asVoice`)
  - Ghi âm giọng nói: đặt `asVoice: true` với âm thanh **MP3** hoặc **CAF** để gửi như tin nhắn thoại iMessage. BlueBubbles chuyển đổi MP3 → CAF khi gửi ghi âm.

### ID tin nhắn (ngắn vs đầy đủ)

OpenClaw có thể hiển thị ID tin nhắn _ngắn_ (ví dụ: `1`, `2`) để tiết kiệm token.

- `MessageSid` / `ReplyToId` có thể là ID ngắn.
- `MessageSidFull` / `ReplyToIdFull` chứa ID đầy đủ của nhà cung cấp.
- ID ngắn chỉ tồn tại trong bộ nhớ; có thể hết hạn khi khởi động lại hoặc bị loại khỏi cache.
- Hành động chấp nhận `messageId` ngắn hoặc đầy đủ, nhưng ID ngắn sẽ lỗi nếu không còn khả dụng.

Dùng ID đầy đủ cho tự động hóa và lưu trữ bền vững:

- Mẫu: `{{MessageSidFull}}`, `{{ReplyToIdFull}}`
- Ngữ cảnh: `MessageSidFull` / `ReplyToIdFull` trong payload đến

Xem [Configuration](/gateway/configuration) để biết biến mẫu.

## Chặn stream

Kiểm soát việc phản hồi được gửi như một tin nhắn đơn hay stream theo khối:

```json5
{
  channels: {
    bluebubbles: {
      blockStreaming: true, // enable block streaming (off by default)
    },
  },
}
```

## Media + giới hạn

- Tệp đính kèm đến được tải xuống và lưu trong cache media.
- Giới hạn media qua `channels.bluebubbles.mediaMaxMb` (mặc định: 8 MB).
- Văn bản gửi đi được chia khối theo `channels.bluebubbles.textChunkLimit` (mặc định: 4000 ký tự).

## Tham chiếu cấu hình

Cấu hình đầy đủ: [Configuration](/gateway/configuration)

Tùy chọn nhà cung cấp:

- `channels.bluebubbles.enabled`: Bật/tắt kênh.
- `channels.bluebubbles.serverUrl`: URL cơ sở REST API của BlueBubbles.
- `channels.bluebubbles.password`: Mật khẩu API.
- `channels.bluebubbles.webhookPath`: Đường dẫn endpoint webhook (mặc định: `/bluebubbles-webhook`).
- `channels.bluebubbles.dmPolicy`: `pairing | allowlist | open | disabled` (mặc định: `pairing`).
- `channels.bluebubbles.allowFrom`: Danh sách cho phép Tin nhan truc tiep (handle, email, số E.164, `chat_id:*`, `chat_guid:*`).
- `channels.bluebubbles.groupPolicy`: `open | allowlist | disabled` (mặc định: `allowlist`).
- `channels.bluebubbles.groupAllowFrom`: Danh sách cho phép người gửi trong nhóm.
- `channels.bluebubbles.groups`: Cấu hình theo nhóm (`requireMention`, v.v.).
- `channels.bluebubbles.sendReadReceipts`: Gửi biên nhận đã đọc (mặc định: `true`).
- `channels.bluebubbles.blockStreaming`: Bật stream theo khối (mặc định: `false`; cần cho phản hồi dạng stream).
- `channels.bluebubbles.textChunkLimit`: Kích thước khối gửi đi theo ký tự (mặc định: 4000).
- `channels.bluebubbles.chunkMode`: `length` (mặc định) chỉ tách khi vượt `textChunkLimit`; `newline` tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- `channels.bluebubbles.mediaMaxMb`: Giới hạn media đến (MB) (mặc định: 8).
- `channels.bluebubbles.historyLimit`: Số tin nhắn nhóm tối đa cho ngữ cảnh (0 để tắt).
- `channels.bluebubbles.dmHistoryLimit`: Giới hạn lịch sử Tin nhan truc tiep.
- `channels.bluebubbles.actions`: Bật/tắt các hành động cụ thể.
- `channels.bluebubbles.accounts`: Cấu hình đa tài khoản.

Tùy chọn toàn cục liên quan:

- `agents.list[].groupChat.mentionPatterns` (hoặc `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.

## Địa chỉ hóa / mục tiêu gửi

Ưu tiên `chat_guid` để định tuyến ổn định:

- `chat_guid:iMessage;-;+15555550123` (ưu tiên cho nhóm)
- `chat_id:123`
- `chat_identifier:...`
- Handle trực tiếp: `+15555550123`, `user@example.com`
  - Nếu handle trực tiếp chưa có chat Tin nhan truc tiep, OpenClaw sẽ tạo một cuộc trò chuyện qua `POST /api/v1/chat/new`. Điều này yêu cầu bật BlueBubbles Private API.

## Bảo mật

- Yêu cầu webhook được xác thực bằng cách so sánh tham số truy vấn hoặc header `guid`/`password` với `channels.bluebubbles.password`. Các yêu cầu từ `localhost` cũng được chấp nhận.
- Giữ bí mật mật khẩu API và endpoint webhook (coi như thông tin đăng nhập).
- Tin cậy localhost có nghĩa là reverse proxy cùng máy có thể vô tình bỏ qua mật khẩu. Nếu bạn proxy gateway, hãy yêu cầu xác thực tại proxy và cấu hình `gateway.trustedProxies`. Xem [Gateway security](/gateway/security#reverse-proxy-configuration).
- Bật HTTPS + quy tắc firewall trên máy chủ BlueBubbles nếu mở ra ngoài LAN.

## Xu ly su co

- Nếu sự kiện đang gõ/đã đọc ngừng hoạt động, kiểm tra log webhook BlueBubbles và xác minh đường dẫn gateway khớp `channels.bluebubbles.webhookPath`.
- Mã ghép cặp hết hạn sau một giờ; dùng `openclaw pairing list bluebubbles` và `openclaw pairing approve bluebubbles <code>`.
- Phản ứng yêu cầu BlueBubbles private API (`POST /api/v1/message/react`); đảm bảo phiên bản máy chủ có cung cấp.
- Chỉnh sửa/thu hồi yêu cầu macOS 13+ và phiên bản BlueBubbles tương thích. Trên macOS 26 (Tahoe), chỉnh sửa hiện bị lỗi do thay đổi private API.
- Cập nhật biểu tượng nhóm có thể không ổn định trên macOS 26 (Tahoe): API có thể báo thành công nhưng biểu tượng mới không đồng bộ.
- OpenClaw tự động ẩn các hành động đã biết là bị lỗi dựa trên phiên bản macOS của máy chủ BlueBubbles. Nếu chỉnh sửa vẫn xuất hiện trên macOS 26 (Tahoe), hãy tắt thủ công bằng `channels.bluebubbles.actions.edit=false`.
- Thông tin trạng thái/sức khỏe: `openclaw status --all` hoặc `openclaw status --deep`.

Để tham khảo quy trình kênh chung, xem [Channels](/channels) và hướng dẫn [Plugins](/plugins).
