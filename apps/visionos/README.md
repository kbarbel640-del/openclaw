# OpenClaw VisionOS (MVP)

This app hosts the visionOS node shell for OpenClaw with a voice-first control panel.

## Quick start

From repo root:

```bash
pnpm visionos:open
```

Build/test from CLI:

```bash
pnpm visionos:build
pnpm visionos:test
```

## Current scope

- Voice-first shared-space control panel
- Duplex voice state machine with automatic fallback to PTT
- Natural gesture intent mapping (pinch, hold, drag, resize, cancel)
- Canvas/Chat/Usage surface windows (MVP placeholders)
