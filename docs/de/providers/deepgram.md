---
summary: „Deepgram-Transkription fuer eingehende Sprachnachrichten“
read_when:
  - Sie moechten Deepgram Speech-to-Text fuer Audio-Anhaenge
  - Sie benoetigen ein schnelles Deepgram-Konfigurationsbeispiel
title: „Deepgram“
x-i18n:
  source_path: providers/deepgram.md
  source_hash: 8f19e072f0867211
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:09Z
---

# Deepgram (Audio-Transkription)

Deepgram ist eine Speech-to-Text-API. In OpenClaw wird sie fuer die **Transkription eingehender Audio-/Sprachnachrichten**
ueber `tools.media.audio` verwendet.

Wenn aktiviert, laedt OpenClaw die Audiodatei zu Deepgram hoch und fuegt das Transkript
in die Antwort-Pipeline ein (`{{Transcript}}` + `[Audio]`-Block). Dies ist **kein Streaming**;
es wird der Endpunkt fuer vorab aufgezeichnete Transkription verwendet.

Website: https://deepgram.com  
Docs: https://developers.deepgram.com

## Schnellstart

1. Setzen Sie Ihren API-Schluessel:

```
DEEPGRAM_API_KEY=dg_...
```

2. Aktivieren Sie den Anbieter:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Optionen

- `model`: Deepgram-Modell-ID (Standard: `nova-3`)
- `language`: Sprachhinweis (optional)
- `tools.media.audio.providerOptions.deepgram.detect_language`: Spracherkennung aktivieren (optional)
- `tools.media.audio.providerOptions.deepgram.punctuate`: Interpunktion aktivieren (optional)
- `tools.media.audio.providerOptions.deepgram.smart_format`: Smart Formatting aktivieren (optional)

Beispiel mit Sprache:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [{ provider: "deepgram", model: "nova-3", language: "en" }],
      },
    },
  },
}
```

Beispiel mit Deepgram-Optionen:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        providerOptions: {
          deepgram: {
            detect_language: true,
            punctuate: true,
            smart_format: true,
          },
        },
        models: [{ provider: "deepgram", model: "nova-3" }],
      },
    },
  },
}
```

## Hinweise

- Die Authentifizierung folgt der standardmaessigen Anbieter-Reihenfolge; `DEEPGRAM_API_KEY` ist der einfachste Weg.
- Ueberschreiben Sie Endpunkte oder Header mit `tools.media.audio.baseUrl` und `tools.media.audio.headers`, wenn Sie einen Proxy verwenden.
- Die Ausgabe folgt denselben Audio-Regeln wie bei anderen Anbietern (Groessenbegrenzungen, Timeouts, Transkript-Injektion).
