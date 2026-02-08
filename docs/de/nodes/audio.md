---
summary: „Wie eingehende Audio-/Sprachnotizen heruntergeladen, transkribiert und in Antworten eingefügt werden“
read_when:
  - Ändern der Audio-Transkription oder Medienverarbeitung
title: „Audio- und Sprachnotizen“
x-i18n:
  source_path: nodes/audio.md
  source_hash: b926c47989ab0d1e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:48Z
---

# Audio / Sprachnotizen — 2026-01-17

## Was funktioniert

- **Medienverständnis (Audio)**: Wenn Audioverständnis aktiviert ist (oder automatisch erkannt wird), führt OpenClaw Folgendes aus:
  1. Lokalisiert den ersten Audio‑Anhang (lokaler Pfad oder URL) und lädt ihn bei Bedarf herunter.
  2. Erzwingt `maxBytes`, bevor an jeden Modelleinsatz gesendet wird.
  3. Führt den ersten geeigneten Modelleinsatz der Reihe nach aus (Anbieter oder CLI).
  4. Wenn er fehlschlägt oder überspringt (Größe/Zeitüberschreitung), wird der nächste Eintrag versucht.
  5. Bei Erfolg ersetzt es `Body` durch einen `[Audio]`‑Block und setzt `{{Transcript}}`.
- **Befehlsparsing**: Wenn die Transkription erfolgreich ist, werden `CommandBody`/`RawBody` auf das Transkript gesetzt, sodass Slash‑Befehle weiterhin funktionieren.
- **Ausführliches Logging**: In `--verbose` protokollieren wir, wann die Transkription läuft und wann sie den Textkörper ersetzt.

## Automatische Erkennung (Standard)

Wenn Sie **keine Modelle konfigurieren** und `tools.media.audio.enabled` **nicht** auf `false` gesetzt ist,
erkennt OpenClaw automatisch in dieser Reihenfolge und stoppt bei der ersten funktionierenden Option:

1. **Lokale CLIs** (falls installiert)
   - `sherpa-onnx-offline` (erfordert `SHERPA_ONNX_MODEL_DIR` mit Encoder/Decoder/Joiner/Tokens)
   - `whisper-cli` (aus `whisper-cpp`; verwendet `WHISPER_CPP_MODEL` oder das mitgelieferte Tiny‑Modell)
   - `whisper` (Python‑CLI; lädt Modelle automatisch herunter)
2. **Gemini CLI** (`gemini`) unter Verwendung von `read_many_files`
3. **Anbieter‑Schlüssel** (OpenAI → Groq → Deepgram → Google)

Um die automatische Erkennung zu deaktivieren, setzen Sie `tools.media.audio.enabled: false`.
Zur Anpassung setzen Sie `tools.media.audio.models`.
Hinweis: Die Binärerkennung ist Best‑Effort über macOS/Linux/Windows hinweg; stellen Sie sicher, dass die CLI auf `PATH` liegt (wir erweitern `~`), oder setzen Sie ein explizites CLI‑Modell mit vollständigem Befehls‑Pfad.

## Konfigurationsbeispiele

### Anbieter + CLI‑Fallback (OpenAI + Whisper CLI)

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
            timeoutSeconds: 45,
          },
        ],
      },
    },
  },
}
```

### Nur Anbieter mit Scope‑Gating

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        scope: {
          default: "allow",
          rules: [{ action: "deny", match: { chatType: "group" } }],
        },
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    },
  },
}
```

### Nur Anbieter (Deepgram)

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

## Hinweise & Limits

- Die Anbieter‑Authentifizierung folgt der Standardreihenfolge der Modell‑Authentifizierung (Auth‑Profile, Umgebungsvariablen, `models.providers.*.apiKey`).
- Deepgram übernimmt `DEEPGRAM_API_KEY`, wenn `provider: "deepgram"` verwendet wird.
- Details zur Deepgram‑Einrichtung: [Deepgram (Audio‑Transkription)](/providers/deepgram).
- Audio‑Anbieter können `baseUrl`, `headers` und `providerOptions` über `tools.media.audio` überschreiben.
- Das Standard‑Größenlimit beträgt 20 MB (`tools.media.audio.maxBytes`). Übergroßes Audio wird für dieses Modell übersprungen und der nächste Eintrag wird versucht.
- Der Standard‑`maxChars` für Audio ist **nicht gesetzt** (vollständiges Transkript). Setzen Sie `tools.media.audio.maxChars` oder pro Eintrag `maxChars`, um die Ausgabe zu kürzen.
- Der OpenAI‑Standard ist `gpt-4o-mini-transcribe`; setzen Sie `model: "gpt-4o-transcribe"` für höhere Genauigkeit.
- Verwenden Sie `tools.media.audio.attachments`, um mehrere Sprachnotizen zu verarbeiten (`mode: "all"` + `maxAttachments`).
- Das Transkript steht Vorlagen als `{{Transcript}}` zur Verfügung.
- CLI‑stdout ist begrenzt (5 MB); halten Sie die CLI‑Ausgabe knapp.

## Fallstricke

- Scope‑Regeln verwenden „first‑match wins“. `chatType` wird auf `direct`, `group` oder `room` normalisiert.
- Stellen Sie sicher, dass Ihre CLI mit Exit‑Code 0 endet und reinen Text ausgibt; JSON muss über `jq -r .text` aufbereitet werden.
- Halten Sie Zeitüberschreitungen vernünftig (`timeoutSeconds`, Standard 60 s), um das Blockieren der Antwort‑Warteschlange zu vermeiden.
