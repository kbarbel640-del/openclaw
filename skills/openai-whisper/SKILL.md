---
name: openai-whisper
description: Local speech-to-text with a Whisper CLI binary (no API key).
homepage: https://openai.com/research/whisper
metadata:
  {
    "openclaw":
      {
        "emoji": "🎙️",
        "requires": { "bins": ["whisper"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "openai-whisper",
              "bins": ["whisper"],
              "label": "Install OpenAI Whisper (brew)",
            },
          ],
      },
  }
---

# Whisper (Local CLI)

Use `whisper` for local speech-to-text. This skill supports two local modes.

## Mode 1: Live server (faster repeated transcriptions)

Use this when you run whisper in server mode (for example `whisper --server`).

```bash
curl --request POST --url http://127.0.0.1:8080/inference --form 'file=@/path/audio.mp3'
```

Notes:

- Endpoint defaults to `http://127.0.0.1:8080/inference`.
- Response body contains the transcript text.

## Mode 2: On-demand CLI (simple single-shot runs)

Use this when whisper is not running as a server.

```bash
whisper -f /path/audio.mp3
```

## Which mode to use

- If whisper server is running and reachable, use server mode (`curl POST`).
- Otherwise use on-demand mode (`whisper -f ...`).

Notes

- This skill is local-only and should not call external APIs.
- Flag support varies by whisper implementation. `-f` and `--server` are from whisperfile-style binaries.
- If your local `whisper --help` shows OpenAI Python Whisper flags (`--output_format`, `--output_dir`), use those flags instead of whisperfile-style flags.
