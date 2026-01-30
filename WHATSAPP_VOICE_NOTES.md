# WhatsApp Voice Notes: Transcription + Voice Replies (Docker)

This setup adds two capabilities for WhatsApp:

1) Transcribe inbound WhatsApp voice notes into text (speech-to-text).
2) Optionally reply with a WhatsApp voice message (text-to-speech).

It keeps all state intact by persisting host mounts for both config and workspace.

## Persisted State (Do Not Lose)

Make sure your gateway container always mounts:

- `~/.clawdbot/` -> `/home/node/.clawdbot` (config, credentials, sessions)
- `~/clawd/` -> `/home/node/clawd` (workspace + memory files)

If you rebuild/recreate the container but keep those two mounts, your memories/config remain.

## 1) Build a Whisper-Enabled Image

Build the image (includes `ffmpeg` + `whisper-cli` from whisper.cpp):

```bash
docker build -t clawdbot:whisper -f Dockerfile.whisper .
```

## 2) Download a Whisper Model (Host)

Download a whisper.cpp `ggml-*.bin` model into:

```text
~/.clawdbot/tools/whisper-cpp/
```

Example (base model):

```bash
mkdir -p ~/.clawdbot/tools/whisper-cpp
curl -L --fail -o ~/.clawdbot/tools/whisper-cpp/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

## 3) Run the Gateway Container

Set `WHISPER_CPP_MODEL` to the model path inside the container:

```bash
MSYS_NO_PATHCONV=1 docker run -d --name clawdbot-gateway \
  -p 18789:18789 \
  -v /c/Users/<you>/.clawdbot:/home/node/.clawdbot \
  -v /c/Users/<you>/clawd:/home/node/clawd \
  -e HOME=/home/node \
  -e TERM=xterm-256color \
  -e WHISPER_CPP_MODEL=/home/node/.clawdbot/tools/whisper-cpp/ggml-base.bin \
  clawdbot:whisper node dist/index.js gateway
```

## 4) Config: Enable Transcription

In `~/.clawdbot/clawdbot.json`, set `tools.media.audio` with a CLI model that:

- converts WhatsApp audio to WAV via `ffmpeg`
- runs `whisper-cli`
- prints the transcript to stdout

This repo’s local setup currently uses:

- `tools.media.audio.enabled=true`
- a WhatsApp-only scope gate
- a `bash -lc` command that expects `WHISPER_CPP_MODEL` to point at the model file

## 5) Config: Enable Voice Replies (TTS)

To speak back only when you send voice notes:

- set `messages.tts.auto = "inbound"`

WhatsApp outbound audio is sent as PTT (`voice note`) automatically.

## Quick Checks

```bash
docker exec clawdbot-gateway node dist/index.js channels status
docker logs -f clawdbot-gateway
```

If WhatsApp shows `linked` but not connected, restart the gateway:

```bash
docker restart clawdbot-gateway
```

## References

- https://docs.clawd.bot/nodes/audio
- https://docs.clawd.bot/tts
- https://docs.clawd.bot/channels/whatsapp
