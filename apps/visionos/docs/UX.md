# UX: Voice + Gesture Interaction Model

## Information Architecture (Shared Space first)

- Control Panel window: always-on lightweight voice HUD.
- Canvas window: agent workspace surface.
- Chat window: conversation surface.
- Usage window: token/cost summary surface.

Immersive Space is not required for this increment and remains a v1+ enhancement path.

## Interaction Principles

1. Voice first: user should begin speaking without opening deep menus.
2. Gesture naturalness: pinch patterns only, no memorization-heavy symbolic gestures.
3. Explicit recovery: state pill must explain fallback/recovery transitions.
4. Multi-lingual continuity: language switching should affect both translation output and TTS voice.

## Voice State Pill Behavior

- `continuous_listening`: "Listening"
- `assistant_speaking`: "Speaking"
- `barge_in`: transient "Barge-in"
- `fallback_ptt`: "PTT Fallback"
- `recovering`: "Recovering"

## Gesture Mapping

1. Pinch once on buttons: open Chat/Canvas/Usage or toggle translation mode.
2. Pinch-hold on talk control: hold to capture.
3. Release talk hold: submit capture.
4. Downward flick while holding: cancel capture.
5. Pinch+drag: move panel.
6. Two-hand resize: scale panel/window.

## Accessibility and discoverability

- Every gesture path has a visible control button.
- Status and fallback are always represented as text, not only animation.
