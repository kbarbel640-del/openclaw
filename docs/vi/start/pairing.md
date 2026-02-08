---
summary: "Tong quan ve pairing: phe duyet ai co the DM ban + nhung node nao co the tham gia"
read_when:
  - Thiet lap kiem soat truy cap DM
  - Pairing mot node iOS/Android moi
  - Xem xet tu the bao mat cua OpenClaw
title: "Pairing"
x-i18n:
  source_path: start/pairing.md
  source_hash: 5a0539932f905536
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:32Z
---

# Pairing

“Pairing” la buoc **phe duyet cua chu so huu** ro rang trong OpenClaw.
No duoc su dung o hai noi:

1. **DM pairing** (ai duoc phep noi chuyen voi bot)
2. **Node pairing** (thiet bi/node nao duoc phep tham gia mang Gateway)

Bo canh bao mat: [Security](/gateway/security)

## 1) DM pairing (truy cap chat dau vao)

Khi mot kenh duoc cau hinh voi chinh sach DM `pairing`, nguoi gui chua xac dinh se nhan mot ma ngan va tin nhan cua ho **khong duoc xu ly** cho den khi ban phe duyet.

Cac chinh sach DM mac dinh duoc tai lieu hoa tai: [Security](/gateway/security)

Ma pairing:

- 8 ky tu, chu hoa, khong co ky tu de nham lan (`0O1I`).
- **Het han sau 1 gio**. Bot chi gui thong diep pairing khi co yeu cau moi duoc tao (xap xi moi gio mot lan cho moi nguoi gui).
- Yeu cau DM pairing dang cho bi gioi han o **3 moi kenh** theo mac dinh; cac yeu cau bo sung se bi bo qua cho den khi mot yeu cau het han hoac duoc phe duyet.

### Phe duyet nguoi gui

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

Cac kenh ho tro: `telegram`, `whatsapp`, `signal`, `imessage`, `discord`, `slack`.

### Noi luu trang thai

Duoc luu duoi `~/.openclaw/credentials/`:

- Yeu cau dang cho: `<channel>-pairing.json`
- Kho allowlist da duoc phe duyet: `<channel>-allowFrom.json`

Hay coi day la du lieu nhay cam (chung quyet dinh quyen truy cap vao tro ly cua ban).

## 2) Pairing thiet bi node (iOS/Android/macOS/headless nodes)

Cac node ket noi toi Gateway nhu **thiet bi** voi `role: node`. Gateway
tao mot yeu cau pairing thiet bi va can duoc phe duyet.

### Phe duyet thiet bi node

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### Noi luu trang thai

Duoc luu duoi `~/.openclaw/devices/`:

- `pending.json` (ton tai ngan han; yeu cau dang cho se het han)
- `paired.json` (thiet bi da pairing + token)

### Ghi chu

- API `node.pair.*` cu (CLI: `openclaw nodes pending/approve`) la
  mot kho pairing rieng do Gateway so huu. Cac WS node van can pairing thiet bi.

## Tai lieu lien quan

- Mo hinh bao mat + prompt injection: [Security](/gateway/security)
- Cap nhat an toan (chay doctor): [Updating](/install/updating)
- Cau hinh kenh:
  - Telegram: [Telegram](/channels/telegram)
  - WhatsApp: [WhatsApp](/channels/whatsapp)
  - Signal: [Signal](/channels/signal)
  - BlueBubbles (iMessage): [BlueBubbles](/channels/bluebubbles)
  - iMessage (cu): [iMessage](/channels/imessage)
  - Discord: [Discord](/channels/discord)
  - Slack: [Slack](/channels/slack)
