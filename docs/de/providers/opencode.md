---
summary: "Verwenden Sie OpenCode Zen (kuratierte Modelle) mit OpenClaw"
read_when:
  - Sie moechten OpenCode Zen fuer den Modellzugriff verwenden
  - Sie moechten eine kuratierte Liste codingfreundlicher Modelle
title: "OpenCode Zen"
x-i18n:
  source_path: providers/opencode.md
  source_hash: b3b5c640ac32f317
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:14Z
---

# OpenCode Zen

OpenCode Zen ist eine **kuratierte Liste von Modellen**, die vom OpenCode-Team fuer Coding-Agents empfohlen werden.
Es ist ein optionaler, gehosteter Modellzugriff, der einen API-Schluessel verwendet und den Anbieter `opencode` nutzt.
Zen befindet sich derzeit in der Beta-Phase.

## CLI-Einrichtung

```bash
openclaw onboard --auth-choice opencode-zen
# or non-interactive
openclaw onboard --opencode-zen-api-key "$OPENCODE_API_KEY"
```

## Konfigurationsausschnitt

```json5
{
  env: { OPENCODE_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

## Hinweise

- `OPENCODE_ZEN_API_KEY` wird ebenfalls unterstuetzt.
- Sie melden sich bei Zen an, fuegen Abrechnungsdetails hinzu und kopieren Ihren API-Schluessel.
- OpenCode Zen rechnet pro Anfrage ab; pruefen Sie das OpenCode-Dashboard fuer Details.
