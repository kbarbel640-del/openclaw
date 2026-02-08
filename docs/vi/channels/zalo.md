---
summary: "Trạng thái hỗ trợ bot Zalo, khả năng và cấu hình"
read_when:
  - Làm việc với các tính năng hoặc webhook của Zalo
title: "Zalo"
x-i18n:
  source_path: channels/zalo.md
  source_hash: 0311d932349f9641
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:22Z
---

# Zalo (Bot API)

Trạng thái: thử nghiệm. Chỉ hỗ trợ tin nhắn trực tiếp; nhóm sẽ sớm có theo tài liệu Zalo.

## Cần plugin

Zalo được phân phối dưới dạng plugin và không đi kèm cài đặt lõi.

- Cài qua CLI: `openclaw plugins install @openclaw/zalo`
- Hoặc chọn **Zalo** trong quá trình huong dan ban dau và xác nhận lời nhắc cài đặt
- Chi tiết: [Plugins](/plugin)

## Thiết lập nhanh (cho người mới)

1. Cài plugin Zalo:
   - Từ bản checkout mã nguồn: `openclaw plugins install ./extensions/zalo`
   - Từ npm (nếu đã phát hành): `openclaw plugins install @openclaw/zalo`
   - Hoặc chọn **Zalo** trong huong dan ban dau và xác nhận lời nhắc cài đặt
2. Thiết lập token:
   - Env: `ZALO_BOT_TOKEN=...`
   - Hoặc config: `channels.zalo.botToken: "..."`.
3. Khởi động lại Gateway (hoặc hoàn tất huong dan ban dau).
4. Quyền truy cập DM mặc định là ghép cặp; phê duyệt mã ghép cặp khi liên hệ lần đầu.

Cấu hình tối thiểu:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

## Đây là gì

Zalo là ứng dụng nhắn tin tập trung tại Việt Nam; Bot API của nó cho phép Gateway chạy bot cho hội thoại 1:1.
Phù hợp cho hỗ trợ hoặc thông báo khi bạn muốn định tuyến xác định quay lại Zalo.

- Một kênh Zalo Bot API do Gateway sở hữu.
- Định tuyến xác định: phản hồi quay lại Zalo; mô hình không chọn kênh.
- DM dùng chung phiên chính của tác tử.
- Nhóm chưa được hỗ trợ (tài liệu Zalo ghi “coming soon”).

## Thiết lập (đường nhanh)

### 1) Tạo bot token (Zalo Bot Platform)

1. Truy cập **https://bot.zaloplatforms.com** và đăng nhập.
2. Tạo bot mới và cấu hình cài đặt.
3. Sao chép bot token (định dạng: `12345689:abc-xyz`).

### 2) Cấu hình token (env hoặc config)

Ví dụ:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

Tùy chọn env: `ZALO_BOT_TOKEN=...` (chỉ hoạt động cho tài khoản mặc định).

Hỗ trợ đa tài khoản: dùng `channels.zalo.accounts` với token theo từng tài khoản và tùy chọn `name`.

3. Khởi động lại Gateway. Zalo sẽ khởi động khi token được xác định (env hoặc config).
4. Quyền truy cập DM mặc định là ghép cặp. Phê duyệt mã khi bot được liên hệ lần đầu.

## Cách hoạt động (hành vi)

- Tin nhắn đến được chuẩn hóa vào phong bì kênh dùng chung với placeholder media.
- Phản hồi luôn quay lại cùng cuộc trò chuyện Zalo.
- Mặc định long-polling; có chế độ webhook với `channels.zalo.webhookUrl`.

## Giới hạn

- Văn bản gửi đi được chia nhỏ 2000 ký tự (giới hạn API Zalo).
- Tải lên/tải xuống media bị giới hạn bởi `channels.zalo.mediaMaxMb` (mặc định 5).
- Streaming bị chặn mặc định do giới hạn 2000 ký tự khiến streaming kém hữu ích.

## Kiểm soát truy cập (DM)

### Quyền truy cập DM

- Mặc định: `channels.zalo.dmPolicy = "pairing"`. Người gửi chưa biết sẽ nhận mã ghép cặp; tin nhắn bị bỏ qua cho đến khi được phê duyệt (mã hết hạn sau 1 giờ).
- Phê duyệt qua:
  - `openclaw pairing list zalo`
  - `openclaw pairing approve zalo <CODE>`
- Ghép cặp là cơ chế trao đổi token mặc định. Chi tiết: [Pairing](/start/pairing)
- `channels.zalo.allowFrom` chấp nhận ID người dùng dạng số (không có tra cứu username).

## Long-polling vs webhook

