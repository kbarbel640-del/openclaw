---
summary: "Hỗ trợ tài khoản Zalo cá nhân qua zca-cli (đăng nhập QR), khả năng và cấu hình"
read_when:
  - Thiết lập Zalo Cá Nhân cho OpenClaw
  - Gỡ lỗi đăng nhập hoặc luồng tin nhắn Zalo Cá Nhân
title: "Zalo Cá Nhân"
x-i18n:
  source_path: channels/zalouser.md
  source_hash: 2a249728d556e5cc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:17Z
---

# Zalo Cá Nhân (không chính thức)

Trạng thái: thử nghiệm. Tích hợp này tự động hóa một **tài khoản Zalo cá nhân** qua `zca-cli`.

> **Cảnh báo:** Đây là tích hợp không chính thức và có thể dẫn đến việc tài khoản bị hạn chế/khóa. Tự chịu rủi ro khi sử dụng.

## Plugin bắt buộc

Zalo Cá Nhân được phát hành dưới dạng plugin và không đi kèm với bản cài đặt lõi.

- Cài qua CLI: `openclaw plugins install @openclaw/zalouser`
- Hoặc từ mã nguồn: `openclaw plugins install ./extensions/zalouser`
- Chi tiết: [Plugins](/plugin)

## Điều kiện tiên quyết: zca-cli

Máy Gateway phải có sẵn binary `zca` trong `PATH`.

- Kiểm tra: `zca --version`
- Nếu thiếu, cài zca-cli (xem `extensions/zalouser/README.md` hoặc tài liệu zca-cli thượng nguồn).

## Thiết lập nhanh (cho người mới)

1. Cài plugin (xem ở trên).
2. Đăng nhập (QR, trên máy Gateway):
   - `openclaw channels login --channel zalouser`
   - Quét mã QR trong terminal bằng ứng dụng Zalo trên di động.
3. Bật kênh:

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

4. Khởi động lại Gateway (hoặc hoàn tất onboarding).
5. Truy cập Tin nhắn trực tiếp mặc định theo cơ chế ghép cặp; chấp thuận mã ghép cặp khi liên hệ lần đầu.

## Nó là gì

- Dùng `zca listen` để nhận tin nhắn đến.
- Dùng `zca msg ...` để gửi phản hồi (văn bản/media/liên kết).
- Thiết kế cho các trường hợp dùng **tài khoản cá nhân** khi Zalo Bot API không khả dụng.

## Đặt tên

ID kênh là `zalouser` để làm rõ đây là tự động hóa **tài khoản người dùng Zalo cá nhân** (không chính thức). Chúng tôi giữ `zalo` cho khả năng tích hợp API Zalo chính thức trong tương lai.

## Tìm ID (danh bạ)

Dùng CLI danh bạ để khám phá người dùng/nhóm và ID của họ:

```bash
openclaw directory self --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory groups list --channel zalouser --query "work"
```

## Giới hạn

- Văn bản gửi đi được chia khối ~2000 ký tự (giới hạn của client Zalo).
- Streaming bị chặn theo mặc định.

## Kiểm soát truy cập (Tin nhắn trực tiếp)

`channels.zalouser.dmPolicy` hỗ trợ: `pairing | allowlist | open | disabled` (mặc định: `pairing`).
`channels.zalouser.allowFrom` chấp nhận ID người dùng hoặc tên. Trình hướng dẫn sẽ phân giải tên sang ID qua `zca friend find` khi có.

Phê duyệt qua:

- `openclaw pairing list zalouser`
- `openclaw pairing approve zalouser <code>`

## Truy cập nhóm (tùy chọn)

- Mặc định: `channels.zalouser.groupPolicy = "open"` (cho phép nhóm). Dùng `channels.defaults.groupPolicy` để ghi đè mặc định khi chưa đặt.
- Giới hạn theo danh sách cho phép với:
  - `channels.zalouser.groupPolicy = "allowlist"`
  - `channels.zalouser.groups` (khóa là ID nhóm hoặc tên)
- Chặn tất cả nhóm: `channels.zalouser.groupPolicy = "disabled"`.
- Trình hướng dẫn cấu hình có thể hỏi danh sách cho phép nhóm.
- Khi khởi động, OpenClaw phân giải tên nhóm/người dùng trong danh sách cho phép sang ID và ghi log ánh xạ; các mục không phân giải được sẽ giữ nguyên như đã nhập.

Ví dụ:

```json5
{
  channels: {
    zalouser: {
      groupPolicy: "allowlist",
      groups: {
        "123456789": { allow: true },
        "Work Chat": { allow: true },
      },
    },
  },
}
```

## Đa tài khoản

Tài khoản ánh xạ tới các hồ sơ zca. Ví dụ:

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      defaultAccount: "default",
      accounts: {
        work: { enabled: true, profile: "work" },
      },
    },
  },
}
```

## Xử lý sự cố

**Không tìm thấy `zca`:**

- Cài zca-cli và đảm bảo nó nằm trong `PATH` cho tiến trình Gateway.

**Đăng nhập không được lưu:**

- `openclaw channels status --probe`
- Đăng nhập lại: `openclaw channels logout --channel zalouser && openclaw channels login --channel zalouser`
