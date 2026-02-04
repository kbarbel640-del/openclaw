# MiniMax TTS for OpenClaw Talk Mode

This document explains how to configure MiniMax TTS for Talk Mode in the OpenClaw macOS App.

## Overview

MiniMax TTS provides high-quality Chinese voice synthesis for Talk Mode. When enabled, it replaces the default system TTS with MiniMax's cloud-based voice synthesis.

## Features

- **MiniMax Cloud TTS**: High-quality Chinese voice synthesis via WebSocket streaming
- **Improved Interrupt Detection**: Optimized speech interruption with better accuracy
  - Minimum 5 characters required to trigger interrupt (prevents false positives)
  - Echo detection to avoid self-interruption from TTS playback
  - Real-time interrupt during TTS playback
- **Automatic Fallback**: Falls back to macOS system TTS if MiniMax is unavailable

## Configuration Methods

You can configure MiniMax TTS using any of the following methods (in order of priority):

### Method 1: Environment Variables (Recommended for Development)

Set environment variables in your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export MINIMAX_API_KEY="your-minimax-api-key"
export MINIMAX_VOICE_ID="male-qn-qingse"     # Optional, default: male-qn-qingse
export MINIMAX_MODEL="speech-2.6-hd"          # Optional, default: speech-2.6-hd
export MINIMAX_TTS_ENABLED="1"                # Optional, default: enabled
```

### Method 2: OpenClaw Config File (Recommended for Production)

Edit `~/.openclaw/openclaw.json` and add the following configuration:

```json
{
  "env": {
    "MINIMAX_API_KEY": "your-minimax-api-key"
  },
  "talk": {
    "minimax": {
      "enabled": true,
      "apiKey": "your-minimax-api-key",
      "voiceId": "male-qn-qingse",
      "model": "speech-2.6-hd"
    }
  }
}
```

**Note:** You can set the API key in either `env.MINIMAX_API_KEY` or `talk.minimax.apiKey`. If both are set, `env.MINIMAX_API_KEY` takes priority.

### Method 3: Dashboard Config

1. Open OpenClaw Dashboard (http://localhost:18789 or via menu bar)
2. Go to **Config** → **Raw**
3. Add the configuration as shown in Method 2
4. Click **Save** and **Apply**

## Configuration Options

| Option   | Environment Variable  | Config Key                                     | Default          | Description                |
| -------- | --------------------- | ---------------------------------------------- | ---------------- | -------------------------- |
| API Key  | `MINIMAX_API_KEY`     | `env.MINIMAX_API_KEY` or `talk.minimax.apiKey` | (required)       | Your MiniMax API key       |
| Voice ID | `MINIMAX_VOICE_ID`    | `talk.minimax.voiceId`                         | `male-qn-qingse` | Voice identifier           |
| Model    | `MINIMAX_MODEL`       | `talk.minimax.model`                           | `speech-2.6-hd`  | TTS model to use           |
| Enabled  | `MINIMAX_TTS_ENABLED` | `talk.minimax.enabled`                         | `true`           | Enable/disable MiniMax TTS |

## Available Voices

Common MiniMax voice IDs:

| Voice ID             | Description                      |
| -------------------- | -------------------------------- |
| `male-qn-qingse`     | 青涩青年音 (Young male)          |
| `male-qn-jingying`   | 精英青年音 (Elite male)          |
| `male-qn-badao`      | 霸道青年音 (Confident male)      |
| `male-qn-daxuesheng` | 大学生音 (College student male)  |
| `female-shaonv`      | 少女音 (Young female)            |
| `female-yujie`       | 御姐音 (Mature female)           |
| `female-chengshu`    | 成熟女性音 (Mature female)       |
| `female-tianmei`     | 甜美女性音 (Sweet female)        |
| `presenter_male`     | 男性主持人 (Male presenter)      |
| `presenter_female`   | 女性主持人 (Female presenter)    |
| `audiobook_male_1`   | 男性有声书1 (Audiobook male 1)   |
| `audiobook_male_2`   | 男性有声书2 (Audiobook male 2)   |
| `audiobook_female_1` | 女性有声书1 (Audiobook female 1) |
| `audiobook_female_2` | 女性有声书2 (Audiobook female 2) |

For a complete list, visit: https://platform.minimaxi.com/docs/guides/T2A/tts/voice-types

## Available Models

| Model              | Description                         |
| ------------------ | ----------------------------------- |
| `speech-2.6-hd`    | High-definition model (recommended) |
| `speech-2.8-turbo` | Faster model with good quality      |

## Getting Your API Key

1. Visit https://platform.minimaxi.com
2. Create an account or sign in
3. Go to API Keys section
4. Create a new API key
5. Copy the key and configure as shown above

## Troubleshooting

### TTS not working

1. Check if API key is configured:

   ```bash
   openclaw config get env.MINIMAX_API_KEY
   ```

2. Check macOS logs:

   ```bash
   log show --predicate 'subsystem == "ai.openclaw"' --last 5m | grep -i minimax
   ```

3. Verify Gateway is running:
   ```bash
   openclaw gateway status
   ```

### Fallback to System TTS

If MiniMax TTS fails or is not configured, Talk Mode automatically falls back to macOS system TTS.

## Files Modified

This feature modifies the following files in the OpenClaw macOS app:

- `apps/macos/Sources/OpenClaw/TalkModeRuntime.swift` - Main Talk Mode logic
- `apps/macos/Sources/OpenClaw/MiniMaxTTS.swift` - MiniMax TTS client (new file)
- `apps/macos/Sources/OpenClaw/StreamingTTSPipeline.swift` - Streaming pipeline (new file)
- `apps/macos/Sources/OpenClaw/PermissionManager.swift` - Minor updates

## Version

- OpenClaw Version: 2026.2.3
- MiniMax TTS Integration: v1.0
- Date: 2026-02-04
