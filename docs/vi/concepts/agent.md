---
summary: "Runtime tac tu (pi-mono nhung), hop dong workspace, va khoi tao phien"
read_when:
  - Thay doi runtime tac tu, khoi tao workspace, hoac hanh vi phien
title: "Agent Runtime"
x-i18n:
  source_path: concepts/agent.md
  source_hash: 04b4e0bc6345d2af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:57Z
---

# Agent Runtime 🤖

OpenClaw chay mot runtime tac tu nhung duy nhat duoc dan xuat tu **pi-mono**.

## Workspace (bat buoc)

OpenClaw su dung mot thu muc workspace tac tu duy nhat (`agents.defaults.workspace`) lam thu muc lam viec **duy nhat** (`cwd`) cua tac tu cho cong cu va ngu canh.

Khuyen nghi: su dung `openclaw setup` de tao `~/.openclaw/openclaw.json` neu chua ton tai va khoi tao cac tep workspace.

Bo cuc workspace day du + huong dan sao luu: [Agent workspace](/concepts/agent-workspace)

Neu `agents.defaults.sandbox` duoc bat, cac phien khong phai chinh co the ghi de dieu nay bang
workspace theo tung phien duoi `agents.defaults.sandbox.workspaceRoot` (xem
[Cau hinh Gateway](/gateway/configuration)).

## Tep bootstrap (duoc tiem)

Ben trong `agents.defaults.workspace`, OpenClaw mong doi cac tep co the chinh sua boi nguoi dung sau:

- `AGENTS.md` — huong dan van hanh + “bo nho”
- `SOUL.md` — nhan vat, gioi han, giong dieu
- `TOOLS.md` — ghi chu cong cu do nguoi dung duy tri (vi du: `imsg`, `sag`, quy uoc)
- `BOOTSTRAP.md` — nghiep thuc chay lan dau mot lan (bi xoa sau khi hoan tat)
- `IDENTITY.md` — ten/phong cach/emoji cua tac tu
- `USER.md` — ho so nguoi dung + cach xung ho ua thich

O luot dau tien cua mot phien moi, OpenClaw tiem truc tiep noi dung cac tep nay vao ngu canh tac tu.

Cac tep trong se bi bo qua. Cac tep lon se duoc cat gon va cat bo voi mot dau danh dau de prompt gon nhe (doc tep de xem day du noi dung).

Neu mot tep bi thieu, OpenClaw tiem mot dong danh dau “missing file” duy nhat (va `openclaw setup` se tao mot mau mac dinh an toan).

`BOOTSTRAP.md` chi duoc tao cho **workspace moi hoan toan** (khong co tep bootstrap nao khac ton tai). Neu ban xoa no sau khi hoan tat nghiep thuc, no se khong duoc tao lai o cac lan khoi dong sau.

De tat hoan toan viec tao tep bootstrap (doi voi workspace da duoc seed san), dat:

```json5
{ agent: { skipBootstrap: true } }
```

## Cong cu tich hop

Cac cong cu cot loi (doc/thuc thi/chinh sua/ghi va cac cong cu he thong lien quan) luon san sang,
tuy thuoc chinh sach cong cu. `apply_patch` la tuy chon va bi gioi han boi
`tools.exec.applyPatch`. `TOOLS.md` **khong** dieu khien cong cu nao ton tai; no la
huong dan cho cach _ban_ muon chung duoc su dung.

## Skills

OpenClaw tai Skills tu ba vi tri (workspace thang khi trung ten):

- Dong goi (di kem ban cai dat)
- Quan ly/cuc bo: `~/.openclaw/skills`
- Workspace: `<workspace>/skills`

Skills co the bi gioi han boi cau hinh/bien moi truong (xem `skills` trong [Cau hinh Gateway](/gateway/configuration)).

## Tich hop pi-mono

OpenClaw tai su dung cac phan cua codebase pi-mono (mo hinh/cong cu), nhung **quan ly phien, kham pha, va ket noi cong cu thuoc ve OpenClaw**.

- Khong co runtime tac tu pi-coding.
- Khong tham khao bat ky thiet lap `~/.pi/agent` hay `<workspace>/.pi` nao.

## Phien

Ban ghi phien duoc luu duoi dang JSONL tai:

- `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

ID phien on dinh va do OpenClaw chon.
Cac thu muc phien Pi/Tau cu **khong** duoc doc.

## Dieu huong khi streaming

Khi che do hang doi la `steer`, cac tin nhan den duoc tiem vao lan chay hien tai.
Hang doi duoc kiem tra **sau moi lan goi cong cu**; neu co tin nhan trong hang doi,
cac lan goi cong cu con lai tu thong diep tro ly hien tai se bi bo qua (ket qua cong cu loi voi "Skipped due to queued user message."), sau do tin nhan nguoi dung trong hang doi
duoc tiem truoc phan hoi tro ly tiep theo.

Khi che do hang doi la `followup` hoac `collect`, cac tin nhan den duoc giu lai den khi
luot hien tai ket thuc, sau do mot luot tac tu moi bat dau voi cac payload trong hang doi. Xem
[Queue](/concepts/queue) de biet che do + hanh vi debounce/cap.

Block streaming gui cac khoi tro ly da hoan tat ngay khi xong; mac dinh la
**tat** (`agents.defaults.blockStreamingDefault: "off"`).
Dieu chinh ranh gioi bang `agents.defaults.blockStreamingBreak` (`text_end` vs `message_end`; mac dinh la text_end).
Dieu khien viec chia khoi mem bang `agents.defaults.blockStreamingChunk` (mac dinh
800–1200 ky tu; uu tien ngat doan van, sau do xuong dong; cau la cuoi).
Hop nhat cac khoi streaming bang `agents.defaults.blockStreamingCoalesce` de giam
spam mot dong (ghep dua tren thoi gian nhan roi truoc khi gui). Cac kenh khong phai Telegram yeu cau
`*.blockStreaming: true` ro rang de bat tra loi theo khoi.
Tom tat cong cu chi tiet duoc phat tai thoi diem bat dau cong cu (khong debounce); UI dieu khien
stream dau ra cong cu qua cac su kien tac tu khi co san.
Chi tiet hon: [Streaming + chunking](/concepts/streaming).

## Tham chieu mo hinh

Cac tham chieu mo hinh trong cau hinh (vi du `agents.defaults.model` va `agents.defaults.models`) duoc phan tich bang cach tach theo `/` **dau tien**.

- Su dung `provider/model` khi cau hinh mo hinh.
- Neu ID mo hinh tu than chua `/` (kieu OpenRouter), hay bao gom tien to nha cung cap (vi du: `openrouter/moonshotai/kimi-k2`).
- Neu ban bo qua nha cung cap, OpenClaw coi dau vao la alias hoac mo hinh cua **nha cung cap mac dinh** (chi hoat dong khi khong co `/` trong ID mo hinh).

## Cau hinh (toi thieu)

Toi thieu, hay dat:

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom` (rat khuyen nghi)

---

_Tiep theo: [Group Chats](/concepts/group-messages)_ 🦞
