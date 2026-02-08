---
summary: "Xu ly ngay va gio tren cac phong bi, prompt, cong cu va connector"
read_when:
  - Ban dang thay doi cach hien thi dau thoi gian cho mo hinh hoac nguoi dung
  - Ban dang debug dinh dang thoi gian trong tin nhan hoac dau ra system prompt
title: "Ngay va Gio"
x-i18n:
  source_path: date-time.md
  source_hash: 753af5946a006215
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:05Z
---

# Ngay & Gio

OpenClaw mac dinh su dung **thoi gian cuc bo cua may chu cho dau thoi gian van chuyen** va **chi su dung mui gio cua nguoi dung trong system prompt**.
Dau thoi gian tu nha cung cap duoc giu nguyen de cac cong cu giu duoc ngu nghia ban dia cua chung (thoi gian hien tai co san qua `session_status`).

## Phong bi tin nhan (mac dinh la cuc bo)

Tin nhan dau vao duoc boc trong mot phong bi co dau thoi gian (do chinh xac theo phut):

```
[Provider ... 2026-01-05 16:26 PST] message text
```

Dau thoi gian phong bi nay **mac dinh la thoi gian cuc bo cua may chu**, bat ke mui gio cua nha cung cap.

Ban co the ghi de hanh vi nay:

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

- `envelopeTimezone: "utc"` su dung UTC.
- `envelopeTimezone: "local"` su dung mui gio cua may chu.
- `envelopeTimezone: "user"` su dung `agents.defaults.userTimezone` (neu khong co thi quay ve mui gio cua may chu).
- Su dung mot mui gio IANA cu the (vi du: `"America/Chicago"`) cho mot vung co dinh.
- `envelopeTimestamp: "off"` loai bo dau thoi gian tuyet doi khoi tieu de phong bi.
- `envelopeElapsed: "off"` loai bo hau to thoi gian da troi qua (kieu `+2m`).

### Vi du

**Cuc bo (mac dinh):**

```
[WhatsApp +1555 2026-01-18 00:19 PST] hello
```

**Mui gio nguoi dung:**

```
[WhatsApp +1555 2026-01-18 00:19 CST] hello
```

**Bat thoi gian da troi qua:**

```
[WhatsApp +1555 +30s 2026-01-18T05:19Z] follow-up
```

## System prompt: Ngay & Gio Hien Tai

Neu biet mui gio cua nguoi dung, system prompt se bao gom mot muc rieng
**Current Date & Time** chi voi **mui gio** (khong co dong ho/dinh dang thoi gian)
de giu on dinh cho viec cache prompt:

```
Time zone: America/Chicago
```

Khi tac tu can thoi gian hien tai, hay dung cong cu `session_status`; the trang thai
se bao gom mot dong dau thoi gian.

## Dong su kien he thong (mac dinh la cuc bo)

Cac su kien he thong duoc xep hang va chen vao bo canh tac tu se duoc tien to boi dau thoi gian su dung
cung lua chon mui gio nhu phong bi tin nhan (mac dinh: thoi gian cuc bo cua may chu).

```
System: [2026-01-12 12:19:17 PST] Model switched.
```

### Cau hinh mui gio + dinh dang cho nguoi dung

```json5
{
  agents: {
    defaults: {
      userTimezone: "America/Chicago",
      timeFormat: "auto", // auto | 12 | 24
    },
  },
}
```

- `userTimezone` thiet lap **mui gio cuc bo cua nguoi dung** cho bo canh prompt.
- `timeFormat` dieu khien **hien thi 12h/24h** trong prompt. `auto` theo tuy chon cua he dieu hanh.

## Phat hien dinh dang thoi gian (tu dong)

Khi `timeFormat: "auto"`, OpenClaw kiem tra tuy chon cua he dieu hanh (macOS/Windows)
va quay ve dinh dang theo locale. Gia tri duoc phat hien se **duoc cache theo moi tien trinh**
de tranh goi he thong lap lai.

## Payload cong cu + connector (thoi gian nha cung cap thuan + truong chuan hoa)

Cac cong cu theo kenh tra ve **dau thoi gian goc cua nha cung cap** va them cac truong chuan hoa de nhat quan:

- `timestampMs`: mili giay epoch (UTC)
- `timestampUtc`: chuoi ISO 8601 UTC

Cac truong goc cua nha cung cap duoc giu nguyen de khong mat mat du lieu.

- Slack: chuoi giong epoch tu API
- Discord: dau thoi gian ISO UTC
- Telegram/WhatsApp: dau thoi gian so/ISO dac thu nha cung cap

Neu ban can thoi gian cuc bo, hay chuyen doi o phia sau su dung mui gio da biet.

## Tai lieu lien quan

- [System Prompt](/concepts/system-prompt)
- [Timezones](/concepts/timezone)
- [Messages](/concepts/messages)
