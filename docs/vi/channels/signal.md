---
summary: "Ho tro Signal thong qua signal-cli (JSON-RPC + SSE), thiet lap va mo hinh so"
read_when:
  - Thiet lap ho tro Signal
  - Xu ly su co gui/nhan Signal
title: "Signal"
x-i18n:
  source_path: channels/signal.md
  source_hash: ca4de8b3685017f5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:30Z
---

# Signal (signal-cli)

Trang thai: tich hop CLI ben ngoai. Gateway giao tiep voi `signal-cli` qua HTTP JSON-RPC + SSE.

## Quick setup (beginner)

1. Su dung **mot so Signal rieng** cho bot (khuyen nghi).
2. Cai dat `signal-cli` (can Java).
3. Lien ket thiet bi bot va khoi dong daemon:
   - `signal-cli link -n "OpenClaw"`
4. Cau hinh OpenClaw va khoi dong gateway.

Cau hinh toi thieu:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

## What it is

- Kenh Signal thong qua `signal-cli` (khong phai libsignal tich hop).
- Dinh tuyen xac dinh: phan hoi luon quay lai Signal.
- DMs chia se phien chinh cua tac tu; nhom duoc tach rieng (`agent:<agentId>:signal:group:<groupId>`).

## Config writes

Mac dinh, Signal duoc phep ghi cap nhat cau hinh duoc kich hoat boi `/config set|unset` (can `commands.config: true`).

Tat bang:

```json5
{
  channels: { signal: { configWrites: false } },
}
```

## The number model (important)

- Gateway ket noi toi **mot thiet bi Signal** (tai khoan `signal-cli`).
- Neu chay bot tren **tai khoan Signal ca nhan** cua ban, no se bo qua tin nhan cua chinh ban (bao ve vong lap).
- De co “toi nhan tin cho bot va no tra loi”, hay dung **mot so bot rieng**.

## Setup (fast path)

1. Cai dat `signal-cli` (can Java).
2. Lien ket mot tai khoan bot:
   - `signal-cli link -n "OpenClaw"` roi quet QR trong Signal.
3. Cau hinh Signal va khoi dong gateway.

Vi du:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

Ho tro nhieu tai khoan: su dung `channels.signal.accounts` voi cau hinh theo tung tai khoan va tuy chon `name`. Xem [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) de biet mau dung chung.

## External daemon mode (httpUrl)

Neu ban muon tu quan ly `signal-cli` (khoi dong JVM lanh cham, khoi tao container, hoac CPU chia se), hay chay daemon rieng va tro OpenClaw toi no:

```json5
{
  channels: {
    signal: {
      httpUrl: "http://127.0.0.1:8080",
      autoStart: false,
    },
  },
}
```

Cach nay bo qua tu dong spawn va thoi gian cho khoi dong ben trong OpenClaw. Voi khoi dong cham khi tu dong spawn, dat `channels.signal.startupTimeoutMs`.

## Access control (DMs + groups)

DMs:

- Mac dinh: `channels.signal.dmPolicy = "pairing"`.
- Nguoi gui chua biet nhan mot ma ghep cap; tin nhan bi bo qua cho toi khi duoc chap thuan (ma het han sau 1 gio).
- Phe duyet bang:
  - `openclaw pairing list signal`
  - `openclaw pairing approve signal <CODE>`
- Ghep cap la co che trao doi token mac dinh cho DMs Signal. Chi tiet: [Pairing](/start/pairing)
- Nguoi gui chi co UUID (tu `sourceUuid`) duoc luu la `uuid:<id>` trong `channels.signal.allowFrom`.

Groups:

- `channels.signal.groupPolicy = open | allowlist | disabled`.
- `channels.signal.groupAllowFrom` dieu khien ai co the kich hoat trong nhom khi `allowlist` duoc dat.

## How it works (behavior)

- `signal-cli` chay nhu mot daemon; gateway doc su kien qua SSE.
- Tin nhan vao duoc chuan hoa thanh bao boc kenh dung chung.
- Phan hoi luon duoc dinh tuyen tro lai cung so hoac nhom.

## Media + limits

- Van ban gui ra duoc chia thanh cac doan `channels.signal.textChunkLimit` (mac dinh 4000).
- Chia theo dong moi tuy chon: dat `channels.signal.chunkMode="newline"` de tach theo dong trong (ranh gioi doan) truoc khi chia theo do dai.
- Ho tro tep dinh kem (base64 lay tu `signal-cli`).
- Gioi han media mac dinh: `channels.signal.mediaMaxMb` (mac dinh 8).
- Su dung `channels.signal.ignoreAttachments` de bo qua tai media.
- Ngu canh lich su nhom dung `channels.signal.historyLimit` (hoac `channels.signal.accounts.*.historyLimit`), quay ve `messages.groupChat.historyLimit`. Dat `0` de tat (mac dinh 50).

