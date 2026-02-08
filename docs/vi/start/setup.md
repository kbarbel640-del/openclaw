---
summary: "Thiết lập nâng cao và quy trình làm việc cho phát triển với OpenClaw"
read_when:
  - Thiết lập một máy mới
  - Bạn muốn “mới nhất + tốt nhất” mà không làm hỏng thiết lập cá nhân
title: "Thiết lập"
x-i18n:
  source_path: start/setup.md
  source_hash: 6620daddff099dc0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:36Z
---

# Thiết lập

<Note>
Nếu bạn thiết lập lần đầu, hãy bắt đầu với [Bat Dau](/start/getting-started).
Để biết chi tiết về trình hướng dẫn, xem [Onboarding Wizard](/start/wizard).
</Note>

Cập nhật lần cuối: 2026-01-01

## TL;DR

- **Tùy biến nằm ngoài repo:** `~/.openclaw/workspace` (workspace) + `~/.openclaw/openclaw.json` (config).
- **Quy trình ổn định:** cài ứng dụng macOS; để ứng dụng chạy Gateway đi kèm.
- **Quy trình tiên phong:** tự chạy Gateway qua `pnpm gateway:watch`, sau đó để ứng dụng macOS gắn vào ở chế độ Local.

## Điều kiện tiên quyết (từ source)

- Node `>=22`
- `pnpm`
- Docker (tùy chọn; chỉ cho thiết lập container hóa/e2e — xem [Docker](/install/docker))

## Chiến lược tùy biến (để cập nhật không gây rắc rối)

Nếu bạn muốn “100% phù hợp với tôi” _và_ cập nhật dễ dàng, hãy giữ phần tùy biến trong:

- **Config:** `~/.openclaw/openclaw.json` (JSON/JSON5-ish)
- **Workspace:** `~/.openclaw/workspace` (skills, prompts, memories; hãy tạo thành repo git riêng tư)

Khởi tạo một lần:

```bash
openclaw setup
```

Từ trong repo này, dùng entry CLI cục bộ:

```bash
openclaw setup
```

Nếu bạn chưa cài bản global, hãy chạy qua `pnpm openclaw setup`.

## Chạy Gateway từ repo này

Sau `pnpm build`, bạn có thể chạy CLI đóng gói trực tiếp:

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

## Quy trình ổn định (ưu tiên ứng dụng macOS)

1. Cài đặt + khởi chạy **OpenClaw.app** (menu bar).
2. Hoàn tất checklist onboarding/quyền truy cập (các prompt TCC).
3. Đảm bảo Gateway ở chế độ **Local** và đang chạy (ứng dụng quản lý).
4. Liên kết các bề mặt (ví dụ: WhatsApp):

```bash
openclaw channels login
```

5. Kiểm tra nhanh:

```bash
openclaw health
```

Nếu onboarding không khả dụng trong bản build của bạn:

- Chạy `openclaw setup`, sau đó `openclaw channels login`, rồi khởi động Gateway thủ công (`openclaw gateway`).

## Quy trình tiên phong (Gateway trong terminal)

Mục tiêu: làm việc trên Gateway TypeScript, có hot reload, và giữ UI của ứng dụng macOS được gắn kết.

### 0) (Tùy chọn) Chạy cả ứng dụng macOS từ source

Nếu bạn cũng muốn ứng dụng macOS ở nhánh tiên phong:

```bash
./scripts/restart-mac.sh
```

### 1) Khởi động Gateway dev

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` chạy gateway ở chế độ watch và reload khi TypeScript thay đổi.

### 2) Trỏ ứng dụng macOS tới Gateway đang chạy

Trong **OpenClaw.app**:

- Connection Mode: **Local**
  Ứng dụng sẽ gắn vào gateway đang chạy trên cổng đã cấu hình.

### 3) Xác minh

- Trạng thái Gateway trong ứng dụng sẽ hiển thị **“Using existing gateway …”**
- Hoặc qua CLI:

```bash
openclaw health
```

### Những lỗi hay gặp

- **Sai cổng:** WS của Gateway mặc định là `ws://127.0.0.1:18789`; giữ ứng dụng + CLI cùng một cổng.
- **Vị trí lưu trạng thái:**
  - Thông tin xác thực: `~/.openclaw/credentials/`
  - Phiên: `~/.openclaw/agents/<agentId>/sessions/`
  - Log: `/tmp/openclaw/`

## Bản đồ lưu trữ thông tin xác thực

Dùng mục này khi debug xác thực hoặc quyết định sao lưu gì:

- **WhatsApp**: `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`
- **Telegram bot token**: config/env hoặc `channels.telegram.tokenFile`
- **Discord bot token**: config/env (chưa hỗ trợ file token)
- **Slack tokens**: config/env (`channels.slack.*`)
- **Danh sách cho phép ghép cặp**: `~/.openclaw/credentials/<channel>-allowFrom.json`
- **Hồ sơ xác thực model**: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- **Nhập OAuth cũ**: `~/.openclaw/credentials/oauth.json`
  Chi tiết thêm: [Security](/gateway/security#credential-storage-map).

## Cập nhật (không phá vỡ thiết lập)

- Giữ `~/.openclaw/workspace` và `~/.openclaw/` là “phần của bạn”; đừng đưa prompt/config cá nhân vào repo `openclaw`.
- Cập nhật source: `git pull` + `pnpm install` (khi lockfile thay đổi) + tiếp tục dùng `pnpm gateway:watch`.

## Linux (dịch vụ systemd cho người dùng)

Bản cài Linux dùng dịch vụ systemd **user**. Mặc định, systemd dừng các dịch vụ người dùng khi đăng xuất/nhàn rỗi, điều này sẽ tắt Gateway. Onboarding sẽ cố gắng bật lingering cho bạn (có thể yêu cầu sudo). Nếu vẫn tắt, hãy chạy:

```bash
sudo loginctl enable-linger $USER
```

Với máy chủ luôn bật hoặc đa người dùng, cân nhắc dùng dịch vụ **system** thay vì
dịch vụ user (không cần lingering). Xem [Gateway runbook](/gateway) để biết ghi chú về systemd.

## Tài liệu liên quan

- [Gateway runbook](/gateway) (cờ, giám sát, cổng)
- [Gateway configuration](/gateway/configuration) (schema config + ví dụ)
- [Discord](/channels/discord) và [Telegram](/channels/telegram) (reply tags + cài đặt replyToMode)
- [OpenClaw assistant setup](/start/openclaw)
- [macOS app](/platforms/macos) (vòng đời gateway)
