# Test Plan: Voice + Gesture MVP

## Unit tests

File: `apps/visionos/Tests/VisionNodeAppModelTests.swift`

1. Control panel activation enters `continuous_listening`.
2. Barge-in transition path is preserved (`assistant_speaking` -> `barge_in` -> `continuous_listening`).
3. Degraded signal triggers `fallback_ptt` with visible status.
4. Healthy signals recover from fallback to `continuous_listening`.
5. Pinch-hold and release complete one PTT cycle.
6. Downward flick cancels capture and clears active PTT.
7. Voice command opens chat/canvas/usage surfaces.
8. Voice command maps to vision skill shortcuts.
9. Language toggles through zh/en/ja.
10. Talk command set remains aligned to OpenClaw command names.

## Manual smoke checks

1. Launch app on visionOS simulator.
2. Confirm Control Panel starts in listening state without extra clicks.
3. Hold-talk control changes state to PTT fallback and release returns to recovering state.
4. Enter commands like "open chat" / "打开画布" / "使用量を表示" and verify surface windows open.

## Exit criteria

- `pnpm visionos:gen` succeeds.
- `pnpm visionos:build` succeeds on visionOS simulator destination.
- `pnpm visionos:test` passes with zero failures.
