---
summary: "Thiet ke hang doi lenh de tuan tu hoa cac lan chay tra loi tu dong dau vao"
read_when:
  - Thay doi thuc thi hoac do dong thoi cua tra loi tu dong
title: "Hang Doi Lenh"
x-i18n:
  source_path: concepts/queue.md
  source_hash: 2104c24d200fb4f9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:00Z
---

# Hang Doi Lenh (2026-01-16)

Chung toi tuan tu hoa cac lan chay tra loi tu dong dau vao (tat ca kenh) thong qua mot hang doi nho trong tien trinh de ngan viec nhieu lan chay tac tu va cham vao nhau, trong khi van cho phep song song an toan giua cac phien.

## Vi sao

- Cac lan chay tra loi tu dong co the ton kem (goi LLM) va co the va cham khi nhieu tin nhan dau vao den gan nhau.
- Tuan tu hoa giup tranh canh tranh tai nguyen dung chung (tep phien, log, CLI stdin) va giam nguy co bi gioi han toc do tu phia tren.

## Cach hoat dong

- Mot hang doi FIFO nhan biet lane rut moi lane voi gioi han dong thoi co the cau hinh (mac dinh 1 cho cac lane chua cau hinh; main mac dinh 4, subagent la 8).
- `runEmbeddedPiAgent` xep hang theo **khoa phien** (lane `session:<key>`) de dam bao chi co mot lan chay dang hoat dong moi phien.
- Moi lan chay phien sau do duoc dua vao mot **lane toan cuc** (mac dinh la `main`) de tong muc song song bi gioi han boi `agents.defaults.maxConcurrent`.
- Khi bat log chi tiet, cac lan chay bi xep hang se phat ra thong bao ngan neu cho hon ~2s truoc khi bat dau.
- Chi bao dang go van kich hoat ngay lap tuc khi xep hang (neu kenh ho tro) nen trai nghiem nguoi dung khong doi trong khi cho den luot.

## Che do hang doi (theo kenh)

Tin nhan dau vao co the dieu huong lan chay hien tai, cho mot luot theo doi, hoac lam ca hai:

- `steer`: chen ngay vao lan chay hien tai (huy cac cuoc goi cong cu dang cho sau ran gioi cong cu tiep theo). Neu khong streaming, se quay ve followup.
- `followup`: xep hang cho luot tac tu tiep theo sau khi lan chay hien tai ket thuc.
- `collect`: gop tat ca tin nhan da xep hang thanh **mot** luot followup duy nhat (mac dinh). Neu tin nhan nham den cac kenh/luong khac nhau, chung se duoc rut rieng le de bao toan dinh tuyen.
- `steer-backlog` (con goi la `steer+backlog`): dieu huong ngay **va** giu lai tin nhan cho mot luot followup.
- `interrupt` (ke thua): huy lan chay dang hoat dong cua phien do, sau do chay tin nhan moi nhat.
- `queue` (ten goi khac ke thua): giong voi `steer`.

Steer-backlog co nghia la ban co the nhan duoc phan hoi followup sau lan chay da dieu huong, vi vay
cac be mat streaming co the trong giong nhu bi trung lap. Uu tien `collect`/`steer` neu ban muon
mot phan hoi cho moi tin nhan dau vao.
Gui `/queue collect` nhu mot lenh doc lap (theo phien) hoac dat `messages.queue.byChannel.discord: "collect"`.

Mac dinh (khi khong duoc dat trong cau hinh):

- Tat ca be mat → `collect`

Cau hinh toan cuc hoac theo kenh thong qua `messages.queue`:

```json5
{
  messages: {
    queue: {
      mode: "collect",
      debounceMs: 1000,
      cap: 20,
      drop: "summarize",
      byChannel: { discord: "collect" },
    },
  },
}
```

## Tuy chon hang doi

Tuy chon ap dung cho `followup`, `collect`, va `steer-backlog` (va cho `steer` khi no quay ve followup):

- `debounceMs`: cho yen lang truoc khi bat dau mot luot followup (ngan “tiep tuc, tiep tuc”).
- `cap`: so tin nhan toi da duoc xep hang moi phien.
- `drop`: chinh sach tran (`old`, `new`, `summarize`).

Summarize giu mot danh sach gach dau dong ngan cac tin nhan bi loai bo va chen no nhu mot prompt followup tong hop.
Mac dinh: `debounceMs: 1000`, `cap: 20`, `drop: summarize`.

## Ghi de theo phien

- Gui `/queue <mode>` nhu mot lenh doc lap de luu che do cho phien hien tai.
- Co the ket hop tuy chon: `/queue collect debounce:2s cap:25 drop:summarize`
- `/queue default` hoac `/queue reset` se xoa ghi de theo phien.

## Pham vi va dam bao

- Ap dung cho cac lan chay tac tu tra loi tu dong tren tat ca cac kenh dau vao su dung pipeline tra loi cua Gateway (WhatsApp web, Telegram, Slack, Discord, Signal, iMessage, webchat, v.v.).
- Lane mac dinh (`main`) la dung chung cho toan bo tien trinh doi voi inbound + heartbeat chinh; dat `agents.defaults.maxConcurrent` de cho phep nhieu phien song song.
- Cac lane bo sung co the ton tai (vi du `cron`, `subagent`) de cac cong viec nen chay song song ma khong chan cac phan hoi dau vao.
- Lane theo phien dam bao chi co mot lan chay tac tu cham vao mot phien cu the tai mot thoi diem.
- Khong co phu thuoc ben ngoai hoac luong worker nen; thuan TypeScript + promises.

## Xu ly su co

- Neu lenh co ve bi ket, hay bat log chi tiet va tim cac dong “queued for …ms” de xac nhan hang doi dang duoc rut.
- Neu ban can do sau hang doi, hay bat log chi tiet va theo doi cac dong thoi gian hang doi.
