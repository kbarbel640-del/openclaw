---
summary: "Trung tâm xu ly su co: trieu chung → kiem tra → cach khac phuc"
read_when:
  - Ban gap loi va muon biet lo trinh khac phuc
  - Trinh cai dat bao “thanh cong” nhung CLI khong hoat dong
title: "Xu ly su co"
x-i18n:
  source_path: help/troubleshooting.md
  source_hash: 00ba2a20732fa22c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:27Z
---

# Xu ly su co

## 60 giay dau tien

Chay cac lenh sau theo thu tu:

```bash
openclaw status
openclaw status --all
openclaw gateway probe
openclaw logs --follow
openclaw doctor
```

Neu Gateway co the truy cap, thu cac phep kiem tra sau:

```bash
openclaw status --deep
```

## Cac truong hop “bi hong” pho bien

### `openclaw: command not found`

Gan nhu luon la van de PATH cua Node/npm. Bat dau tu day:

- [Cai dat (kiem tra tinh hop le PATH Node/npm)](/install#nodejs--npm-path-sanity)

### Trinh cai dat that bai (hoac ban can day du log)

Chay lai trinh cai dat o che do verbose de xem toan bo trace va dau ra npm:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

Doi voi ban beta:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

Ban cung co the dat `OPENCLAW_VERBOSE=1` thay cho co.

### Gateway “unauthorized”, khong the ket noi, hoac lien tuc ket noi lai

- [Xu ly su co Gateway](/gateway/troubleshooting)
- [Xac thuc Gateway](/gateway/authentication)

### Giao dien Dieu khien that bai tren HTTP (yeu cau danh tinh thiet bi)

- [Xu ly su co Gateway](/gateway/troubleshooting)
- [Giao dien Dieu khien](/web/control-ui#insecure-http)

### `docs.openclaw.ai` hien thi loi SSL (Comcast/Xfinity)

Mot so ket noi Comcast/Xfinity chan `docs.openclaw.ai` thong qua Xfinity Advanced Security.
Tat Advanced Security hoac them `docs.openclaw.ai` vao allowlist, sau do thu lai.

- Tro giup Xfinity Advanced Security: https://www.xfinity.com/support/articles/using-xfinity-xfi-advanced-security
- Kiem tra nhanh: thu diem phat song di dong hoac VPN de xac nhan day la loc o muc ISP

### Dich vu bao dang chay, nhung phep do RPC that bai

- [Xu ly su co Gateway](/gateway/troubleshooting)
- [Tien trinh nen / dich vu](/gateway/background-process)

### Loi model/xac thuc (gioi han toc do, thanh toan, “all models failed”)

- [Models](/cli/models)
- [Khai niem OAuth / xac thuc](/concepts/oauth)

### `/model` bao `model not allowed`

Dieu nay thuong co nghia la `agents.defaults.models` duoc cau hinh lam allowlist. Khi no khong rong,
chi nhung khoa nha cung cap/model do moi co the duoc chon.

- Kiem tra allowlist: `openclaw config get agents.defaults.models`
- Them model ban muon (hoac xoa allowlist) va thu lai `/model`
- Dung `/models` de duyet cac nha cung cap/model duoc phep

### Khi gui bao loi

Dan bao cao an toan:

```bash
openclaw status --all
```

Neu co the, hay kem theo phan cuoi log lien quan tu `openclaw logs --follow`.
