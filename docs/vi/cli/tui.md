---
summary: "Tham chiếu CLI cho `openclaw tui` (giao diện người dùng terminal kết nối với Gateway)"
read_when:
  - Bạn muốn một giao diện terminal cho Gateway (thân thiện với truy cập từ xa)
  - Bạn muốn truyền url/token/session từ script
title: "tui"
x-i18n:
  source_path: cli/tui.md
  source_hash: f0a97d92e08746a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:30Z
---

# `openclaw tui`

Mở giao diện người dùng terminal được kết nối với Gateway.

Liên quan:

- Hướng dẫn TUI: [TUI](/tui)

## Ví dụ

```bash
openclaw tui
openclaw tui --url ws://127.0.0.1:18789 --token <token>
openclaw tui --session main --deliver
```
