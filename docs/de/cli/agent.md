---
summary: "CLI-Referenz fuer `openclaw agent` (einen Agenten-Zug ueber das Gateway senden)"
read_when:
  - Sie moechten einen Agenten-Zug aus Skripten ausfuehren (optional Antwort zustellen)
title: "Agent"
x-i18n:
  source_path: cli/agent.md
  source_hash: dcf12fb94e207c68
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:35Z
---

# `openclaw agent`

Fuehren Sie einen Agenten-Zug ueber das Gateway aus (verwenden Sie `--local` fuer eingebettete Nutzung).
Verwenden Sie `--agent <id>`, um einen konfigurierten Agenten direkt anzusprechen.

Verwandt:

- Agent-Send-Werkzeug: [Agent send](/tools/agent-send)

## Beispiele

```bash
openclaw agent --to +15555550123 --message "status update" --deliver
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```
