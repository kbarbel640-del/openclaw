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
   - `dev.update` (development helper: pull latest branch + optional build in repo path)
   - `dev.restart` (development helper: schedule process self-restart with optional delay)
   - `dev.screenshot` (development helper: capture primary-screen jpg + focused window metadata)
   - `screen.list` (Phase 2: returns display metadata list `{ index, id, name }`)
   - `screen.record` (Phase 2 timed MP4 path: returns base64 mp4 with recording metadata)
   - `camera.list` (Phase 2: returns device metadata list `{ id, name, position, deviceType }`)
   - `camera.snap` (Phase 2: jpg payload shape with native WinRT capture and optional bundled ffmpeg fallback; returns actionable unavailable error with backend reason if capture/privacy setup is missing)
   - `window.list` (Automation MVP: returns `{ windows: [{ handle, title, process, isFocused }] }`)
   - `window.focus` (Automation MVP: focus by `handle` or `titleContains`)
   - `window.rect` (Automation MVP: returns `{ rect: { handle, left, top, right, bottom, width, height } }`)
   - `input.type` (Automation MVP: SendInput Unicode text injection into focused window)
   - `input.key` (Automation MVP: SendInput virtual-key combos into focused window)
   - `input.click` (Automation MVP: mouse click at `{ x, y }` with `button=primary|secondary|left|right` + optional `doubleClick`; primary/secondary respect OS swapped-button setting)
   - `input.scroll` (Automation MVP: vertical wheel scroll with `deltaY` and optional coordinate targeting `{ x, y }`)
   - `input.click.relative` (Automation MVP: click at window-relative offsets `{ offsetX, offsetY }` using `handle` or `titleContains`)
6. Local IPC named-pipe server is running on Windows (`\\.\pipe\openclaw.node.ipc`) with auth + methods:
   - `ipc.ping`
   - `ipc.window.list`
   - `ipc.window.focus`
   - `ipc.window.rect`
   - `ipc.input.type`
   - `ipc.input.key`
   - `ipc.input.click`
   - `ipc.input.scroll`
   - `ipc.input.click.relative`
   - `ipc.dev.update`
   - `ipc.dev.restart`
   - auth token required when configured (Program currently uses gateway token as shared secret)
7. Gateway URL/token resolution works from:
   - CLI args: `--gateway-url`, `--gateway-token`
   - env: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`
   - config fallback: `~/.openclaw/openclaw.json`

## Current caveats
- Node now connects using node identity (`client.id = node-host`, role/mode = node).
- Basic command execution exists (`system.run`, `system.which`, `system.notify`) and Phase 2 now includes `screen.record` timed MP4 recording via `ScreenRecorderLib` plus `camera.snap` via native WinRT capture/list (PowerShell bridge) with optional bundled ffmpeg fallback if packaged.
- Real-host camera validation is complete for current hardware (single USB webcam): `camera.snap` works in generic and explicit `deviceId` modes; `facing=front/back` may map to the same physical camera semantics on single-camera hosts; `maxWidth` and `quality` controls are verified.
- Camera path no longer depends on `MediaFoundation.Net`; this removes the `NU1701` framework-compat warning path for `net8.0` builds.
- Build/test currently require x64 platform selection when running commands from CLI in this environment (e.g. `-p:Platform=x64`) because `ScreenRecorderLib` does not support AnyCPU.
- Pairing pending state is currently in-memory and filled from broadcast events (`device.pair.requested`, `node.pair.requested`) and cleared on `*.pair.resolved` via `CoreMethodService.HandleGatewayEvent`; not persisted locally.
- Reconnect loop now uses exponential backoff (up to 30s) and a background monitor correctly tracks `tick` frames from the server, closing to trigger reconnect if a tick is missed by >5s tolerance.

## Tests
- Project: `OpenClaw.Node.Tests`
- Current total: **74 passing** (plus real-gateway integration suite passing with device-auth handshake)

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
1. Keep running `RUN_REAL_GATEWAY_INTEGRATION=1 dotnet test --filter "FullyQualifiedName~RealGatewayIntegrationTests" -p:Platform=x64` before major merges (now with signed device-auth handshake on connect; suite covers node-connect/status plus screen.list/camera.list/window.list/window.rect response-shape paths, screen.record generic + explicit screenIndex path, and camera.snap generic + explicit deviceId/front-back shape paths when available).
2. On Windows hosts, ensure camera prerequisites are explicit in onboarding/docs: Camera privacy toggles enabled for desktop apps.
3. Extend camera validation on true multi-camera hardware (distinct front/back/external) to tune device-selection heuristics beyond single-camera semantics.
4. Add IPC integration tests that invoke the new dev helper methods in a non-destructive mode.
5. If needed later, persist pairing pending cache to disk (currently in-memory only).
