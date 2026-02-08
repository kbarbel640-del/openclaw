---
summary: "Standortbefehl für Nodes (location.get), Berechtigungsmodi und Hintergrundverhalten"
read_when:
  - Hinzufügen von Unterstützung für Standort-Nodes oder Berechtigungs-UI
  - Entwurf von Hintergrund-Standort- und Push-Abläufen
title: "Standortbefehl"
x-i18n:
  source_path: nodes/location-command.md
  source_hash: 23124096256384d2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:51Z
---

# Standortbefehl (Nodes)

## TL;DR

- `location.get` ist ein Node-Befehl (über `node.invoke`).
- Standardmäßig deaktiviert.
- Einstellungen verwenden einen Selektor: Aus / Während der Nutzung / Immer.
- Separater Schalter: Präziser Standort.

## Warum ein Selektor (nicht nur ein Schalter)

OS-Berechtigungen sind mehrstufig. Wir können in der App einen Selektor bereitstellen, aber das OS entscheidet weiterhin über die tatsächliche Freigabe.

- iOS/macOS: Nutzer können in Systemabfragen/Einstellungen **Während der Nutzung** oder **Immer** wählen. Die App kann eine Hochstufung anfordern, das OS kann jedoch die Einstellungen verlangen.
- Android: Hintergrund-Standort ist eine separate Berechtigung; ab Android 10+ erfordert sie häufig einen Einstellungsablauf.
- Präziser Standort ist eine separate Freigabe (iOS 14+ „Präzise“, Android „fine“ vs. „coarse“).

Der Selektor in der UI steuert den von uns angeforderten Modus; die tatsächliche Freigabe liegt in den OS-Einstellungen.

## Einstellungsmodell

Pro Node-Gerät:

- `location.enabledMode`: `off | whileUsing | always`
- `location.preciseEnabled`: bool

UI-Verhalten:

- Auswahl von `whileUsing` fordert eine Vordergrundberechtigung an.
- Auswahl von `always` stellt zuerst `whileUsing` sicher und fordert dann Hintergrundzugriff an (oder leitet den Nutzer bei Bedarf zu den Einstellungen weiter).
- Wenn das OS die angeforderte Stufe verweigert, wird auf die höchste gewährte Stufe zurückgesetzt und ein Status angezeigt.

## Berechtigungszuordnung (node.permissions)

Optional. Der macOS-Node meldet `location` über die Berechtigungszuordnung; iOS/Android können dies auslassen.

## Befehl: `location.get`

Aufgerufen über `node.invoke`.

Parameter (empfohlen):

```json
{
  "timeoutMs": 10000,
  "maxAgeMs": 15000,
  "desiredAccuracy": "coarse|balanced|precise"
}
```

Antwort-Payload:

```json
{
  "lat": 48.20849,
  "lon": 16.37208,
  "accuracyMeters": 12.5,
  "altitudeMeters": 182.0,
  "speedMps": 0.0,
  "headingDeg": 270.0,
  "timestamp": "2026-01-03T12:34:56.000Z",
  "isPrecise": true,
  "source": "gps|wifi|cell|unknown"
}
```

Fehler (stabile Codes):

- `LOCATION_DISABLED`: Selektor ist aus.
- `LOCATION_PERMISSION_REQUIRED`: Berechtigung für den angeforderten Modus fehlt.
- `LOCATION_BACKGROUND_UNAVAILABLE`: App ist im Hintergrund, aber nur „Während der Nutzung“ erlaubt.
- `LOCATION_TIMEOUT`: kein Fix rechtzeitig.
- `LOCATION_UNAVAILABLE`: Systemfehler / keine Anbieter.

## Hintergrundverhalten (zukünftig)

Ziel: Das Modell kann den Standort anfordern, auch wenn der Node im Hintergrund ist, aber nur wenn:

- Der Nutzer **Immer** ausgewählt hat.
- Das OS Hintergrund-Standortzugriff gewährt.
- Die App im Hintergrund für Standort ausgeführt werden darf (iOS-Hintergrundmodus / Android-Vordergrunddienst oder spezielle Erlaubnis).

Push-ausgelöster Ablauf (zukünftig):

1. Das Gateway sendet einen Push an den Node (stiller Push oder FCM-Daten).
2. Der Node wacht kurz auf und fordert den Standort vom Gerät an.
3. Der Node leitet die Payload an das Gateway weiter.

Hinweise:

- iOS: Immer-Berechtigung + Hintergrund-Standortmodus erforderlich. Stille Pushes können gedrosselt werden; rechnen Sie mit intermittierenden Ausfällen.
- Android: Hintergrund-Standort kann einen Vordergrunddienst erfordern; andernfalls ist mit Ablehnung zu rechnen.

## Modell-/Tooling-Integration

- Tool-Oberfläche: Das `nodes`-Tool fügt die Aktion `location_get` hinzu (Node erforderlich).
- CLI: `openclaw nodes location get --node <id>`.
- Agentenrichtlinien: Nur aufrufen, wenn der Nutzer den Standort aktiviert hat und den Umfang versteht.

## UX-Text (empfohlen)

- Aus: „Standortfreigabe ist deaktiviert.“
- Während der Nutzung: „Nur wenn OpenClaw geöffnet ist.“
- Immer: „Hintergrund-Standort erlauben. Erfordert Systemberechtigung.“
- Präzise: „Präzisen GPS-Standort verwenden. Zum Teilen eines ungefähren Standorts deaktivieren.“
