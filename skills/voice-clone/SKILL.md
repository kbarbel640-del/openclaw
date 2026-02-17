---
name: voice-clone
description: Clone voices and generate speech using ElevenLabs voice cloning API. Use when the user wants to clone a voice, create a custom voice from audio samples, generate speech in a cloned voice, or work with voice profiles. Also triggers for "clone my voice", "speak like X", "create a voice from this audio", or "use my voice".
metadata:
  {
    "openclaw":
      {
        "emoji": "🎙️",
        "requires": { "env": ["ELEVENLABS_API_KEY"] },
      },
  }
---

# Voice Clone

Clone voices and generate speech via the ElevenLabs API.

## Capabilities

| Feature              | Endpoint                           | Description                              |
| -------------------- | ---------------------------------- | ---------------------------------------- |
| **Instant Clone**    | `POST /v1/voices/add`              | Clone from 1+ audio samples (no training)|
| **List Voices**      | `GET /v1/voices`                   | List all available + cloned voices       |
| **Generate Speech**  | `POST /v1/text-to-speech/{id}`     | TTS with any voice (cloned or preset)    |
| **Delete Voice**     | `DELETE /v1/voices/{id}`           | Remove a cloned voice                    |
| **Voice Settings**   | `GET /v1/voices/{id}/settings`     | Get voice generation settings            |

## Workflow

### 1. Clone a voice (Instant Voice Cloning)

Requires 1+ audio samples (MP3, WAV, M4A). More samples = better quality.

```bash
# Clone from audio file(s)
curl -X POST "https://api.elevenlabs.io/v1/voices/add" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -F "name=MyVoice" \
  -F "description=Custom cloned voice" \
  -F "files=@sample1.mp3" \
  -F "files=@sample2.mp3"
```

Response contains the new `voice_id` for TTS.

**Audio sample tips:**
- Minimum 30 seconds, ideally 1-3 minutes per sample
- Clean audio without background noise
- Natural speaking voice (not whispering or shouting)
- Supported formats: MP3, WAV, M4A, FLAC, OGG, WEBM

### 2. List available voices

```bash
curl -s "https://api.elevenlabs.io/v1/voices" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" | jq '.voices[] | {voice_id, name, category}'
```

### 3. Generate speech with cloned voice

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/<voice_id>" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is my cloned voice speaking.",
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.75,
      "style": 0.5,
      "use_speaker_boost": true
    }
  }' \
  --output speech.mp3
```

### 4. Use cloned voice with OpenClaw TTS

Once a voice is cloned, configure it as the default TTS voice in `~/.openclaw/openclaw.json`:

```json5
{
  messages: {
    tts: {
      provider: "elevenlabs",
      voiceId: "<cloned-voice-id>",
      model: "eleven_multilingual_v2",
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.5,
        useSpeakerBoost: true
      }
    }
  }
}
```

This makes all TTS output use the cloned voice across all channels.

### 5. Delete a cloned voice

```bash
curl -X DELETE "https://api.elevenlabs.io/v1/voices/<voice_id>" \
  -H "xi-api-key: $ELEVENLABS_API_KEY"
```

## Voice Settings Reference

| Parameter          | Range   | Effect                                               |
| ------------------ | ------- | ---------------------------------------------------- |
| `stability`        | 0.0-1.0 | Higher = more consistent, lower = more expressive    |
| `similarity_boost` | 0.0-1.0 | Higher = closer to original voice                    |
| `style`            | 0.0-1.0 | Higher = more expressive style (costs more latency)  |
| `use_speaker_boost`| boolean | Enhance voice clarity (recommended for cloned voices)|

## Integration with OpenClaw

- Cloned voices work with all OpenClaw TTS channels (WhatsApp, Telegram, Discord, etc.)
- Use the `tts` directive in messages: `[[[tts:text="Speak this with cloned voice"]]]`
- Voice settings can be overridden per-channel in config
- Works with `sherpa-onnx-tts` for offline fallback (different voice)

## Notes

- ElevenLabs free tier includes limited characters/month but supports instant cloning
- Cloned voices are private to your account
- Always get consent before cloning someone's voice
- Audio quality of samples directly affects clone quality
