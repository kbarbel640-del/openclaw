---
summary: "Kameraaufnahme (iOS-Knoten + macOS-App) fuer die Nutzung durch Agenten: Fotos (jpg) und kurze Videoclips (mp4)"
read_when:
  - Beim Hinzufuegen oder Aendern der Kameraaufnahme auf iOS-Knoten oder macOS
  - Beim Erweitern agentenzugaenglicher MEDIA-Tempdatei-Workflows
title: "Kameraaufnahme"
x-i18n:
  source_path: nodes/camera.md
  source_hash: b4d5f5ecbab6f705
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:54Z
---

# Kameraaufnahme (Agent)

OpenClaw unterstuetzt **Kameraaufnahme** fuer Agenten-Workflows:

- **iOS-Knoten** (ueber Gateway gekoppelt): Aufnahme eines **Fotos** (`jpg`) oder **kurzen Videoclips** (`mp4`, optional mit Audio) ueber `node.invoke`.
- **Android-Knoten** (ueber Gateway gekoppelt): Aufnahme eines **Fotos** (`jpg`) oder **kurzen Videoclips** (`mp4`, optional mit Audio) ueber `node.invoke`.
- **macOS-App** (Knoten ueber Gateway): Aufnahme eines **Fotos** (`jpg`) oder **kurzen Videoclips** (`mp4`, optional mit Audio) ueber `node.invoke`.

Der gesamte Kamerazugriff ist durch **benutzergesteuerte Einstellungen** abgesichert.

## iOS-Knoten

### Benutzereinstellung (standardmaessig an)

- iOS-Einstellungs-Tab → **Kamera** → **Kamera erlauben** (`camera.enabled`)
  - Standard: **an** (fehlender Schluessel wird als aktiviert behandelt).
  - Wenn aus: `camera.*`-Befehle geben `CAMERA_DISABLED` zurueck.

### Befehle (ueber Gateway `node.invoke`)

- `camera.list`
  - Antwort-Payload:
    - `devices`: Array von `{ id, name, position, deviceType }`

- `camera.snap`
  - Parameter:
    - `facing`: `front|back` (Standard: `front`)
    - `maxWidth`: number (optional; Standard `1600` auf dem iOS-Knoten)
    - `quality`: `0..1` (optional; Standard `0.9`)
    - `format`: aktuell `jpg`
    - `delayMs`: number (optional; Standard `0`)
    - `deviceId`: string (optional; aus `camera.list`)
  - Antwort-Payload:
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`, `height`
  - Payload-Schutz: Fotos werden neu komprimiert, um das Base64-Payload unter 5 MB zu halten.

- `camera.clip`
  - Parameter:
    - `facing`: `front|back` (Standard: `front`)
    - `durationMs`: number (Standard `3000`, begrenzt auf maximal `60000`)
    - `includeAudio`: boolean (Standard `true`)
    - `format`: aktuell `mp4`
    - `deviceId`: string (optional; aus `camera.list`)
  - Antwort-Payload:
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

### Vordergrund-Anforderung

Wie `canvas.*` erlaubt der iOS-Knoten `camera.*`-Befehle nur im **Vordergrund**. Aufrufe im Hintergrund geben `NODE_BACKGROUND_UNAVAILABLE` zurueck.

### CLI-Helfer (Tempdateien + MEDIA)

Der einfachste Weg, Anhaenge zu erhalten, ist ueber den CLI-Helfer, der decodierte Medien in eine Tempdatei schreibt und `MEDIA:<path>` ausgibt.

Beispiele:

```bash
openclaw nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
openclaw nodes camera snap --node <id> --facing front
openclaw nodes camera clip --node <id> --duration 3000
openclaw nodes camera clip --node <id> --no-audio
```

Hinweise:

- `nodes camera snap` ist standardmaessig **beide** Ausrichtungen, um dem Agenten beide Ansichten bereitzustellen.
- Ausgabedateien sind temporaer (im OS-Tempverzeichnis), sofern Sie keinen eigenen Wrapper erstellen.

## Android-Knoten

### Benutzereinstellung (standardmaessig an)

- Android-Einstellungsblatt → **Kamera** → **Kamera erlauben** (`camera.enabled`)
  - Standard: **an** (fehlender Schluessel wird als aktiviert behandelt).
  - Wenn aus: `camera.*`-Befehle geben `CAMERA_DISABLED` zurueck.

### Berechtigungen

- Android erfordert Laufzeitberechtigungen:
  - `CAMERA` fuer sowohl `camera.snap` als auch `camera.clip`.
  - `RECORD_AUDIO` fuer `camera.clip` wenn `includeAudio=true`.

Wenn Berechtigungen fehlen, fordert die App diese nach Moeglichkeit an; werden sie verweigert, schlagen `camera.*`-Anfragen mit einem
`*_PERMISSION_REQUIRED`-Fehler fehl.

### Vordergrund-Anforderung

Wie `canvas.*` erlaubt der Android-Knoten `camera.*`-Befehle nur im **Vordergrund**. Aufrufe im Hintergrund geben `NODE_BACKGROUND_UNAVAILABLE` zurueck.

### Payload-Schutz

Fotos werden neu komprimiert, um das Base64-Payload unter 5 MB zu halten.

## macOS-App

### Benutzereinstellung (standardmaessig aus)

Die macOS-Begleit-App stellt ein Kontrollkaestchen bereit:

- **Einstellungen → Allgemein → Kamera erlauben** (`openclaw.cameraEnabled`)
  - Standard: **aus**
  - Wenn aus: Kameraanfragen geben „Kamera durch Benutzer deaktiviert“ zurueck.

### CLI-Helfer (Knotenaufruf)

Verwenden Sie die zentrale `openclaw`-CLI, um Kamerabefehle auf dem macOS-Knoten aufzurufen.

Beispiele:

```bash
openclaw nodes camera list --node <id>            # list camera ids
openclaw nodes camera snap --node <id>            # prints MEDIA:<path>
openclaw nodes camera snap --node <id> --max-width 1280
openclaw nodes camera snap --node <id> --delay-ms 2000
openclaw nodes camera snap --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --duration 10s          # prints MEDIA:<path>
openclaw nodes camera clip --node <id> --duration-ms 3000      # prints MEDIA:<path> (legacy flag)
openclaw nodes camera clip --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --no-audio
```

Hinweise:

- `openclaw nodes camera snap` ist standardmaessig `maxWidth=1600`, sofern nicht ueberschrieben.
- Unter macOS wartet `camera.snap` `delayMs` (Standard 2000 ms) nach dem Aufwaermen/Einpendeln der Belichtung, bevor die Aufnahme erfolgt.
- Foto-Payloads werden neu komprimiert, um Base64 unter 5 MB zu halten.

## Sicherheit + praktische Grenzen

- Kamera- und Mikrofonzugriff loesen die ueblichen OS-Berechtigungsabfragen aus (und erfordern Usage-Strings in der Info.plist).
- Videoclips sind begrenzt (derzeit `<= 60s`), um uebergrosse Knoten-Payloads zu vermeiden (Base64-Overhead + Nachrichtenlimits).

## macOS-Bildschirmvideo (OS-Ebene)

Fuer _Bildschirm_-Video (nicht Kamera) verwenden Sie die macOS-Begleit-App:

```bash
openclaw nodes screen record --node <id> --duration 10s --fps 15   # prints MEDIA:<path>
```

Hinweise:

- Erfordert die macOS-Berechtigung **Bildschirmaufnahme** (TCC).
