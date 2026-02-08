---
summary: "Cách chạy test cục bộ (vitest) và khi nào nên dùng chế độ force/coverage"
read_when:
  - Chạy hoặc sửa test
title: "Test"
x-i18n:
  source_path: reference/test.md
  source_hash: be7b751fb81c8c94
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:24Z
---

# Test

- Bộ công cụ kiểm thử đầy đủ (suites, live, Docker): [Testing](/testing)

- `pnpm test:force`: Kết thúc mọi tiến trình gateway còn tồn tại đang giữ cổng điều khiển mặc định, sau đó chạy toàn bộ bộ Vitest với một cổng gateway cô lập để các test server không va chạm với một phiên bản đang chạy. Dùng khi lần chạy gateway trước đó để lại cổng 18789 bị chiếm.
- `pnpm test:coverage`: Chạy Vitest với V8 coverage. Ngưỡng toàn cục là 70% cho lines/branches/functions/statements. Coverage loại trừ các entrypoint nặng về tích hợp (CLI wiring, gateway/telegram bridges, webchat static server) để tập trung mục tiêu vào logic có thể kiểm thử đơn vị.
- `pnpm test:e2e`: Chạy các bài smoke test end-to-end của gateway (ghép cặp WS/HTTP/node đa phiên bản).
- `pnpm test:live`: Chạy các bài test live của provider (minimax/zai). Yêu cầu API keys và `LIVE=1` (hoặc `*_LIVE_TEST=1` theo từng provider) để bỏ trạng thái skip.

## Đo độ trễ model (khóa cục bộ)

Script: [`scripts/bench-model.ts`](https://github.com/openclaw/openclaw/blob/main/scripts/bench-model.ts)

Cách dùng:

- `source ~/.profile && pnpm tsx scripts/bench-model.ts --runs 10`
- Env tùy chọn: `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `ANTHROPIC_API_KEY`
- Prompt mặc định: “Trả lời bằng một từ duy nhất: ok. Không dấu câu hay văn bản bổ sung.”

Lần chạy gần nhất (2025-12-31, 20 lần):

- minimax median 1279ms (min 1114, max 2431)
- opus median 2454ms (min 1224, max 3170)

## Onboarding E2E (Docker)

Docker là tùy chọn; chỉ cần khi chạy các smoke test onboarding trong container.

Luồng cold-start đầy đủ trong một container Linux sạch:

```bash
scripts/e2e/onboard-docker.sh
```

Script này điều khiển trình hướng dẫn tương tác thông qua pseudo-tty, xác minh các tệp config/workspace/session, sau đó khởi động gateway và chạy `openclaw health`.

## Smoke test nhập QR (Docker)

Đảm bảo `qrcode-terminal` tải được dưới Node 22+ trong Docker:

```bash
pnpm test:docker:qr
```
