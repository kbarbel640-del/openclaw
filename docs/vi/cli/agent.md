---
summary: "Tham chieu CLI cho `openclaw agent` (gui mot luot tac tu qua Gateway)"
read_when:
  - Ban muon chay mot luot tac tu tu cac script (tuy chon gui phan hoi)
title: "tac tu"
x-i18n:
  source_path: cli/agent.md
  source_hash: dcf12fb94e207c68
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:19Z
---

# `openclaw agent`

Chay mot luot tac tu qua Gateway (su dung `--local` cho embedded).
Su dung `--agent <id>` de nham den mot tac tu da duoc cau hinh truc tiep.

Lien quan:

- Cong cu Agent send: [Agent send](/tools/agent-send)

## Vi du

```bash
openclaw agent --to +15555550123 --message "status update" --deliver
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```
