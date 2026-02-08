---
summary: "Plugin-Manifest + Anforderungen an das JSON-Schema (strikte Konfigurationsvalidierung)"
read_when:
  - Sie erstellen ein OpenClaw-Plugin
  - Sie muessen ein Plugin-Konfigurationsschema ausliefern oder Plugin-Validierungsfehler debuggen
title: "Plugin-Manifest"
x-i18n:
  source_path: plugins/manifest.md
  source_hash: 47b3e33c915f47bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:11Z
---

# Plugin-Manifest (openclaw.plugin.json)

Jedes Plugin **muss** eine `openclaw.plugin.json`-Datei im **Plugin-Root** mitliefern.
OpenClaw verwendet dieses Manifest, um die Konfiguration zu validieren, **ohne Plugin-Code auszufuehren**.
Fehlende oder ungueltige Manifeste werden als Plugin-Fehler behandelt und blockieren
die Konfigurationsvalidierung.

Siehe die vollstaendige Anleitung zum Plugin-System: [Plugins](/plugin).

## Erforderliche Felder

```json
{
  "id": "voice-call",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

Erforderliche Schluessel:

- `id` (string): kanonische Plugin-ID.
- `configSchema` (object): JSON-Schema fuer die Plugin-Konfiguration (inline).

Optionale Schluessel:

- `kind` (string): Plugin-Typ (Beispiel: `"memory"`).
- `channels` (array): von diesem Plugin registrierte Kanal-IDs (Beispiel: `["matrix"]`).
- `providers` (array): von diesem Plugin registrierte Anbieter-IDs.
- `skills` (array): zu ladende Skills-Verzeichnisse (relativ zum Plugin-Root).
- `name` (string): Anzeigename fuer das Plugin.
- `description` (string): kurze Plugin-Zusammenfassung.
- `uiHints` (object): Bezeichnungen/Platzhalter/Sensitivitaets-Flags fuer Konfigurationsfelder zur UI-Darstellung.
- `version` (string): Plugin-Version (informativ).

## Anforderungen an das JSON-Schema

- **Jedes Plugin muss ein JSON-Schema mitliefern**, auch wenn es keine Konfiguration akzeptiert.
- Ein leeres Schema ist zulaessig (zum Beispiel `{ "type": "object", "additionalProperties": false }`).
- Schemata werden beim Lesen/Schreiben der Konfiguration validiert, nicht zur Laufzeit.

## Validierungsverhalten

- Unbekannte `channels.*`-Schluessel sind **Fehler**, es sei denn, die Kanal-ID ist
  durch ein Plugin-Manifest deklariert.
- `plugins.entries.<id>`, `plugins.allow`, `plugins.deny` und `plugins.slots.*`
  muessen auf **auffindbare** Plugin-IDs verweisen. Unbekannte IDs sind **Fehler**.
- Wenn ein Plugin installiert ist, aber ein defektes oder fehlendes Manifest oder Schema hat,
  schlaegt die Validierung fehl und Doctor meldet den Plugin-Fehler.
- Wenn eine Plugin-Konfiguration existiert, das Plugin jedoch **deaktiviert** ist, bleibt
  die Konfiguration erhalten und in Doctor + Logs wird eine **Warnung** angezeigt.

## Hinweise

- Das Manifest ist **fuer alle Plugins erforderlich**, einschliesslich lokaler Ladevorgaenge aus dem Dateisystem.
- Zur Laufzeit wird das Plugin-Modul weiterhin separat geladen; das Manifest dient nur der
  Erkennung + Validierung.
- Wenn Ihr Plugin von nativen Modulen abhaengt, dokumentieren Sie die Build-Schritte und alle
  Anforderungen an Allowlists von Paketmanagern (zum Beispiel pnpm `allow-build-scripts`
  - `pnpm rebuild <package>`).
