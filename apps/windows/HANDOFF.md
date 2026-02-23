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
6. Gateway URL/token resolution works from:
   - CLI args: `--gateway-url`, `--gateway-token`
   - env: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`
   - config fallback: `~/.openclaw/openclaw.json`

## Current caveats
- Node now connects using node identity (`client.id = node-host`, role/mode = node).
- Basic command execution exists (`system.run`, `system.which`, `system.notify`) and Phase 2 now includes `screen.record` timed MP4 recording via `ScreenRecorderLib`.
- Build/test currently require x64 platform selection when running commands from CLI in this environment (e.g. `-p:Platform=x64`) because `ScreenRecorderLib` does not support AnyCPU.
- Pairing pending state is currently in-memory and filled from broadcast events (`device.pair.requested`, `node.pair.requested`) and cleared on `*.pair.resolved` via `CoreMethodService.HandleGatewayEvent`; not persisted locally.
- Reconnect loop now uses exponential backoff (up to 30s) and a background monitor correctly tracks `tick` frames from the server, closing to trigger reconnect if a tick is missed by >5s tolerance.

## Tests
- Project: `OpenClaw.Node.Tests`
- Current total: **26 passing**

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
2. Add first camera primitive (`camera.snap`) with the same base64 response shape expected by gateway tooling.
3. Keep running `RUN_REAL_GATEWAY_INTEGRATION=1 dotnet test --filter "FullyQualifiedName~RealGatewayIntegrationTests" -p:Platform=x64` before major merges (currently covers hello-ok connect + status response path).
4. If needed later, persist pairing pending cache to disk (currently in-memory only).
