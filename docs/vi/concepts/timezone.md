---
summary: "Xử lý múi giờ cho agent, phong bì và prompt"
read_when:
  - Bạn cần hiểu cách dấu thời gian được chuẩn hóa cho mô hình
  - Cấu hình múi giờ người dùng cho system prompt
title: "Múi giờ"
x-i18n:
  source_path: concepts/timezone.md
  source_hash: 9ee809c96897db11
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:53Z
---

# Múi giờ

OpenClaw chuẩn hóa dấu thời gian để mô hình nhìn thấy **một thời điểm tham chiếu duy nhất**.

## Phong bì tin nhắn (mặc định là local)

Tin nhắn đến được bọc trong một phong bì như sau:

```
[Provider ... 2026-01-05 16:26 PST] message text
```

Dấu thời gian trong phong bì **mặc định theo local của host**, với độ chính xác đến phút.

Bạn có thể ghi đè bằng:

```json5
{
  agents: {
    defaults: {
      envelopeTimezone: "local", // "utc" | "local" | "user" | IANA timezone
      envelopeTimestamp: "on", // "on" | "off"
      envelopeElapsed: "on", // "on" | "off"
    },
  },
}
```

- `envelopeTimezone: "utc"` sử dụng UTC.
- `envelopeTimezone: "user"` sử dụng `agents.defaults.userTimezone` (dự phòng về múi giờ của host).
- Dùng múi giờ IANA tường minh (ví dụ: `"Europe/Vienna"`) để có độ lệch cố định.
- `envelopeTimestamp: "off"` loại bỏ dấu thời gian tuyệt đối khỏi header phong bì.
- `envelopeElapsed: "off"` loại bỏ hậu tố thời gian đã trôi qua (kiểu `+2m`).

### Ví dụ

**Local (mặc định):**

```
[Signal Alice +1555 2026-01-18 00:19 PST] hello
```

**Múi giờ cố định:**

```
[Signal Alice +1555 2026-01-18 06:19 GMT+1] hello
```

**Thời gian đã trôi qua:**

```
[Signal Alice +1555 +2m 2026-01-18T05:19Z] follow-up
```

## Payload của công cụ (dữ liệu thô từ provider + trường đã chuẩn hóa)

Các lệnh gọi công cụ (`channels.discord.readMessages`, `channels.slack.readMessages`, v.v.) trả về **dấu thời gian thô từ provider**.
Chúng tôi cũng đính kèm các trường đã chuẩn hóa để nhất quán:

- `timestampMs` (epoch milliseconds UTC)
- `timestampUtc` (chuỗi UTC ISO 8601)

Các trường thô từ provider được giữ nguyên.

## Múi giờ người dùng cho system prompt

Đặt `agents.defaults.userTimezone` để cho mô hình biết múi giờ local của người dùng. Nếu không
được đặt, OpenClaw sẽ xác định **múi giờ của host tại thời điểm chạy** (không ghi cấu hình).

```json5
{
  agents: { defaults: { userTimezone: "America/Chicago" } },
}
```

System prompt bao gồm:

- Phần `Current Date & Time` với thời gian local và múi giờ
- `Time format: 12-hour` hoặc `24-hour`

Bạn có thể kiểm soát định dạng prompt bằng `agents.defaults.timeFormat` (`auto` | `12` | `24`).

Xem [Date & Time](/date-time) để biết toàn bộ hành vi và ví dụ.
