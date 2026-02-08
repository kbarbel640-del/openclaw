---
summary: "Manifest plugin + yêu cầu JSON schema (xác thực cấu hình nghiêm ngặt)"
read_when:
  - Bạn đang xây dựng một plugin OpenClaw
  - Bạn cần phát hành schema cấu hình plugin hoặc gỡ lỗi các lỗi xác thực plugin
title: "Manifest Plugin"
x-i18n:
  source_path: plugins/manifest.md
  source_hash: 47b3e33c915f47bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:01Z
---

# Manifest plugin (openclaw.plugin.json)

Mọi plugin **bắt buộc** phải đi kèm một tệp `openclaw.plugin.json` trong **thư mục gốc của plugin**.
OpenClaw dùng manifest này để xác thực cấu hình **mà không thực thi mã plugin**. Manifest bị thiếu hoặc không hợp lệ được xem là lỗi plugin và sẽ chặn việc xác thực cấu hình.

Xem hướng dẫn đầy đủ về hệ thống plugin: [Plugins](/plugin).

## Các trường bắt buộc

```json
{
  "id": "voice-call",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

Các khóa bắt buộc:

- `id` (string): id plugin chuẩn.
- `configSchema` (object): JSON Schema cho cấu hình plugin (nhúng).

Các khóa tùy chọn:

- `kind` (string): loại plugin (ví dụ: `"memory"`).
- `channels` (array): các id kênh được plugin này đăng ký (ví dụ: `["matrix"]`).
- `providers` (array): các id provider được plugin này đăng ký.
- `skills` (array): các thư mục skill cần tải (tương đối so với thư mục gốc plugin).
- `name` (string): tên hiển thị của plugin.
- `description` (string): mô tả ngắn của plugin.
- `uiHints` (object): nhãn/trình giữ chỗ/cờ nhạy cảm của các trường cấu hình để render UI.
- `version` (string): phiên bản plugin (mang tính thông tin).

## Yêu cầu JSON Schema

- **Mọi plugin đều phải đi kèm một JSON Schema**, ngay cả khi không nhận cấu hình.
- Schema rỗng là chấp nhận được (ví dụ: `{ "type": "object", "additionalProperties": false }`).
- Schema được xác thực tại thời điểm đọc/ghi cấu hình, không phải lúc runtime.

## Hành vi xác thực

- Các khóa `channels.*` không xác định là **lỗi**, trừ khi id kênh được khai báo bởi
  manifest của một plugin.
- `plugins.entries.<id>`, `plugins.allow`, `plugins.deny`, và `plugins.slots.*`
  phải tham chiếu tới các id plugin **có thể khám phá**. Id không xác định là **lỗi**.
- Nếu một plugin đã được cài đặt nhưng manifest hoặc schema bị hỏng hoặc thiếu,
  việc xác thực sẽ thất bại và Doctor báo lỗi plugin.
- Nếu cấu hình plugin tồn tại nhưng plugin bị **vô hiệu hóa**, cấu hình vẫn được giữ lại và
  một **cảnh báo** sẽ được hiển thị trong Doctor + logs.

## Ghi chú

- Manifest là **bắt buộc cho mọi plugin**, bao gồm cả các plugin được tải từ hệ thống tệp cục bộ.
- Runtime vẫn tải module plugin riêng; manifest chỉ dùng cho
  khám phá + xác thực.
- Nếu plugin của bạn phụ thuộc vào các module native, hãy tài liệu hóa các bước build và mọi
  yêu cầu allowlist của trình quản lý gói (ví dụ, pnpm `allow-build-scripts`
  - `pnpm rebuild <package>`).