- Mặc định: long-polling (không cần URL công khai).
- Chế độ webhook: đặt `channels.zalo.webhookUrl` và `channels.zalo.webhookSecret`.
  - Secret webhook phải dài 8–256 ký tự.
  - URL webhook phải dùng HTTPS.
  - Zalo gửi sự kiện kèm header `X-Bot-Api-Secret-Token` để xác minh.
  - Gateway HTTP xử lý yêu cầu webhook tại `channels.zalo.webhookPath` (mặc định theo đường dẫn URL webhook).

**Lưu ý:** getUpdates (polling) và webhook loại trừ lẫn nhau theo tài liệu API Zalo.

## Các loại tin nhắn được hỗ trợ

- **Tin nhắn văn bản**: Hỗ trợ đầy đủ với chia nhỏ 2000 ký tự.
- **Tin nhắn hình ảnh**: Tải xuống và xử lý hình ảnh đến; gửi hình ảnh qua `sendPhoto`.
- **Sticker**: Được ghi log nhưng chưa xử lý đầy đủ (không có phản hồi từ tác tử).
- **Loại không hỗ trợ**: Được ghi log (ví dụ: tin nhắn từ người dùng được bảo vệ).

## Khả năng

| Tính năng          | Trạng thái                       |
| ------------------ | -------------------------------- |
| Tin nhắn trực tiếp | ✅ Hỗ trợ                        |
| Nhóm               | ❌ Sắp có (theo tài liệu Zalo)   |
| Media (hình ảnh)   | ✅ Hỗ trợ                        |
| Phản ứng           | ❌ Không hỗ trợ                  |
| Thread             | ❌ Không hỗ trợ                  |
| Khảo sát           | ❌ Không hỗ trợ                  |
| Lệnh gốc           | ❌ Không hỗ trợ                  |
| Streaming          | ⚠️ Bị chặn (giới hạn 2000 ký tự) |

## Đích gửi (CLI/cron)

- Dùng chat id làm đích.
- Ví dụ: `openclaw message send --channel zalo --target 123456789 --message "hi"`.

## Xử lý sự cố

**Bot không phản hồi:**

- Kiểm tra token hợp lệ: `openclaw channels status --probe`
- Xác minh người gửi đã được phê duyệt (ghép cặp hoặc allowFrom)
- Kiểm tra log Gateway: `openclaw logs --follow`

**Webhook không nhận sự kiện:**

- Đảm bảo URL webhook dùng HTTPS
- Xác minh secret token dài 8–256 ký tự
- Xác nhận endpoint HTTP của Gateway truy cập được tại đường dẫn đã cấu hình
- Kiểm tra getUpdates polling không chạy (hai chế độ loại trừ nhau)

## Tham chiếu cấu hình (Zalo)

Cấu hình đầy đủ: [Configuration](/gateway/configuration)

Tùy chọn provider:

- `channels.zalo.enabled`: bật/tắt khởi động kênh.
- `channels.zalo.botToken`: bot token từ Zalo Bot Platform.
- `channels.zalo.tokenFile`: đọc token từ đường dẫn tệp.
- `channels.zalo.dmPolicy`: `pairing | allowlist | open | disabled` (mặc định: ghép cặp).
- `channels.zalo.allowFrom`: danh sách cho phép DM (ID người dùng). `open` yêu cầu `"*"`. Trình hướng dẫn sẽ hỏi ID dạng số.
- `channels.zalo.mediaMaxMb`: giới hạn media vào/ra (MB, mặc định 5).
- `channels.zalo.webhookUrl`: bật chế độ webhook (yêu cầu HTTPS).
- `channels.zalo.webhookSecret`: secret webhook (8–256 ký tự).
- `channels.zalo.webhookPath`: đường dẫn webhook trên máy chủ HTTP của Gateway.
- `channels.zalo.proxy`: URL proxy cho các yêu cầu API.

Tùy chọn đa tài khoản:

- `channels.zalo.accounts.<id>.botToken`: token theo từng tài khoản.
- `channels.zalo.accounts.<id>.tokenFile`: tệp token theo từng tài khoản.
- `channels.zalo.accounts.<id>.name`: tên hiển thị.
- `channels.zalo.accounts.<id>.enabled`: bật/tắt tài khoản.
- `channels.zalo.accounts.<id>.dmPolicy`: chính sách DM theo từng tài khoản.
- `channels.zalo.accounts.<id>.allowFrom`: danh sách cho phép theo từng tài khoản.
- `channels.zalo.accounts.<id>.webhookUrl`: URL webhook theo từng tài khoản.
- `channels.zalo.accounts.<id>.webhookSecret`: secret webhook theo từng tài khoản.
- `channels.zalo.accounts.<id>.webhookPath`: đường dẫn webhook theo từng tài khoản.
- `channels.zalo.accounts.<id>.proxy`: URL proxy theo từng tài khoản.
