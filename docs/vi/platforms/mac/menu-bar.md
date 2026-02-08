---
summary: "Logic trạng thái menu bar và những gì hiển thị cho người dùng"
read_when:
  - Tinh chinh UI menu mac hoac logic trang thai
title: "Menu Bar"
x-i18n:
  source_path: platforms/mac/menu-bar.md
  source_hash: 8eb73c0e671a76aa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:01Z
---

# Logic Trang Thai Menu Bar

## Nhung gi duoc hien thi

- Chung toi hien thi trang thai cong viec hien tai cua tac tu trong bieu tuong menu bar va o dong trang thai dau tien cua menu.
- Trang thai suc khoe se an khi cong viec dang hoat dong; no se tro lai khi tat ca phien deu o trang thai nhan roi.
- Khoi “Nodes” trong menu chi liet ke **thiet bi** (cac node da ghep cap qua `node.list`), khong bao gom cac muc client/presence.
- Mot muc “Usage” se xuat hien ben duoi Context khi co anh chup muc su dung cua nha cung cap.

## Mo hinh trang thai

- Phien: su kien den voi `runId` (moi lan chay) kem theo `sessionKey` trong payload. Phien “chinh” la khoa `main`; neu thieu, chung toi se dung phien duoc cap nhat gan nhat.
- Uu tien: phien chinh luon thang. Neu phien chinh dang hoat dong, trang thai cua no se duoc hien thi ngay lap tuc. Neu phien chinh nhan roi, phien khong phai chinh nhung hoat dong gan nhat se duoc hien thi. Chung toi khong doi qua doi lai giua chung trong khi dang hoat dong; chi chuyen khi phien hien tai chuyen sang nhan roi hoac khi phien chinh bat dau hoat dong.
- Loai hoat dong:
  - `job`: thuc thi lenh muc cao (`state: started|streaming|done|error`).
  - `tool`: `phase: start|result` voi `toolName` va `meta/args`.

## Enum IconState (Swift)

- `idle`
- `workingMain(ActivityKind)`
- `workingOther(ActivityKind)`
- `overridden(ActivityKind)` (ghi de debug)

### ActivityKind → glyph

- `exec` → 💻
- `read` → 📄
- `write` → ✍️
- `edit` → 📝
- `attach` → 📎
- mac dinh → 🛠️

### Anh xa hien thi

- `idle`: critter binh thuong.
- `workingMain`: huy hieu voi glyph, mau day du, hoat anh chan “dang lam viec”.
- `workingOther`: huy hieu voi glyph, mau giam, khong chay.
- `overridden`: su dung glyph/mau da chon bat ke hoat dong.

## Noi dung dong trang thai (menu)

- Khi cong viec dang hoat dong: `<Session role> · <activity label>`
  - Vi du: `Main · exec: pnpm test`, `Other · read: apps/macos/Sources/OpenClaw/AppState.swift`.
- Khi nhan roi: quay ve tom tat trang thai suc khoe.

## Tiep nhan su kien

- Nguon: su kien kenh dieu khien `agent` (`ControlChannel.handleAgentEvent`).
- Cac truong duoc phan tich:
  - `stream: "job"` voi `data.state` cho bat dau/dung.
  - `stream: "tool"` voi `data.phase`, `name`, tuy chon `meta`/`args`.
- Nhan:
  - `exec`: dong dau tien cua `args.command`.
  - `read`/`write`: duong dan rut gon.
  - `edit`: duong dan kem loai thay doi duoc suy ra tu `meta`/so luong diff.
  - du phong: ten cong cu.

## Ghi de debug

- Cai dat ▸ Debug ▸ bo chon “Icon override”:
  - `System (auto)` (mac dinh)
  - `Working: main` (theo loai cong cu)
  - `Working: other` (theo loai cong cu)
  - `Idle`
- Duoc luu thong qua `@AppStorage("iconOverride")`; anh xa toi `IconState.overridden`.

## Danh sach kiem thu

- Kich hoat cong viec phien chinh: xac nhan bieu tuong chuyen ngay lap tuc va dong trang thai hien thi nhan cua phien chinh.
- Kich hoat cong viec phien khong chinh khi phien chinh nhan roi: bieu tuong/trang thai hien thi phien khong chinh; giu on dinh cho den khi no ket thuc.
- Bat dau phien chinh khi phien khac dang hoat dong: bieu tuong lap tuc chuyen sang phien chinh.
- Cac dot cong cu nhanh: dam bao huy hieu khong nhap nhay (TTL grace tren ket qua cong cu).
- Dong trang thai suc khoe xuat hien lai khi tat ca phien deu nhan roi.
