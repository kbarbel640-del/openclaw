---
title: "Quy trinh phat trien Pi"
x-i18n:
  source_path: pi-dev.md
  source_hash: 65bd0580dd03df05
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:47Z
---

# Quy trinh phat trien Pi

Huong dan nay tom tat mot quy trinh hop ly de lam viec voi tich hop Pi trong OpenClaw.

## Kiem tra kieu va Linting

- Kiem tra kieu va build: `pnpm build`
- Lint: `pnpm lint`
- Kiem tra dinh dang: `pnpm format`
- Full gate truoc khi day len: `pnpm lint && pnpm build && pnpm test`

## Chay Pi Tests

Su dung script chuyen biet cho bo test tich hop Pi:

```bash
scripts/pi/run-tests.sh
```

De bao gom bai test live kiem tra hanh vi nha cung cap thuc:

```bash
scripts/pi/run-tests.sh --live
```

Script se chay tat ca cac unit test lien quan den Pi thong qua cac glob sau:

- `src/agents/pi-*.test.ts`
- `src/agents/pi-embedded-*.test.ts`
- `src/agents/pi-tools*.test.ts`
- `src/agents/pi-settings.test.ts`
- `src/agents/pi-tool-definition-adapter.test.ts`
- `src/agents/pi-extensions/*.test.ts`

## Kiem thu thu cong

Quy trinh de xuat:

- Chay Gateway o che do dev:
  - `pnpm gateway:dev`
- Kich hoat tac tu truc tiep:
  - `pnpm openclaw agent --message "Hello" --thinking low`
- Su dung TUI de debug tuong tac:
  - `pnpm tui`

Doi voi hanh vi goi cong cu, hay nhap lenh cho mot hanh dong `read` hoac `exec` de co the quan sat viec streaming cong cu va xu ly payload.

## Dat lai trang thai sach

Trang thai duoc luu duoi thu muc trang thai cua OpenClaw. Mac dinh la `~/.openclaw`. Neu `OPENCLAW_STATE_DIR` duoc thiet lap, hay su dung thu muc do thay the.

De dat lai tat ca:

- `openclaw.json` cho cau hinh
- `credentials/` cho ho so xac thuc va token
- `agents/<agentId>/sessions/` cho lich su phien tac tu
- `agents/<agentId>/sessions.json` cho chi muc phien
- `sessions/` neu ton tai duong dan legacy
- `workspace/` neu ban muon mot workspace trong

Neu chi muon dat lai cac phien, hay xoa `agents/<agentId>/sessions/` va `agents/<agentId>/sessions.json` cho tac tu do. Giu `credentials/` neu ban khong muon xac thuc lai.

## Tham khao

- https://docs.openclaw.ai/testing
- https://docs.openclaw.ai/start/getting-started
