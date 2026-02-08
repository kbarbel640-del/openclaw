---
summary: "Huong dan tac tu OpenClaw mac dinh va danh sach Skills cho cau hinh tro ly ca nhan"
read_when:
  - Bat dau mot phien tac tu OpenClaw moi
  - Kich hoat hoac kiem tra cac Skills mac dinh
x-i18n:
  source_path: reference/AGENTS.default.md
  source_hash: 20ec2b8d8fc03c16
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:31Z
---

# AGENTS.md — Tro ly Ca nhan OpenClaw (mac dinh)

## Lan chay dau tien (khuyen nghi)

OpenClaw su dung mot thu muc workspace rieng cho tac tu. Mac dinh: `~/.openclaw/workspace` (co the cau hinh qua `agents.defaults.workspace`).

1. Tao workspace (neu chua ton tai):

```bash
mkdir -p ~/.openclaw/workspace
```

2. Sao chep cac mau workspace mac dinh vao workspace:

```bash
cp docs/reference/templates/AGENTS.md ~/.openclaw/workspace/AGENTS.md
cp docs/reference/templates/SOUL.md ~/.openclaw/workspace/SOUL.md
cp docs/reference/templates/TOOLS.md ~/.openclaw/workspace/TOOLS.md
```

3. Tuy chon: neu ban muon danh sach Skills cua tro ly ca nhan, thay the AGENTS.md bang tep nay:

```bash
cp docs/reference/AGENTS.default.md ~/.openclaw/workspace/AGENTS.md
```

4. Tuy chon: chon workspace khac bang cach dat `agents.defaults.workspace` (ho tro `~`):

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
}
```

## Mac dinh an toan

- Khong do (dump) thu muc hoac bi mat vao chat.
- Khong chay lenh pha huy tru khi duoc yeu cau ro rang.
- Khong gui tra loi tung phan/streaming toi cac nen tang nhan tin ben ngoai (chi gui tra loi cuoi cung).

## Bat dau phien (bat buoc)

- Doc `SOUL.md`, `USER.md`, `memory.md`, va hom nay+hom qua trong `memory/`.
- Thuc hien dieu nay truoc khi phan hoi.

## Linh hon (bat buoc)

- `SOUL.md` xac dinh danh tinh, giong dieu va ranh gioi. Hay giu cap nhat.
- Neu ban thay doi `SOUL.md`, hay thong bao cho nguoi dung.
- Moi phien ban la mot the hien moi; tinh lien tuc nam trong cac tep nay.

## Khong gian chung (khuyen nghi)

- Ban khong phai la giong noi cua nguoi dung; hay than trong trong chat nhom hoac kenh cong khai.
- Khong chia se du lieu rieng tu, thong tin lien he, hoac ghi chu noi bo.

## He thong bo nho (khuyen nghi)

- Nhat ky hang ngay: `memory/YYYY-MM-DD.md` (tao `memory/` neu can).
- Bo nho dai han: `memory.md` cho su that ben vung, so thich va quyet dinh.
- Khi bat dau phien, doc hom nay + hom qua + `memory.md` neu co.
- Ghi nhan: quyet dinh, so thich, rang buoc, vong viec con dang do.
- Tranh luu bi mat tru khi duoc yeu cau ro rang.

## Cong cu & Skills

- Cong cu nam trong Skills; hay tuan theo `SKILL.md` cua tung skill khi can.
- Giu cac ghi chu phu thuoc moi truong trong `TOOLS.md` (Notes for Skills).

## Meo sao luu (khuyen nghi)

Neu ban coi workspace nay la “bo nho” cua Clawd, hay bien no thanh mot git repo (ly tuong la rieng tu) de `AGENTS.md` va cac tep bo nho cua ban duoc sao luu.

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md
git commit -m "Add Clawd workspace"
# Optional: add a private remote + push
```

## OpenClaw Lam Gi

- Chay Gateway WhatsApp + tac tu lap trinh Pi de tro ly co the doc/ghi chat, lay boi canh, va chay Skills qua may Mac chu.
- Ung dung macOS quan ly quyen (ghi man hinh, thong bao, micro) va mo ra CLI `openclaw` qua nhi phan dong goi cua no.
- Chat truc tiep duoc gop mac dinh vao phien `main` cua tac tu; nhom duoc giu tach biet thanh `agent:<agentId>:<channel>:group:<id>` (phong/kenh: `agent:<agentId>:<channel>:channel:<id>`); heartbeat giu cac tac vu nen hoat dong.

## Skills Cot Loi (kich hoat trong Settings → Skills)

- **mcporter** — Runtime/CLI may chu cong cu de quan ly cac backend skill ben ngoai.
- **Peekaboo** — Chup man hinh macOS nhanh voi phan tich thi giac AI tuy chon.
- **camsnap** — Thu khung hinh, doan clip, hoac canh bao chuyen dong tu camera an ninh RTSP/ONVIF.
- **oracle** — CLI tac tu san sang cho OpenAI voi phat lai phien va dieu khien trinh duyet.
- **eightctl** — Dieu khien giac ngu cua ban tu terminal.
- **imsg** — Gui, doc, stream iMessage & SMS.
- **wacli** — WhatsApp CLI: dong bo, tim kiem, gui.
- **discord** — Hanh dong Discord: tha cam xuc, sticker, binh chon. Su dung dich `user:<id>` hoac `channel:<id>` (id so thuan de gay nham lan).
- **gog** — Google Suite CLI: Gmail, Calendar, Drive, Contacts.
- **spotify-player** — Trinh khach Spotify tren terminal de tim kiem/xep hang doi/dieu khien phat.
- **sag** — Giong noi ElevenLabs voi UX kieu mac-style say; mac dinh stream ra loa.
- **Sonos CLI** — Dieu khien loa Sonos (kham pha/trang thai/phat/am luong/nhom) tu script.
- **blucli** — Phat, nhom va tu dong hoa trinh phat BluOS tu script.
- **OpenHue CLI** — Dieu khien den Philips Hue cho canh va tu dong hoa.
- **OpenAI Whisper** — Chuyen giong noi thanh van ban cuc bo cho doc chinh ta nhanh va ban ghi am hop thu.
- **Gemini CLI** — Cac mo hinh Google Gemini tu terminal cho hoi dap nhanh.
- **bird** — X/Twitter CLI de dang tweet, tra loi, doc chuoi va tim kiem khong can trinh duyet.
- **agent-tools** — Bo cong cu tien ich cho tu dong hoa va script ho tro.

## Ghi Chu Su Dung

- Uu tien CLI `openclaw` cho script; ung dung mac xu ly quyen.
- Chay cai dat tu tab Skills; no an nut neu nhi phan da ton tai.
- Giu heartbeat duoc bat de tro ly co the lap lich nhac nho, theo doi hop thu, va kich hoat ghi hinh camera.
- Giao dien Canvas chay toan man hinh voi lop phu goc. Tranh dat dieu khien quan trong o mep tren-trai/tren-phai/duoi; hay them le (gutter) ro rang trong bo cuc va khong phu thuoc vao safe-area insets.
- De xac minh dua tren trinh duyet, dung `openclaw browser` (tab/trang thai/anh chup) voi ho so Chrome do OpenClaw quan ly.
- De kiem tra DOM, dung `openclaw browser eval|query|dom|snapshot` (va `--json`/`--out` khi can dau ra cho may).
- De tuong tac, dung `openclaw browser click|type|hover|drag|select|upload|press|wait|navigate|back|evaluate|run` (click/type can tham chieu snapshot; dung `evaluate` cho bo chon CSS).
