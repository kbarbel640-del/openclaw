---
summary: "Trang thai ho tro Matrix, kha nang va cau hinh"
read_when:
  - Lam viec voi cac tinh nang kenh Matrix
title: "Matrix"
x-i18n:
  source_path: channels/matrix.md
  source_hash: 923ff717cf14d01c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:33Z
---

# Matrix (plugin)

Matrix la mot giao thuc nhan tin mo, phan tan. OpenClaw ket noi nhu mot **nguoi dung** Matrix
tren bat ky homeserver nao, vi vay ban can mot tai khoan Matrix cho bot. Sau khi dang nhap,
ban co the nhan tin truc tiep (DM) cho bot hoac moi bot vao cac phong (Matrix “groups”).
Beeper cung la mot lua chon client hop le, nhung yeu cau bat E2EE.

Trang thai: ho tro thong qua plugin (@vector-im/matrix-bot-sdk). Tin nhan truc tiep, phong, threads, media, reactions,
polls (gui + poll-start duoi dang van ban), location va E2EE (co ho tro crypto).

## Plugin bat buoc

Matrix duoc phan phoi duoi dang plugin va khong di kem voi cai dat loi.

Cai dat qua CLI (npm registry):

```bash
openclaw plugins install @openclaw/matrix
```

Local checkout (khi chay tu repo git):

```bash
openclaw plugins install ./extensions/matrix
```

Neu ban chon Matrix trong qua trinh configure/onboarding va phat hien git checkout,
OpenClaw se tu dong de xuat duong dan cai dat local.

Chi tiet: [Plugins](/plugin)

## Thiet lap

1. Cai dat plugin Matrix:
   - Tu npm: `openclaw plugins install @openclaw/matrix`
   - Tu local checkout: `openclaw plugins install ./extensions/matrix`
2. Tao tai khoan Matrix tren mot homeserver:
   - Xem cac lua chon hosting tai [https://matrix.org/ecosystem/hosting/](https://matrix.org/ecosystem/hosting/)
   - Hoac tu host.
3. Lay access token cho tai khoan bot:
   - Su dung Matrix login API voi `curl` tai homeserver cua ban:

   ```bash
   curl --request POST \
     --url https://matrix.example.org/_matrix/client/v3/login \
     --header 'Content-Type: application/json' \
     --data '{
     "type": "m.login.password",
     "identifier": {
       "type": "m.id.user",
       "user": "your-user-name"
     },
     "password": "your-password"
   }'
   ```

   - Thay `matrix.example.org` bang URL homeserver cua ban.
   - Hoac dat `channels.matrix.userId` + `channels.matrix.password`: OpenClaw goi cung endpoint
     dang nhap, luu access token vao `~/.openclaw/credentials/matrix/credentials.json`,
     va tai su dung no o lan khoi dong sau.

4. Cau hinh thong tin xac thuc:
   - Env: `MATRIX_HOMESERVER`, `MATRIX_ACCESS_TOKEN` (hoac `MATRIX_USER_ID` + `MATRIX_PASSWORD`)
   - Hoac config: `channels.matrix.*`
   - Neu ca hai deu duoc dat, config se duoc uu tien.
   - Khi co access token: user ID duoc lay tu dong thong qua `/whoami`.
   - Khi dat, `channels.matrix.userId` nen la Matrix ID day du (vi du: `@bot:example.org`).
5. Khoi dong lai Gateway (hoac hoan tat onboarding).
6. Bat dau DM voi bot hoac moi bot vao phong tu bat ky Matrix client nao
   (Element, Beeper, v.v.; xem https://matrix.org/ecosystem/clients/). Beeper yeu cau E2EE,
   vi vay hay dat `channels.matrix.encryption: true` va xac minh thiet bi.

Cau hinh toi thieu (access token, user ID tu dong lay):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      dm: { policy: "pairing" },
    },
  },
}
```

Cau hinh E2EE (bat ma hoa dau-cuoi):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      encryption: true,
      dm: { policy: "pairing" },
    },
  },
}
```

## Ma hoa (E2EE)

