# Architecture: Voice and Gesture Core

## Scope of this increment

This increment introduces the voice-gesture state model and wiring shell in `VisionNodeAppModel`.

File: `apps/visionos/Sources/Model/VisionNodeAppModel.swift`

## New internal types

- `VoiceInteractionState`
- `GestureIntent`
- `VoiceFallbackPolicy` (`autoPTT`)

## State Machine

States:

1. `idle`
2. `continuous_listening`
3. `assistant_speaking`
4. `barge_in`
5. `fallback_ptt`
6. `recovering`

Transition rules:

1. Control Panel activation -> `continuous_listening`.
2. Assistant speaking + user speech detected -> `barge_in` -> `continuous_listening`.
3. Repeated failures or high latency -> `fallback_ptt` when fallback policy is `autoPTT`.
4. Healthy recognition signals after fallback -> `recovering` -> `continuous_listening`.

## Gesture intent routing

`handleGestureIntent` applies only control actions and never attempts semantic interpretation.

- Surface actions: open Chat/Canvas/Usage, toggle language mode.
- Voice capture actions: start/stop/cancel PTT fallback flow.

## OpenClaw protocol alignment

- No protocol changes in this increment.
- Existing talk command names remain the contract:
  - `talk.ptt.start`
  - `talk.ptt.stop`
  - `talk.ptt.cancel`
  - `talk.ptt.once`

Source of truth: `apps/shared/OpenClawKit/Sources/OpenClawKit/TalkCommands.swift`
