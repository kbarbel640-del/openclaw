---
summary: "Hướng dẫn thiết lập cho nhà phát triển làm việc với ứng dụng OpenClaw trên macOS"
read_when:
  - Thiết lập môi trường phát triển macOS
title: "Thiết Lập Phát Triển macOS"
x-i18n:
  source_path: platforms/mac/dev-setup.md
  source_hash: 4ea67701bd58b751
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:52Z
---

# Thiết Lập Dành Cho Nhà Phát Triển macOS

Hướng dẫn này bao gồm các bước cần thiết để build và chạy ứng dụng OpenClaw trên macOS từ mã nguồn.

## Điều Kiện Tiên Quyết

Trước khi build ứng dụng, hãy đảm bảo bạn đã cài đặt các thành phần sau:

1.  **Xcode 26.2+**: Bắt buộc cho phát triển Swift.
2.  **Node.js 22+ & pnpm**: Bắt buộc cho Gateway, CLI và các script đóng gói.

## 1. Cài Đặt Phụ Thuộc

Cài đặt các phụ thuộc dùng chung cho toàn bộ dự án:

```bash
pnpm install
```

## 2. Build và Đóng Gói Ứng Dụng

Để build ứng dụng macOS và đóng gói thành `dist/OpenClaw.app`, hãy chạy:

```bash
./scripts/package-mac-app.sh
```

Nếu bạn không có chứng chỉ Apple Developer ID, script sẽ tự động sử dụng **ad-hoc signing** (`-`).

Đối với các chế độ chạy dev, cờ ký (signing flags) và xử lý sự cố Team ID, xem README của ứng dụng macOS:
https://github.com/openclaw/openclaw/blob/main/apps/macos/README.md

> **Lưu ý**: Ứng dụng ký ad-hoc có thể kích hoạt các thông báo bảo mật. Nếu ứng dụng bị crash ngay lập tức với thông báo "Abort trap 6", hãy xem mục [Troubleshooting](#troubleshooting).

## 3. Cài Đặt CLI

Ứng dụng macOS yêu cầu cài đặt CLI `openclaw` ở phạm vi toàn cục để quản lý các tác vụ nền.

**Để cài đặt (khuyến nghị):**

1.  Mở ứng dụng OpenClaw.
2.  Vào tab cài đặt **General**.
3.  Nhấn **"Install CLI"**.

Hoặc cài đặt thủ công:

```bash
npm install -g openclaw@<version>
```

## Troubleshooting

### Build Thất Bại: Không Khớp Toolchain hoặc SDK

Quá trình build ứng dụng macOS yêu cầu macOS SDK mới nhất và toolchain Swift 6.2.

**Phụ thuộc hệ thống (bắt buộc):**

- **Phiên bản macOS mới nhất có sẵn trong Software Update** (bắt buộc bởi SDK Xcode 26.2)
- **Xcode 26.2** (toolchain Swift 6.2)

**Kiểm tra:**

```bash
xcodebuild -version
xcrun swift --version
```

Nếu phiên bản không khớp, hãy cập nhật macOS/Xcode và chạy lại quá trình build.

### Ứng Dụng Bị Crash Khi Cấp Quyền

Nếu ứng dụng bị crash khi bạn cho phép truy cập **Speech Recognition** hoặc **Microphone**, nguyên nhân có thể do cache TCC bị hỏng hoặc chữ ký không khớp.

**Cách khắc phục:**

1. Đặt lại quyền TCC:
   ```bash
   tccutil reset All bot.molt.mac.debug
   ```
2. Nếu vẫn không được, hãy tạm thời thay đổi `BUNDLE_ID` trong [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) để buộc macOS tạo lại trạng thái “clean slate”.

### Gateway hiển thị "Starting..." vô thời hạn

Nếu trạng thái Gateway cứ ở "Starting...", hãy kiểm tra xem có tiến trình zombie nào đang chiếm cổng hay không:

```bash
openclaw gateway status
openclaw gateway stop

# If you’re not using a LaunchAgent (dev mode / manual runs), find the listener:
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

Nếu một lần chạy thủ công đang chiếm cổng, hãy dừng tiến trình đó (Ctrl+C). Trong trường hợp cuối cùng, hãy kill PID bạn đã tìm được ở trên.
