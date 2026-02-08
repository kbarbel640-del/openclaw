---
summary: "Talk-Modus: kontinuierliche Sprachgespräche mit ElevenLabs TTS"
read_when:
  - Implementierung des Talk-Modus auf macOS/iOS/Android
  - Aendern von Stimme/TTS/Unterbrechungsverhalten
title: "Talk-Modus"
x-i18n:
  source_path: nodes/talk.md
  source_hash: ecbc3701c9e95029
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:53Z
---

# Talk-Modus

Der Talk-Modus ist eine kontinuierliche Sprachgesprächsschleife:

1. Auf Sprache hören
2. Transkript an das Modell senden (Hauptsitzung, chat.send)
3. Auf die Antwort warten
4. Wiedergabe über ElevenLabs (Streaming-Wiedergabe)

## Verhalten (macOS)

- **Immer eingeblendetes Overlay**, solange der Talk-Modus aktiviert ist.
- Phasenübergänge **Zuhören → Denken → Sprechen**.
- Bei einer **kurzen Pause** (Stillefenster) wird das aktuelle Transkript gesendet.
- Antworten werden **in WebChat geschrieben** (wie beim Tippen).
- **Unterbrechen bei Sprache** (standardmäßig an): Wenn der Nutzer zu sprechen beginnt, während der Assistent spricht, stoppen wir die Wiedergabe und vermerken den Zeitstempel der Unterbrechung für den nächsten Prompt.

## Sprachdirektiven in Antworten

Der Assistent kann seiner Antwort eine **einzelne JSON-Zeile** voranstellen, um die Stimme zu steuern:

```json
{ "voice": "<voice-id>", "once": true }
```

Regeln:

- Nur die erste nicht-leere Zeile.
- Unbekannte Schlüssel werden ignoriert.
- `once: true` gilt nur für die aktuelle Antwort.
- Ohne `once` wird die Stimme zum neuen Standard für den Talk-Modus.
- Die JSON-Zeile wird vor der TTS-Wiedergabe entfernt.

Unterstützte Schlüssel:

- `voice` / `voice_id` / `voiceId`
- `model` / `model_id` / `modelId`
- `speed`, `rate` (WPM), `stability`, `similarity`, `style`, `speakerBoost`
- `seed`, `normalize`, `lang`, `output_format`, `latency_tier`
- `once`

## Konfiguration (`~/.openclaw/openclaw.json`)

```json5
{
  talk: {
    voiceId: "elevenlabs_voice_id",
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
    apiKey: "elevenlabs_api_key",
    interruptOnSpeech: true,
  },
}
```

Standardwerte:

- `interruptOnSpeech`: true
- `voiceId`: faellt zurueck auf `ELEVENLABS_VOICE_ID` / `SAG_VOICE_ID` (oder die erste ElevenLabs-Stimme, wenn ein API-Schluessel verfuegbar ist)
- `modelId`: standardmaessig `eleven_v3`, wenn nicht gesetzt
- `apiKey`: faellt zurueck auf `ELEVENLABS_API_KEY` (oder das Gateway-Shell-Profil, falls verfuegbar)
- `outputFormat`: standardmaessig `pcm_44100` auf macOS/iOS und `pcm_24000` auf Android (setzen Sie `mp3_*`, um MP3-Streaming zu erzwingen)

## macOS-UI

- Umschalter in der Menueleiste: **Talk**
- Konfigurations-Tab: Gruppe **Talk-Modus** (Stimmen-ID + Unterbrechungsumschalter)
- Overlay:
  - **Zuhören**: Wolkenpulse mit Mikrofonpegel
  - **Denken**: absinkende Animation
  - **Sprechen**: abstrahlende Ringe
  - Wolke anklicken: Sprechen stoppen
  - X anklicken: Talk-Modus beenden

## Hinweise

- Erfordert Sprach- und Mikrofonberechtigungen.
- Verwendet `chat.send` gegen den Sitzungsschluessel `main`.
- TTS nutzt die ElevenLabs-Streaming-API mit `ELEVENLABS_API_KEY` und inkrementeller Wiedergabe auf macOS/iOS/Android fuer geringere Latenz.
- `stability` fuer `eleven_v3` wird auf `0.0`, `0.5` oder `1.0` validiert; andere Modelle akzeptieren `0..1`.
- `latency_tier` wird bei Setzung auf `0..4` validiert.
- Android unterstuetzt die Ausgabeformate `pcm_16000`, `pcm_22050`, `pcm_24000` und `pcm_44100` fuer latenzarmes AudioTrack-Streaming.
