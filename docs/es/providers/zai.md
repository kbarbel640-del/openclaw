---
summary: "Use Z.AI (modelos GLM) con OpenClaw"
read_when:
  - Quiere modelos Z.AI / GLM en OpenClaw
  - Necesita una configuracion simple de ZAI_API_KEY
title: "Z.AI"
x-i18n:
  source_path: providers/zai.md
  source_hash: 2c24bbad86cf86c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:43Z
---

# Z.AI

Z.AI es la plataforma de API para los modelos **GLM**. Proporciona APIs REST para GLM y utiliza claves de API
para la autenticacion. Cree su clave de API en la consola de Z.AI. OpenClaw utiliza el proveedor `zai`
con una clave de API de Z.AI.

## Configuracion del CLI

```bash
openclaw onboard --auth-choice zai-api-key
# or non-interactive
openclaw onboard --zai-api-key "$ZAI_API_KEY"
```

## Fragmento de configuracion

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Notas

- Los modelos GLM estan disponibles como `zai/<model>` (ejemplo: `zai/glm-4.7`).
- Consulte [/providers/glm](/providers/glm) para el resumen de la familia de modelos.
- Z.AI utiliza autenticacion Bearer con su clave de API.
