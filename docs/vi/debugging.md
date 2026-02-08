---
summary: "Cong cu debug: che do theo doi, dong mo hinh tho, va truy vet ro ri ly do"
read_when:
  - Ban can kiem tra dau ra mo hinh tho de phat hien ro ri ly do
  - Ban muon chay Gateway o che do theo doi trong khi lap trinh va thu nghiem
  - Ban can mot quy trinh debug co the lap lai
title: "Debug"
x-i18n:
  source_path: debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:09Z
---

# Debug

Trang nay bao gom cac cong cu ho tro debug cho dau ra dang stream, dac biet khi
nha cung cap tron ly do vao van ban thong thuong.

## Ghi de debug luc chay

Su dung `/debug` trong chat de dat cac ghi de cau hinh **chi ap dung luc chay**
(trong bo nho, khong ghi ra dia).
`/debug` bi tat theo mac dinh; bat bang `commands.debug: true`.
Cach nay rat tien khi ban can bat/tat cac thiet lap it dung den ma khong can sua `openclaw.json`.

Vi du:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` se xoa tat ca ghi de va quay lai cau hinh tren dia.

## Che do theo doi Gateway

De lap nhanh, chay gateway voi bo theo doi tep:

```bash
pnpm gateway:watch --force
```

Tuong duong voi:

```bash
tsx watch src/entry.ts gateway --force
```

Them bat ky co Gateway CLI nao sau `gateway:watch` va chung se duoc truyen qua
moi lan khoi dong lai.

## Ho so dev + gateway dev (--dev)

Su dung ho so dev de tach biet trang thai va khoi tao mot thiet lap an toan,
co the huy bo de phuc vu debug. Co **hai** co `--dev`:

- **`--dev` toan cuc (profile):** tach biet trang thai duoi `~/.openclaw-dev` va
  dat cong gateway mac dinh la `19001` (cac cong phat sinh se dich chuyen theo).
- **`gateway --dev`: bao Gateway tu dong tao cau hinh + workspace mac dinh**
  khi chua ton tai (va bo qua BOOTSTRAP.md).

Luong de xuat (ho so dev + dev bootstrap):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

Neu ban chua co cai dat toan cuc, hay chay CLI thong qua `pnpm openclaw ...`.

No thuc hien:

1. **Tach biet ho so** (`--dev` toan cuc)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (trinh duyet/canvas cung dich chuyen tuong ung)

2. **Dev bootstrap** (`gateway --dev`)
   - Ghi cau hinh toi thieu neu chua co (`gateway.mode=local`, bind loopback).
   - Dat `agent.workspace` toi workspace dev.
   - Dat `agent.skipBootstrap=true` (khong co BOOTSTRAP.md).
   - Gieo cac tep workspace neu thieu:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - Dinh danh mac dinh: **C3‑PO** (protocol droid).
   - Bo qua cac nha cung cap kenh o che do dev (`OPENCLAW_SKIP_CHANNELS=1`).

Luong reset (khoi dau moi):

```bash
pnpm gateway:dev:reset
```

Luu y: `--dev` la co ho so **toan cuc** va bi mot so runner “nuot” mat.
Neu can chi ro, hay dung dang bien moi truong:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` se xoa cau hinh, thong tin xac thuc, phien, va workspace dev (su dung
`trash`, khong phai `rm`), sau do tao lai thiet lap dev mac dinh.

Meo: neu mot gateway khong phai dev dang chay (launchd/systemd), hay dung no truoc:

```bash
openclaw gateway stop
```

## Ghi log dong tho (OpenClaw)

OpenClaw co the ghi log **dong tro ly tho** truoc bat ky loc/dinh dang nao.
Day la cach tot nhat de xem ly do co den duoi dang delta van ban thuong
(hay la cac khoi suy nghi tach rieng).

Bat qua CLI:

```bash
pnpm gateway:watch --force --raw-stream
```

Tuy chon ghi de duong dan:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

Cac bien moi truong tuong duong:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

Tep mac dinh:

`~/.openclaw/logs/raw-stream.jsonl`

## Ghi log chunk tho (pi-mono)

De bat **cac chunk tuong thich OpenAI tho** truoc khi duoc phan tich thanh cac khoi,
pi-mono cung cap mot logger rieng:

```bash
PI_RAW_STREAM=1
```

Duong dan tuy chon:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

Tep mac dinh:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> Luu y: chi phat sinh tu cac tien trinh su dung nha cung cap
> `openai-completions` cua pi-mono.

## Luu y an toan

- Log dong tho co the chua day du prompt, dau ra cong cu, va du lieu nguoi dung.
- Hay giu log o may cuc bo va xoa sau khi debug.
- Neu chia se log, hay loai bo truoc cac bi mat va PII.
