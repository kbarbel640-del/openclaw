---
summary: "Tham chiếu CLI cho `openclaw update` (cập nhật mã nguồn an toàn tương đối + Gateway tự khởi động lại)"
read_when:
  - Bạn muốn cập nhật một bản checkout mã nguồn một cách an toàn
  - Bạn cần hiểu hành vi viết tắt của `--update`
title: "cap nhat"
x-i18n:
  source_path: cli/update.md
  source_hash: 3a08e8ac797612c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:40Z
---

# `openclaw update`

Cập nhật OpenClaw an toàn và chuyển đổi giữa các kênh stable/beta/dev.

Nếu bạn cài đặt qua **npm/pnpm** (cài đặt toàn cục, không có metadata git), việc cập nhật diễn ra theo luồng của trình quản lý gói trong [Updating](/install/updating).

## Usage

```bash
openclaw update
openclaw update status
openclaw update wizard
openclaw update --channel beta
openclaw update --channel dev
openclaw update --tag beta
openclaw update --no-restart
openclaw update --json
openclaw --update
```

## Options

- `--no-restart`: bỏ qua việc khởi động lại dịch vụ Gateway sau khi cập nhật thành công.
- `--channel <stable|beta|dev>`: đặt kênh cập nhật (git + npm; được lưu trong cấu hình).
- `--tag <dist-tag|version>`: ghi đè dist-tag hoặc phiên bản npm chỉ cho lần cập nhật này.
- `--json`: in JSON `UpdateRunResult` có thể đọc bằng máy.
- `--timeout <seconds>`: thời gian chờ cho từng bước (mặc định là 1200s).

Lưu ý: hạ cấp phiên bản yêu cầu xác nhận vì các phiên bản cũ có thể làm hỏng cấu hình.

## `update status`

Hiển thị kênh cập nhật đang hoạt động + git tag/branch/SHA (đối với bản checkout mã nguồn), cùng với tình trạng khả dụng của bản cập nhật.

```bash
openclaw update status
openclaw update status --json
openclaw update status --timeout 10
```

Options:

- `--json`: in JSON trạng thái có thể đọc bằng máy.
- `--timeout <seconds>`: thời gian chờ cho các bước kiểm tra (mặc định là 3s).

## `update wizard`

Luồng tương tác để chọn kênh cập nhật và xác nhận có khởi động lại Gateway
sau khi cập nhật hay không (mặc định là khởi động lại). Nếu bạn chọn `dev` mà không có bản checkout git, hệ thống sẽ đề nghị tạo một bản.

## What it does

Khi bạn chuyển kênh một cách tường minh (`--channel ...`), OpenClaw cũng giữ cho
phương thức cài đặt được đồng bộ:

- `dev` → đảm bảo có một bản checkout git (mặc định: `~/openclaw`, ghi đè bằng `OPENCLAW_GIT_DIR`),
  cập nhật nó và cài đặt CLI toàn cục từ bản checkout đó.
- `stable`/`beta` → cài đặt từ npm bằng dist-tag tương ứng.

## Git checkout flow

Channels:

- `stable`: checkout tag không phải beta mới nhất, sau đó build + doctor.
- `beta`: checkout tag `-beta` mới nhất, sau đó build + doctor.
- `dev`: checkout `main`, sau đó fetch + rebase.

High-level:

1. Yêu cầu worktree sạch (không có thay đổi chưa commit).
2. Chuyển sang kênh đã chọn (tag hoặc branch).
3. Fetch upstream (chỉ dev).
4. Chỉ dev: chạy lint tiền kiểm + build TypeScript trong một worktree tạm; nếu tip thất bại, lùi tối đa 10 commit để tìm bản build sạch mới nhất.
5. Rebase lên commit đã chọn (chỉ dev).
6. Cài đặt dependencies (ưu tiên pnpm; fallback npm).
7. Build + build Control UI.
8. Chạy `openclaw doctor` như bước kiểm tra “cập nhật an toàn” cuối cùng.
9. Đồng bộ plugin theo kênh đang hoạt động (dev dùng extension đóng gói sẵn; stable/beta dùng npm) và cập nhật các plugin cài bằng npm.

## `--update` shorthand

`openclaw --update` được viết lại thành `openclaw update` (hữu ích cho shell và script khởi chạy).

## See also

- `openclaw doctor` (đề nghị chạy update trước trên các bản checkout git)
- [Development channels](/install/development-channels)
- [Updating](/install/updating)
- [CLI reference](/cli)
