---
summary: "Parsing eingehender Kanalstandorte (Telegram + WhatsApp) und Kontextfelder"
read_when:
  - Hinzufuegen oder Aendern der Kanal-Standortverarbeitung
  - Verwendung von Standort-Kontextfeldern in Agent-Prompts oder Werkzeugen
title: "Parsing von Kanalstandorten"
x-i18n:
  source_path: channels/location.md
  source_hash: 5602ef105c3da7e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:25Z
---

# Parsing von Kanalstandorten

OpenClaw normalisiert geteilte Standorte aus Chat-Kanaelen zu:

- menschenlesbarem Text, der an den eingehenden Text angehaengt wird, und
- strukturierten Feldern in der Kontext-Nutzlast der automatischen Antwort.

Derzeit unterstuetzt:

- **Telegram** (Standort-Pins + Orte + Live-Standorte)
- **WhatsApp** (locationMessage + liveLocationMessage)
- **Matrix** (`m.location` mit `geo_uri`)

## Textformatierung

Standorte werden als freundliche Zeilen ohne Klammern dargestellt:

- Pin:
  - `📍 48.858844, 2.294351 ±12m`
- Benannter Ort:
  - `📍 Eiffel Tower — Champ de Mars, Paris (48.858844, 2.294351 ±12m)`
- Live-Freigabe:
  - `🛰 Live location: 48.858844, 2.294351 ±12m`

Wenn der Kanal eine Beschriftung/einen Kommentar enthaelt, wird dieser in der naechsten Zeile angehaengt:

```
📍 48.858844, 2.294351 ±12m
Meet here
```

## Kontextfelder

Wenn ein Standort vorhanden ist, werden diese Felder zu `ctx` hinzugefuegt:

- `LocationLat` (Zahl)
- `LocationLon` (Zahl)
- `LocationAccuracy` (Zahl, Meter; optional)
- `LocationName` (Zeichenkette; optional)
- `LocationAddress` (Zeichenkette; optional)
- `LocationSource` (`pin | place | live`)
- `LocationIsLive` (Boolesch)

## Kanalhinweise

- **Telegram**: Orte werden auf `LocationName/LocationAddress` abgebildet; Live-Standorte verwenden `live_period`.
- **WhatsApp**: `locationMessage.comment` und `liveLocationMessage.caption` werden als Beschriftungszeile angehaengt.
- **Matrix**: `geo_uri` wird als Pin-Standort geparst; die Hoehe wird ignoriert und `LocationIsLive` ist immer false.
