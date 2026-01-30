# Clawdbot Docker Setup Notes (Local)

These notes document the working local Docker setup we built. They are intentionally scrubbed of secrets and personal identifiers.

## What’s Running

- Gateway runs in Docker as `clawdbot-gateway` and listens on port `18789`.
- Control UI is served by the gateway on the same port.
- WhatsApp is linked and the listener is running.

## Persisted State (Kept Intact)

All state is persisted on the host via bind mounts:

- `~/.clawdbot/` (config, credentials, sessions)
- `~/clawd/` (workspace files like `AGENTS.md`, `MEMORY.md`, etc.)

As long as you keep mounting these two directories, you can rebuild/recreate the container without losing memory/config.

## Control UI

Open the tokenized dashboard URL (token is required for non-loopback binds):

```text
http://localhost:18789/?token=<YOUR_GATEWAY_TOKEN>
```

If it loads but shows disconnected, go to `Overview` and click `Connect` after pasting the token.

## WhatsApp

Quick status:

```bash
docker exec clawdbot-gateway node dist/index.js channels status
```

If WhatsApp shows `linked` but `stopped/disconnected`, restarting the gateway usually fixes it:

```bash
docker restart clawdbot-gateway
```

If it’s still disconnected after restart, relink:

```bash
docker exec -it clawdbot-gateway node dist/index.js channels login
```

## Audio Transcription (WhatsApp Voice Notes)

We enabled inbound audio transcription using local `ffmpeg` + `whisper-cli` (whisper.cpp):

- Image: `clawdbot:whisper` (built from `Dockerfile.whisper`)
- Model file stored on host under `~/.clawdbot/tools/whisper-cpp/`
- Container env var:
  - `WHISPER_CPP_MODEL=/home/node/.clawdbot/tools/whisper-cpp/ggml-base.bin`

Config lives in `~/.clawdbot/clawdbot.json` under `tools.media.audio` and is scoped to WhatsApp.

## Voice Replies (TTS)

We enabled auto-TTS for replies after inbound voice notes:

- `messages.tts.auto = "inbound"`

WhatsApp sends outbound audio with `ptt: true`, so replies show up as voice messages.

## Container Commands

Build the whisper-enabled image:

```bash
docker build -t clawdbot:whisper -f Dockerfile.whisper .
```

Run the gateway (replace host paths/tokens as needed):

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

Logs:

```bash
docker logs -f clawdbot-gateway
```

## References

- https://docs.clawd.bot/channels/whatsapp
- https://docs.clawd.bot/nodes/audio
- https://docs.clawd.bot/tts
