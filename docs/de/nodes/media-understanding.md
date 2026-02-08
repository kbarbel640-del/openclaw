---
summary: "Eingehendes Bild-/Audio-/Video‑Verständnis (optional) mit Anbieter‑ und CLI‑Fallbacks"
read_when:
  - Entwurf oder Refactoring des Medienverständnisses
  - Feinabstimmung der eingehenden Audio-/Video-/Bild‑Vorverarbeitung
title: "Medienverständnis"
x-i18n:
  source_path: nodes/media-understanding.md
  source_hash: 4b275b152060eae3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:03Z
---

# Medienverständnis (eingehend) — 2026-01-17

OpenClaw kann **eingehende Medien zusammenfassen** (Bild/Audio/Video), bevor die Antwort‑Pipeline startet. Es erkennt automatisch, ob lokale Werkzeuge oder Anbieter‑Schlüssel verfügbar sind, und kann deaktiviert oder angepasst werden. Wenn das Verständnis ausgeschaltet ist, erhalten Modelle weiterhin wie gewohnt die Originaldateien/URLs.

## Ziele

- Optional: eingehende Medien vorab in kurzen Text überführen für schnelleres Routing + bessere Befehlsanalyse.
- Originale Medienzustellung an das Modell bewahren (immer).
- **Anbieter‑APIs** und **CLI‑Fallbacks** unterstützen.
- Mehrere Modelle mit geordneter Fallback‑Reihenfolge erlauben (Fehler/Größe/Timeout).

## Verhalten auf hoher Ebene

1. Eingehende Anhänge sammeln (`MediaPaths`, `MediaUrls`, `MediaTypes`).
2. Für jede aktivierte Fähigkeit (Bild/Audio/Video) Anhänge gemäß Richtlinie auswählen (Standard: **erster**).
3. Den ersten geeigneten Modelletrag wählen (Größe + Fähigkeit + Auth).
4. Wenn ein Modell fehlschlägt oder das Medium zu groß ist, **auf den nächsten Eintrag zurückfallen**.
5. Bei Erfolg:
   - `Body` wird zu einem `[Image]`‑, `[Audio]`‑ oder `[Video]`‑Block.
   - Audio setzt `{{Transcript}}`; die Befehlsanalyse nutzt den Caption‑Text, falls vorhanden,
     andernfalls das Transkript.
   - Captions werden als `User text:` innerhalb des Blocks beibehalten.

Wenn das Verständnis fehlschlägt oder deaktiviert ist, **läuft der Antwortfluss fort** mit dem ursprünglichen Body + Anhängen.

## Konfigurationsübersicht

`tools.media` unterstützt **gemeinsame Modelle** plus fähigkeitsspezifische Überschreibungen:

- `tools.media.models`: gemeinsame Modellliste (verwenden Sie `capabilities` zur Steuerung).
- `tools.media.image` / `tools.media.audio` / `tools.media.video`:
  - Standards (`prompt`, `maxChars`, `maxBytes`, `timeoutSeconds`, `language`)
  - Anbieter‑Überschreibungen (`baseUrl`, `headers`, `providerOptions`)
  - Deepgram‑Audiooptionen über `tools.media.audio.providerOptions.deepgram`
  - optionale **fähigkeitsspezifische `models`‑Liste** (bevorzugt vor gemeinsamen Modellen)
  - `attachments`‑Richtlinie (`mode`, `maxAttachments`, `prefer`)
  - `scope` (optionale Steuerung nach Kanal/Chat‑Typ/Sitzungsschlüssel)
- `tools.media.concurrency`: maximale gleichzeitige Fähigkeitsläufe (Standard **2**).

```json5
{
  tools: {
    media: {
      models: [
        /* shared list */
      ],
      image: {
        /* optional overrides */
      },
      audio: {
        /* optional overrides */
      },
      video: {
        /* optional overrides */
      },
    },
  },
}
```

### Modelleträge

Jeder `models[]`‑Eintrag kann **Anbieter** oder **CLI** sein:

```json5
{
  type: "provider", // default if omitted
  provider: "openai",
  model: "gpt-5.2",
  prompt: "Describe the image in <= 500 chars.",
  maxChars: 500,
  maxBytes: 10485760,
  timeoutSeconds: 60,
  capabilities: ["image"], // optional, used for multi‑modal entries
  profile: "vision-profile",
  preferredProfile: "vision-fallback",
}
```