## Typing + read receipts

- **Chi bao dang go**: OpenClaw gui tin hieu dang go qua `signal-cli sendTyping` va lam moi trong khi dang tra loi.
- **Bien nhan da doc**: khi `channels.signal.sendReadReceipts` la true, OpenClaw chuyen tiep bien nhan da doc cho DMs duoc phep.
- Signal-cli khong cung cap bien nhan da doc cho nhom.

## Reactions (message tool)

- Su dung `message action=react` voi `channel=signal`.
- Doi tuong: nguoi gui E.164 hoac UUID (su dung `uuid:<id>` tu dau ra ghep cap; UUID thuan cung dung).
- `messageId` la dau thoi gian Signal cua tin nhan ban dang phan ung.
- Phan ung trong nhom can `targetAuthor` hoac `targetAuthorUuid`.

Vi du:

```
message action=react channel=signal target=uuid:123e4567-e89b-12d3-a456-426614174000 messageId=1737630212345 emoji=🔥
message action=react channel=signal target=+15551234567 messageId=1737630212345 emoji=🔥 remove=true
message action=react channel=signal target=signal:group:<groupId> targetAuthor=uuid:<sender-uuid> messageId=1737630212345 emoji=✅
```

Cau hinh:

- `channels.signal.actions.reactions`: bat/tat hanh dong phan ung (mac dinh true).
- `channels.signal.reactionLevel`: `off | ack | minimal | extensive`.
  - `off`/`ack` tat phan ung cua tac tu (cong cu tin nhan `react` se bao loi).
  - `minimal`/`extensive` bat phan ung cua tac tu va dat muc huong dan.
- Ghi de theo tai khoan: `channels.signal.accounts.<id>.actions.reactions`, `channels.signal.accounts.<id>.reactionLevel`.

## Delivery targets (CLI/cron)

- DMs: `signal:+15551234567` (hoac E.164 thuan).
- DMs UUID: `uuid:<id>` (hoac UUID thuan).
- Groups: `signal:group:<groupId>`.
- Ten nguoi dung: `username:<name>` (neu duoc tai khoan Signal cua ban ho tro).

## Configuration reference (Signal)

Cau hinh day du: [Configuration](/gateway/configuration)

Tuy chon nha cung cap:

- `channels.signal.enabled`: bat/tat khoi dong kenh.
- `channels.signal.account`: E.164 cho tai khoan bot.
- `channels.signal.cliPath`: duong dan toi `signal-cli`.
- `channels.signal.httpUrl`: URL daemon day du (ghi de host/port).
- `channels.signal.httpHost`, `channels.signal.httpPort`: rang buoc daemon (mac dinh 127.0.0.1:8080).
- `channels.signal.autoStart`: tu dong spawn daemon (mac dinh true neu `httpUrl` chua dat).
- `channels.signal.startupTimeoutMs`: thoi gian cho khoi dong (ms) (tran 120000).
- `channels.signal.receiveMode`: `on-start | manual`.
- `channels.signal.ignoreAttachments`: bo qua tai tep dinh kem.
- `channels.signal.ignoreStories`: bo qua stories tu daemon.
- `channels.signal.sendReadReceipts`: chuyen tiep bien nhan da doc.
- `channels.signal.dmPolicy`: `pairing | allowlist | open | disabled` (mac dinh: pairing).
- `channels.signal.allowFrom`: danh sach cho phep DM (E.164 hoac `uuid:<id>`). `open` can `"*"`. Signal khong co ten nguoi dung; dung ID so dien thoai/UUID.
- `channels.signal.groupPolicy`: `open | allowlist | disabled` (mac dinh: allowlist).
- `channels.signal.groupAllowFrom`: allowlist nguoi gui trong nhom.
- `channels.signal.historyLimit`: so tin nhan nhom toi da dua vao ngu canh (0 de tat).
- `channels.signal.dmHistoryLimit`: gioi han lich su DM theo luot nguoi dung. Ghi de theo nguoi dung: `channels.signal.dms["<phone_or_uuid>"].historyLimit`.
- `channels.signal.textChunkLimit`: kich thuoc chia doan gui ra (ky tu).
- `channels.signal.chunkMode`: `length` (mac dinh) hoac `newline` de tach theo dong trong (ranh gioi doan) truoc khi chia theo do dai.
- `channels.signal.mediaMaxMb`: gioi han media vao/ra (MB).

Tuy chon toan cuc lien quan:

- `agents.list[].groupChat.mentionPatterns` (Signal khong ho tro mentions goc).
- `messages.groupChat.mentionPatterns` (du phong toan cuc).
- `messages.responsePrefix`.
