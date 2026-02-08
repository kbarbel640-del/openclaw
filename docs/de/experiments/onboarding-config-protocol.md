---
summary: "RPC-Protokollnotizen fuer den Einfuehrungsassistenten und das Konfigurationsschema"
read_when: "Aendern der Schritte des Einfuehrungsassistenten oder der Endpunkte des Konfigurationsschemas"
title: "Einfuehrung und Konfigurationsprotokoll"
x-i18n:
  source_path: experiments/onboarding-config-protocol.md
  source_hash: 55163b3ee029c024
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:15Z
---

# Einfuehrung + Konfigurationsprotokoll

Zweck: gemeinsame Einfuehrungs- und Konfigurationsoberflaechen ueber CLI, macOS-App und Web-UI hinweg.

## Komponenten

- Assistenten-Engine (gemeinsame Sitzung + Prompts + Einfuehrungsstatus).
- Die CLI-Einfuehrung verwendet denselben Assistentenablauf wie die UI-Clients.
- Gateway RPC stellt Endpunkte fuer Assistent und Konfigurationsschema bereit.
- Die macOS-Einfuehrung verwendet das Assistenten-Schrittmodell.
- Die Web-UI rendert Konfigurationsformulare aus JSON Schema + UI-Hinweisen.

## Gateway RPC

- `wizard.start` Parameter: `{ mode?: "local"|"remote", workspace?: string }`
- `wizard.next` Parameter: `{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel` Parameter: `{ sessionId }`
- `wizard.status` Parameter: `{ sessionId }`
- `config.schema` Parameter: `{}`

Antworten (Form)

- Assistent: `{ sessionId, done, step?, status?, error? }`
- Konfigurationsschema: `{ schema, uiHints, version, generatedAt }`

## UI-Hinweise

- `uiHints` nach Pfad indiziert; optionale Metadaten (Label/Hilfe/Gruppe/Reihenfolge/Erweitert/Sensitiv/Platzhalter).
- Sensitive Felder werden als Passwort-Eingaben gerendert; keine Redaktionsschicht.
- Nicht unterstuetzte Schema-Knoten fallen auf den rohen JSON-Editor zurueck.

## Hinweise

- Dieses Dokument ist der einzige Ort, um Protokoll-Refactorings fuer Einfuehrung/Konfiguration zu verfolgen.
