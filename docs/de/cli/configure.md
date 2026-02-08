---
summary: "CLI-Referenz fuer `openclaw configure` (interaktive Konfigurationsabfragen)"
read_when:
  - Sie moechten Anmeldeinformationen, Geraete oder Agent-Standards interaktiv anpassen
title: "konfigurieren"
x-i18n:
  source_path: cli/configure.md
  source_hash: 9cb2bb5237b02b3a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:37Z
---

# `openclaw configure`

Interaktive Abfrage zum Einrichten von Anmeldeinformationen, Geraeten und Agent-Standards.

Hinweis: Der Abschnitt **Model** enthaelt jetzt eine Mehrfachauswahl fuer die
`agents.defaults.models`-Allowlist (was in `/model` und im Modell-Auswaehler angezeigt wird).

Tipp: `openclaw config` ohne Unterbefehl oeffnet denselben Assistenten. Verwenden Sie
`openclaw config get|set|unset` fuer nicht-interaktive Aenderungen.

Verwandt:

- Gateway-Konfigurationsreferenz: [Configuration](/gateway/configuration)
- Config CLI: [Config](/cli/config)

Hinweise:

- Die Auswahl, wo das Gateway ausgefuehrt wird, aktualisiert immer `gateway.mode`. Sie koennen „Continue“ waehlen, ohne weitere Abschnitte zu bearbeiten, wenn dies alles ist, was Sie benoetigen.
- Kanalorientierte Dienste (Slack/Discord/Matrix/Microsoft Teams) fragen waehrend der Einrichtung nach Kanal-/Raum-Allowlists. Sie koennen Namen oder IDs eingeben; der Assistent loest Namen, wenn moeglich, in IDs auf.

## Beispiele

```bash
openclaw configure
openclaw configure --section models --section channels
```