```json5
{
  type: "cli",
  command: "gemini",
  args: [
    "-m",
    "gemini-3-flash",
    "--allowed-tools",
    "read_file",
    "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
  ],
  maxChars: 500,
  maxBytes: 52428800,
  timeoutSeconds: 120,
  capabilities: ["video", "image"],
}
```

CLI‑Vorlagen können außerdem verwenden:

- `{{MediaDir}}` (Verzeichnis, das die Mediendatei enthält)
- `{{OutputDir}}` (für diesen Lauf erstelltes Scratch‑Verzeichnis)
- `{{OutputBase}}` (Scratch‑Datei‑Basispfad, ohne Erweiterung)

## Standardwerte und Limits

Empfohlene Standardwerte:

- `maxChars`: **500** für Bild/Video (kurz, befehlsfreundlich)
- `maxChars`: **nicht gesetzt** für Audio (vollständiges Transkript, sofern Sie kein Limit setzen)
- `maxBytes`:
  - Bild: **10MB**
  - Audio: **20MB**
  - Video: **50MB**

Regeln:

- Überschreitet ein Medium `maxBytes`, wird dieses Modell übersprungen und **das nächste Modell versucht**.
- Gibt das Modell mehr als `maxChars` zurück, wird die Ausgabe gekürzt.
- `prompt` ist standardmäßig ein einfaches „Beschreiben Sie das {media}.“ plus die `maxChars`‑Hinweise (nur Bild/Video).
- Wenn `<capability>.enabled: true`, aber keine Modelle konfiguriert sind, versucht OpenClaw das
  **aktive Antwortmodell**, sofern dessen Anbieter die Fähigkeit unterstützt.

### Automatische Erkennung des Medienverständnisses (Standard)

Wenn `tools.media.<capability>.enabled` **nicht** auf `false` gesetzt ist und Sie keine
Modelle konfiguriert haben, erkennt OpenClaw automatisch in dieser Reihenfolge und **stoppt bei der ersten funktionierenden Option**:

1. **Lokale CLIs** (nur Audio; falls installiert)
   - `sherpa-onnx-offline` (erfordert `SHERPA_ONNX_MODEL_DIR` mit Encoder/Decoder/Joiner/Tokens)
   - `whisper-cli` (`whisper-cpp`; verwendet `WHISPER_CPP_MODEL` oder das gebündelte Tiny‑Modell)
   - `whisper` (Python‑CLI; lädt Modelle automatisch herunter)
2. **Gemini‑CLI** (`gemini`) mit `read_many_files`
3. **Anbieter‑Schlüssel**
   - Audio: OpenAI → Groq → Deepgram → Google
   - Bild: OpenAI → Anthropic → Google → MiniMax
   - Video: Google

Um die automatische Erkennung zu deaktivieren, setzen Sie:

```json5
{
  tools: {
    media: {
      audio: {
        enabled: false,
      },
    },
  },
}
```

Hinweis: Die Erkennung von Binärdateien erfolgt nach bestem Bemühen unter macOS/Linux/Windows; stellen Sie sicher, dass die CLI auf `PATH` liegt (wir erweitern `~`), oder setzen Sie einen expliziten CLI‑Modelleintrag mit vollständigem Befehlspfad.

## Fähigkeiten (optional)

Wenn Sie `capabilities` setzen, wird der Eintrag nur für diese Medientypen ausgeführt. Für gemeinsame
Listen kann OpenClaw Standardwerte ableiten:

- `openai`, `anthropic`, `minimax`: **Bild**
- `google` (Gemini‑API): **Bild + Audio + Video**
- `groq`: **Audio**
- `deepgram`: **Audio**

Für CLI‑Einträge **setzen Sie `capabilities` explizit**, um überraschende Zuordnungen zu vermeiden.
Wenn Sie `capabilities` weglassen, ist der Eintrag für die Liste zulässig, in der er erscheint.

## Anbieter‑Unterstützungsmatrix (OpenClaw‑Integrationen)

| Fähigkeit | Anbieter‑Integration                              | Hinweise                                          |
| --------- | ------------------------------------------------- | ------------------------------------------------- |
| Bild      | OpenAI / Anthropic / Google / andere über `pi-ai` | Jedes bildfähige Modell im Registry funktioniert. |
| Audio     | OpenAI, Groq, Deepgram, Google                    | Anbieter‑Transkription (Whisper/Deepgram/Gemini). |
| Video     | Google (Gemini‑API)                               | Anbieter‑Videoverständnis.                        |

## Empfohlene Anbieter

**Bild**

