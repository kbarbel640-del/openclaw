---
summary: "Cách các script cài đặt hoạt động (install.sh + install-cli.sh), các cờ và tự động hóa"
read_when:
  - Bạn muốn hiểu `openclaw.ai/install.sh`
  - Bạn muốn tự động hóa cài đặt (CI / headless)
  - Bạn muốn cài đặt từ một bản checkout GitHub
title: "Nội bộ Trình cài đặt"
x-i18n:
  source_path: install/installer.md
  source_hash: 9e0a19ecb5da0a39
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:38Z
---

# Nội bộ trình cài đặt

OpenClaw cung cấp hai script cài đặt (được phân phối từ `openclaw.ai`):

- `https://openclaw.ai/install.sh` — trình cài đặt “khuyến nghị” (mặc định cài npm toàn cục; cũng có thể cài từ một bản checkout GitHub)
- `https://openclaw.ai/install-cli.sh` — trình cài đặt CLI thân thiện với môi trường không có quyền root (cài vào một prefix với Node riêng)
- `https://openclaw.ai/install.ps1` — trình cài đặt Windows PowerShell (mặc định dùng npm; tùy chọn cài qua git)

Để xem các cờ/hành vi hiện tại, chạy:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Trợ giúp Windows (PowerShell):

```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -?
```

Nếu trình cài đặt hoàn tất nhưng `openclaw` không được tìm thấy trong một terminal mới, thường là vấn đề PATH của Node/npm. Xem: [Install](/install#nodejs--npm-path-sanity).

## install.sh (khuyến nghị)

Những gì nó làm (mức cao):

- Phát hiện hệ điều hành (macOS / Linux / WSL).
- Đảm bảo Node.js **22+** (macOS qua Homebrew; Linux qua NodeSource).
- Chọn phương thức cài đặt:
  - `npm` (mặc định): `npm install -g openclaw@latest`
  - `git`: clone/build một bản checkout mã nguồn và cài một script wrapper
- Trên Linux: tránh lỗi quyền npm toàn cục bằng cách chuyển prefix của npm sang `~/.npm-global` khi cần.
- Nếu nâng cấp bản cài đặt hiện có: chạy `openclaw doctor --non-interactive` (cố gắng hết mức).
- Với cài đặt qua git: chạy `openclaw doctor --non-interactive` sau khi cài/cập nhật (cố gắng hết mức).
- Giảm thiểu các vấn đề cài native của `sharp` bằng cách mặc định `SHARP_IGNORE_GLOBAL_LIBVIPS=1` (tránh build liên kết với libvips hệ thống).

Nếu bạn _muốn_ `sharp` liên kết với libvips cài đặt toàn cục (hoặc bạn đang gỡ lỗi), hãy đặt:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=0 curl -fsSL https://openclaw.ai/install.sh | bash
```

### Khả năng phát hiện / lời nhắc “git install”

Nếu bạn chạy trình cài đặt khi **đã ở bên trong một bản checkout mã nguồn OpenClaw** (được phát hiện qua `package.json` + `pnpm-workspace.yaml`), nó sẽ hỏi:

- cập nhật và sử dụng bản checkout này (`git`)
- hoặc chuyển sang cài đặt npm toàn cục (`npm`)

Trong ngữ cảnh không tương tác (không có TTY / `--no-prompt`), bạn phải truyền `--install-method git|npm` (hoặc đặt `OPENCLAW_INSTALL_METHOD`), nếu không script sẽ thoát với mã `2`.

### Vì sao cần Git

Git là bắt buộc cho đường dẫn `--install-method git` (clone / pull).

Với cài đặt `npm`, Git _thường_ không bắt buộc, nhưng một số môi trường vẫn cần đến (ví dụ khi một gói hoặc phụ thuộc được tải qua URL git). Trình cài đặt hiện đảm bảo Git có sẵn để tránh các bất ngờ `spawn git ENOENT` trên các distro mới.

### Vì sao npm gặp `EACCES` trên Linux mới cài

Trên một số thiết lập Linux (đặc biệt sau khi cài Node qua trình quản lý gói hệ thống hoặc NodeSource), prefix toàn cục của npm trỏ tới một vị trí do root sở hữu. Khi đó `npm install -g ...` sẽ thất bại với lỗi quyền `EACCES` / `mkdir`.

`install.sh` khắc phục điều này bằng cách chuyển prefix sang:

- `~/.npm-global` (và thêm nó vào `PATH` trong `~/.bashrc` / `~/.zshrc` khi có)

## install-cli.sh (trình cài đặt CLI không cần root)

Script này cài `openclaw` vào một prefix (mặc định: `~/.openclaw`) và cũng cài một runtime Node riêng dưới prefix đó, để có thể hoạt động trên các máy mà bạn không muốn động chạm tới Node/npm hệ thống.

Trợ giúp:

```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash -s -- --help
```

## install.ps1 (Windows PowerShell)

Những gì nó làm (mức cao):

- Đảm bảo Node.js **22+** (winget/Chocolatey/Scoop hoặc thủ công).
- Chọn phương thức cài đặt:
  - `npm` (mặc định): `npm install -g openclaw@latest`
  - `git`: clone/build một bản checkout mã nguồn và cài một script wrapper
- Chạy `openclaw doctor --non-interactive` khi nâng cấp và cài qua git (cố gắng hết mức).

Ví dụ:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git -GitDir "C:\\openclaw"
```

Biến môi trường:

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`

Yêu cầu Git:

Nếu bạn chọn `-InstallMethod git` và thiếu Git, trình cài đặt sẽ in ra
liên kết Git for Windows (`https://git-scm.com/download/win`) và thoát.

Các vấn đề thường gặp trên Windows:

- **npm error spawn git / ENOENT**: cài Git for Windows và mở lại PowerShell, sau đó chạy lại trình cài đặt.
- **"openclaw" is not recognized**: thư mục bin npm toàn cục của bạn không có trong PATH. Hầu hết hệ thống dùng
  `%AppData%\\npm`. Bạn cũng có thể chạy `npm config get prefix` và thêm `\\bin` vào PATH, rồi mở lại PowerShell.
