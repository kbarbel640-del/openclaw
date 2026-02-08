---
summary: "Nghi thức khoi dong ban dau cho tac tu, gieo thiet lap khong gian lam viec va cac tep nhan dang"
read_when:
  - Hieu dieu gi xay ra trong lan chay tac tu dau tien
  - Giai thich cac tep khoi dong ban dau nam o dau
  - Xu ly su co thiet lap nhan dang trong onboarding
title: "Khoi Dong Ban Dau Tac Tu"
sidebarTitle: "Bootstrapping"
x-i18n:
  source_path: start/bootstrapping.md
  source_hash: 4a08b5102f25c6c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:25Z
---

# Khoi Dong Ban Dau Tac Tu

Khoi dong ban dau la nghi thuc **lan chay dau tien** chuan bi khong gian lam viec cho tac tu va
thu thap thong tin nhan dang. No xay ra sau onboarding, khi tac tu khoi dong lan dau tien.

## Khoi dong ban dau lam gi

Trong lan chay tac tu dau tien, OpenClaw tien hanh khoi dong ban dau khong gian lam viec (mac dinh
`~/.openclaw/workspace`):

- Tao cac tep `AGENTS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, `USER.md`.
- Chay mot nghi thuc Hoi & Dap ngan (tung cau hoi mot).
- Ghi nhan dang + tuy chon vao `IDENTITY.md`, `USER.md`, `SOUL.md`.
- Xoa `BOOTSTRAP.md` khi hoan tat de chi chay mot lan.

## No chay o dau

Khoi dong ban dau luon chay tren **gateway host**. Neu ung dung macOS ket noi toi mot Gateway tu xa,
khong gian lam viec va cac tep khoi dong ban dau nam tren may tu xa do.

<Note>
Khi Gateway chay tren mot may khac, hay chinh sua cac tep khong gian lam viec tren gateway host
(vi du, `user@gateway-host:~/.openclaw/workspace`).
</Note>

## Tai lieu lien quan

- Onboarding ung dung macOS: [Onboarding](/start/onboarding)
- Bo cuc khong gian lam viec: [Agent workspace](/concepts/agent-workspace)
