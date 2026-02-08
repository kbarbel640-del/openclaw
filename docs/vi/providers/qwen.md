---
summary: "Su dung OAuth Qwen (goi mien phi) trong OpenClaw"
read_when:
  - Ban muon su dung Qwen voi OpenClaw
  - Ban muon truy cap OAuth mien phi vao Qwen Coder
title: "Qwen"
x-i18n:
  source_path: providers/qwen.md
  source_hash: 88b88e224e2fecbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:08Z
---

# Qwen

Qwen cung cap quy trinh OAuth o goi mien phi cho cac mo hinh Qwen Coder va Qwen Vision
(2.000 yeu cau/ngay, tuy thuoc vao gioi han toc do cua Qwen).

## Bat plugin

```bash
openclaw plugins enable qwen-portal-auth
```

Khoi dong lai Gateway sau khi bat.

## Xac thuc

```bash
openclaw models auth login --provider qwen-portal --set-default
```

Lenh nay chay quy trinh OAuth device-code cua Qwen va ghi mot muc nha cung cap vao
`models.json` (kem theo mot alias `qwen` de chuyen doi nhanh).

## ID mo hinh

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

Chuyen doi mo hinh bang:

```bash
openclaw models set qwen-portal/coder-model
```

## Tai su dung dang nhap Qwen Code CLI

Neu ban da dang nhap bang Qwen Code CLI, OpenClaw se dong bo thong tin dang nhap
tu `~/.qwen/oauth_creds.json` khi no tai auth store. Ban van can mot muc
`models.providers.qwen-portal` (su dung lenh dang nhap o tren de tao).

## Ghi chu

- Token tu dong lam moi; hay chay lai lenh dang nhap neu lam moi that bai hoac quyen truy cap bi thu hoi.
- Base URL mac dinh: `https://portal.qwen.ai/v1` (co the ghi de bang
  `models.providers.qwen-portal.baseUrl` neu Qwen cung cap endpoint khac).
- Xem [Model providers](/concepts/model-providers) de biet them chi tiet ve cac quy tac ap dung cho toan bo nha cung cap.
