---
summary: "Đăng nhập GitHub Copilot từ OpenClaw bằng quy trình thiết bị"
read_when:
  - Bạn muốn sử dụng GitHub Copilot làm nhà cung cấp mô hình
  - Bạn cần quy trình `openclaw models auth login-github-copilot`
title: "GitHub Copilot"
x-i18n:
  source_path: providers/github-copilot.md
  source_hash: 503e0496d92c921e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:01Z
---

# GitHub Copilot

## GitHub Copilot là gì?

GitHub Copilot là trợ lý viết mã AI của GitHub. Nó cung cấp quyền truy cập vào các
mô hình Copilot cho tài khoản và gói GitHub của bạn. OpenClaw có thể sử dụng
Copilot làm nhà cung cấp mô hình theo hai cách khác nhau.

## Hai cách sử dụng Copilot trong OpenClaw

### 1) Nhà cung cấp GitHub Copilot tích hợp sẵn (`github-copilot`)

Sử dụng quy trình đăng nhập thiết bị gốc để lấy token GitHub, sau đó trao đổi
thành token API Copilot khi OpenClaw chạy. Đây là cách **mặc định** và đơn giản
nhất vì không yêu cầu VS Code.

### 2) Plugin Copilot Proxy (`copilot-proxy`)

Sử dụng tiện ích mở rộng VS Code **Copilot Proxy** như một cầu nối cục bộ.
OpenClaw giao tiếp với endpoint `/v1` của proxy và sử dụng danh sách mô
hình bạn cấu hình tại đó. Chọn cách này khi bạn đã chạy Copilot Proxy trong
VS Code hoặc cần định tuyến qua nó. Bạn phải bật plugin và giữ tiện ích mở rộng
VS Code đang chạy.

Sử dụng GitHub Copilot làm nhà cung cấp mô hình (`github-copilot`). Lệnh đăng nhập
chạy quy trình thiết bị của GitHub, lưu hồ sơ xác thực và cập nhật cấu hình của
bạn để sử dụng hồ sơ đó.

## Thiết lập CLI

```bash
openclaw models auth login-github-copilot
```

Bạn sẽ được nhắc truy cập một URL và nhập mã dùng một lần. Giữ cửa sổ terminal mở
cho đến khi hoàn tất.

### Cờ tùy chọn

```bash
openclaw models auth login-github-copilot --profile-id github-copilot:work
openclaw models auth login-github-copilot --yes
```

## Đặt mô hình mặc định

```bash
openclaw models set github-copilot/gpt-4o
```

### Đoạn cấu hình

```json5
{
  agents: { defaults: { model: { primary: "github-copilot/gpt-4o" } } },
}
```

## Ghi chú

- Yêu cầu TTY tương tác; hãy chạy trực tiếp trong terminal.
- Tính khả dụng của mô hình Copilot phụ thuộc vào gói của bạn; nếu một mô hình bị
  từ chối, hãy thử ID khác (ví dụ `github-copilot/gpt-4.1`).
- Đăng nhập sẽ lưu token GitHub trong kho hồ sơ xác thực và trao đổi thành token
  API Copilot khi OpenClaw chạy.