Ma hoa dau-cuoi duoc **ho tro** thong qua Rust crypto SDK.

Bat bang `channels.matrix.encryption: true`:

- Neu module crypto tai duoc, cac phong ma hoa se tu dong duoc giai ma.
- Media gui di se duoc ma hoa khi gui toi cac phong ma hoa.
- O lan ket noi dau tien, OpenClaw yeu cau xac minh thiet bi tu cac phien khac cua ban.
- Xac minh thiet bi trong mot Matrix client khac (Element, v.v.) de bat chia se khoa.
- Neu module crypto khong the tai, E2EE se bi tat va cac phong ma hoa se khong duoc giai ma;
  OpenClaw se ghi canh bao.
- Neu ban gap loi thieu module crypto (vi du, `@matrix-org/matrix-sdk-crypto-nodejs-*`),
  hay cho phep build scripts cho `@matrix-org/matrix-sdk-crypto-nodejs` va chay
  `pnpm rebuild @matrix-org/matrix-sdk-crypto-nodejs` hoac tai binary bang
  `node node_modules/@matrix-org/matrix-sdk-crypto-nodejs/download-lib.js`.

Trang thai crypto duoc luu theo tung tai khoan + access token trong
`~/.openclaw/matrix/accounts/<account>/<homeserver>__<user>/<token-hash>/crypto/`
(co so du lieu SQLite). Trang thai dong bo (sync) nam canh no trong `bot-storage.json`.
Neu access token (thiet bi) thay doi, mot store moi se duoc tao va bot can
duoc xac minh lai cho cac phong ma hoa.

**Xac minh thiet bi:**
Khi E2EE duoc bat, bot se yeu cau xac minh tu cac phien khac cua ban khi khoi dong.
Mo Element (hoac client khac) va chap thuan yeu cau xac minh de thiet lap tin cay.
Sau khi xac minh, bot co the giai ma tin nhan trong cac phong ma hoa.

## Mo hinh dinh tuyen

- Phan hoi luon duoc gui lai ve Matrix.
- DMs chia se phien chinh cua tac tu; phong anh xa toi cac phien nhom.

## Kiem soat truy cap (DMs)

- Mac dinh: `channels.matrix.dm.policy = "pairing"`. Nguoi gui chua biet se nhan ma ghep cap.
- Phe duyet qua:
  - `openclaw pairing list matrix`
  - `openclaw pairing approve matrix <CODE>`
- DMs cong khai: `channels.matrix.dm.policy="open"` cong voi `channels.matrix.dm.allowFrom=["*"]`.
- `channels.matrix.dm.allowFrom` chap nhan Matrix user ID day du (vi du: `@user:server`). Trinh huong dan se giai ten hien thi thanh user ID khi tim kiem thu muc tim thay mot ket qua khop chinh xac duy nhat.

## Phong (groups)

- Mac dinh: `channels.matrix.groupPolicy = "allowlist"` (yeu cau nhac ten). Dung `channels.defaults.groupPolicy` de ghi de mac dinh khi chua dat.
- Allowlist phong bang `channels.matrix.groups` (room ID hoac alias; ten se duoc giai thanh ID khi tim kiem thu muc tim thay mot ket qua khop chinh xac duy nhat):

```json5
{
  channels: {
    matrix: {
      groupPolicy: "allowlist",
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
      groupAllowFrom: ["@owner:example.org"],
    },
  },
}
```

- `requireMention: false` bat tu dong tra loi trong phong do.
- `groups."*"` co the dat mac dinh cho viec yeu cau nhac ten tren nhieu phong.
- `groupAllowFrom` han che nhung nguoi gui co the kich hoat bot trong phong (Matrix user ID day du).
- Allowlist `users` theo tung phong co the tiep tuc han che nguoi gui trong mot phong cu the (su dung Matrix user ID day du).
- Trinh huong dan cau hinh se hoi ve allowlist phong (room ID, alias, hoac ten) va chi giai ten khi khop chinh xac va duy nhat.
- Khi khoi dong, OpenClaw giai ten phong/nguoi dung trong allowlist thanh ID va ghi log anh xa; cac muc khong giai duoc se bi bo qua khi doi chieu allowlist.
- Loi moi se tu dong duoc tham gia theo mac dinh; dieu khien bang `channels.matrix.autoJoin` va `channels.matrix.autoJoinAllowlist`.
- De cho phep **khong co phong nao**, dat `channels.matrix.groupPolicy: "disabled"` (hoac giu allowlist rong).
- Khoa cu: `channels.matrix.rooms` (cung cau truc voi `groups`).

