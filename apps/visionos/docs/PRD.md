# PRD: OpenClaw visionOS Voice-First MVP

## Product Goal

Upgrade the MVP from "can connect" to "continuous voice communication with OpenClaw" while remaining safe and recoverable.

## Decisions Locked

1. Primary mode: continuous duplex voice.
2. Gesture complexity: basic natural gestures only.
3. Degraded-condition fallback: automatic fallback to PTT.

## MVP Key Scenarios (must-pass)

1. Voice opening loop: entering Control Panel starts continuous listening and first utterance reaches OpenClaw.
2. Barge-in loop: user speech interrupts assistant speech and keeps the same session context.
3. Degrade loop: high latency / repeated recognition failures trigger automatic PTT fallback with clear status pill.
4. Gesture-to-voice loop: pinch-hold starts voice capture, release sends, cancel drops transcript.
5. Voice-to-surface loop: "open chat/canvas/usage" opens the corresponding surface window.
6. Voice-to-vision-skill loop: "describe/translate" triggers `camera.snap` + matching vision skill and returns spoken summary + card.
7. Voice-to-memory loop: "remember this" routes to `/vision_record_memory` and writes markdown memory.
8. Security block loop: untrusted/unpaired/license-missing states do not crash and provide alternatives.
9. Session restore loop: app restart restores voice continuity and language preference.
10. Multi-language loop: zh/en/ja input-output alignment for voice + translation output.

## Gesture Contract (MVP)

1. Pinch once: activate focused control action.
2. Pinch-hold: push-to-talk fallback capture.
3. Pinch + drag: move control panel/card surface.
4. Two-hand resize: resize canvas/chat windows.
5. Hold + downward flick: cancel active voice capture.

## Constraints

1. No complex symbolic gesture dictionary in MVP.
2. Every core gesture action must have a visible button fallback.
3. Gesture is for trigger/control only; intent understanding remains voice/context-driven.
