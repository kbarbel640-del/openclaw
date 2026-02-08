---
summary: "Gỡ cài đặt OpenClaw hoàn toàn (CLI, dịch vụ, trạng thái, workspace)"
read_when:
  - Bạn muốn gỡ OpenClaw khỏi một máy
  - Dịch vụ Gateway vẫn chạy sau khi gỡ cài đặt
title: "Gỡ cài đặt"
x-i18n:
  source_path: install/uninstall.md
  source_hash: 6673a755c5e1f90a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:35Z
---

# Gỡ cài đặt

Có hai cách:

- **Cách dễ** nếu `openclaw` vẫn còn được cài đặt.
- **Gỡ dịch vụ thủ công** nếu CLI đã bị xóa nhưng dịch vụ vẫn đang chạy.

## Cách dễ (CLI vẫn còn)

Khuyến nghị: dùng trình gỡ cài đặt tích hợp sẵn:

```bash
openclaw uninstall
```

Không tương tác (tự động hóa / npx):

```bash
openclaw uninstall --all --yes --non-interactive
npx -y openclaw uninstall --all --yes --non-interactive
```

Các bước thủ công (kết quả tương tự):

1. Dừng dịch vụ Gateway:

```bash
openclaw gateway stop
```

2. Gỡ cài đặt dịch vụ Gateway (launchd/systemd/schtasks):

```bash
openclaw gateway uninstall
```

3. Xóa trạng thái + cấu hình:

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
```

Nếu bạn đặt `OPENCLAW_CONFIG_PATH` ở vị trí tùy chỉnh bên ngoài thư mục trạng thái, hãy xóa tệp đó luôn.

4. Xóa workspace của bạn (tùy chọn, sẽ xóa các tệp agent):

```bash
rm -rf ~/.openclaw/workspace
```

5. Gỡ cài đặt CLI (chọn cách bạn đã dùng):

```bash
npm rm -g openclaw
pnpm remove -g openclaw
bun remove -g openclaw
```

6. Nếu bạn đã cài ứng dụng macOS:

```bash
rm -rf /Applications/OpenClaw.app
```

Ghi chú:

- Nếu bạn dùng profiles (`--profile` / `OPENCLAW_PROFILE`), lặp lại bước 3 cho từng thư mục trạng thái (mặc định là `~/.openclaw-<profile>`).
- Ở chế độ remote, thư mục trạng thái nằm trên **máy chủ Gateway**, vì vậy hãy chạy các bước 1–4 ở đó nữa.

## Gỡ dịch vụ thủ công (không có CLI)

Dùng cách này nếu dịch vụ Gateway vẫn chạy nhưng `openclaw` bị thiếu.

### macOS (launchd)

Nhãn mặc định là `bot.molt.gateway` (hoặc `bot.molt.<profile>`; bản legacy `com.openclaw.*` có thể vẫn tồn tại):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

Nếu bạn dùng profile, thay nhãn và tên plist bằng `bot.molt.<profile>`. Xóa mọi plist `com.openclaw.*` legacy nếu có.

### Linux (systemd user unit)

Tên unit mặc định là `openclaw-gateway.service` (hoặc `openclaw-gateway-<profile>.service`):

```bash
systemctl --user disable --now openclaw-gateway.service
rm -f ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Tên task mặc định là `OpenClaw Gateway` (hoặc `OpenClaw Gateway (<profile>)`).
Script của task nằm trong thư mục trạng thái của bạn.

```powershell
schtasks /Delete /F /TN "OpenClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclaw\gateway.cmd"
```

Nếu bạn dùng profile, hãy xóa task tương ứng và `~\.openclaw-<profile>\gateway.cmd`.

## Cài đặt thông thường vs checkout mã nguồn

### Cài đặt thông thường (install.sh / npm / pnpm / bun)

Nếu bạn dùng `https://openclaw.ai/install.sh` hoặc `install.ps1`, CLI được cài bằng `npm install -g openclaw@latest`.
Hãy gỡ bằng `npm rm -g openclaw` (hoặc `pnpm remove -g` / `bun remove -g` nếu bạn cài theo cách đó).

### Checkout mã nguồn (git clone)

Nếu bạn chạy từ một repo đã checkout (`git clone` + `openclaw ...` / `bun run openclaw ...`):

1. Gỡ dịch vụ Gateway **trước khi** xóa repo (dùng cách dễ ở trên hoặc gỡ dịch vụ thủ công).
2. Xóa thư mục repo.
3. Xóa trạng thái + workspace như hướng dẫn ở trên.