## Threads

- Ho tro tra loi theo thread.
- `channels.matrix.threadReplies` dieu khien viec phan hoi co o lai trong thread hay khong:
  - `off`, `inbound` (mac dinh), `always`
- `channels.matrix.replyToMode` dieu khien metadata reply-to khi khong tra loi trong thread:
  - `off` (mac dinh), `first`, `all`

## Kha nang

| Tinh nang          | Trang thai                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Tin nhan truc tiep | ✅ Ho tro                                                                                     |
| Phong              | ✅ Ho tro                                                                                     |
| Threads            | ✅ Ho tro                                                                                     |
| Media              | ✅ Ho tro                                                                                     |
| E2EE               | ✅ Ho tro (can module crypto)                                                                 |
| Reactions          | ✅ Ho tro (gui/doc qua tools)                                                                 |
| Polls              | ✅ Ho tro gui; poll bat dau tu ben ngoai duoc chuyen thanh van ban (bo qua phan hoi/ket thuc) |
| Location           | ✅ Ho tro (geo URI; bo qua do cao)                                                            |
| Lenh native        | ✅ Ho tro                                                                                     |

## Tham chieu cau hinh (Matrix)

Cau hinh day du: [Configuration](/gateway/configuration)

Tuy chon provider:

- `channels.matrix.enabled`: bat/tat khoi dong kenh.
- `channels.matrix.homeserver`: URL homeserver.
- `channels.matrix.userId`: Matrix user ID (tuy chon khi co access token).
- `channels.matrix.accessToken`: access token.
- `channels.matrix.password`: mat khau de dang nhap (token duoc luu).
- `channels.matrix.deviceName`: ten hien thi cua thiet bi.
- `channels.matrix.encryption`: bat E2EE (mac dinh: false).
- `channels.matrix.initialSyncLimit`: gioi han dong bo ban dau.
- `channels.matrix.threadReplies`: `off | inbound | always` (mac dinh: inbound).
- `channels.matrix.textChunkLimit`: kich thuoc chunk van ban gui ra (ky tu).
- `channels.matrix.chunkMode`: `length` (mac dinh) hoac `newline` de tach theo dong trong (ranh gioi doan van) truoc khi chia theo do dai.
- `channels.matrix.dm.policy`: `pairing | allowlist | open | disabled` (mac dinh: pairing).
- `channels.matrix.dm.allowFrom`: DM allowlist (Matrix user ID day du). `open` yeu cau `"*"`. Trinh huong dan se giai ten thanh ID khi co the.
- `channels.matrix.groupPolicy`: `allowlist | open | disabled` (mac dinh: allowlist).
- `channels.matrix.groupAllowFrom`: danh sach nguoi gui duoc phep cho tin nhan nhom (Matrix user ID day du).
- `channels.matrix.allowlistOnly`: ap dung bat buoc quy tac allowlist cho DMs + phong.
- `channels.matrix.groups`: allowlist nhom + ban do cau hinh theo phong.
- `channels.matrix.rooms`: allowlist/cau hinh nhom kieu cu.
- `channels.matrix.replyToMode`: che do reply-to cho threads/tags.
- `channels.matrix.mediaMaxMb`: gioi han media vao/ra (MB).
- `channels.matrix.autoJoin`: xu ly loi moi (`always | allowlist | off`, mac dinh: always).
- `channels.matrix.autoJoinAllowlist`: room ID/alias duoc phep de auto-join.
- `channels.matrix.actions`: gating tool theo hanh dong (reactions/messages/pins/memberInfo/channelInfo).
