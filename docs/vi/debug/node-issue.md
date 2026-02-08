---
summary: Ghi chú và cách khắc phục sự cố Node + tsx "__name is not a function"
read_when:
  - Gỡ lỗi các script dev chỉ chạy bằng Node hoặc lỗi chế độ watch
  - Điều tra các sự cố crash của loader tsx/esbuild trong OpenClaw
title: "Sự cố Node + tsx"
x-i18n:
  source_path: debug/node-issue.md
  source_hash: f9e9bd2281508337
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:58Z
---

# Sự cố Node + tsx "\_\_name is not a function"

## Tóm tắt

Chạy OpenClaw qua Node với `tsx` bị lỗi ngay khi khởi động với:

```
[openclaw] Failed to start CLI: TypeError: __name is not a function
    at createSubsystemLogger (.../src/logging/subsystem.ts:203:25)
    at .../src/agents/auth-profiles/constants.ts:25:20
```

Vấn đề này bắt đầu sau khi chuyển các script dev từ Bun sang `tsx` (commit `2871657e`, 2026-01-06). Cùng đường chạy runtime đó hoạt động bình thường với Bun.

## Môi trường

- Node: v25.x (quan sát trên v25.3.0)
- tsx: 4.21.0
- OS: macOS (khả năng tái hiện cũng cao trên các nền tảng khác chạy Node 25)

## Cách tái hiện (chỉ Node)

```bash
# in repo root
node --version
pnpm install
node --import tsx src/entry.ts status
```

## Tái hiện tối thiểu trong repo

```bash
node --import tsx scripts/repro/tsx-name-repro.ts
```

## Kiểm tra phiên bản Node

- Node 25.3.0: lỗi
- Node 22.22.0 (Homebrew `node@22`): lỗi
- Node 24: chưa cài tại đây; cần xác minh

## Ghi chú / giả thuyết

- `tsx` dùng esbuild để biến đổi TS/ESM. `keepNames` của esbuild phát sinh một helper `__name` và bọc các định nghĩa hàm bằng `__name(...)`.
- Lỗi cho thấy `__name` tồn tại nhưng không phải là hàm tại runtime, hàm ý helper bị thiếu hoặc bị ghi đè cho module này trong đường loader của Node 25.
- Các vấn đề helper `__name` tương tự đã được báo cáo ở các dự án dùng esbuild khác khi helper bị thiếu hoặc bị ghi lại.

## Lịch sử hồi quy

- `2871657e` (2026-01-06): các script được chuyển từ Bun sang tsx để Bun trở thành tùy chọn.
- Trước đó (đường Bun), `openclaw status` và `gateway:watch` hoạt động.

## Cách khắc phục tạm thời

- Dùng Bun cho các script dev (hiện đang tạm thời quay lại).
- Dùng Node + tsc watch, sau đó chạy output đã biên dịch:
  ```bash
  pnpm exec tsc --watch --preserveWatchOutput
  node --watch openclaw.mjs status
  ```
- Đã xác nhận cục bộ: `pnpm exec tsc -p tsconfig.json` + `node openclaw.mjs status` hoạt động trên Node 25.
- Tắt keepNames của esbuild trong loader TS nếu có thể (tránh chèn helper `__name`); hiện tsx chưa cung cấp tùy chọn này.
- Thử Node LTS (22/24) với `tsx` để xem sự cố có chỉ riêng Node 25 hay không.

## Tài liệu tham khảo

- https://opennext.js.org/cloudflare/howtos/keep_names
- https://esbuild.github.io/api/#keep-names
- https://github.com/evanw/esbuild/issues/1031

## Bước tiếp theo

- Tái hiện trên Node 22/24 để xác nhận hồi quy của Node 25.
- Thử `tsx` nightly hoặc ghim về phiên bản sớm hơn nếu có hồi quy đã biết.
- Nếu tái hiện trên Node LTS, tạo repro tối thiểu upstream kèm theo stack trace `__name`.
