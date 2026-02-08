---
summary: "Tham chiếu CLI cho `openclaw config` (lấy/đặt/gỡ các giá trị cấu hình)"
read_when:
  - Bạn muốn đọc hoặc chỉnh sửa cấu hình theo cách không tương tác
title: "cấu hình"
x-i18n:
  source_path: cli/config.md
  source_hash: d60a35f5330f22bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:22Z
---

# `openclaw config`

Các trợ giúp cấu hình: lấy/đặt/gỡ giá trị theo đường dẫn. Chạy không kèm lệnh con để mở trình hướng dẫn cấu hình (giống `openclaw configure`).

## Ví dụ

```bash
openclaw config get browser.executablePath
openclaw config set browser.executablePath "/usr/bin/google-chrome"
openclaw config set agents.defaults.heartbeat.every "2h"
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
openclaw config unset tools.web.search.apiKey
```

## Đường dẫn

Đường dẫn dùng ký pháp dấu chấm hoặc ngoặc:

```bash
openclaw config get agents.defaults.workspace
openclaw config get agents.list[0].id
```

Dùng chỉ số trong danh sách tác tử để nhắm tới một tác tử cụ thể:

```bash
openclaw config get agents.list
openclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Giá trị

Giá trị được phân tích cú pháp theo JSON5 khi có thể; nếu không, chúng sẽ được xử lý như chuỗi.
Dùng `--json` để bắt buộc phân tích JSON5.

```bash
openclaw config set agents.defaults.heartbeat.every "0m"
openclaw config set gateway.port 19001 --json
openclaw config set channels.whatsapp.groups '["*"]' --json
```

Khởi động lại Gateway sau khi chỉnh sửa.
