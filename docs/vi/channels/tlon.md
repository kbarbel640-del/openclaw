---
summary: "Trang thai ho tro, kha nang va cau hinh cho Tlon/Urbit"
read_when:
  - Lam viec voi tinh nang kenh Tlon/Urbit
title: "Tlon"
x-i18n:
  source_path: channels/tlon.md
  source_hash: 19d7ffe23e82239f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:14Z
---

# Tlon (plugin)

Tlon la mot ung dung nhan tin phan tan xay dung tren Urbit. OpenClaw ket noi voi tau Urbit cua ban va co the
phan hoi tin nhan truc tiep va tin nhan nhom. Phan hoi trong nhom mac dinh yeu cau @ mention va co the
bi gioi han them thong qua allowlist.

Trang thai: ho tro qua plugin. Ho tro DM, mention trong nhom, tra loi theo thread, va phuong an du phong cho media chi van ban
(URL duoc them vao chu thich). Khong ho tro reaction, poll, va tai len media native.

## Plugin bat buoc

Tlon duoc phat hanh duoi dang plugin va khong di kem voi ban cai dat loi.

Cai dat qua CLI (npm registry):

```bash
openclaw plugins install @openclaw/tlon
```

Checkout cuc bo (khi chay tu repo git):

```bash
openclaw plugins install ./extensions/tlon
```

Chi tiet: [Plugins](/plugin)

## Thiet lap

1. Cai dat plugin Tlon.
2. Thu thap URL tau va ma dang nhap.
3. Cau hinh `channels.tlon`.
4. Khoi dong lai Gateway.
5. Gui DM cho bot hoac mention no trong kenh nhom.

Cau hinh toi thieu (mot tai khoan):

```json5
{
  channels: {
    tlon: {
      enabled: true,
      ship: "~sampel-palnet",
      url: "https://your-ship-host",
      code: "lidlut-tabwed-pillex-ridrup",
    },
  },
}
```

## Kenh nhom

Tu dong kham pha duoc bat theo mac dinh. Ban cung co the ghim kenh thu cong:

```json5
{
  channels: {
    tlon: {
      groupChannels: ["chat/~host-ship/general", "chat/~host-ship/support"],
    },
  },
}
```

Tat tu dong kham pha:

```json5
{
  channels: {
    tlon: {
      autoDiscoverChannels: false,
    },
  },
}
```

## Kiem soat truy cap

Allowlist DM (rong = cho phep tat ca):

```json5
{
  channels: {
    tlon: {
      dmAllowlist: ["~zod", "~nec"],
    },
  },
}
```

Uy quyen nhom (bi gioi han theo mac dinh):

```json5
{
  channels: {
    tlon: {
      defaultAuthorizedShips: ["~zod"],
      authorization: {
        channelRules: {
          "chat/~host-ship/general": {
            mode: "restricted",
            allowedShips: ["~zod", "~nec"],
          },
          "chat/~host-ship/announcements": {
            mode: "open",
          },
        },
      },
    },
  },
}
```

## Dich vu dich den (CLI/cron)

Su dung cac muc nay voi `openclaw message send` hoac phan phoi qua cron:

- DM: `~sampel-palnet` hoac `dm/~sampel-palnet`
- Nhom: `chat/~host-ship/channel` hoac `group:~host-ship/channel`

## Ghi chu

- Phan hoi trong nhom yeu cau mention (vi du `~your-bot-ship`) de tra loi.
- Tra loi theo thread: neu tin nhan dau vao nam trong mot thread, OpenClaw se tra loi trong chinh thread do.
- Media: `sendMedia` se chuyen sang van ban + URL (khong tai len native).
