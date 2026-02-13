---
name: openai-whisper
description: Use when you need to transcribe audio to text locally using the Whisper CLI, without requiring an API key.
homepage: https://openai.com/research/whisper
metadata:
  openclaw:
    emoji: 🎙️
    requires:
      bins: ["whisper"]
    install:
      - id: brew
        kind: brew
        formula: openai-whisper
        bins: ["whisper"]
        label: "Install OpenAI Whisper (brew)"
---

# Whisper (CLI)

Use `whisper` to transcribe audio locally.

Quick start
- `whisper /path/audio.mp3 --model large-v3-turbo --output_format txt --output_dir .`
- `whisper /path/audio.m4a --task translate --output_format srt`

Notes
- Models download to `~/.cache/whisper` (Windows: `C:\Users\<用户名>\.cache\whisper`) on first run.
- Installed on this system: `large-v3-turbo` (1.51GB) only, for best accuracy & speed balance.
- Use `--model large-v3-turbo` for all transcriptions.
- Model storage: C:\Users\User\.cache\whisper