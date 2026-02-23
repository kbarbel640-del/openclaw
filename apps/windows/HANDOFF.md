# Handoff - OpenClaw Windows Node

## Repo path
`/home/david/openclaw_source/apps/windows`

## What works now
1. `OpenClaw.Node` builds/runs.
2. Connects to real local OpenClaw gateway and completes handshake (`hello-ok`).
3. Receives `connect.challenge`, sends `connect` request in gateway frame format.
4. Supports method router handlers for:
   - `status`
   - `health`
   - `set-heartbeats`
   - `system-event`
   - `channels.status`
   - `config.get`
   - `config.set`
   - `config.patch`
   - `config.schema`
   - `node.pair.list` / `node.pair.approve` / `node.pair.reject`
   - `device.pair.list` / `device.pair.approve` / `device.pair.reject`
5. Supports `node.invoke.request` ingestion and emits `node.invoke.result` with actual execution for:
   - `system.run`
   - `system.which`
   - `system.notify`
   - `screen.list` (Phase 2: returns display metadata list `{ index, id, name }`)
   - `screen.record` (Phase 2 timed MP4 path: returns base64 mp4 with recording metadata)
   - `camera.list` (Phase 2: returns device metadata list `{ id, name, position, deviceType }`)
   - `camera.snap` (Phase 2: jpg payload shape with ffmpeg DirectShow capture path; returns actionable unavailable error if capture backend/privacy setup is missing)
   - `window.list` (Automation MVP: returns `{ windows: [{ handle, title, process, isFocused }] }`)
   - `window.focus` (Automation MVP: focus by `handle` or `titleContains`)
   - `window.rect` (Automation MVP: returns `{ rect: { handle, left, top, right, bottom, width, height } }`)
   - `input.type` (Automation MVP: SendInput Unicode text injection into focused window)
   - `input.key` (Automation MVP: SendInput virtual-key combos into focused window)
   - `input.click` (Automation MVP: mouse click at `{ x, y }` with `button=primary|secondary|left|right` + optional `doubleClick`; primary/secondary respect OS swapped-button setting)
   - `input.scroll` (Automation MVP: vertical wheel scroll with `deltaY` and optional coordinate targeting `{ x, y }`)
   - `input.click.relative` (Automation MVP: click at window-relative offsets `{ offsetX, offsetY }` using `handle` or `titleContains`)
6. Gateway URL/token resolution works from:
   - CLI args: `--gateway-url`, `--gateway-token`
   - env: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`
   - config fallback: `~/.openclaw/openclaw.json`

## Current caveats
- Node now connects using node identity (`client.id = node-host`, role/mode = node).
- Basic command execution exists (`system.run`, `system.which`, `system.notify`) and Phase 2 now includes `screen.record` timed MP4 recording via `ScreenRecorderLib` plus `camera.snap` via ffmpeg DirectShow capture/list.
- Camera path no longer depends on `MediaFoundation.Net`; this removes the `NU1701` framework-compat warning path for `net8.0` builds.
- Build/test currently require x64 platform selection when running commands from CLI in this environment (e.g. `-p:Platform=x64`) because `ScreenRecorderLib` does not support AnyCPU.
- Pairing pending state is currently in-memory and filled from broadcast events (`device.pair.requested`, `node.pair.requested`) and cleared on `*.pair.resolved` via `CoreMethodService.HandleGatewayEvent`; not persisted locally.
- Reconnect loop now uses exponential backoff (up to 30s) and a background monitor correctly tracks `tick` frames from the server, closing to trigger reconnect if a tick is missed by >5s tolerance.

## Tests
- Project: `OpenClaw.Node.Tests`
- Current total: **60 passing** (plus real-gateway integration suite passing with device-auth handshake)

Run:
```bash
cd /home/david/openclaw_source/apps/windows
dotnet build OpenClaw.Node/OpenClaw.Node.csproj -p:Platform=x64
dotnet test OpenClaw.Node.Tests/OpenClaw.Node.Tests.csproj -p:Platform=x64
```

## Run app locally
```bash
cd /home/david/openclaw_source/apps/windows/OpenClaw.Node
dotnet run -p:Platform=x64 -- --gateway-url ws://127.0.0.1:18789 --gateway-token <TOKEN>
```

(or rely on env/config auto-resolution)

## Immediate next steps
1. Run real-gateway validation of `screen.record` end-to-end from the OpenClaw CLI path and tune source selection/audio defaults as needed.
2. Run real-gateway end-to-end validation for `camera.snap` on a physical Windows host (front/back selection, deviceId routing, and payload dimensions).
3. Keep running `RUN_REAL_GATEWAY_INTEGRATION=1 dotnet test --filter "FullyQualifiedName~RealGatewayIntegrationTests" -p:Platform=x64` before major merges (now with signed device-auth handshake on connect; suite currently 10 passing and covers node-connect/status plus screen.list/camera.list/window.list/window.rect response-shape paths, screen.record generic + explicit screenIndex path, and camera.snap generic + explicit deviceId path when available).
4. On Windows hosts, ensure camera prerequisites are explicit in onboarding/docs: Camera privacy toggles enabled for desktop apps + ffmpeg available on PATH for camera commands.
5. If needed later, persist pairing pending cache to disk (currently in-memory only).
