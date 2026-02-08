---
summary: "Tổng quan ghép đôi: phê duyệt ai có thể nhắn tin trực tiếp cho bạn + những nút nào có thể tham gia"
read_when:
  - Thiết lập kiểm soát truy cập tin nhắn trực tiếp
  - Ghép đôi một nút iOS/Android mới
  - Rà soát tư thế bảo mật của OpenClaw
title: "Ghép đôi"
x-i18n:
  source_path: channels/pairing.md
  source_hash: cc6ce9c71db6d96d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:03Z
---

# Ghép đôi

“Ghép đôi” là bước **phê duyệt rõ ràng của chủ sở hữu** trong OpenClaw.
Nó được sử dụng ở hai nơi:

1. **Ghép đôi DM** (ai được phép nói chuyện với bot)
2. **Ghép đôi nút** (những thiết bị/nút nào được phép tham gia mạng Gateway)

Ngữ cảnh bảo mật: [Security](/gateway/security)

## 1) Ghép đôi DM (truy cập trò chuyện đến)

Khi một kênh được cấu hình với chính sách DM `pairing`, người gửi chưa biết sẽ nhận một mã ngắn và tin nhắn của họ **không được xử lý** cho đến khi bạn phê duyệt.

Các chính sách DM mặc định được tài liệu hóa tại: [Security](/gateway/security)

Mã ghép đôi:

- 8 ký tự, chữ hoa, không có ký tự dễ nhầm lẫn (`0O1I`).
- **Hết hạn sau 1 giờ**. Bot chỉ gửi thông báo ghép đôi khi có yêu cầu mới được tạo (xấp xỉ mỗi giờ một lần cho mỗi người gửi).
- Các yêu cầu ghép đôi DM đang chờ được giới hạn **3 yêu cầu mỗi kênh** theo mặc định; các yêu cầu bổ sung sẽ bị bỏ qua cho đến khi một yêu cầu hết hạn hoặc được phê duyệt.

### Phê duyệt người gửi

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

Các kênh được hỗ trợ: `telegram`, `whatsapp`, `signal`, `imessage`, `discord`, `slack`.

### Trạng thái được lưu ở đâu

Được lưu dưới `~/.openclaw/credentials/`:

- Yêu cầu đang chờ: `<channel>-pairing.json`
- Kho danh sách cho phép đã phê duyệt: `<channel>-allowFrom.json`

Hãy coi những dữ liệu này là nhạy cảm (chúng kiểm soát quyền truy cập vào trợ lý của bạn).

## 2) Ghép đôi thiết bị nút (các nút iOS/Android/macOS/headless)

Các nút kết nối tới Gateway như **thiết bị** với `role: node`. Gateway
tạo một yêu cầu ghép đôi thiết bị cần được phê duyệt.

### Phê duyệt một thiết bị nút

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### Lưu trữ trạng thái ghép đôi nút

Được lưu dưới `~/.openclaw/devices/`:

- `pending.json` (vòng đời ngắn; các yêu cầu đang chờ sẽ hết hạn)
- `paired.json` (thiết bị đã ghép đôi + token)

### Ghi chú

- API `node.pair.*` cũ (CLI: `openclaw nodes pending/approve`) là một kho ghép đôi riêng do gateway sở hữu. Các nút WS vẫn yêu cầu ghép đôi thiết bị.

## Tài liệu liên quan

- Mô hình bảo mật + prompt injection: [Security](/gateway/security)
- Cập nhật an toàn (chạy doctor): [Updating](/install/updating)
- Cấu hình kênh:
  - Telegram: [Telegram](/channels/telegram)
  - WhatsApp: [WhatsApp](/channels/whatsapp)
  - Signal: [Signal](/channels/signal)
  - BlueBubbles (iMessage): [BlueBubbles](/channels/bluebubbles)
  - iMessage (cũ): [iMessage](/channels/imessage)
  - Discord: [Discord](/channels/discord)
  - Slack: [Slack](/channels/slack)
