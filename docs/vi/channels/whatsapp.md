---
summary: "Tích hợp WhatsApp (kênh web): đăng nhập, hộp thư, trả lời, media và vận hành"
read_when:
  - Làm việc với hành vi kênh WhatsApp/web hoặc định tuyến hộp thư
title: "WhatsApp"
x-i18n:
  source_path: channels/whatsapp.md
  source_hash: 44fd88f8e2692849
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:46Z
---

# WhatsApp (kênh web)

Trạng thái: Chỉ hỗ trợ WhatsApp Web qua Baileys. Gateway sở hữu phiên (session).

## Thiết lập nhanh (người mới)

1. Nếu có thể, hãy dùng **một số điện thoại riêng** (khuyến nghị).
2. Cấu hình WhatsApp trong `~/.openclaw/openclaw.json`.
3. Chạy `openclaw channels login` để quét mã QR (Linked Devices).
4. Khởi động gateway.

Cấu hình tối thiểu:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551234567"],
    },
  },
}
```

## Mục tiêu

- Nhiều tài khoản WhatsApp (đa tài khoản) trong một tiến trình Gateway.
- Định tuyến xác định: trả lời quay về WhatsApp, không định tuyến qua model.
- Model thấy đủ ngữ cảnh để hiểu trả lời trích dẫn.

## Ghi cấu hình

Theo mặc định, WhatsApp được phép ghi cập nhật cấu hình được kích hoạt bởi `/config set|unset` (yêu cầu `commands.config: true`).

Tắt bằng:

```json5
{
  channels: { whatsapp: { configWrites: false } },
}
```

## Kiến trúc (ai sở hữu cái gì)

- **Gateway** sở hữu socket Baileys và vòng lặp hộp thư.
- **CLI / ứng dụng macOS** giao tiếp với gateway; không dùng Baileys trực tiếp.
- **Active listener** là bắt buộc cho gửi ra; nếu không, gửi sẽ thất bại ngay.

## Lấy số điện thoại (hai chế độ)

WhatsApp yêu cầu số di động thật để xác minh. VoIP và số ảo thường bị chặn. Có hai cách được hỗ trợ để chạy OpenClaw trên WhatsApp:

### Số riêng (khuyến nghị)

Dùng **một số điện thoại riêng** cho OpenClaw. UX tốt nhất, định tuyến sạch, không có vấn đề tự chat. Thiết lập lý tưởng: **điện thoại Android cũ/dự phòng + eSIM**. Để Wi‑Fi và nguồn, rồi liên kết qua QR.

**WhatsApp Business:** Bạn có thể dùng WhatsApp Business trên cùng thiết bị với số khác. Rất phù hợp để tách WhatsApp cá nhân — cài WhatsApp Business và đăng ký số OpenClaw ở đó.

**Cấu hình mẫu (số riêng, allowlist một người dùng):**

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551234567"],
    },
  },
}
```

**Chế độ ghép cặp (tùy chọn):**  
Nếu muốn ghép cặp thay vì allowlist, đặt `channels.whatsapp.dmPolicy` thành `pairing`. Người gửi lạ sẽ nhận mã ghép cặp; phê duyệt bằng:
`openclaw pairing approve whatsapp <code>`

### Số cá nhân (dự phòng)

Giải pháp nhanh: chạy OpenClaw trên **chính số của bạn**. Nhắn cho chính mình (WhatsApp “Message yourself”) để thử nghiệm nhằm tránh làm phiền danh bạ. Trong quá trình thiết lập và thử nghiệm, bạn sẽ phải đọc mã xác minh trên điện thoại chính. **Bắt buộc bật chế độ self-chat.**  
Khi trình hướng dẫn hỏi số WhatsApp cá nhân, nhập số bạn sẽ nhắn từ đó (chủ sở hữu/người gửi), không phải số trợ lý.

**Cấu hình mẫu (số cá nhân, self-chat):**

```json
{
  "whatsapp": {
    "selfChatMode": true,
    "dmPolicy": "allowlist",
    "allowFrom": ["+15551234567"]
  }
}
```

Trả lời self-chat mặc định dùng `[{identity.name}]` khi được đặt (nếu không thì `[openclaw]`)
nếu `messages.responsePrefix` chưa được đặt. Đặt rõ để tùy biến hoặc tắt
tiền tố (dùng `""` để loại bỏ).

### Mẹo nguồn số

