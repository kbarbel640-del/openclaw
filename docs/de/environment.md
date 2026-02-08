---
summary: „Wo OpenClaw Umgebungsvariablen lädt und die Reihenfolge der Priorität“
read_when:
  - Sie müssen wissen, welche Umgebungsvariablen geladen werden und in welcher Reihenfolge
  - Sie debuggen fehlende API-Schlüssel im Gateway
  - Sie dokumentieren Anbieter-Authentifizierung oder Bereitstellungsumgebungen
title: „Umgebungsvariablen“
x-i18n:
  source_path: environment.md
  source_hash: b49ae50e5d306612
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:13Z
---

# Umgebungsvariablen

OpenClaw bezieht Umgebungsvariablen aus mehreren Quellen. Die Regel lautet: **Vorhandene Werte niemals überschreiben**.

## Priorität (höchste → niedrigste)

1. **Prozessumgebung** (was der Gateway-Prozess bereits aus der übergeordneten Shell/dem Daemon hat).
2. **`.env` im aktuellen Arbeitsverzeichnis** (dotenv-Standard; überschreibt nicht).
3. **Globales `.env`** unter `~/.openclaw/.env` (auch bekannt als `$OPENCLAW_STATE_DIR/.env`; überschreibt nicht).
4. **Config-`env`-Block** in `~/.openclaw/openclaw.json` (wird nur angewendet, wenn fehlend).
5. **Optionaler Login-Shell-Import** (`env.shellEnv.enabled` oder `OPENCLAW_LOAD_SHELL_ENV=1`), wird nur für fehlende erwartete Schlüssel angewendet.

Wenn die Konfigurationsdatei vollständig fehlt, wird Schritt 4 übersprungen; der Shell-Import wird weiterhin ausgeführt, sofern aktiviert.

## Config-`env`-Block

Zwei gleichwertige Wege, um Inline-Umgebungsvariablen zu setzen (beide überschreiben nicht):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

## Shell-Env-Import

`env.shellEnv` führt Ihre Login-Shell aus und importiert nur **fehlende** erwartete Schlüssel:

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Äquivalente Umgebungsvariablen:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

## Umgebungsvariablen-Ersetzung in der Konfiguration

Sie können Umgebungsvariablen direkt in Konfigurations-Stringwerten mit der Syntax `${VAR_NAME}` referenzieren:

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
}
```

Siehe [Konfiguration: Umgebungsvariablen-Ersetzung](/gateway/configuration#env-var-substitution-in-config) fuer alle Details.

## Verwandt

- [Gateway-Konfiguration](/gateway/configuration)
- [FAQ: Umgebungsvariablen und .env-Laden](/help/faq#env-vars-and-env-loading)
- [Modellübersicht](/concepts/models)
