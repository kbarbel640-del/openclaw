---
summary: "Các bước ký cho bản debug macOS được tạo bởi các script đóng gói"
read_when:
  - Khi build hoặc ký các bản debug mac cho macOS
title: "Ký macOS"
x-i18n:
  source_path: platforms/mac/signing.md
  source_hash: 403b92f9a0ecdb7c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:56Z
---

# ký mac (bản debug)

Ứng dụng này thường được build từ [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh), script này hiện:

- đặt một bundle identifier debug ổn định: `ai.openclaw.mac.debug`
- ghi Info.plist với bundle id đó (có thể ghi đè qua `BUNDLE_ID=...`)
- gọi [`scripts/codesign-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/codesign-mac-app.sh) để ký binary chính và app bundle, để macOS xem mỗi lần rebuild là cùng một bundle đã ký và giữ lại quyền TCC (thông báo, trợ năng, ghi màn hình, mic, giọng nói). Để quyền ổn định, hãy dùng danh tính ký thật; ký ad-hoc là tùy chọn và kém ổn định (xem [macOS permissions](/platforms/mac/permissions)).
- dùng `CODESIGN_TIMESTAMP=auto` theo mặc định; nó bật trusted timestamps cho chữ ký Developer ID. Đặt `CODESIGN_TIMESTAMP=off` để bỏ timestamp (bản debug offline).
- chèn metadata build vào Info.plist: `OpenClawBuildTimestamp` (UTC) và `OpenClawGitCommit` (hash ngắn) để bảng About có thể hiển thị build, git, và kênh debug/release.
- **Đóng gói yêu cầu Node 22+**: script chạy các bản build TS và build Control UI.
- đọc `SIGN_IDENTITY` từ môi trường. Thêm `export SIGN_IDENTITY="Apple Development: Your Name (TEAMID)"` (hoặc chứng chỉ Developer ID Application của bạn) vào shell rc để luôn ký bằng chứng chỉ của bạn. Ký ad-hoc cần chủ động bật qua `ALLOW_ADHOC_SIGNING=1` hoặc `SIGN_IDENTITY="-"` (không khuyến nghị cho việc kiểm thử quyền).
- chạy kiểm tra Team ID sau khi ký và sẽ thất bại nếu bất kỳ Mach-O nào bên trong app bundle được ký bởi Team ID khác. Đặt `SKIP_TEAM_ID_CHECK=1` để bỏ qua.

## Usage

```bash
# from repo root
scripts/package-mac-app.sh               # auto-selects identity; errors if none found
SIGN_IDENTITY="Developer ID Application: Your Name" scripts/package-mac-app.sh   # real cert
ALLOW_ADHOC_SIGNING=1 scripts/package-mac-app.sh    # ad-hoc (permissions will not stick)
SIGN_IDENTITY="-" scripts/package-mac-app.sh        # explicit ad-hoc (same caveat)
DISABLE_LIBRARY_VALIDATION=1 scripts/package-mac-app.sh   # dev-only Sparkle Team ID mismatch workaround
```

### Ghi chú về ký ad-hoc

Khi ký bằng `SIGN_IDENTITY="-"` (ad-hoc), script sẽ tự động tắt **Hardened Runtime** (`--options runtime`). Điều này cần thiết để tránh crash khi ứng dụng cố tải các framework nhúng (như Sparkle) không cùng Team ID. Chữ ký ad-hoc cũng làm mất khả năng giữ quyền TCC; xem [macOS permissions](/platforms/mac/permissions) để biết các bước khôi phục.

## Metadata build cho About

`package-mac-app.sh` đóng dấu bundle với:

- `OpenClawBuildTimestamp`: ISO8601 UTC tại thời điểm đóng gói
- `OpenClawGitCommit`: hash git ngắn (hoặc `unknown` nếu không có)

Tab About đọc các key này để hiển thị phiên bản, ngày build, commit git, và liệu đây có phải là bản debug hay không (qua `#if DEBUG`). Chạy lại packager để làm mới các giá trị này sau khi thay đổi mã.

## Vì sao

Quyền TCC gắn với bundle identifier _và_ chữ ký mã. Các bản debug không ký với UUID thay đổi đã khiến macOS quên các quyền sau mỗi lần rebuild. Việc ký các binary (ad-hoc theo mặc định) và giữ cố định bundle id/đường dẫn (`dist/OpenClaw.app`) giúp giữ quyền giữa các lần build, tương tự cách làm của VibeTunnel.
