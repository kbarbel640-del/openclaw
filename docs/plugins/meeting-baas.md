---
summary: "Meeting BaaS plugin: record meetings on Google Meet, Zoom, and Microsoft Teams via Meeting BaaS API"
read_when:
  - You want to record or transcribe meetings from OpenClaw
  - You are configuring or developing the meeting-baas plugin
title: "Meeting BaaS Plugin"
---

# Meeting BaaS (plugin)

Record meetings on Google Meet, Zoom, and Microsoft Teams via the
[Meeting BaaS](https://meetingbaas.com) unified API.

This is a tool-only plugin (no channel, no webhook server).

## Where it runs

This plugin runs **inside the Gateway process**.

If you use a remote Gateway, install/configure the plugin on the **machine
running the Gateway**, then restart the Gateway to load it.

## Install

### Option A: install from npm (recommended)

```bash
openclaw plugins install @openclaw/meeting-baas
```

Restart the Gateway afterwards.

### Option B: install from a local folder (dev)

```bash
openclaw plugins install ./extensions/meeting-baas
cd ./extensions/meeting-baas && pnpm install
```

Restart the Gateway afterwards.

## Config

Set your Meeting BaaS API key:

```bash
openclaw config set extensions.meeting-baas.apiKey "your-api-key"
```

Or configure via the full config object under `plugins.entries.meeting-baas.config`:

```json5
{
  plugins: {
    entries: {
      "meeting-baas": {
        enabled: true,
        config: {
          apiKey: "your-meeting-baas-api-key",
          // Optional: custom base URL (advanced)
          // baseUrl: "https://api.meetingbaas.com",
        },
      },
    },
  },
}
```

Get your API key from [meetingbaas.com](https://meetingbaas.com).

## Agent tool

Tool name: `meeting_bot`

Actions:

- `create_bot` — Send a bot to join and record a meeting (requires `meeting_url` and `bot_name`)
- `get_bot` — Get full bot status and details (requires `bot_id`)
- `get_transcript` — Retrieve transcript, recording URLs, participants, and speakers (requires `bot_id`)
- `leave_bot` — Remove the bot from an active meeting (requires `bot_id`)
- `list_bots` — List all bots
- `delete_bot_data` — Delete recordings and data for a bot (requires `bot_id`)

Optional parameters for `create_bot`:

- `entry_message` — Message posted in meeting chat on join (Google Meet and Zoom only)
- `recording_mode` — `speaker_view` (default), `audio_only`, or `gallery_view`

### Enable the tool

The meeting_bot tool is registered as optional. Enable it in your agent config:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: ["meeting_bot"],
        },
      },
    ],
  },
}
```

### Example usage

Record a meeting:

```
Send a bot named "Meeting Recorder" to https://meet.google.com/abc-defg-hij
```

Get the transcript after the meeting ends:

```
Get the transcript for bot bot-uuid-here
```
