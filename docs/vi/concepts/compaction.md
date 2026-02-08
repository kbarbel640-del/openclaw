---
summary: "Cua so ngu canh + compaction: cach OpenClaw giu cac phien nam trong gioi han cua mo hinh"
read_when:
  - "Ban muon hieu ve auto-compaction va /compact"
  - "Ban dang debug cac phien dai cham gioi han ngu canh"
title: "Compaction"
x-i18n:
  source_path: concepts/compaction.md
  source_hash: e1d6791f2902044b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:44Z
---

# Cua So Ngu Canh & Compaction

Moi mo hinh deu co **cua so ngu canh** (so token toi da no co the nhin thay). Cac cuoc tro chuyen chay lau se tich luy thong diep va ket qua cong cu; khi cua so bi chat, OpenClaw **compacts** lich su cu hon de nam trong gioi han.

## Compaction la gi

Compaction **tom tat cuoc hoi thoai cu hon** thanh mot muc tom tat gon va giu nguyen cac thong diep gan day. Ban tom tat duoc luu trong lich su phien, vi vay cac yeu cau sau se su dung:

- Ban tom tat compaction
- Cac thong diep gan day sau diem compaction

Compaction **duoc luu ben vung** trong lich su JSONL cua phien.

## Cau hinh

Xem [Compaction config & modes](/concepts/compaction) de biet cac cai dat `agents.defaults.compaction`.

## Auto-compaction (bat mac dinh)

Khi mot phien gan cham hoac vuot qua cua so ngu canh cua mo hinh, OpenClaw kich hoat auto-compaction va co the thu lai yeu cau ban dau bang ngu canh da duoc compact.

Ban se thay:

- `🧹 Auto-compaction complete` o che do verbose
- `/status` hien thi `🧹 Compactions: <count>`

Truoc khi compaction, OpenClaw co the chay mot luot **silent memory flush** de luu cac ghi chu ben vung xuong dia. Xem [Memory](/concepts/memory) de biet chi tiet va cau hinh.

## Compaction thu cong

Su dung `/compact` (tuy chon kem huong dan) de buoc chay mot lan compaction:

```
/compact Focus on decisions and open questions
```

## Nguon cua so ngu canh

Cua so ngu canh phu thuoc vao mo hinh. OpenClaw su dung dinh nghia mo hinh tu danh muc nha cung cap da cau hinh de xac dinh gioi han.

## Compaction so voi pruning

- **Compaction**: tom tat va **luu ben vung** trong JSONL.
- **Session pruning**: chi cat bot **ket qua cong cu** cu, **trong bo nho**, theo moi yeu cau.

Xem [/concepts/session-pruning](/concepts/session-pruning) de biet chi tiet ve pruning.

## Meo

- Su dung `/compact` khi phien co cam giac cu hoac ngu canh bi phong to.
- Dau ra cong cu lon da duoc cat bot san; pruning co the giam them su tich luy ket qua cong cu.
- Neu ban can bat dau lai tu dau, `/new` hoac `/reset` se bat dau mot session id moi.
