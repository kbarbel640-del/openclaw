---
summary: "Tham chiếu CLI cho `openclaw skills` (list/info/check) và tính đủ điều kiện của skill"
read_when:
  - Bạn muốn xem những skill nào có sẵn và sẵn sàng chạy
  - Bạn muốn gỡ lỗi các binary/bien moi truong/cau hinh bị thiếu cho skill
title: "skills"
x-i18n:
  source_path: cli/skills.md
  source_hash: 7878442c88a27ec8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:29Z
---

# `openclaw skills`

Kiểm tra Skills (đi kèm + workspace + ghi đè được quản lý) và xem những gì đủ điều kiện so với các yêu cầu còn thiếu.

Liên quan:

- Hệ thống Skills: [Skills](/tools/skills)
- Cau hinh Skills: [Skills config](/tools/skills-config)
- Cài đặt ClawHub: [ClawHub](/tools/clawhub)

## Commands

```bash
openclaw skills list
openclaw skills list --eligible
openclaw skills info <name>
openclaw skills check
```
