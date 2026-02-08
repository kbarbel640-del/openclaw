---
summary: „Wie Sie Tests lokal ausführen (vitest) und wann Sie die Modi force/coverage verwenden sollten“
read_when:
  - Beim Ausführen oder Beheben von Tests
title: „Tests“
x-i18n:
  source_path: reference/test.md
  source_hash: be7b751fb81c8c94
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:30Z
---

# Tests

- Vollständiges Test‑Kit (Suites, Live, Docker): [Tests](/testing)

- `pnpm test:force`: Beendet alle verbliebenen Gateway‑Prozesse, die den Standard‑Control‑Port belegen, und führt anschließend die vollständige Vitest‑Suite mit einem isolierten Gateway‑Port aus, damit Server‑Tests nicht mit einer laufenden Instanz kollidieren. Verwenden Sie dies, wenn ein vorheriger Gateway‑Lauf den Port 18789 belegt hat.
- `pnpm test:coverage`: Führt Vitest mit V8‑Coverage aus. Globale Schwellenwerte sind 70 % für Lines/Branches/Functions/Statements. Die Coverage schließt integrationslastige Entry‑Points (CLI‑Wiring, Gateway/Telegram‑Bridges, Webchat‑Static‑Server) aus, um den Fokus auf unit‑testbare Logik zu legen.
- `pnpm test:e2e`: Führt Gateway‑End‑to‑End‑Smoke‑Tests aus (Multi‑Instance‑WS/HTTP/Node‑Pairing).
- `pnpm test:live`: Führt Provider‑Live‑Tests aus (minimax/zai). Erfordert API‑Keys und `LIVE=1` (oder anbieterspezifisch `*_LIVE_TEST=1`), um das Überspringen aufzuheben.

## Model latency bench (lokale Keys)

Skript: [`scripts/bench-model.ts`](https://github.com/openclaw/openclaw/blob/main/scripts/bench-model.ts)

Verwendung:

- `source ~/.profile && pnpm tsx scripts/bench-model.ts --runs 10`
- Optionale Env: `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `ANTHROPIC_API_KEY`
- Standard‑Prompt: „Antworten Sie mit einem einzelnen Wort: ok. Keine Satzzeichen oder zusätzlichen Text.“

Letzter Lauf (2025‑12‑31, 20 Läufe):

- minimax Median 1279 ms (Min. 1114, Max. 2431)
- opus Median 2454 ms (Min. 1224, Max. 3170)

## Einfuehrung E2E (Docker)

Docker ist optional; dies wird nur für containerisierte Einfuehrungs‑Smoke‑Tests benötigt.

Vollständiger Cold‑Start‑Ablauf in einem sauberen Linux‑Container:

```bash
scripts/e2e/onboard-docker.sh
```

Dieses Skript steuert den interaktiven Assistenten über ein Pseudo‑TTY, verifiziert Konfigurations‑/Workspace‑/Sitzungsdateien, startet anschließend das Gateway und führt `openclaw health` aus.

## QR‑Import‑Smoke (Docker)

Stellt sicher, dass `qrcode-terminal` unter Node 22+ in Docker geladen wird:

```bash
pnpm test:docker:qr
```
