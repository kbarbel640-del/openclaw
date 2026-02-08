---
summary: "Thiết lập bot Mattermost và cau hinh OpenClaw"
read_when:
  - Thiet lap Mattermost
  - Go loi dinh tuyen Mattermost
title: "Mattermost"
x-i18n:
  source_path: channels/mattermost.md
  source_hash: 57fabe5eb0efbcb8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:15Z
---

# Mattermost (plugin)

Trang thai: duoc ho tro qua plugin (bot token + su kien WebSocket). Kenh, nhom va Tin nhan truc tiep deu duoc ho tro.
Mattermost la nen tang nhan tin cho nhom co the tu luu tru; xem trang chinh thuc tai
[mattermost.com](https://mattermost.com) de biet chi tiet san pham va tai xuong.

## Can plugin

Mattermost duoc phat hanh duoi dang plugin va khong duoc dong goi cung cai dat loi.

Cai dat qua CLI (npm registry):

```bash
openclaw plugins install @openclaw/mattermost
```

Kiem tra ma nguon cuc bo (khi chay tu repo git):

```bash
openclaw plugins install ./extensions/mattermost
```

Neu ban chon Mattermost trong qua trinh cau hinh/Onboarding va phat hien checkout git,
OpenClaw se tu dong de xuat duong dan cai dat cuc bo.

Chi tiet: [Plugins](/plugin)

## Khoi dong nhanh

1. Cai dat plugin Mattermost.
2. Tao tai khoan bot Mattermost va sao chep **bot token**.
3. Sao chep **base URL** cua Mattermost (vi du: `https://chat.example.com`).
4. Cau hinh OpenClaw va khoi dong Gateway.

Cau hinh toi thieu:

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## Bien moi truong (tai khoan mac dinh)

Dat cac bien nay tren may chu Gateway neu ban muon dung env vars:

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

Env vars chi ap dung cho tai khoan **mac dinh** (`default`). Cac tai khoan khac phai dung gia tri cau hinh.

## Che do tro chuyen

Mattermost tu dong phan hoi Tin nhan truc tiep. Hanh vi trong kenh duoc dieu khien boi `chatmode`:

- `oncall` (mac dinh): chi phan hoi khi duoc @mention trong kenh.
- `onmessage`: phan hoi moi tin nhan trong kenh.
- `onchar`: phan hoi khi tin nhan bat dau bang tien to kich hoat.

Vi du cau hinh:

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

Ghi chu:

- `onchar` van phan hoi voi @mention ro rang.
- `channels.mattermost.requireMention` duoc ton trong cho cau hinh cu nhung `chatmode` duoc khuyen dung.

## Kiem soat truy cap (Tin nhan truc tiep)

- Mac dinh: `channels.mattermost.dmPolicy = "pairing"` (nguoi gui khong xac dinh se nhan ma ghep noi).
- Phe duyet qua:
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- Tin nhan truc tiep cong khai: `channels.mattermost.dmPolicy="open"` kem `channels.mattermost.allowFrom=["*"]`.

## Kenh (nhom)

- Mac dinh: `channels.mattermost.groupPolicy = "allowlist"` (yeu cau mention).
- Cho phep danh sach nguoi gui voi `channels.mattermost.groupAllowFrom` (ID nguoi dung hoac `@username`).
- Kenh mo: `channels.mattermost.groupPolicy="open"` (yeu cau mention).

## Dich muc tieu cho gui ra

Su dung cac dinh dang dich muc tieu nay voi `openclaw message send` hoac cron/webhooks:

- `channel:<id>` cho mot kenh
- `user:<id>` cho Tin nhan truc tiep
- `@username` cho Tin nhan truc tiep (phan giai qua API Mattermost)

ID thuan se duoc coi la kenh.

## Da tai khoan

Mattermost ho tro nhieu tai khoan duoi `channels.mattermost.accounts`:

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## Xu ly su co

- Khong co phan hoi trong kenh: dam bao bot o trong kenh va duoc mention (oncall), dung tien to kich hoat (onchar), hoac dat `chatmode: "onmessage"`.
- Loi xac thuc: kiem tra bot token, base URL, va xem tai khoan co duoc bat hay khong.
- Van de da tai khoan: env vars chi ap dung cho tai khoan `default`.
