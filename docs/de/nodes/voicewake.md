---
summary: "Globale Voice-Wake-Wörter (Gateway-eigen) und wie sie über Knoten hinweg synchronisiert werden"
read_when:
  - Ändern des Verhaltens oder der Standardwerte für Voice-Wake-Wörter
  - Hinzufügen neuer Knotenplattformen, die eine Synchronisierung der Wake-Wörter benötigen
title: "Voice Wake"
x-i18n:
  source_path: nodes/voicewake.md
  source_hash: eb34f52dfcdc3fc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:51Z
---

# Voice Wake (Globale Wake-Wörter)

OpenClaw behandelt **Wake-Wörter als eine einzige globale Liste**, die vom **Gateway** verwaltet wird.

- Es gibt **keine knotenspezifischen benutzerdefinierten Wake-Wörter**.
- **Jede Knoten-/App-UI kann** die Liste bearbeiten; Änderungen werden vom Gateway persistiert und an alle verteilt.
- Jedes Gerät behält weiterhin seinen eigenen **Voice Wake aktiviert/deaktiviert**-Schalter (lokale UX + Berechtigungen unterscheiden sich).

## Speicherung (Gateway-Host)

Wake-Wörter werden auf der Gateway-Maschine gespeichert unter:

- `~/.openclaw/settings/voicewake.json`

Form:

```json
{ "triggers": ["openclaw", "claude", "computer"], "updatedAtMs": 1730000000000 }
```

## Protokoll

### Methoden

- `voicewake.get` → `{ triggers: string[] }`
- `voicewake.set` mit Parametern `{ triggers: string[] }` → `{ triggers: string[] }`

Hinweise:

- Trigger werden normalisiert (getrimmt, leere Einträge verworfen). Leere Listen fallen auf Standardwerte zurück.
- Limits werden aus Sicherheitsgründen erzwungen (Obergrenzen für Anzahl/Länge).

### Ereignisse

- `voicewake.changed` Payload `{ triggers: string[] }`

Wer es erhält:

- Alle WebSocket-Clients (macOS-App, WebChat usw.)
- Alle verbundenen Knoten (iOS/Android) sowie auch beim Verbinden eines Knotens als initialer Push des „aktuellen Zustands“.

## Client-Verhalten

### macOS-App

- Verwendet die globale Liste, um `VoiceWakeRuntime`-Trigger zu steuern.
- Das Bearbeiten von „Trigger words“ in den Voice-Wake-Einstellungen ruft `voicewake.set` auf und verlässt sich anschließend auf den Broadcast, um andere Clients synchron zu halten.

### iOS-Knoten

- Verwendet die globale Liste für die `VoiceWakeManager`-Trigger-Erkennung.
- Das Bearbeiten der Wake-Wörter in den Einstellungen ruft `voicewake.set` (über das Gateway-WS) auf und hält außerdem die lokale Wake-Wort-Erkennung reaktionsfähig.

### Android-Knoten

- Stellt in den Einstellungen einen Editor für Wake-Wörter bereit.
- Ruft `voicewake.set` über das Gateway-WS auf, sodass Änderungen überall synchronisiert werden.
