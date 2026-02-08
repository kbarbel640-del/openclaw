---
summary: "Referencia de la CLI para `openclaw agent` (enviar un turno del agente a través del Gateway)"
read_when:
  - Quiere ejecutar un turno del agente desde scripts (opcionalmente entregar la respuesta)
title: "agente"
x-i18n:
  source_path: cli/agent.md
  source_hash: dcf12fb94e207c68
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:07Z
---

# `openclaw agent`

Ejecute un turno del agente a través del Gateway (use `--local` para integrado).
Use `--agent <id>` para dirigirse directamente a un agente configurado.

Relacionado:

- Herramienta de envio de agente: [Envio de agente](/tools/agent-send)

## Ejemplos

```bash
openclaw agent --to +15555550123 --message "status update" --deliver
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```
