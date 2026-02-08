---
summary: "Plugin Zalo Personal: đăng nhập QR + nhắn tin qua zca-cli (cài plugin + cấu hình kênh + CLI + công cụ)"
read_when:
  - Bạn muốn hỗ trợ Zalo Personal (không chính thức) trong OpenClaw
  - Bạn đang cấu hình hoặc phát triển plugin zalouser
title: "Plugin Zalo Personal"
x-i18n:
  source_path: plugins/zalouser.md
  source_hash: b29b788b023cd507
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:59Z
---

# Zalo Personal (plugin)

Hỗ trợ Zalo Personal cho OpenClaw thông qua một plugin, sử dụng `zca-cli` để tự động hóa một tài khoản người dùng Zalo thông thường.

> **Cảnh báo:** Tự động hóa không chính thức có thể dẫn đến việc tài khoản bị tạm khóa/cấm. Sử dụng với rủi ro của riêng bạn.

## Đặt tên

Channel id là `zalouser` để làm rõ rằng đây là tự động hóa **tài khoản người dùng Zalo cá nhân** (không chính thức). Chúng tôi giữ `zalo` cho khả năng tích hợp API Zalo chính thức trong tương lai.

## Nơi chạy

Plugin này chạy **bên trong tiến trình Gateway**.

Nếu bạn dùng Gateway từ xa, hãy cài đặt/cấu hình trên **máy chạy Gateway**, sau đó khởi động lại Gateway.

## Cài đặt

### Tùy chọn A: cài từ npm

```bash
openclaw plugins install @openclaw/zalouser
```

Sau đó khởi động lại Gateway.

### Tùy chọn B: cài từ thư mục cục bộ (dev)

```bash
openclaw plugins install ./extensions/zalouser
cd ./extensions/zalouser && pnpm install
```

Sau đó khởi động lại Gateway.

## Điều kiện tiên quyết: zca-cli

Máy chạy Gateway phải có `zca` trên `PATH`:

```bash
zca --version
```

## Cấu hình

Cấu hình kênh nằm dưới `channels.zalouser` (không phải `plugins.entries.*`):

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

## CLI

```bash
openclaw channels login --channel zalouser
openclaw channels logout --channel zalouser
openclaw channels status --probe
openclaw message send --channel zalouser --target <threadId> --message "Hello from OpenClaw"
openclaw directory peers list --channel zalouser --query "name"
```

## Công cụ agent

Tên công cụ: `zalouser`

Hành động: `send`, `image`, `link`, `friends`, `groups`, `me`, `status`
