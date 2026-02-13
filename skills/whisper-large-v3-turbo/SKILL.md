---
name: whisper-large-v3-turbo
description: Use when you need to transcribe audio to text using local Whisper (Large-v3-Turbo) model for high-accuracy STT, run via uv and Python script.
metadata:
  openclaw:
    emoji: 👂
    requires:
      python: ">=3.10"
      gpu: "Recommended (RTX 3070+)"
    install:
      - label: "Install dependencies (Whisper + Torch)"
        command: "uv pip install click openai-whisper torch"
    run:
      - label: "Transcribe File"
        command: "uv run scripts/transcribe.py {{MediaPath}} --quiet"
        description: "Transcribes an audio file and outputs text to stdout."
---

# Local Whisper (Large-v3-Turbo)

Use the bundled script to transcribe audio with Whisper Large-v3-Turbo.

## Model

- **Model**: openai/whisper-large-v3-turbo (1.51 GB)
- **Path**: Model auto-downloaded to `~/.cache/whisper` or set `WHISPER_MODEL_DIR`.

## Usage

```bash
uv run scripts/transcribe.py audio.mp3 --quiet
uv run scripts/transcribe.py audio.wav --language Chinese --output_format txt
```

## Script Location

`{baseDir}/scripts/transcribe.py` is provided by the skill package.

## Notes

- The script prints plain text to stdout; capture or pipe as needed.
- GPU recommended for speed; CPU works but slower.
- Use `--language` to improve accuracy.