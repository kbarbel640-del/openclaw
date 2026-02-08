---
summary: "Trạng thái hỗ trợ, khả năng và cấu hình của Nextcloud Talk"
read_when:
  - Làm việc với các tính năng kênh Nextcloud Talk
title: "Nextcloud Talk"
x-i18n:
  source_path: channels/nextcloud-talk.md
  source_hash: 4062946ebf333903
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:12Z
---

# Nextcloud Talk (plugin)

Trạng thái: được hỗ trợ qua plugin (bot webhook). Hỗ trợ tin nhắn trực tiếp, phòng, phản ứng và tin nhắn markdown.

## Cần plugin

Nextcloud Talk được phát hành dưới dạng plugin và không đi kèm với bản cài đặt lõi.

Cài đặt qua CLI (npm registry):

```bash
openclaw plugins install @openclaw/nextcloud-talk
```

Checkout cục bộ (khi chạy từ repo git):

```bash
openclaw plugins install ./extensions/nextcloud-talk
```

Nếu bạn chọn Nextcloud Talk trong quá trình cấu hình/onboarding và phát hiện có checkout git,
OpenClaw sẽ tự động đề xuất đường dẫn cài đặt cục bộ.

Chi tiết: [Plugins](/plugin)

## Thiết lập nhanh (người mới)

1. Cài đặt plugin Nextcloud Talk.
2. Trên máy chủ Nextcloud của bạn, tạo một bot:
   ```bash
   ./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction
   ```
3. Bật bot trong cài đặt phòng mục tiêu.
4. Cấu hình OpenClaw:
   - Config: `channels.nextcloud-talk.baseUrl` + `channels.nextcloud-talk.botSecret`
   - Hoặc env: `NEXTCLOUD_TALK_BOT_SECRET` (chỉ tài khoản mặc định)
5. Khởi động lại Gateway (hoặc hoàn tất onboarding).

Cấu hình tối thiểu:

```json5
{
  channels: {
    "nextcloud-talk": {
      enabled: true,
      baseUrl: "https://cloud.example.com",
      botSecret: "shared-secret",
      dmPolicy: "pairing",
    },
  },
}
```

## Ghi chú

- Bot không thể chủ động bắt đầu DM. Người dùng phải nhắn cho bot trước.
- URL webhook phải có thể truy cập được từ Gateway; đặt `webhookPublicUrl` nếu ở sau proxy.
- Tải lên media không được hỗ trợ bởi API bot; media được gửi dưới dạng URL.
- Payload webhook không phân biệt DM với phòng; đặt `apiUser` + `apiPassword` để bật tra cứu loại phòng (nếu không, DM sẽ được xử lý như phòng).

## Kiểm soát truy cập (DM)

- Mặc định: `channels.nextcloud-talk.dmPolicy = "pairing"`. Người gửi không xác định sẽ nhận mã ghép nối.
- Phê duyệt qua:
  - `openclaw pairing list nextcloud-talk`
  - `openclaw pairing approve nextcloud-talk <CODE>`
- DM công khai: `channels.nextcloud-talk.dmPolicy="open"` cộng với `channels.nextcloud-talk.allowFrom=["*"]`.
- `allowFrom` chỉ khớp ID người dùng Nextcloud; tên hiển thị bị bỏ qua.

## Phòng (nhóm)

- Mặc định: `channels.nextcloud-talk.groupPolicy = "allowlist"` (bị chặn theo nhắc tên).
- Cho phép danh sách phòng với `channels.nextcloud-talk.rooms`:

```json5
{
  channels: {
    "nextcloud-talk": {
      rooms: {
        "room-token": { requireMention: true },
      },
    },
  },
}
```

- Để không cho phép phòng nào, giữ danh sách cho phép trống hoặc đặt `channels.nextcloud-talk.groupPolicy="disabled"`.

## Khả năng

| Tính năng          | Trạng thái   |
| ------------------ | ------------ |
| Tin nhắn trực tiếp | Hỗ trợ       |
| Phòng              | Hỗ trợ       |
| Chuỗi              | Không hỗ trợ |
| Media              | Chỉ URL      |
| Phản ứng           | Hỗ trợ       |
| Lệnh gốc           | Không hỗ trợ |

## Tham chiếu cấu hình (Nextcloud Talk)

Cấu hình đầy đủ: [Configuration](/gateway/configuration)

Tùy chọn nhà cung cấp:

- `channels.nextcloud-talk.enabled`: bật/tắt khởi động kênh.
- `channels.nextcloud-talk.baseUrl`: URL instance Nextcloud.
- `channels.nextcloud-talk.botSecret`: bí mật chia sẻ của bot.
- `channels.nextcloud-talk.botSecretFile`: đường dẫn tệp bí mật.
- `channels.nextcloud-talk.apiUser`: người dùng API để tra cứu phòng (phát hiện DM).
- `channels.nextcloud-talk.apiPassword`: mật khẩu API/app để tra cứu phòng.
- `channels.nextcloud-talk.apiPasswordFile`: đường dẫn tệp mật khẩu API.
- `channels.nextcloud-talk.webhookPort`: cổng lắng nghe webhook (mặc định: 8788).
- `channels.nextcloud-talk.webhookHost`: host webhook (mặc định: 0.0.0.0).
- `channels.nextcloud-talk.webhookPath`: đường dẫn webhook (mặc định: /nextcloud-talk-webhook).
- `channels.nextcloud-talk.webhookPublicUrl`: URL webhook có thể truy cập từ bên ngoài.
- `channels.nextcloud-talk.dmPolicy`: `pairing | allowlist | open | disabled`.
- `channels.nextcloud-talk.allowFrom`: danh sách cho phép DM (ID người dùng). `open` yêu cầu `"*"`.
- `channels.nextcloud-talk.groupPolicy`: `allowlist | open | disabled`.
- `channels.nextcloud-talk.groupAllowFrom`: danh sách cho phép nhóm (ID người dùng).
- `channels.nextcloud-talk.rooms`: cài đặt theo phòng và danh sách cho phép.
- `channels.nextcloud-talk.historyLimit`: giới hạn lịch sử nhóm (0 để tắt).
- `channels.nextcloud-talk.dmHistoryLimit`: giới hạn lịch sử DM (0 để tắt).
- `channels.nextcloud-talk.dms`: ghi đè theo DM (historyLimit).
- `channels.nextcloud-talk.textChunkLimit`: kích thước chia đoạn văn bản gửi ra (ký tự).
- `channels.nextcloud-talk.chunkMode`: `length` (mặc định) hoặc `newline` để tách theo dòng trống (ranh giới đoạn) trước khi chia theo độ dài.
- `channels.nextcloud-talk.blockStreaming`: tắt block streaming cho kênh này.
- `channels.nextcloud-talk.blockStreamingCoalesce`: tinh chỉnh gộp block streaming.
- `channels.nextcloud-talk.mediaMaxMb`: giới hạn media đầu vào (MB).
