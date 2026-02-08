---
summary: "Plan: OpenResponses-Endpunkt /v1/responses hinzufügen und Chat Completions sauber veralten lassen"
owner: "openclaw"
status: "draft"
last_updated: "2026-01-19"
title: "OpenResponses-Gateway-Plan"
x-i18n:
  source_path: experiments/plans/openresponses-gateway.md
  source_hash: 71a22c48397507d1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:21Z
---

# OpenResponses Gateway Integrationsplan

## Kontext

OpenClaw Gateway stellt derzeit einen minimalen OpenAI-kompatiblen Chat-Completions-Endpunkt unter
`/v1/chat/completions` bereit (siehe [OpenAI Chat Completions](/gateway/openai-http-api)).

Open Responses ist ein offener Inferenzstandard, der auf der OpenAI Responses API basiert. Er ist für
agentische Workflows konzipiert und verwendet itembasierte Eingaben sowie semantische Streaming-Ereignisse.
Die OpenResponses-Spezifikation definiert `/v1/responses`, nicht `/v1/chat/completions`.

## Ziele

- Hinzufügen eines `/v1/responses`-Endpunkts, der den OpenResponses-Semantiken entspricht.
- Beibehaltung von Chat Completions als Kompatibilitätsschicht, die sich leicht deaktivieren und
  später entfernen lässt.
- Standardisierung von Validierung und Parsing mit isolierten, wiederverwendbaren Schemas.

## Nicht-Ziele

- Vollständige OpenResponses-Feature-Parität im ersten Durchgang (Bilder, Dateien, gehostete Werkzeuge).
- Ersetzung der internen Agent-Ausführungslogik oder Werkzeug-Orchestrierung.
- Änderung des bestehenden `/v1/chat/completions`-Verhaltens in der ersten Phase.

## Forschungszusammenfassung

Quellen: OpenResponses OpenAPI, OpenResponses-Spezifikationsseite und der Hugging-Face-Blogbeitrag.

Wesentliche Punkte:

- `POST /v1/responses` akzeptiert `CreateResponseBody`-Felder wie `model`, `input` (String oder
  `ItemParam[]`), `instructions`, `tools`, `tool_choice`, `stream`, `max_output_tokens` und
  `max_tool_calls`.
- `ItemParam` ist eine diskriminierte Union aus:
  - `message`-Items mit Rollen `system`, `developer`, `user`, `assistant`
  - `function_call` und `function_call_output`
  - `reasoning`
  - `item_reference`
- Erfolgreiche Antworten liefern eine `ResponseResource` mit `object: "response"`, `status` und
  `output`-Items.
- Streaming verwendet semantische Ereignisse wie:
  - `response.created`, `response.in_progress`, `response.completed`, `response.failed`
  - `response.output_item.added`, `response.output_item.done`
  - `response.content_part.added`, `response.content_part.done`
  - `response.output_text.delta`, `response.output_text.done`
- Die Spezifikation erfordert:
  - `Content-Type: text/event-stream`
  - `event:` muss mit dem JSON-Feld `type` übereinstimmen
  - Terminales Ereignis muss das Literal `[DONE]` sein
- Reasoning-Items können `content`, `encrypted_content` und `summary` offenlegen.
- HF-Beispiele enthalten `OpenResponses-Version: latest` in Anfragen (optionalem Header).

## Vorgeschlagene Architektur

- Hinzufügen von `src/gateway/open-responses.schema.ts`, das ausschließlich Zod-Schemas enthält (keine Gateway-Imports).
- Hinzufügen von `src/gateway/openresponses-http.ts` (oder `open-responses-http.ts`) für `/v1/responses`.
- Beibehaltung von `src/gateway/openai-http.ts` als Legacy-Kompatibilitätsadapter.
- Hinzufügen der Konfiguration `gateway.http.endpoints.responses.enabled` (Standard `false`).
- `gateway.http.endpoints.chatCompletions.enabled` unabhängig halten; beide Endpunkte sollen
  separat umschaltbar sein.
- Beim Start eine Warnung ausgeben, wenn Chat Completions aktiviert ist, um den Legacy-Status zu signalisieren.

## Abschaltungspfad für Chat Completions

- Strikte Modulgrenzen beibehalten: keine gemeinsam genutzten Schema-Typen zwischen Responses und Chat Completions.
- Chat Completions per Konfiguration opt-in machen, sodass es ohne Codeänderungen deaktiviert werden kann.
- Dokumentation aktualisieren und Chat Completions als Legacy kennzeichnen, sobald `/v1/responses` stabil ist.
- Optionaler zukünftiger Schritt: Chat-Completions-Anfragen auf den Responses-Handler abbilden,
  um einen einfacheren Entfernungspfad zu ermöglichen.

## Phase-1-Unterstützungsumfang

- Akzeptieren von `input` als String oder `ItemParam[]` mit Nachrichtenrollen und `function_call_output`.
- System- und Developer-Nachrichten in `extraSystemPrompt` extrahieren.
- Die zuletzt eingegangene `user` oder `function_call_output` als aktuelle Nachricht für Agent-Läufe verwenden.
- Nicht unterstützte Inhaltsbestandteile (Bild/Datei) mit `invalid_request_error` ablehnen.
- Eine einzelne Assistant-Nachricht mit `output_text`-Inhalt zurückgeben.
- `usage` mit auf Null gesetzten Werten zurückgeben, bis die Token-Abrechnung angebunden ist.

## Validierungsstrategie (kein SDK)

- Zod-Schemas für den unterstützten Teil implementieren von:
  - `CreateResponseBody`
  - `ItemParam` + Unionen der Nachrichten-Inhaltsbestandteile
  - `ResponseResource`
  - Streaming-Ereignisformen, die vom Gateway verwendet werden
- Schemas in einem einzelnen, isolierten Modul halten, um Drift zu vermeiden und zukünftige Codegenerierung zu ermöglichen.

## Streaming-Implementierung (Phase 1)

- SSE-Zeilen mit sowohl `event:` als auch `data:`.
- Erforderliche Sequenz (minimal funktionsfähig):
  - `response.created`
  - `response.output_item.added`
  - `response.content_part.added`
  - `response.output_text.delta` (bei Bedarf wiederholen)
  - `response.output_text.done`
  - `response.content_part.done`
  - `response.completed`
  - `[DONE]`

## Tests und Verifikationsplan

- E2E-Abdeckung für `/v1/responses` hinzufügen:
  - Authentifizierung erforderlich
  - Form der Nicht-Streaming-Antwort
  - Reihenfolge der Streaming-Ereignisse und `[DONE]`
  - Sitzungsrouting mit Headern und `user`
- `src/gateway/openai-http.e2e.test.ts` unverändert lassen.
- Manuell: curl an `/v1/responses` mit `stream: true` ausführen und die Ereignisreihenfolge sowie das terminale
  `[DONE]` verifizieren.

## Dokumentationsaktualisierungen (Follow-up)

- Neue Dokumentationsseite für die Nutzung und Beispiele von `/v1/responses` hinzufügen.
- `/gateway/openai-http-api` mit einem Legacy-Hinweis und einem Verweis auf `/v1/responses` aktualisieren.
