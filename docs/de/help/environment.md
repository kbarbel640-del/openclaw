---
summary: "Wo OpenClaw Umgebungsvariablen lädt und in welcher Reihenfolge sie priorisiert werden"
read_when:
  - Sie muessen wissen, welche Umgebungsvariablen geladen werden und in welcher Reihenfolge
  - Sie debuggen fehlende API-Schluessel im Gateway
  - Sie dokumentieren Anbieter-Authentifizierung oder Bereitstellungsumgebungen
title: "Umgebungsvariablen"
x-i18n:
  source_path: help/environment.md
  source_hash: b49ae50e5d306612
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:49Z
---

# Umgebungsvariablen

OpenClaw bezieht Umgebungsvariablen aus mehreren Quellen. Die Regel lautet: **Vorhandene Werte niemals ueberschreiben**.

## Prioritaet (hoechste → niedrigste)

1. **Prozessumgebung** (was der Gateway-Prozess bereits von der uebergeordneten Shell/ dem Daemon hat).
2. **`.env` im aktuellen Arbeitsverzeichnis** (dotenv-Standard; ueberschreibt nicht).
3. **Globales `.env` unter `~/.openclaw/.env`** (auch bekannt als `$OPENCLAW_STATE_DIR/.env`; ueberschreibt nicht).
4. **Konfigurationsblock `env`** in `~/.openclaw/openclaw.json` (wird nur angewendet, wenn Werte fehlen).
5. **Optionale Importfunktion der Login-Shell** (`env.shellEnv.enabled` oder `OPENCLAW_LOAD_SHELL_ENV=1`), angewendet nur fuer fehlende erwartete Schluessel.

Wenn die Konfigurationsdatei vollstaendig fehlt, wird Schritt 4 uebersprungen; der Shell-Import laeuft weiterhin, sofern aktiviert.

## Konfigurationsblock `env`

Zwei gleichwertige Moeglichkeiten, Inline-Umgebungsvariablen zu setzen (beide ueberschreiben nicht):

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

## Shell-Umgebungsimport

`env.shellEnv` fuehrt Ihre Login-Shell aus und importiert nur **fehlende** erwartete Schluessel:

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

Entsprechende Umgebungsvariablen:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

## Umgebungsvariablenersetzung in der Konfiguration

Sie koennen Umgebungsvariablen direkt in Konfigurations-Stringwerten referenzieren, indem Sie die Syntax `${VAR_NAME}` verwenden:

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

Siehe [Konfiguration: Umgebungsvariablenersetzung](/gateway/configuration#env-var-substitution-in-config) fuer alle Details.

## Verwandtes

- [Gateway-Konfiguration](/gateway/configuration)
- [FAQ: Umgebungsvariablen und .env-Laden](/help/faq#env-vars-and-env-loading)
- [Modelluebersicht](/concepts/models)
