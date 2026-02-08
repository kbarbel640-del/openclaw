---
summary: "Tham chiếu CLI cho `openclaw plugins` (liệt kê, cài đặt, bật/tắt, doctor)"
read_when:
  - Bạn muốn cài đặt hoặc quản lý các plugin Gateway chạy trong tiến trình
  - Bạn muốn gỡ lỗi các lỗi tải plugin
title: "plugin"
x-i18n:
  source_path: cli/plugins.md
  source_hash: c6bf76b1e766b912
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:31Z
---

# `openclaw plugins`

Quản lý các plugin/tiện ích mở rộng của Gateway (được tải trong tiến trình).

Liên quan:

- Hệ thống plugin: [Plugins](/plugin)
- Manifest + schema của plugin: [Plugin manifest](/plugins/manifest)
- Tăng cường bảo mật: [Security](/gateway/security)

## Commands

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
openclaw plugins update <id>
openclaw plugins update --all
```

Các plugin đi kèm được phát hành cùng OpenClaw nhưng mặc định bị tắt. Dùng `plugins enable` để
kích hoạt chúng.

Tất cả plugin phải đi kèm một tệp `openclaw.plugin.json` với JSON Schema nội tuyến
(`configSchema`, ngay cả khi trống). Thiếu hoặc không hợp lệ manifest hay schema
sẽ ngăn plugin được tải và làm thất bại việc xác thực cấu hình.

### Install

```bash
openclaw plugins install <path-or-spec>
```

Lưu ý bảo mật: hãy coi việc cài plugin như chạy mã. Ưu tiên các phiên bản được ghim.

Các định dạng lưu trữ được hỗ trợ: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Dùng `--link` để tránh sao chép một thư mục cục bộ (thêm vào `plugins.load.paths`):

```bash
openclaw plugins install -l ./my-plugin
```

### Update

```bash
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins update <id> --dry-run
```

Cập nhật chỉ áp dụng cho các plugin được cài từ npm (được theo dõi trong `plugins.installs`).
