---
summary: "Tham chiếu CLI cho `openclaw onboard` (trình hướng dẫn huong dan ban dau tương tác)"
read_when:
  - Bạn muốn thiết lập có hướng dẫn cho Gateway, workspace, xác thực, kênh và Skills
title: "onboard"
x-i18n:
  source_path: cli/onboard.md
  source_hash: 69a96accb2d571ff
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:33Z
---

# `openclaw onboard`

Trình hướng dẫn huong dan ban dau tương tác (thiết lập Gateway cục bộ hoặc từ xa).

## Related guides

- Trung tâm huong dan ban dau CLI: [Onboarding Wizard (CLI)](/start/wizard)
- Tham chiếu huong dan ban dau CLI: [CLI Onboarding Reference](/start/wizard-cli-reference)
- Tự động hóa CLI: [CLI Automation](/start/wizard-cli-automation)
- Huong dan ban dau macOS: [Onboarding (macOS App)](/start/onboarding)

## Examples

```bash
openclaw onboard
openclaw onboard --flow quickstart
openclaw onboard --flow manual
openclaw onboard --mode remote --remote-url ws://gateway-host:18789
```

Flow notes:

- `quickstart`: nhắc tối thiểu, tự động tạo token gateway.
- `manual`: nhắc đầy đủ cho cổng/bind/xác thực (bí danh của `advanced`).
- Cuộc trò chuyện đầu tiên nhanh nhất: `openclaw dashboard` (UI điều khiển, không cần thiết lập kênh).

## Common follow-up commands

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` không hàm ý chế độ không tương tác. Dùng `--non-interactive` cho script.
</Note>
