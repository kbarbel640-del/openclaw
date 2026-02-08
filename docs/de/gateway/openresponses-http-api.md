---
summary: „Stellen Sie über das Gateway einen OpenResponses‑kompatiblen /v1/responses‑HTTP‑Endpoint bereit“
read_when:
  - Integration von Clients, die die OpenResponses‑API sprechen
  - Sie benötigen itembasierte Eingaben, Client‑Werkzeugaufrufe oder SSE‑Events
title: „OpenResponses API“
x-i18n:
  source_path: gateway/openresponses-http-api.md
  source_hash: 0597714837f8b210
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:34Z
---

# OpenResponses API (HTTP)

Das Gateway von OpenClaw kann einen OpenResponses‑kompatiblen `POST /v1/responses`‑Endpoint bereitstellen.

Dieser Endpoint ist **standardmäßig deaktiviert**. Aktivieren Sie ihn zuerst in der Konfiguration.

- `POST /v1/responses`
- Derselbe Port wie das Gateway (WS + HTTP‑Multiplex): `http://<gateway-host>:<port>/v1/responses`

Unter der Haube werden Anfragen als normaler Gateway‑Agent‑Lauf ausgeführt (gleicher Codepfad wie
`openclaw agent`), sodass Routing/Berechtigungen/Konfiguration Ihrem Gateway entsprechen.

## Authentifizierung

Verwendet die Gateway‑Auth‑Konfiguration. Senden Sie ein Bearer‑Token:

- `Authorization: Bearer <token>`

Hinweise:

- Wenn `gateway.auth.mode="token"`, verwenden Sie `gateway.auth.token` (oder `OPENCLAW_GATEWAY_TOKEN`).
- Wenn `gateway.auth.mode="password"`, verwenden Sie `gateway.auth.password` (oder `OPENCLAW_GATEWAY_PASSWORD`).

## Auswahl eines Agenten

Keine benutzerdefinierten Header erforderlich: Kodieren Sie die Agent‑ID im OpenResponses‑Feld `model`:

- `model: "openclaw:<agentId>"` (Beispiel: `"openclaw:main"`, `"openclaw:beta"`)
- `model: "agent:<agentId>"` (Alias)

Oder adressieren Sie einen bestimmten OpenClaw‑Agenten per Header:

- `x-openclaw-agent-id: <agentId>` (Standard: `main`)

Erweitert:

- `x-openclaw-session-key: <sessionKey>`, um das Sitzungs‑Routing vollständig zu steuern.

## Aktivieren des Endpoints

Setzen Sie `gateway.http.endpoints.responses.enabled` auf `true`:

```json5
{
  gateway: {
    http: {
      endpoints: {
        responses: { enabled: true },
      },
    },
  },
}
```

## Deaktivieren des Endpoints

Setzen Sie `gateway.http.endpoints.responses.enabled` auf `false`:

```json5
{
  gateway: {
    http: {
      endpoints: {
        responses: { enabled: false },
      },
    },
  },
}
```

## Sitzungsverhalten

Standardmäßig ist der Endpoint **pro Anfrage zustandslos** (bei jedem Aufruf wird ein neuer Sitzungsschlüssel erzeugt).

Wenn die Anfrage einen OpenResponses‑String `user` enthält, leitet das Gateway daraus einen stabilen Sitzungsschlüssel ab,
sodass wiederholte Aufrufe eine Agent‑Sitzung teilen können.

## Anfrageformat (unterstützt)

Die Anfrage folgt der OpenResponses‑API mit itembasierter Eingabe. Aktueller Support:

- `input`: String oder Array von Item‑Objekten.
- `instructions`: wird in den System‑Prompt zusammengeführt.
- `tools`: Client‑Werkzeugdefinitionen (Funktions‑Tools).
- `tool_choice`: Client‑Werkzeuge filtern oder erzwingen.
- `stream`: aktiviert SSE‑Streaming.
- `max_output_tokens`: Best‑Effort‑Ausgabelimit (anbieterabhängig).
- `user`: stabiles Sitzungs‑Routing.

Akzeptiert, aber **derzeit ignoriert**:

- `max_tool_calls`
- `reasoning`
- `metadata`
- `store`
- `previous_response_id`
- `truncation`

## Items (Eingabe)

### `message`

Rollen: `system`, `developer`, `user`, `assistant`.

- `system` und `developer` werden an den System‑Prompt angehängt.
- Das aktuellste `user`‑ oder `function_call_output`‑Item wird zur „aktuellen Nachricht“.
- Frühere User/Assistant‑Nachrichten werden als Verlauf für Kontext einbezogen.

### `function_call_output` (zugbasierte Tools)

Senden Sie Tool‑Ergebnisse zurück an das Modell:

```json
{
  "type": "function_call_output",
  "call_id": "call_123",
  "output": "{\"temperature\": \"72F\"}"
}
```

### `reasoning` und `item_reference`

Aus Gründen der Schema‑Kompatibilität akzeptiert, beim Erstellen des Prompts jedoch ignoriert.

## Tools (clientseitige Funktions‑Tools)

