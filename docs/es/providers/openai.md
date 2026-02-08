---
summary: "Use OpenAI mediante claves API o suscripción Codex en OpenClaw"
read_when:
  - Quiere usar modelos de OpenAI en OpenClaw
  - Quiere autenticación con suscripción Codex en lugar de claves API
title: "OpenAI"
x-i18n:
  source_path: providers/openai.md
  source_hash: 13d8fd7f1f935b0a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:38Z
---

# OpenAI

OpenAI proporciona APIs para desarrolladores de modelos GPT. Codex admite **inicio de sesión con ChatGPT** para acceso por suscripción o **inicio de sesión con clave API** para acceso basado en uso. Codex cloud requiere inicio de sesión con ChatGPT.

## Opción A: Clave API de OpenAI (Plataforma OpenAI)

**Ideal para:** acceso directo a la API y facturación basada en uso.
Obtenga su clave API desde el panel de OpenAI.

### Configuración de la CLI

```bash
openclaw onboard --auth-choice openai-api-key
# or non-interactive
openclaw onboard --openai-api-key "$OPENAI_API_KEY"
```

### Fragmento de configuración

```json5
{
  env: { OPENAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

## Opción B: Suscripción OpenAI Code (Codex)

**Ideal para:** usar acceso por suscripción de ChatGPT/Codex en lugar de una clave API.
Codex cloud requiere inicio de sesión con ChatGPT, mientras que la CLI de Codex admite inicio de sesión con ChatGPT o con clave API.

### Configuración de la CLI

```bash
# Run Codex OAuth in the wizard
openclaw onboard --auth-choice openai-codex

# Or run OAuth directly
openclaw models auth login --provider openai-codex
```

### Fragmento de configuración

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

## Notas

- Las referencias de modelos siempre usan `provider/model` (vea [/concepts/models](/concepts/models)).
- Los detalles de autenticación y las reglas de reutilización están en [/concepts/oauth](/concepts/oauth).
