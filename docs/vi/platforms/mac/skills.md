---
summary: "Giao diện cai dat Skills macOS va trang thai duoc ho tro boi gateway"
read_when:
  - Cap nhat giao dien cai dat Skills macOS
  - Thay doi han che Skills hoac hanh vi cai dat
title: "Skills"
x-i18n:
  source_path: platforms/mac/skills.md
  source_hash: ecd5286bbe49eed8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:54Z
---

# Skills (macOS)

Ung dung macOS hien thi Skills cua OpenClaw thong qua gateway; no khong phan tich Skills tai may cuc bo.

## Nguon du lieu

- `skills.status` (gateway) tra ve tat ca Skills cung voi dieu kien du dieu kien va cac yeu cau con thieu
  (bao gom cac chan allowlist cho Skills dong goi).
- Cac yeu cau duoc suy ra tu `metadata.openclaw.requires` trong moi `SKILL.md`.

## Hanh dong cai dat

- `metadata.openclaw.install` xac dinh cac tuy chon cai dat (brew/node/go/uv).
- Ung dung goi `skills.install` de chay trinh cai dat tren may chu gateway.
- Gateway chi hien thi mot trinh cai dat uu tien khi co nhieu lua chon
  (brew neu co san, neu khong thi dung node manager tu `skills.install`, mac dinh npm).

## Khoa Env/API

- Ung dung luu khoa trong `~/.openclaw/openclaw.json` duoi `skills.entries.<skillKey>`.
- `skills.update` cap nhat `enabled`, `apiKey`, va `env`.

## Che do tu xa

- Cai dat + cap nhat cau hinh dien ra tren may chu gateway (khong phai Mac cuc bo).