Stellen Sie Tools mit `tools: [{ type: "function", function: { name, description?, parameters? } }]` bereit.

Wenn der Agent entscheidet, ein Tool aufzurufen, enthält die Antwort ein Ausgabeelement `function_call`.
Anschließend senden Sie eine Folgeanfrage mit `function_call_output`, um den Zug fortzusetzen.

## Bilder (`input_image`)

Unterstützt Base64‑ oder URL‑Quellen:

```json
{
  "type": "input_image",
  "source": { "type": "url", "url": "https://example.com/image.png" }
}
```

Erlaubte MIME‑Typen (aktuell): `image/jpeg`, `image/png`, `image/gif`, `image/webp`.
Maximale Größe (aktuell): 10 MB.

## Dateien (`input_file`)

Unterstützt Base64‑ oder URL‑Quellen:

```json
{
  "type": "input_file",
  "source": {
    "type": "base64",
    "media_type": "text/plain",
    "data": "SGVsbG8gV29ybGQh",
    "filename": "hello.txt"
  }
}
```

Erlaubte MIME‑Typen (aktuell): `text/plain`, `text/markdown`, `text/html`, `text/csv`,
`application/json`, `application/pdf`.

Maximale Größe (aktuell): 5 MB.

Aktuelles Verhalten:

- Dateiinhalte werden dekodiert und dem **System‑Prompt** hinzugefügt, nicht der User‑Nachricht,
  sodass sie flüchtig bleiben (nicht im Sitzungsverlauf persistiert).
- PDFs werden nach Text geparst. Wird wenig Text gefunden, werden die ersten Seiten gerastert
  und als Bilder an das Modell übergeben.

Das PDF‑Parsing verwendet den Node‑freundlichen Legacy‑Build `pdfjs-dist` (ohne Worker). Der moderne
PDF.js‑Build erwartet Browser‑Worker/DOM‑Globals und wird daher im Gateway nicht verwendet.

URL‑Abruf‑Standards:

- `files.allowUrl`: `true`
- `images.allowUrl`: `true`
- Anfragen sind abgesichert (DNS‑Auflösung, Blockierung privater IPs, Redirect‑Limits, Timeouts).

## Datei‑ und Bildlimits (Konfiguration)

Standardwerte können unter `gateway.http.endpoints.responses` angepasst werden:

```json5
{
  gateway: {
    http: {
      endpoints: {
        responses: {
          enabled: true,
          maxBodyBytes: 20000000,
          files: {
            allowUrl: true,
            allowedMimes: [
              "text/plain",
              "text/markdown",
              "text/html",
              "text/csv",
              "application/json",
              "application/pdf",
            ],
            maxBytes: 5242880,
            maxChars: 200000,
            maxRedirects: 3,
            timeoutMs: 10000,
            pdf: {
              maxPages: 4,
              maxPixels: 4000000,
              minTextChars: 200,
            },
          },
          images: {
            allowUrl: true,
            allowedMimes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
            maxBytes: 10485760,
            maxRedirects: 3,
            timeoutMs: 10000,
          },
        },
      },
    },
  },
}
```

Standardwerte, wenn nicht angegeben:

- `maxBodyBytes`: 20 MB
- `files.maxBytes`: 5 MB
- `files.maxChars`: 200 k
- `files.maxRedirects`: 3
- `files.timeoutMs`: 10 s
- `files.pdf.maxPages`: 4
- `files.pdf.maxPixels`: 4.000.000
- `files.pdf.minTextChars`: 200
- `images.maxBytes`: 10 MB
- `images.maxRedirects`: 3
- `images.timeoutMs`: 10 s

## Streaming (SSE)

Setzen Sie `stream: true`, um Server‑Sent Events (SSE) zu empfangen:

- `Content-Type: text/event-stream`
- Jede Event‑Zeile ist `event: <type>` und `data: <json>`
- Der Stream endet mit `data: [DONE]`

Derzeit ausgegebene Event‑Typen:

- `response.created`
- `response.in_progress`
- `response.output_item.added`
- `response.content_part.added`
- `response.output_text.delta`
- `response.output_text.done`
- `response.content_part.done`
- `response.output_item.done`
- `response.completed`
- `response.failed` (bei Fehlern)

## Nutzung

`usage` wird befüllt, wenn der zugrunde liegende Anbieter Token‑Zählungen meldet.

## Fehler

Fehler verwenden ein JSON‑Objekt wie:

```json
{ "error": { "message": "...", "type": "invalid_request_error" } }
```

Häufige Fälle:

- `401` fehlende/ungültige Authentifizierung
- `400` ungültiger Anfrage‑Body
- `405` falsche Methode

## Beispiele

Nicht‑Streaming:

```bash
curl -sS http://127.0.0.1:18789/v1/responses \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'x-openclaw-agent-id: main' \
  -d '{
    "model": "openclaw",
    "input": "hi"
  }'
```

Streaming:

```bash
curl -N http://127.0.0.1:18789/v1/responses \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'x-openclaw-agent-id: main' \
  -d '{
    "model": "openclaw",
    "stream": true,
    "input": "hi"
  }'
```
