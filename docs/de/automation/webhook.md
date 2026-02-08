---
summary: „Webhook-Eingang fuer Wake- und isolierte Agent-Laeufe“
read_when:
  - Hinzufuegen oder Aendern von Webhook-Endpunkten
  - Anbinden externer Systeme an OpenClaw
title: „Webhooks“
x-i18n:
  source_path: automation/webhook.md
  source_hash: f26b88864567be82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:21Z
---

# Webhooks

Das Gateway kann einen kleinen HTTP-Webhook-Endpunkt fuer externe Trigger bereitstellen.

## Aktivieren

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
  },
}
```

Hinweise:

- `hooks.token` ist erforderlich, wenn `hooks.enabled=true`.
- `hooks.path` ist standardmaessig `/hooks`.

## Authentifizierung

Jede Anfrage muss das Hook-Token enthalten. Bevorzugen Sie Header:

- `Authorization: Bearer <token>` (empfohlen)
- `x-openclaw-token: <token>`
- `?token=<token>` (veraltet; protokolliert eine Warnung und wird in einer kuenftigen Major-Version entfernt)

## Endpunkte

### `POST /hooks/wake`

Payload:

```json
{ "text": "System line", "mode": "now" }
```

- `text` **erforderlich** (string): Die Beschreibung des Ereignisses (z. B. „Neue E-Mail empfangen“).
- `mode` optional (`now` | `next-heartbeat`): Ob ein sofortiger Heartbeat ausgeloest werden soll (Standard `now`) oder bis zur naechsten periodischen Pruefung gewartet wird.

Wirkung:

- Stellt ein Systemereignis fuer die **Haupt**-Sitzung in die Warteschlange
- Wenn `mode=now`, wird ein sofortiger Heartbeat ausgeloest

### `POST /hooks/agent`

Payload:

```json
{
  "message": "Run this",
  "name": "Email",
  "sessionKey": "hook:email:msg-123",
  "wakeMode": "now",
  "deliver": true,
  "channel": "last",
  "to": "+15551234567",
  "model": "openai/gpt-5.2-mini",
  "thinking": "low",
  "timeoutSeconds": 120
}
```

- `message` **erforderlich** (string): Der Prompt oder die Nachricht, die der Agent verarbeiten soll.
- `name` optional (string): Menschenlesbarer Name fuer den Hook (z. B. „GitHub“), der als Praefix in Sitzungszusammenfassungen verwendet wird.
- `sessionKey` optional (string): Der Schluessel zur Identifizierung der Agent-Sitzung. Standardmaessig ein zufaelliger `hook:<uuid>`. Die Verwendung eines konsistenten Schluessels ermoeglicht eine mehrzuegige Konversation im Hook-Kontext.
- `wakeMode` optional (`now` | `next-heartbeat`): Ob ein sofortiger Heartbeat ausgeloest werden soll (Standard `now`) oder bis zur naechsten periodischen Pruefung gewartet wird.
- `deliver` optional (boolean): Wenn `true`, wird die Antwort des Agenten an den Messaging-Kanal gesendet. Standard ist `true`. Antworten, die nur Heartbeat-Bestaetigungen sind, werden automatisch uebersprungen.
- `channel` optional (string): Der Messaging-Kanal fuer die Zustellung. Einer von: `last`, `whatsapp`, `telegram`, `discord`, `slack`, `mattermost` (Plugin), `signal`, `imessage`, `msteams`. Standard ist `last`.
- `to` optional (string): Die Empfaengerkennung fuer den Kanal (z. B. Telefonnummer fuer WhatsApp/Signal, Chat-ID fuer Telegram, Kanal-ID fuer Discord/Slack/Mattermost (Plugin), Konversations-ID fuer MS Teams). Standard ist der letzte Empfaenger in der Hauptsitzung.
- `model` optional (string): Modell-Ueberschreibung (z. B. `anthropic/claude-3-5-sonnet` oder ein Alias). Muss in der erlaubten Modellliste enthalten sein, falls eingeschraenkt.
- `thinking` optional (string): Ueberschreibung der Denkstufe (z. B. `low`, `medium`, `high`).
- `timeoutSeconds` optional (number): Maximale Dauer fuer den Agent-Lauf in Sekunden.

Wirkung:

- Fuehrt einen **isolierten** Agent-Turn aus (eigener Sitzungsschluessel)
- Postet immer eine Zusammenfassung in die **Haupt**-Sitzung
- Wenn `wakeMode=now`, wird ein sofortiger Heartbeat ausgeloest

### `POST /hooks/<name>` (zugeordnet)

Benutzerdefinierte Hook-Namen werden ueber `hooks.mappings` aufgeloest (siehe Konfiguration). Eine Zuordnung kann
beliebige Payloads in `wake`- oder `agent`-Aktionen umwandeln, mit optionalen Templates oder
Code-Transformationen.

Zuordnungsoptionen (Uebersicht):

- `hooks.presets: ["gmail"]` aktiviert die integrierte Gmail-Zuordnung.
- `hooks.mappings` ermoeglicht es Ihnen, `match`, `action` und Templates in der Konfiguration zu definieren.
- `hooks.transformsDir` + `transform.module` laden ein JS/TS-Modul fuer benutzerdefinierte Logik.
- Verwenden Sie `match.source`, um einen generischen Ingest-Endpunkt beizubehalten (payload-gesteuertes Routing).
- TS-Transformationen erfordern einen TS-Loader (z. B. `bun` oder `tsx`) oder zur Laufzeit vorkompiliertes `.js`.
- Setzen Sie `deliver: true` + `channel`/`to` in Zuordnungen, um Antworten auf eine Chat-Oberflaeche zu routen
  (`channel` ist standardmaessig `last` und faellt auf WhatsApp zurueck).
- `allowUnsafeExternalContent: true` deaktiviert den externen Content-Safety-Wrapper fuer diesen Hook
  (gefaehrlich; nur fuer vertrauenswuerdige interne Quellen).
- `openclaw webhooks gmail setup` schreibt `hooks.gmail`-Konfiguration fuer `openclaw webhooks gmail run`.
  Siehe [Gmail Pub/Sub](/automation/gmail-pubsub) fuer den vollstaendigen Gmail-Watch-Flow.

## Antworten

- `200` fuer `/hooks/wake`
- `202` fuer `/hooks/agent` (asynchroner Lauf gestartet)
- `401` bei Authentifizierungsfehler
- `400` bei ungueltigem Payload
- `413` bei zu grossen Payloads

## Beispiele

```bash
curl -X POST http://127.0.0.1:18789/hooks/wake \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"text":"New email received","mode":"now"}'
```

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","wakeMode":"next-heartbeat"}'
```

