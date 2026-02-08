---
summary: „Oberflaechen zur Nutzungsverfolgung und Anforderungen an Anmeldeinformationen“
read_when:
  - Sie verdrahten Oberflaechen fuer Anbieter‑Nutzung/Kontingente
  - Sie muessen das Verhalten der Nutzungsverfolgung oder Auth‑Anforderungen erklaeren
title: „Nutzungsverfolgung“
x-i18n:
  source_path: concepts/usage-tracking.md
  source_hash: 6f6ed2a70329b2a6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:12Z
---

# Nutzungsverfolgung

## Was es ist

- Ruft Anbieter‑Nutzungs‑/Kontingentdaten direkt von deren Nutzungsendpunkten ab.
- Keine geschaetzten Kosten; nur die vom Anbieter gemeldeten Zeitfenster.

## Wo es angezeigt wird

- `/status` in Chats: Emoji‑reiche Statuskarte mit Sitzungstokens + geschaetzten Kosten (nur API‑Schluessel). Die Anbieter‑Nutzung wird fuer den **aktuellen Modellanbieter** angezeigt, sofern verfuegbar.
- `/usage off|tokens|full` in Chats: Nutzungs‑Footer pro Antwort (OAuth zeigt nur Tokens).
- `/usage cost` in Chats: lokale Kostenuebersicht, aggregiert aus OpenClaw‑Sitzungsprotokollen.
- CLI: `openclaw status --usage` gibt eine vollstaendige Aufschluesselung pro Anbieter aus.
- CLI: `openclaw channels list` gibt denselben Nutzungsschnappschuss zusammen mit der Anbieter‑Konfiguration aus (verwenden Sie `--no-usage` zum Ueberspringen).
- macOS‑Menueleiste: Abschnitt „Usage“ unter „Context“ (nur wenn verfuegbar).

## Anbieter + Anmeldeinformationen

- **Anthropic (Claude)**: OAuth‑Tokens in Auth‑Profilen.
- **GitHub Copilot**: OAuth‑Tokens in Auth‑Profilen.
- **Gemini CLI**: OAuth‑Tokens in Auth‑Profilen.
- **Antigravity**: OAuth‑Tokens in Auth‑Profilen.
- **OpenAI Codex**: OAuth‑Tokens in Auth‑Profilen (accountId wird verwendet, wenn vorhanden).
- **MiniMax**: API‑Schluessel (Coding‑Plan‑Schluessel; `MINIMAX_CODE_PLAN_KEY` oder `MINIMAX_API_KEY`); verwendet das 5‑Stunden‑Coding‑Plan‑Zeitfenster.
- **z.ai**: API‑Schluessel ueber env/config/Auth‑Store.

Die Nutzung wird ausgeblendet, wenn keine passenden OAuth‑/API‑Anmeldeinformationen vorhanden sind.