- **eSIM nội địa** từ nhà mạng trong nước (đáng tin cậy nhất)
  - Áo: [hot.at](https://www.hot.at)
  - UK: [giffgaff](https://www.giffgaff.com) — SIM miễn phí, không hợp đồng
- **SIM trả trước** — rẻ, chỉ cần nhận một SMS xác minh

**Tránh:** TextNow, Google Voice, hầu hết dịch vụ “SMS miễn phí” — WhatsApp chặn rất gắt.

**Mẹo:** Số chỉ cần nhận một SMS xác minh. Sau đó, phiên WhatsApp Web sẽ được duy trì qua `creds.json`.

## Vì sao không dùng Twilio?

- Các bản OpenClaw sớm có hỗ trợ tích hợp WhatsApp Business của Twilio.
- Số WhatsApp Business không phù hợp cho trợ lý cá nhân.
- Meta áp dụng cửa sổ trả lời 24 giờ; nếu bạn chưa phản hồi trong 24 giờ gần nhất, số business không thể chủ động nhắn mới.
- Sử dụng nhiều hoặc “chatty” kích hoạt chặn mạnh, vì tài khoản business không предназнач để gửi hàng chục tin nhắn kiểu trợ lý cá nhân.
- Kết quả: gửi không ổn định và bị chặn thường xuyên, nên đã bỏ hỗ trợ.

## Đăng nhập + thông tin xác thực

- Lệnh đăng nhập: `openclaw channels login` (QR qua Linked Devices).
- Đăng nhập đa tài khoản: `openclaw channels login --account <id>` (`<id>` = `accountId`).
- Tài khoản mặc định (khi bỏ `--account`): `default` nếu có, nếu không thì id tài khoản đầu tiên được cấu hình (theo thứ tự).
- Thông tin xác thực lưu tại `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`.
- Bản sao dự phòng tại `creds.json.bak` (khôi phục khi hỏng).
- Tương thích cũ: các bản cài đặt cũ lưu file Baileys trực tiếp trong `~/.openclaw/credentials/`.
- Đăng xuất: `openclaw channels logout` (hoặc `--account <id>`) xóa trạng thái xác thực WhatsApp (nhưng giữ `oauth.json` dùng chung).
- Socket đã đăng xuất => lỗi hướng dẫn liên kết lại.

## Luồng vào (DM + nhóm)

- Sự kiện WhatsApp đến từ `messages.upsert` (Baileys).
- Listener hộp thư được tháo khi tắt để tránh tích lũy handler sự kiện trong test/khởi động lại.
- Chat trạng thái/phát sóng bị bỏ qua.
- Chat trực tiếp dùng E.164; nhóm dùng group JID.
- **Chính sách DM**: `channels.whatsapp.dmPolicy` kiểm soát truy cập chat trực tiếp (mặc định: `pairing`).
  - Ghép cặp: người gửi lạ nhận mã ghép cặp (phê duyệt qua `openclaw pairing approve whatsapp <code>`; mã hết hạn sau 1 giờ).
  - Mở: yêu cầu `channels.whatsapp.allowFrom` bao gồm `"*"`.
  - Số WhatsApp đã liên kết của bạn được tin cậy ngầm, nên tin nhắn tự gửi bỏ qua kiểm tra `channels.whatsapp.dmPolicy` và `channels.whatsapp.allowFrom`.

### Chế độ số cá nhân (dự phòng)

Nếu bạn chạy OpenClaw trên **số WhatsApp cá nhân**, hãy bật `channels.whatsapp.selfChatMode` (xem cấu hình mẫu ở trên).

Hành vi:

- DM gửi ra không bao giờ kích hoạt trả lời ghép cặp (tránh spam danh bạ).
- DM vào từ người lạ vẫn theo `channels.whatsapp.dmPolicy`.
- Chế độ self-chat (allowFrom bao gồm số của bạn) tránh gửi read receipt tự động và bỏ qua mention JID.
- Read receipt được gửi cho DM không phải self-chat.

## Read receipt

Theo mặc định, gateway đánh dấu tin nhắn WhatsApp vào là đã đọc (dấu tick xanh) khi được chấp nhận.

Tắt toàn cục:

```json5
{
  channels: { whatsapp: { sendReadReceipts: false } },
}
```

Tắt theo tài khoản:

```json5
{
  channels: {
    whatsapp: {
      accounts: {
        personal: { sendReadReceipts: false },
      },
    },
  },
}
```

Ghi chú:

- Chế độ self-chat luôn bỏ qua read receipt.

## WhatsApp FAQ: gửi tin nhắn + ghép cặp

**OpenClaw có nhắn ngẫu nhiên cho danh bạ khi tôi liên kết WhatsApp không?**  
Không. Chính sách DM mặc định là **ghép cặp**, nên người gửi lạ chỉ nhận mã ghép cặp và tin nhắn **không được xử lý**. OpenClaw chỉ trả lời các chat nó nhận được, hoặc các lần gửi bạn chủ động kích hoạt (agent/CLI).

**Ghép cặp hoạt động thế nào trên WhatsApp?**  
Ghép cặp là cổng DM cho người gửi lạ:

- DM đầu tiên từ người gửi mới trả về một mã ngắn (tin nhắn không được xử lý).
- Phê duyệt bằng: `openclaw pairing approve whatsapp <code>` (liệt kê với `openclaw pairing list whatsapp`).
- Mã hết hạn sau 1 giờ; yêu cầu chờ xử lý bị giới hạn 3 mỗi kênh.

**Nhiều người có thể dùng các instance OpenClaw khác nhau trên cùng một số WhatsApp không?**  
Có, bằng cách định tuyến mỗi người gửi đến một agent khác nhau qua `bindings` (peer `kind: "dm"`, E.164 người gửi như `+15551234567`). Trả lời vẫn đến từ **cùng một tài khoản WhatsApp**, và chat trực tiếp sẽ gộp về phiên chính của từng agent, vì vậy hãy dùng **một agent cho mỗi người**. Kiểm soát truy cập DM (`dmPolicy`/`allowFrom`) là toàn cục theo mỗi tài khoản WhatsApp. Xem [Multi-Agent Routing](/concepts/multi-agent).

**Vì sao trình hướng dẫn hỏi số điện thoại của tôi?**  
Trình hướng dẫn dùng số đó để đặt **allowlist/owner** để DM của chính bạn được phép. Nó không dùng để tự động gửi. Nếu chạy trên số WhatsApp cá nhân, hãy dùng chính số đó và bật `channels.whatsapp.selfChatMode`.

## Chuẩn hóa tin nhắn (những gì model thấy)

- `Body` là nội dung tin nhắn hiện tại kèm phong bì.
- Ngữ cảnh trả lời trích dẫn **luôn được nối thêm**:
  ```
  [Replying to +1555 id:ABC123]
  <quoted text or <media:...>>
  [/Replying]
  ```
- Metadata trả lời cũng được đặt:
  - `ReplyToId` = stanzaId
  - `ReplyToBody` = nội dung trích dẫn hoặc placeholder media
  - `ReplyToSender` = E.164 khi biết
- Tin nhắn vào chỉ có media dùng placeholder:
  - `<media:image|video|audio|document|sticker>`

## Nhóm

- Nhóm ánh xạ tới phiên `agent:<agentId>:whatsapp:group:<jid>`.
- Chính sách nhóm: `channels.whatsapp.groupPolicy = open|disabled|allowlist` (mặc định `allowlist`).
- Chế độ kích hoạt:
  - `mention` (mặc định): yêu cầu @mention hoặc khớp regex.
  - `always`: luôn kích hoạt.
- `/activation mention|always` chỉ dành cho owner và phải gửi như một tin nhắn độc lập.
- Owner = `channels.whatsapp.allowFrom` (hoặc self E.164 nếu không đặt).
- **Chèn lịch sử** (chỉ các tin đang chờ):
  - Các tin gần đây _chưa xử lý_ (mặc định 50) được chèn dưới:
    `[Chat messages since your last reply - for context]` (các tin đã có trong phiên sẽ không được chèn lại)
  - Tin hiện tại dưới:
    `[Current message - respond to this]`
  - Gắn hậu tố người gửi: `[from: Name (+E164)]`
- Metadata nhóm được cache 5 phút (tiêu đề + thành viên).

## Gửi trả lời (xâu chuỗi)

- WhatsApp Web gửi tin nhắn chuẩn (hiện gateway không hỗ trợ xâu chuỗi trả lời trích dẫn).
- Thẻ reply bị bỏ qua trên kênh này.

## Phản ứng xác nhận (tự động phản ứng khi nhận)

WhatsApp có thể tự động gửi phản ứng emoji cho tin nhắn đến ngay khi nhận, trước khi bot tạo trả lời. Điều này cho người dùng phản hồi tức thì rằng tin nhắn đã được nhận.

**Cấu hình:**

```json
{
  "whatsapp": {
    "ackReaction": {
      "emoji": "👀",
      "direct": true,
      "group": "mentions"
    }
  }
}
```

**Tùy chọn:**

- `emoji` (string): Emoji dùng để xác nhận (ví dụ: "👀", "✅", "📨"). Rỗng hoặc bỏ qua = tắt tính năng.
- `direct` (boolean, mặc định: `true`): Gửi phản ứng trong chat trực tiếp/DM.
- `group` (string, mặc định: `"mentions"`): Hành vi trong nhóm:
  - `"always"`: Phản ứng với mọi tin nhắn nhóm (kể cả không @mention)
  - `"mentions"`: Chỉ phản ứng khi bot được @mention
  - `"never"`: Không bao giờ phản ứng trong nhóm

**Ghi đè theo tài khoản:**

```json
{
  "whatsapp": {
    "accounts": {
      "work": {
        "ackReaction": {
          "emoji": "✅",
          "direct": false,
          "group": "always"
        }
      }
    }
  }
}
```

**Ghi chú hành vi:**

- Phản ứng được gửi **ngay lập tức** khi nhận tin, trước chỉ báo đang gõ hoặc trả lời của bot.
- Trong nhóm với `requireMention: false` (kích hoạt: luôn), `group: "mentions"` sẽ phản ứng với mọi tin nhắn (không chỉ @mention).
- Fire-and-forget: lỗi phản ứng được ghi log nhưng không chặn bot trả lời.
- Participant JID tự động được thêm cho phản ứng trong nhóm.
- WhatsApp bỏ qua `messages.ackReaction`; hãy dùng `channels.whatsapp.ackReaction` thay thế.

## Công cụ agent (phản ứng)

- Công cụ: `whatsapp` với hành động `react` (`chatJid`, `messageId`, `emoji`, tùy chọn `remove`).
- Tùy chọn: `participant` (người gửi trong nhóm), `fromMe` (phản ứng với tin của chính bạn), `accountId` (đa tài khoản).
- Ngữ nghĩa gỡ phản ứng: xem [/tools/reactions](/tools/reactions).
- Chặn công cụ: `channels.whatsapp.actions.reactions` (mặc định: bật).

## Giới hạn

- Văn bản gửi ra được chia khối tới `channels.whatsapp.textChunkLimit` (mặc định 4000).
- Tùy chọn chia theo dòng mới: đặt `channels.whatsapp.chunkMode="newline"` để tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- Lưu media vào bị giới hạn bởi `channels.whatsapp.mediaMaxMb` (mặc định 50 MB).
- Media gửi ra bị giới hạn bởi `agents.defaults.mediaMaxMb` (mặc định 5 MB).

## Gửi ra (văn bản + media)

- Dùng listener web đang hoạt động; lỗi nếu gateway không chạy.
- Chia văn bản: tối đa 4k mỗi tin (cấu hình qua `channels.whatsapp.textChunkLimit`, tùy chọn `channels.whatsapp.chunkMode`).
- Media:
  - Hỗ trợ hình ảnh/video/âm thanh/tài liệu.
  - Âm thanh gửi dưới dạng PTT; `audio/ogg` => `audio/ogg; codecs=opus`.
  - Chú thích chỉ áp dụng cho mục media đầu tiên.
  - Tải media hỗ trợ HTTP(S) và đường dẫn cục bộ.
  - GIF động: WhatsApp yêu cầu MP4 với `gifPlayback: true` để lặp nội tuyến.
    - CLI: `openclaw message send --media <mp4> --gif-playback`
    - Gateway: tham số `send` bao gồm `gifPlayback: true`

## Ghi chú thoại (âm thanh PTT)

WhatsApp gửi âm thanh dưới dạng **voice notes** (bong bóng PTT).

- Kết quả tốt nhất: OGG/Opus. OpenClaw ghi lại `audio/ogg` thành `audio/ogg; codecs=opus`.
- `[[audio_as_voice]]` bị bỏ qua cho WhatsApp (âm thanh đã là voice note).

## Giới hạn media + tối ưu

- Giới hạn gửi ra mặc định: 5 MB (mỗi mục media).
- Ghi đè: `agents.defaults.mediaMaxMb`.
- Hình ảnh được tự động tối ưu sang JPEG dưới ngưỡng (resize + điều chỉnh chất lượng).
- Media quá cỡ => lỗi; trả lời media sẽ rơi về cảnh báo văn bản.

## Heartbeat

- **Gateway heartbeat** ghi log tình trạng kết nối (`web.heartbeatSeconds`, mặc định 60s).
- **Agent heartbeat** có thể cấu hình theo agent (`agents.list[].heartbeat`) hoặc toàn cục
  qua `agents.defaults.heartbeat` (dùng khi không có cấu hình theo agent).
  - Dùng prompt heartbeat đã cấu hình (mặc định: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`) + hành vi bỏ qua `HEARTBEAT_OK`.
  - Gửi mặc định tới kênh dùng gần nhất (hoặc đích đã cấu hình).

## Hành vi kết nối lại

- Chính sách backoff: `web.reconnect`:
  - `initialMs`, `maxMs`, `factor`, `jitter`, `maxAttempts`.
- Nếu đạt maxAttempts, giám sát web dừng (suy giảm).
- Đã đăng xuất => dừng và yêu cầu liên kết lại.

## Bản đồ cấu hình nhanh

- `channels.whatsapp.dmPolicy` (chính sách DM: pairing/allowlist/open/disabled).
- `channels.whatsapp.selfChatMode` (thiết lập cùng điện thoại; bot dùng số WhatsApp cá nhân của bạn).
- `channels.whatsapp.allowFrom` (allowlist DM). WhatsApp dùng số E.164 (không có username).
- `channels.whatsapp.mediaMaxMb` (giới hạn lưu media vào).
- `channels.whatsapp.ackReaction` (tự phản ứng khi nhận tin: `{emoji, direct, group}`).
- `channels.whatsapp.accounts.<accountId>.*` (thiết lập theo tài khoản + tùy chọn `authDir`).
- `channels.whatsapp.accounts.<accountId>.mediaMaxMb` (giới hạn media vào theo tài khoản).
- `channels.whatsapp.accounts.<accountId>.ackReaction` (ghi đè phản ứng xác nhận theo tài khoản).
- `channels.whatsapp.groupAllowFrom` (allowlist người gửi trong nhóm).
- `channels.whatsapp.groupPolicy` (chính sách nhóm).
- `channels.whatsapp.historyLimit` / `channels.whatsapp.accounts.<accountId>.historyLimit` (ngữ cảnh lịch sử nhóm; `0` tắt).
- `channels.whatsapp.dmHistoryLimit` (giới hạn lịch sử DM theo lượt người dùng). Ghi đè theo người dùng: `channels.whatsapp.dms["<phone>"].historyLimit`.
- `channels.whatsapp.groups` (allowlist nhóm + mặc định chặn theo mention; dùng `"*"` để cho phép tất cả)
- `channels.whatsapp.actions.reactions` (chặn phản ứng công cụ WhatsApp).
- `agents.list[].groupChat.mentionPatterns` (hoặc `messages.groupChat.mentionPatterns`)
- `messages.groupChat.historyLimit`
- `channels.whatsapp.messagePrefix` (tiền tố vào; theo tài khoản: `channels.whatsapp.accounts.<accountId>.messagePrefix`; đã loại bỏ: `messages.messagePrefix`)
- `messages.responsePrefix` (tiền tố ra)
- `agents.defaults.mediaMaxMb`
- `agents.defaults.heartbeat.every`
- `agents.defaults.heartbeat.model` (ghi đè tùy chọn)
- `agents.defaults.heartbeat.target`
- `agents.defaults.heartbeat.to`
- `agents.defaults.heartbeat.session`
- `agents.list[].heartbeat.*` (ghi đè theo agent)
- `session.*` (scope, idle, store, mainKey)
- `web.enabled` (tắt khởi động kênh khi false)
- `web.heartbeatSeconds`
- `web.reconnect.*`

## Log + xử lý sự cố

- Phân hệ: `whatsapp/inbound`, `whatsapp/outbound`, `web-heartbeat`, `web-reconnect`.
- Tệp log: `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (có thể cấu hình).
- Hướng dẫn xử lý sự cố: [Gateway troubleshooting](/gateway/troubleshooting).

## Xử lý sự cố (nhanh)

**Chưa liên kết / cần đăng nhập QR**

- Triệu chứng: `channels status` hiển thị `linked: false` hoặc cảnh báo “Not linked”.
- Cách khắc phục: chạy `openclaw channels login` trên máy chủ gateway và quét QR (WhatsApp → Settings → Linked Devices).

**Đã liên kết nhưng ngắt kết nối / lặp kết nối lại**

- Triệu chứng: `channels status` hiển thị `running, disconnected` hoặc cảnh báo “Linked but disconnected”.
- Cách khắc phục: `openclaw doctor` (hoặc khởi động lại gateway). Nếu vẫn tiếp diễn, liên kết lại qua `channels login` và kiểm tra `openclaw logs --follow`.

**Bun runtime**

- **Không khuyến nghị** dùng Bun. WhatsApp (Baileys) và Telegram không ổn định trên Bun.
  Hãy chạy gateway bằng **Node**. (Xem ghi chú runtime trong Getting Started.)
