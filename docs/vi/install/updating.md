---
summary: "Cập nhật OpenClaw an toàn (cài đặt toàn cục hoặc từ nguồn), kèm chiến lược quay lui"
read_when:
  - Cập nhật OpenClaw
  - Có sự cố sau khi cập nhật
title: "Cập nhật"
x-i18n:
  source_path: install/updating.md
  source_hash: 38cccac0839f0f22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:43Z
---

# Cập nhật

OpenClaw phát triển rất nhanh (trước “1.0”). Hãy coi việc cập nhật như vận hành hạ tầng: cập nhật → chạy kiểm tra → khởi động lại (hoặc dùng `openclaw update`, lệnh này sẽ khởi động lại) → xác minh.

## Khuyến nghị: chạy lại trình cài đặt từ website (nâng cấp tại chỗ)

Cách cập nhật **được ưu tiên** là chạy lại trình cài đặt từ website. Trình này
phát hiện các bản cài đặt hiện có, nâng cấp tại chỗ và chạy `openclaw doctor` khi cần.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Ghi chú:

- Thêm `--no-onboard` nếu bạn không muốn trình hướng dẫn onboarding chạy lại.
- Với **cài đặt từ nguồn**, dùng:
  ```bash
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
  ```
  Trình cài đặt sẽ `git pull --rebase` **chỉ khi** repo sạch.
- Với **cài đặt toàn cục**, script dùng `npm install -g openclaw@latest` ở phía dưới.
- Ghi chú di sản: `clawdbot` vẫn khả dụng như một lớp tương thích.

## Trước khi cập nhật

- Biết bạn đã cài theo cách nào: **toàn cục** (npm/pnpm) hay **từ nguồn** (git clone).
- Biết Gateway của bạn đang chạy thế nào: **terminal nền trước** hay **dịch vụ được giám sát** (launchd/systemd).
- Chụp nhanh các tuỳ biến của bạn:
  - Cấu hình: `~/.openclaw/openclaw.json`
  - Thông tin xác thực: `~/.openclaw/credentials/`
  - Workspace: `~/.openclaw/workspace`

## Cập nhật (cài đặt toàn cục)

Cài đặt toàn cục (chọn một):

```bash
npm i -g openclaw@latest
```

```bash
pnpm add -g openclaw@latest
```

Chúng tôi **không** khuyến nghị dùng Bun cho runtime Gateway (lỗi WhatsApp/Telegram).

Để chuyển kênh cập nhật (cài bằng git + npm):

```bash
openclaw update --channel beta
openclaw update --channel dev
openclaw update --channel stable
```

Dùng `--tag <dist-tag|version>` cho một lần cài theo tag/phiên bản cụ thể.

Xem [Development channels](/install/development-channels) để hiểu ngữ nghĩa kênh và ghi chú phát hành.

Lưu ý: với cài đặt npm, gateway ghi gợi ý cập nhật khi khởi động (kiểm tra tag kênh hiện tại). Tắt bằng `update.checkOnStart: false`.

Sau đó:

```bash
openclaw doctor
openclaw gateway restart
openclaw health
```

Ghi chú:

- Nếu Gateway chạy như một dịch vụ, `openclaw gateway restart` được ưu tiên hơn việc kill PID.
- Nếu bạn đang ghim ở một phiên bản cụ thể, xem “Rollback / pinning” bên dưới.

## Cập nhật (`openclaw update`)

Với **cài đặt từ nguồn** (git checkout), ưu tiên:

```bash
openclaw update
```

Lệnh này chạy một luồng cập nhật tương đối an toàn:

- Yêu cầu worktree sạch.
- Chuyển sang kênh đã chọn (tag hoặc branch).
- Fetch + rebase theo upstream đã cấu hình (kênh dev).
- Cài deps, build, build Control UI và chạy `openclaw doctor`.
- Mặc định khởi động lại gateway (dùng `--no-restart` để bỏ qua).

Nếu bạn cài qua **npm/pnpm** (không có metadata git), `openclaw update` sẽ thử cập nhật qua trình quản lý gói. Nếu không phát hiện được kiểu cài đặt, hãy dùng “Cập nhật (cài đặt toàn cục)”.

## Cập nhật (Control UI / RPC)

Control UI có **Update & Restart** (RPC: `update.run`). Nó:

1. Chạy cùng luồng cập nhật nguồn như `openclaw update` (chỉ với git checkout).
2. Ghi một sentinel khởi động lại kèm báo cáo có cấu trúc (đuôi stdout/stderr).
3. Khởi động lại gateway và ping phiên hoạt động gần nhất kèm báo cáo.

Nếu rebase thất bại, gateway hủy cập nhật và khởi động lại mà không áp dụng thay đổi.

## Cập nhật (từ nguồn)

Từ repo checkout:

Ưu tiên:

```bash
openclaw update
```

Thủ công (tương đương):

```bash
git pull
pnpm install
pnpm build
pnpm ui:build # auto-installs UI deps on first run
openclaw doctor
openclaw health
```

Ghi chú:

- `pnpm build` quan trọng khi bạn chạy binary `openclaw` đã đóng gói ([`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs)) hoặc dùng Node để chạy `dist/`.
- Nếu bạn chạy từ repo checkout mà không có cài đặt toàn cục, dùng `pnpm openclaw ...` cho các lệnh CLI.
- Nếu bạn chạy trực tiếp từ TypeScript (`pnpm openclaw ...`), thường không cần rebuild, nhưng **vẫn áp dụng migration cấu hình** → chạy doctor.
- Chuyển đổi giữa cài đặt toàn cục và git rất dễ: cài kiểu còn lại, rồi chạy `openclaw doctor` để entrypoint dịch vụ gateway được ghi lại theo bản cài hiện tại.

## Luôn chạy: `openclaw doctor`

Doctor là lệnh “cập nhật an toàn”. Nó cố ý đơn giản: sửa chữa + migrate + cảnh báo.

Lưu ý: nếu bạn dùng **cài đặt từ nguồn** (git checkout), `openclaw doctor` sẽ đề nghị chạy `openclaw update` trước.

Những việc điển hình nó làm:

- Migrate các khoá cấu hình đã bị loại bỏ / vị trí file cấu hình di sản.
- Kiểm tra chính sách DM và cảnh báo các thiết lập “open” rủi ro.
- Kiểm tra tình trạng Gateway và có thể đề nghị khởi động lại.
- Phát hiện và migrate các dịch vụ gateway cũ (launchd/systemd; schtasks di sản) sang dịch vụ OpenClaw hiện tại.
- Trên Linux, đảm bảo systemd user lingering (để Gateway sống sót sau khi đăng xuất).

Chi tiết: [Doctor](/gateway/doctor)

## Khởi động / dừng / khởi động lại Gateway

CLI (hoạt động trên mọi OS):

```bash
openclaw gateway status
openclaw gateway stop
openclaw gateway restart
openclaw gateway --port 18789
openclaw logs --follow
```

Nếu bạn dùng giám sát:

- macOS launchd (LaunchAgent đóng gói trong app): `launchctl kickstart -k gui/$UID/bot.molt.gateway` (dùng `bot.molt.<profile>`; bản di sản `com.openclaw.*` vẫn dùng được)
- Linux systemd user service: `systemctl --user restart openclaw-gateway[-<profile>].service`
- Windows (WSL2): `systemctl --user restart openclaw-gateway[-<profile>].service`
  - `launchctl`/`systemctl` chỉ hoạt động nếu dịch vụ đã được cài; nếu không hãy chạy `openclaw gateway install`.

Runbook + nhãn dịch vụ chính xác: [Gateway runbook](/gateway)

## Rollback / pinning (khi có sự cố)

### Pin (cài đặt toàn cục)

Cài một phiên bản đã biết là ổn (thay `<version>` bằng phiên bản hoạt động lần cuối):

```bash
npm i -g openclaw@<version>
```

```bash
pnpm add -g openclaw@<version>
```

Mẹo: để xem phiên bản đang được phát hành, chạy `npm view openclaw version`.

Sau đó khởi động lại + chạy lại doctor:

```bash
openclaw doctor
openclaw gateway restart
```

### Pin (từ nguồn) theo ngày

Chọn một commit theo ngày (ví dụ: “trạng thái của main tính đến 2026-01-01”):

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
```

Sau đó cài lại deps + khởi động lại:

```bash
pnpm install
pnpm build
openclaw gateway restart
```

Nếu muốn quay lại bản mới nhất sau này:

```bash
git checkout main
git pull
```

## Nếu bạn bị kẹt

- Chạy lại `openclaw doctor` và đọc kỹ đầu ra (thường nó chỉ ra cách khắc phục).
- Xem: [Xử lý sự cố](/gateway/troubleshooting)
- Hỏi trên Discord: https://discord.gg/clawd
