---
summary: „Nostr-DM-Kanal über NIP-04-verschlüsselte Nachrichten“
read_when:
  - Sie möchten, dass OpenClaw Direktnachrichten über Nostr empfängt
  - Sie richten dezentrale Nachrichtenübermittlung ein
title: "Nostr"
x-i18n:
  source_path: channels/nostr.md
  source_hash: 6b9fe4c74bf5e7c0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:31Z
---

# Nostr

**Status:** Optionales Plugin (standardmäßig deaktiviert).

Nostr ist ein dezentrales Protokoll für soziale Netzwerke. Dieser Kanal ermöglicht es OpenClaw, verschlüsselte Direktnachrichten (DMs) über NIP-04 zu empfangen und zu beantworten.

## Installation (bei Bedarf)

### Einführung (empfohlen)

- Der Einführungsassistent (`openclaw onboard`) und `openclaw channels add` listen optionale Kanal-Plugins auf.
- Die Auswahl von Nostr fordert Sie auf, das Plugin bei Bedarf zu installieren.

Standardinstallationen:

- **Dev-Kanal + git checkout verfügbar:** verwendet den lokalen Plugin-Pfad.
- **Stable/Beta:** lädt von npm herunter.

Sie können die Auswahl jederzeit in der Eingabeaufforderung überschreiben.

### Manuelle Installation

```bash
openclaw plugins install @openclaw/nostr
```

Lokales Checkout verwenden (Dev-Workflows):

```bash
openclaw plugins install --link <path-to-openclaw>/extensions/nostr
```

Starten Sie das Gateway nach der Installation oder Aktivierung von Plugins neu.

## Schnellstart

1. Nostr-Schlüsselpaar erzeugen (falls erforderlich):

```bash
# Using nak
nak key generate
```

2. Zur Konfiguration hinzufügen:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}"
    }
  }
}
```

3. Den Schlüssel exportieren:

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4. Gateway neu starten.

## Konfigurationsreferenz

| Schlüssel    | Typ      | Standard                                    | Beschreibung                                  |
| ------------ | -------- | ------------------------------------------- | --------------------------------------------- |
| `privateKey` | string   | erforderlich                                | Privater Schlüssel im `nsec`- oder Hex-Format |
| `relays`     | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | Relay-URLs (WebSocket)                        |
| `dmPolicy`   | string   | `pairing`                                   | DM-Zugriffsrichtlinie                         |
| `allowFrom`  | string[] | `[]`                                        | Zulässige Absender-Pubkeys                    |
| `enabled`    | boolean  | `true`                                      | Kanal aktivieren/deaktivieren                 |
| `name`       | string   | -                                           | Anzeigename                                   |
| `profile`    | object   | -                                           | NIP-01-Profilmetadaten                        |

## Profilmetadaten

Profildaten werden als NIP-01-`kind:0`-Ereignis veröffentlicht. Sie können diese über die Control UI (Kanäle -> Nostr -> Profil) verwalten oder direkt in der Konfiguration festlegen.

Beispiel:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "profile": {
        "name": "openclaw",
        "displayName": "OpenClaw",
        "about": "Personal assistant DM bot",
        "picture": "https://example.com/avatar.png",
        "banner": "https://example.com/banner.png",
        "website": "https://example.com",
        "nip05": "openclaw@example.com",
        "lud16": "openclaw@example.com"
      }
    }
  }
}
```

Hinweise:

- Profil-URLs müssen `https://` verwenden.
- Der Import von Relays führt Felder zusammen und bewahrt lokale Überschreibungen.

## Zugriffskontrolle

### DM-Richtlinien

- **pairing** (Standard): Unbekannte Absender erhalten einen Pairing-Code.
- **allowlist**: Nur Pubkeys in `allowFrom` dürfen DMs senden.
- **open**: Öffentliche eingehende DMs (erfordert `allowFrom: ["*"]`).
- **disabled**: Eingehende DMs ignorieren.

### Allowlist-Beispiel

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": ["npub1abc...", "npub1xyz..."]
    }
  }
}
```

## Schlüsselformate

Akzeptierte Formate:

- **Privater Schlüssel:** `nsec...` oder 64-stelliges Hex
- **Pubkeys (`allowFrom`):** `npub...` oder Hex

## Relays

Standards: `relay.damus.io` und `nos.lol`.

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nostr.wine"]
    }
  }
}
```

Tipps:

- Verwenden Sie 2–3 Relays für Redundanz.
- Vermeiden Sie zu viele Relays (Latenz, Duplikate).
- Bezahlte Relays können die Zuverlässigkeit verbessern.
- Lokale Relays sind zum Testen geeignet (`ws://localhost:7777`).

## Protokollunterstützung

| NIP    | Status      | Beschreibung                                   |
| ------ | ----------- | ---------------------------------------------- |
| NIP-01 | Unterstützt | Grundlegendes Ereignisformat + Profilmetadaten |
| NIP-04 | Unterstützt | Verschlüsselte DMs (`kind:4`)                  |
| NIP-17 | Geplant     | Geschenkverpackte DMs                          |
| NIP-44 | Geplant     | Versionierte Verschlüsselung                   |

## Tests

### Lokales Relay

```bash
# Start strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["ws://localhost:7777"]
    }
  }
}
```

### Manueller Test

1. Notieren Sie den Bot-Pubkey (npub) aus den Logs.
2. Öffnen Sie einen Nostr-Client (Damus, Amethyst usw.).
3. Senden Sie eine DM an den Bot-Pubkey.
4. Überprüfen Sie die Antwort.

## Fehlerbehebung

### Nachrichten werden nicht empfangen

- Überprüfen Sie, ob der private Schlüssel gültig ist.
- Stellen Sie sicher, dass die Relay-URLs erreichbar sind und `wss://` verwenden (oder `ws://` für lokal).
- Bestätigen Sie, dass `enabled` nicht `false` ist.
- Prüfen Sie die Gateway-Logs auf Relay-Verbindungsfehler.

### Antworten werden nicht gesendet

- Prüfen Sie, ob das Relay Schreibvorgänge akzeptiert.
- Überprüfen Sie die ausgehende Konnektivität.
- Achten Sie auf Relay-Ratenlimits.

### Doppelte Antworten

- Erwartet bei Verwendung mehrerer Relays.
- Nachrichten werden nach Ereignis-ID dedupliziert; nur die erste Zustellung löst eine Antwort aus.

## Sicherheit

- Private Schlüssel niemals committen.
- Verwenden Sie Umgebungsvariablen für Schlüssel.
- Erwägen Sie `allowlist` für Produktions-Bots.

## Einschränkungen (MVP)

- Nur Direktnachrichten (keine Gruppenchats).
- Keine Medienanhänge.
- Nur NIP-04 (NIP-17 Gift-Wrap geplant).