### Ein anderes Modell verwenden

Fuegen Sie `model` zum Agent-Payload (oder zur Zuordnung) hinzu, um das Modell fuer diesen Lauf zu ueberschreiben:

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"message":"Summarize inbox","name":"Email","model":"openai/gpt-5.2-mini"}'
```

Wenn Sie `agents.defaults.models` erzwingen, stellen Sie sicher, dass das Ueberschreibungsmodell dort enthalten ist.

```bash
curl -X POST http://127.0.0.1:18789/hooks/gmail \
  -H 'Authorization: Bearer SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"source":"gmail","messages":[{"from":"Ada","subject":"Hello","snippet":"Hi"}]}'
```

## Sicherheit

- Halten Sie Hook-Endpunkte hinter Loopback, Tailnet oder einem vertrauenswuerdigen Reverse-Proxy.
- Verwenden Sie ein dediziertes Hook-Token; verwenden Sie keine Gateway-Auth-Tokens wieder.
- Vermeiden Sie es, sensible rohe Payloads in Webhook-Logs aufzunehmen.
- Hook-Payloads werden standardmaessig als nicht vertrauenswuerdig behandelt und mit Sicherheitsgrenzen umhuellt.
  Wenn Sie dies fuer einen bestimmten Hook deaktivieren muessen, setzen Sie `allowUnsafeExternalContent: true`
  in der Zuordnung dieses Hooks (gefaehrlich).
