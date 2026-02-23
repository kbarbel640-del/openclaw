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
   - `screen.record` (Phase 2 timed MP4 path: returns base64 mp4 with recording metadata)
   - `camera.snap` (Phase 2: jpg payload shape with native Media Foundation capture path + placeholder fallback)
6. Gateway URL/token resolution works from:
   - CLI args: `--gateway-url`, `--gateway-token`
   - env: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`
   - config fallback: `~/.openclaw/openclaw.json`

## Current caveats
- Node now connects using node identity (`client.id = node-host`, role/mode = node).
- Basic command execution exists (`system.run`, `system.which`, `system.notify`) and Phase 2 now includes `screen.record` timed MP4 recording via `ScreenRecorderLib` plus `camera.snap` via Media Foundation (`MediaFoundation.Net`).
- `MediaFoundation.Net` restores with NU1701 against `net8.0` (framework compatibility warning). Build/tests pass, but this should be validated on a real Windows runtime and potentially replaced with a net8-native interop layer if needed.
- Build/test currently require x64 platform selection when running commands from CLI in this environment (e.g. `-p:Platform=x64`) because `ScreenRecorderLib` does not support AnyCPU.
- Pairing pending state is currently in-memory and filled from broadcast events (`device.pair.requested`, `node.pair.requested`) and cleared on `*.pair.resolved` via `CoreMethodService.HandleGatewayEvent`; not persisted locally.
- Reconnect loop now uses exponential backoff (up to 30s) and a background monitor correctly tracks `tick` frames from the server, closing to trigger reconnect if a tick is missed by >5s tolerance.

## Tests
- Project: `OpenClaw.Node.Tests`
- Current total: **30 passing**

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
3. Keep running `RUN_REAL_GATEWAY_INTEGRATION=1 dotnet test --filter "FullyQualifiedName~RealGatewayIntegrationTests" -p:Platform=x64` before major merges (currently covers node-connect outcome path, status response path, plus camera.snap/screen.record response-shape paths when a node is available).
4. If needed later, persist pairing pending cache to disk (currently in-memory only).
