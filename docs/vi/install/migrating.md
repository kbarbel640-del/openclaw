---
summary: "Di chuyển (migrate) một bản cài đặt OpenClaw từ máy này sang máy khác"
read_when:
  - Bạn đang chuyển OpenClaw sang laptop/server mới
  - Bạn muốn giữ nguyên phiên, xác thực và đăng nhập kênh (WhatsApp, v.v.)
title: "Hướng dẫn Migration"
x-i18n:
  source_path: install/migrating.md
  source_hash: 604d862c4bf86e79
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:40Z
---

# Migration OpenClaw sang máy mới

Hướng dẫn này migrate một OpenClaw Gateway từ máy này sang máy khác **mà không cần làm lại onboarding**.

Về mặt khái niệm, việc migration khá đơn giản:

- Sao chép **thư mục state** (`$OPENCLAW_STATE_DIR`, mặc định: `~/.openclaw/`) — bao gồm cấu hình, xác thực, phiên và trạng thái kênh.
- Sao chép **workspace** của bạn (`~/.openclaw/workspace/` theo mặc định) — bao gồm các tệp agent (bộ nhớ, prompt, v.v.).

Tuy nhiên có những “bẫy” thường gặp liên quan đến **profile**, **quyền**, và **sao chép không đầy đủ**.

## Trước khi bắt đầu (bạn đang migrate những gì)

### 1) Xác định thư mục state của bạn

Hầu hết các bản cài đặt dùng mặc định:

- **State dir:** `~/.openclaw/`

Nhưng có thể khác nếu bạn dùng:

- `--profile <name>` (thường trở thành `~/.openclaw-<profile>/`)
- `OPENCLAW_STATE_DIR=/some/path`

Nếu không chắc, hãy chạy trên máy **cũ**:

```bash
openclaw status
```

Tìm các dòng nhắc đến `OPENCLAW_STATE_DIR` / profile trong output. Nếu bạn chạy nhiều gateway, lặp lại cho từng profile.

### 2) Xác định workspace của bạn

Các mặc định phổ biến:

- `~/.openclaw/workspace/` (workspace được khuyến nghị)
- một thư mục tùy chỉnh bạn tự tạo

Workspace là nơi chứa các tệp như `MEMORY.md`, `USER.md` và `memory/*.md`.

### 3) Hiểu những gì sẽ được giữ lại

Nếu bạn sao chép **cả** state dir và workspace, bạn sẽ giữ được:

- Cấu hình Gateway (`openclaw.json`)
- Profile xác thực / khóa API / token OAuth
- Lịch sử phiên + trạng thái agent
- Trạng thái kênh (ví dụ đăng nhập/phiên WhatsApp)
- Các tệp workspace của bạn (bộ nhớ, ghi chú Skills, v.v.)

Nếu bạn **chỉ** sao chép workspace (ví dụ qua Git), bạn **không** giữ được:

- phiên
- thông tin xác thực
- đăng nhập kênh

Những thứ này nằm dưới `$OPENCLAW_STATE_DIR`.

## Các bước migration (khuyến nghị)

### Bước 0 — Sao lưu (máy cũ)

Trên máy **cũ**, dừng gateway trước để tránh tệp thay đổi trong lúc sao chép:

```bash
openclaw gateway stop
```

(Tùy chọn nhưng khuyến nghị) nén lưu trữ state dir và workspace:

```bash
# Adjust paths if you use a profile or custom locations
cd ~
tar -czf openclaw-state.tgz .openclaw

tar -czf openclaw-workspace.tgz .openclaw/workspace
```

Nếu bạn có nhiều profile/state dir (ví dụ `~/.openclaw-main`, `~/.openclaw-work`), hãy nén từng cái.

### Bước 1 — Cài OpenClaw trên máy mới

Trên máy **mới**, cài CLI (và Node nếu cần):

- Xem: [Install](/install)

Ở giai đoạn này, việc onboarding tạo ra một `~/.openclaw/` mới là bình thường — bạn sẽ ghi đè nó ở bước tiếp theo.

### Bước 2 — Sao chép state dir + workspace sang máy mới

Sao chép **cả hai**:

- `$OPENCLAW_STATE_DIR` (mặc định `~/.openclaw/`)
- workspace của bạn (mặc định `~/.openclaw/workspace/`)

Các cách phổ biến:

- `scp` các tarball và giải nén
- `rsync -a` qua SSH
- ổ đĩa ngoài

Sau khi sao chép, đảm bảo:

- Đã bao gồm các thư mục ẩn (ví dụ `.openclaw/`)
- Quyền sở hữu tệp đúng với user chạy gateway

### Bước 3 — Chạy Doctor (migration + sửa dịch vụ)

Trên máy **mới**:

```bash
openclaw doctor
```

Doctor là lệnh “an toàn và nhàm chán”. Nó sửa dịch vụ, áp dụng migration cấu hình và cảnh báo các điểm không khớp.

Sau đó:

```bash
openclaw gateway restart
openclaw status
```

## Các “bẫy” thường gặp (và cách tránh)

### Bẫy: lệch profile / state-dir

Nếu gateway cũ chạy với một profile (hoặc `OPENCLAW_STATE_DIR`), còn gateway mới dùng profile khác, bạn sẽ thấy các dấu hiệu như:

- thay đổi cấu hình không có hiệu lực
- kênh bị thiếu / bị đăng xuất
- lịch sử phiên trống

Cách sửa: chạy gateway/dịch vụ với **cùng** profile/state dir mà bạn đã migrate, rồi chạy lại:

```bash
openclaw doctor
```

### Bẫy: chỉ sao chép `openclaw.json`

`openclaw.json` là không đủ. Nhiều provider lưu trạng thái dưới:

- `$OPENCLAW_STATE_DIR/credentials/`
- `$OPENCLAW_STATE_DIR/agents/<agentId>/...`

Luôn migrate toàn bộ thư mục `$OPENCLAW_STATE_DIR`.

### Bẫy: quyền / sở hữu

Nếu bạn sao chép bằng root hoặc đổi user, gateway có thể không đọc được thông tin xác thực/phiên.

Cách sửa: đảm bảo state dir + workspace thuộc quyền sở hữu của user chạy gateway.

### Bẫy: migrate giữa chế độ remote/local

- Nếu UI (WebUI/TUI) của bạn trỏ tới một gateway **remote**, thì host remote đó sở hữu kho phiên + workspace.
- Migrate laptop của bạn sẽ không di chuyển trạng thái của gateway remote.

Nếu bạn đang ở chế độ remote, hãy migrate **máy host gateway**.

### Bẫy: bí mật trong bản sao lưu

`$OPENCLAW_STATE_DIR` chứa các bí mật (khóa API, token OAuth, thông tin WhatsApp). Hãy coi bản sao lưu như bí mật sản xuất:

- lưu trữ có mã hóa
- tránh chia sẻ qua kênh không an toàn
- xoay vòng khóa nếu nghi ngờ bị lộ

## Danh sách kiểm tra xác minh

Trên máy mới, xác nhận:

- `openclaw status` cho thấy gateway đang chạy
- Các kênh của bạn vẫn kết nối (ví dụ WhatsApp không cần ghép lại)
- Dashboard mở được và hiển thị các phiên hiện có
- Các tệp workspace (bộ nhớ, cấu hình) đều có mặt

## Liên quan

- [Doctor](/gateway/doctor)
- [Gateway troubleshooting](/gateway/troubleshooting)
- [OpenClaw lưu dữ liệu ở đâu?](/help/faq#where-does-openclaw-store-its-data)
