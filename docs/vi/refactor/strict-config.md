---
summary: "Xac thuc cau hinh nghiem ngat + migration chi qua doctor"
read_when:
  - Thiet ke hoac trien khai hanh vi xac thuc cau hinh
  - Lam viec voi migration cau hinh hoac quy trinh doctor
  - Xu ly schema cau hinh plugin hoac dieu kien tai plugin
title: "Xac Thuc Cau Hinh Nghiem Ngat"
x-i18n:
  source_path: refactor/strict-config.md
  source_hash: 5bc7174a67d2234e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:20Z
---

# Xac thuc cau hinh nghiem ngat (migration chi qua doctor)

## Muc tieu

- **Tu choi moi khoa cau hinh khong xac dinh o moi noi** (goc + long).
- **Tu choi cau hinh plugin khong co schema**; khong tai plugin do.
- **Loai bo tu dong migration cu khi tai**; migration chi chay qua doctor.
- **Tu dong chay doctor (dry-run) khi khoi dong**; neu khong hop le, chan cac lenh khong phai chan doan.

## Khong phai muc tieu

- Tuong thich nguoc khi tai (khoa cu khong tu dong migrate).
- Am tham loai bo cac khoa khong duoc nhan dien.

## Quy tac xac thuc nghiem ngat

- Cau hinh phai khop chinh xac voi schema o moi cap.
- Khoa khong xac dinh la loi xac thuc (khong cho phep passthrough o goc hay long).
- `plugins.entries.<id>.config` phai duoc xac thuc boi schema cua plugin.
  - Neu plugin thieu schema, **tu choi tai plugin** va hien thi loi ro rang.
- Cac khoa `channels.<id>` khong xac dinh la loi tru khi manifest plugin khai bao channel id.
- Manifest plugin (`openclaw.plugin.json`) la bat buoc cho tat ca plugin.

## Thuc thi schema plugin

- Moi plugin cung cap mot JSON Schema nghiem ngat cho cau hinh (nhung truc tiep trong manifest).
- Luong tai plugin:
  1. Giai quyet manifest + schema cua plugin (`openclaw.plugin.json`).
  2. Xac thuc cau hinh theo schema.
  3. Neu thieu schema hoac cau hinh khong hop le: chan tai plugin, ghi nhan loi.
- Thong bao loi bao gom:
  - Plugin id
  - Ly do (thieu schema / cau hinh khong hop le)
  - Duong dan (path) xac thuc that bai
- Plugin bi vo hieu hoa van giu cau hinh, nhung Doctor + log hien thi canh bao.

## Luong Doctor

- Doctor chay **moi lan** cau hinh duoc tai (mac dinh la dry-run).
- Neu cau hinh khong hop le:
  - In tom tat + cac loi co the hanh dong.
  - Huong dan: `openclaw doctor --fix`.
- `openclaw doctor --fix`:
  - Ap dung migration.
  - Loai bo cac khoa khong xac dinh.
  - Ghi cau hinh da cap nhat.

## Chan lenh (khi cau hinh khong hop le)

Duoc phep (chi chan doan):

- `openclaw doctor`
- `openclaw logs`
- `openclaw health`
- `openclaw help`
- `openclaw status`
- `openclaw gateway status`

Tat ca cac lenh khac phai that bai ngay voi: “Cau hinh khong hop le. Chay `openclaw doctor --fix`.”

## Dinh dang UX loi

- Mot tieu de tom tat duy nhat.
- Cac phan nhom:
  - Khoa khong xac dinh (day du duong dan)
  - Khoa cu / can migration
  - Loi tai plugin (plugin id + ly do + duong dan)

## Diem cham trien khai

- `src/config/zod-schema.ts`: loai bo passthrough o goc; object nghiem ngat o moi noi.
- `src/config/zod-schema.providers.ts`: dam bao schema kenh nghiem ngat.
- `src/config/validation.ts`: that bai khi co khoa khong xac dinh; khong ap dung migration cu.
- `src/config/io.ts`: loai bo tu dong migration cu; luon chay doctor dry-run.
- `src/config/legacy*.ts`: chuyen viec su dung sang chi doctor.
- `src/plugins/*`: them schema registry + gating.
- Chan lenh CLI trong `src/cli`.

## Kiem thu

- Tu choi khoa khong xac dinh (goc + long).
- Plugin thieu schema → chan tai plugin voi loi ro rang.
- Cau hinh khong hop le → chan khoi dong Gateway ngoai tru cac lenh chan doan.
- Doctor tu dong dry-run; `doctor --fix` ghi cau hinh da duoc chinh sua.
