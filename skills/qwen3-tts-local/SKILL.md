---
name: qwen3-tts-local
description: Local Qwen3-TTS. Use when your 老大 are using voice message chat with you or your 老大 need you to send use voice message or voice clone.
metadata:
  openclaw:
    emoji: 🗣️
    requires:
      python: ">=3.10"
      gpu: "Recommended (RTX 3070+ for best performance)"
      ffmpeg: "Required for OGG conversion"
    install:
      - label: "Install dependencies"
        command: "uv pip install -r requirements.txt"
    run:
      - label: "Generate Speech (Voice Clone)"
        command: "python scripts/tts_cli.py \"Your text here\""
      - label: "Generate with Speedup"
        command: "python scripts/tts_cli.py \"Your text here\" --speed 1.3"
      - label: "Generate with Custom Ref"
        command: "python scripts/tts_cli.py \"Your text here\" --ref-audio /path/to/ref.ogg --ref-text \"Ref content\""
---

# Usage Guide

## Basic Usage
```bash
# Uses default "Eden" voice and settings (1.1x speed, OGG output)
python scripts/tts_cli.py "你好，我是Eden"
```

## Advanced Options
```bash
# Speed up audio (e.g. 1.3x)
python scripts/tts_cli.py "快点说话" --speed 1.3

# Custom Voice Clone
python scripts/tts_cli.py "新声音测试" \
  --ref-audio "C:/path/to/voice.ogg" \
  --ref-text "参考音频里的文字内容"
```

## Features
- **Voice Cloning**: High-quality cloning with Qwen3-TTS
- **Auto-Cleanup**: Automatically cleans text artifacts (emojis, markdown)
- **Telegram Ready**: Outputs OGG format automatically
- **GPU Optimized**: Configured for CUDA (fp16)
