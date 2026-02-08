---
summary: „Verwenden Sie OpenAI über API-Schlüssel oder ein Codex-Abonnement in OpenClaw“
read_when:
  - Sie möchten OpenAI-Modelle in OpenClaw verwenden
  - Sie möchten die Codex-Abonnementauthentifizierung anstelle von API-Schlüsseln nutzen
title: „OpenAI“
x-i18n:
  source_path: providers/openai.md
  source_hash: 13d8fd7f1f935b0a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:12Z
---

# OpenAI

OpenAI stellt Entwickler-APIs für GPT-Modelle bereit. Codex unterstützt die **Anmeldung mit ChatGPT** für den Zugriff über ein Abonnement oder die **Anmeldung mit API-Schlüssel** für nutzungsbasierte Abrechnung. Codex Cloud erfordert die Anmeldung mit ChatGPT.

## Option A: OpenAI-API-Schlüssel (OpenAI Platform)

**Am besten geeignet für:** direkten API-Zugriff und nutzungsbasierte Abrechnung.
Beziehen Sie Ihren API-Schlüssel über das OpenAI-Dashboard.

### CLI-Einrichtung

```bash
openclaw onboard --auth-choice openai-api-key
# or non-interactive
openclaw onboard --openai-api-key "$OPENAI_API_KEY"
```

### Konfigurationsausschnitt

```json5
{
  env: { OPENAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

## Option B: OpenAI Code (Codex)-Abonnement

**Am besten geeignet für:** die Nutzung des ChatGPT/Codex-Abonnementzugriffs anstelle eines API-Schlüssels.
Codex Cloud erfordert die Anmeldung mit ChatGPT, während die Codex CLI die Anmeldung mit ChatGPT oder per API-Schlüssel unterstützt.

### CLI-Einrichtung

```bash
# Run Codex OAuth in the wizard
openclaw onboard --auth-choice openai-codex

# Or run OAuth directly
openclaw models auth login --provider openai-codex
```

### Konfigurationsausschnitt

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

## Hinweise

- Modellreferenzen verwenden immer `provider/model` (siehe [/concepts/models](/concepts/models)).
- Authentifizierungsdetails und Wiederverwendungsregeln finden Sie unter [/concepts/oauth](/concepts/oauth).
