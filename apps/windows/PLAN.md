# OpenClaw Windows Node - Development Plan

## Objective
Build a native Windows application that replicates the functionality of the OpenClaw macOS companion app, using C# and .NET 8 targeting Windows 10/11 natively.

## Naming convention
- Foundation/protocol layer: **Core** (e.g., `CoreMethodService`).
- System capability layer (next phase): **Api** naming for platform adapters/services.

## Current Snapshot (latest)
- ✅ Windows solution scaffolded: `OpenClaw.sln`
- ✅ Projects created: `OpenClaw.Node`, `OpenClaw.Node.Tests`
- ✅ Real Gateway handshake working against local gateway (`hello-ok` confirmed)
- ✅ Core frame protocol aligned to gateway `req/res/event` flow
- ✅ Method routing scaffold implemented
- ✅ `node.invoke.request` receive + `node.invoke.result` send implemented with command executor (`system.run`, `system.which`, `system.notify`, `screen.list`, `screen.record`, `camera.list`, `camera.snap`)
- ✅ Pairing pending state can be populated from gateway events (`device.pair.requested`, `node.pair.requested`)
- ✅ Config loading added (args/env/`~/.openclaw/openclaw.json`)
- ✅ Phase 2 started with first end-to-end media slice
- ✅ `screen.record` upgraded to timed MP4 recording path (base64 mp4 payload with duration/fps/audio metadata)
- ✅ Tests passing (45 total)

---

## Phase 1: Core Networking & Protocol (Completed)
- [x] Scaffold .NET 8 solution and base app
- [x] Add protocol models (`ConnectParams`, `RequestFrame`, `ResponseFrame`, `EventFrame`)
- [x] Implement WebSocket connection loop
- [x] Handle `connect.challenge` and send `connect` request
- [x] Confirm real gateway `hello-ok` handshake
- [x] Implement request-method router scaffold (`status`, `health`)
- [x] Add bridge models + `node.invoke.request` event handling scaffold
- [x] Return structured `res` envelopes (`ok/payload/error`)
- [x] Add token/url resolution from args/env/config file
- [x] Add robust reconnect backoff and tick/heartbeat miss handling parity with macOS
- [x] Add full method coverage parity (core Phase 1 method set)
- [x] Replace hardcoded client identity shim with Windows-native allowed client id strategy

### Phase 1 method coverage queue (next)
1. ✅ `status`
2. ✅ `health`
3. ✅ `set-heartbeats`
4. ✅ `system-event`
5. ✅ `channels.status`
6. ✅ `config.get` / `config.set` / `config.patch` / `config.schema`
7. ✅ `node.pair.*` + `device.pair.*` implemented as in-memory Phase 1 flow (list/approve/reject over pending request set)

---

## Phase 2: System Capabilities (Media & Automation APIs) (In Progress)
- **Screen/Capture (`Media/`)**
  - [x] `screen.list` bridge command wired in `NodeCommandExecutor` with display metadata payload
  - [x] `screen.record` bridge command wired in `NodeCommandExecutor`
  - [x] Timed recording parameters handled: `durationMs`, `fps`, `includeAudio`, `screenIndex`
  - [x] Returns OpenClaw-compatible payload shapes:
    - `screen.list` -> `{ displays: [{ index, id, name }] }`
    - `screen.record` -> `{ format: "mp4", base64, durationMs, fps, screenIndex, hasAudio }`
  - [x] Initial MP4 recording implementation uses `ScreenRecorderLib` (Windows Media Foundation-backed)
  - [ ] Evaluate/iterate native implementation details (WGC vs Desktop Duplication behavior tuning)
- **Camera (`Media/`)**
  - [x] `camera.list` bridge command wired in `NodeCommandExecutor` with device metadata payload
  - [x] `camera.snap` bridge command wired in `NodeCommandExecutor`
  - [x] Returns OpenClaw-compatible payload shapes:
    - `camera.list` -> `{ devices: [{ id, name, position, deviceType }] }`
    - `camera.snap` -> `{ format: "jpg", base64, width, height }`
  - [x] Replaced ffmpeg bridge with native Media Foundation capture path (device enumeration + source reader + MJPG sample extraction)
  - [x] Added graceful fallback path (placeholder frame) when native camera stack/device capture unavailable
  - [ ] Validate on real Windows host with physical cameras and tune device-selection heuristics
- **Automation (`Automation/`)**
  - [ ] Windows UIAutomation + SendInput bridge
- **Shell execution**
  - [x] `System.Diagnostics.Process` command executor with allowlist

---

## Phase 3: Discovery + IPC
- **Discovery**: mDNS/zeroconf equivalent for Windows
- **IPC**: Named Pipes bridge replacing macOS XPC

---

## Phase 4: UI / Tray / Onboarding
- System tray app (`NotifyIcon`)
- Settings/onboarding flows
- Overlay/HUD equivalents

---

## Testing Strategy
- ✅ Unit tests running via xUnit
- ✅ Current tests: protocol serialization/deserialization + bridge shape checks
- ✅ Added WebSocket dispatch tests with mocked gateway handshake + status request roundtrip
- ✅ Added unhandled-method error-path dispatch test (`INVALID_REQUEST`)
- ✅ Added handler-exception dispatch test (`UNAVAILABLE`)
- ✅ Added invalid-param tests for pairing handlers
- ✅ Added opt-in live gateway integration tests (`RUN_REAL_GATEWAY_INTEGRATION=1`) for:
  - real hello-ok connect path
  - real `status` command response path
- ✅ Added pairing event-ingestion tests (`device.pair.requested`, `node.pair.requested`, `*.pair.resolved`)
- ✅ Added platform-aware `screen.record` command test coverage (Windows success shape + non-Windows unavailable)
- ✅ Added `camera.snap` payload-shape test coverage
- ✅ Added `CameraCaptureService` coverage for baseline capture contract output
- ✅ Added opt-in real gateway integration coverage for `camera.snap` response-shape path when a connected node is available
- ✅ Added opt-in real gateway integration coverage for `screen.record` response-shape path when a connected node is available
- ✅ Added `camera.snap` parameter validation coverage (facing/format/quality invalid-request paths)
- ✅ Added `screen.record` parameter validation coverage (duration/fps/includeAudio/screenIndex/type invalid-request paths)
- ✅ Added `camera.list` command coverage (unit + opt-in real gateway response-shape path when a node is available)
- ✅ Added stricter `camera.list`/device-field shape assertions (unit + real gateway when devices are present)
- ✅ Added `screen.list` command coverage (unit + service-shape + opt-in real gateway response-shape path when a node is available)
- ✅ Added opt-in real gateway `camera.snap` coverage using explicit `deviceId` from `camera.list` when available