- Bevorzugen Sie Ihr aktives Modell, wenn es Bilder unterstützt.
- Gute Standardwerte: `openai/gpt-5.2`, `anthropic/claude-opus-4-6`, `google/gemini-3-pro-preview`.

**Audio**

- `openai/gpt-4o-mini-transcribe`, `groq/whisper-large-v3-turbo` oder `deepgram/nova-3`.
- CLI‑Fallback: `whisper-cli` (whisper‑cpp) oder `whisper`.
- Deepgram‑Einrichtung: [Deepgram (Audio‑Transkription)](/providers/deepgram).

**Video**

- `google/gemini-3-flash-preview` (schnell), `google/gemini-3-pro-preview` (umfangreicher).
- CLI‑Fallback: `gemini`‑CLI (unterstützt `read_file` für Video/Audio).

## Anhang‑Richtlinie

Die fähigkeitsspezifische `attachments` steuert, welche Anhänge verarbeitet werden:

- `mode`: `first` (Standard) oder `all`
- `maxAttachments`: Begrenzung der Anzahl verarbeiteter Elemente (Standard **1**)
- `prefer`: `first`, `last`, `path`, `url`

Wenn `mode: "all"`, werden Ausgaben als `[Image 1/2]`, `[Audio 2/2]` usw. beschriftet.

## Konfigurationsbeispiele

### 1) Gemeinsame Modellliste + Überschreibungen

```json5
{
  tools: {
    media: {
      models: [
        { provider: "openai", model: "gpt-5.2", capabilities: ["image"] },
        {
          provider: "google",
          model: "gemini-3-flash-preview",
          capabilities: ["image", "audio", "video"],
        },
        {
          type: "cli",
          command: "gemini",
          args: [
            "-m",
            "gemini-3-flash",
            "--allowed-tools",
            "read_file",
            "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
          ],
          capabilities: ["image", "video"],
        },
      ],
      audio: {
        attachments: { mode: "all", maxAttachments: 2 },
      },
      video: {
        maxChars: 500,
      },
    },
  },
}
```

### 2) Nur Audio + Video (Bild aus)

```json5
{
  tools: {
    media: {
      audio: {
        enabled: true,
        models: [
          { provider: "openai", model: "gpt-4o-mini-transcribe" },
          {
            type: "cli",
            command: "whisper",
            args: ["--model", "base", "{{MediaPath}}"],
          },
        ],
      },
      video: {
        enabled: true,
        maxChars: 500,
        models: [
          { provider: "google", model: "gemini-3-flash-preview" },
          {
            type: "cli",
            command: "gemini",
            args: [
              "-m",
              "gemini-3-flash",
              "--allowed-tools",
              "read_file",
              "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
            ],
          },
        ],
      },
    },
  },
}
```

### 3) Optionales Bildverständnis

```json5
{
  tools: {
    media: {
      image: {
        enabled: true,
        maxBytes: 10485760,
        maxChars: 500,
        models: [
          { provider: "openai", model: "gpt-5.2" },
          { provider: "anthropic", model: "claude-opus-4-6" },
          {
            type: "cli",
            command: "gemini",
            args: [
              "-m",
              "gemini-3-flash",
              "--allowed-tools",
              "read_file",
              "Read the media at {{MediaPath}} and describe it in <= {{MaxChars}} characters.",
            ],
          },
        ],
      },
    },
  },
}
```

### 4) Multimodaler Einzeleintrag (explizite Fähigkeiten)

```json5
{
  tools: {
    media: {
      image: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
      audio: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
      video: {
        models: [
          {
            provider: "google",
            model: "gemini-3-pro-preview",
            capabilities: ["image", "video", "audio"],
          },
        ],
      },
    },
  },
}
```

## Statusausgabe

Wenn das Medienverständnis ausgeführt wird, enthält `/status` eine kurze Zusammenfassungszeile:

```
📎 Media: image ok (openai/gpt-5.2) · audio skipped (maxBytes)
```

Dies zeigt pro Fähigkeit die Ergebnisse sowie den gewählten Anbieter/das gewählte Modell, sofern zutreffend.

## Hinweise

- Das Verständnis erfolgt **nach bestem Bemühen**. Fehler blockieren Antworten nicht.
- Anhänge werden auch dann an Modelle weitergegeben, wenn das Verständnis deaktiviert ist.
- Verwenden Sie `scope`, um einzuschränken, wo das Verständnis ausgeführt wird (z. B. nur Direktnachrichten).

## Verwandte Dokumente

- [Konfiguration](/gateway/configuration)
- [Bild‑ & Medienunterstützung](/nodes/images)
