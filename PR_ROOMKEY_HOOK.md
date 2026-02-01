## Summary

Compatibility note: Verified against **OpenClaw v2026.1.30**, including recent Telegram threading/HTML and routing changes. The `resolve_room_key` hook remains stable because it operates above channel-specific routing details.

This PR introduces a small, backward-compatible core hook that allows plugins to deterministically influence the canonical conversation identity ("RoomKey") used by OpenClaw for:

- session/transcript selection
- FIFO queue lane selection (ordering)

By default, behavior is unchanged.

## Motivation

OpenClaw’s pipeline already relies on a stable concept of "room/session identity" that drives both history selection and per-session serialization. Today, there is no first-class extension point for plugins to participate in that identity derivation, which forces plugins that need deterministic isolation to either patch channel internals (fragile) or rely on prompt-only scoping (best-effort).

This PR adds the minimal missing abstraction: a hook that lets plugins resolve a canonical RoomKey early in inbound context construction, before any session lookup or queueing occurs.

## Design goals

- Minimal surface area: one hook, one return value
- Backward compatible: default path unchanged
- One invariant: the same key is used for transcript identity and FIFO lane ordering
- Channel-agnostic core API (no "projects" concept in core)

## Proposed API

New hook: `resolve_room_key`

- Called after core computes the default session/room key.
- Plugins may return `{ roomKey }` to override the canonical key; returning `undefined` means no change.

Invariant:
- The returned `roomKey` is used as both the session identity key and the FIFO lane key.

## Implementation notes

- Adds helper: `resolveCanonicalRoomKey()` in `src/routing/room-key.ts` which calls the global hook runner if hooks are registered.
- Telegram inbound context builder calls `resolveCanonicalRoomKey()` after computing the base key.
- Plugin command context includes optional message metadata (`messageId`, `threadId`, `chatId`) to support deterministic semantics tied to monotonic message ids.

## Tests

- Unit test asserts:
  - no hook => roomKey unchanged
  - hook override => roomKey changes and the derived session lane uses the same key

## Non-goals

- No new user-facing features
- No Telegram-specific behavior beyond supplying normalized metadata into the hook
- No changes to default session semantics

---

## Behavioral Contract (normative)

This PR intentionally specifies behavior as **invariants**, not implementation details.

### RoomKey resolution

- **Single canonical key:** For every inbound message, OpenClaw computes exactly one *canonical* `roomKey`.
- **Deterministic:** Given the same inbound message metadata and plugin configuration, the canonical `roomKey` must resolve deterministically.
- **Early binding:** The canonical `roomKey` is finalized **before** any transcript/session lookup or FIFO lane selection.
- **Opt-in override:** If no plugin returns an override from `resolve_room_key`, behavior is unchanged from today.

### Queue + transcript alignment

- **No split-brain:** The canonical `roomKey` is used for **both**:
  - transcript/session identity selection, and
  - FIFO queue lane ordering.
- Therefore, it must be impossible for an inbound message to be queued under one key but persisted/read under another.

### Isolation properties (enabled by plugins)

- Core remains channel-agnostic, but by allowing plugins to override `roomKey`, the system can provide **true isolation boundaries** (e.g., per-project transcripts and ordering) without patching channel internals.

---

## 3-layer model: Transcript / Project Memory / Global Memory (normative)

This PR enables a clean separation of concerns for higher-level UX features (e.g., a Projects mode plugin). The intended model is:

1. **Transcript** (per canonical `roomKey`)
   - The conversation history used for immediate continuity.
   - Must be isolated by design when `roomKey` is isolated.

2. **Project Memory** (durable, project-scoped)
   - Long-lived notes/state associated with a project.
   - Must not be written to/read from other projects.

3. **Global Memory** (durable, explicitly accessed)
   - A separate global store that is **not** implicitly consulted by natural-language recall.
   - Access is explicit (e.g., a dedicated command / route), so reviewers and users can reason about scope.

### Explicitly deferred (out of scope)

- Whether **natural-language recall** should ever *fall back* to global memory is intentionally **not** decided in this PR.

---

## Condensed verification checklist (reasoning about correctness)

- **Deterministic routing:** A stable rule exists to derive a canonical `roomKey` (including any plugin override).
- **One key everywhere:** Transcript identity and FIFO queue lane use the same canonical `roomKey`.
- **True isolation:** Switching scope (e.g., project A → project B) results in different `roomKey`s, hence different transcripts and ordering lanes.
- **No silent miswrites:** There is no path that can write/read history under a key different from the one used for ordering.
- **Escape hatch works:** Disabling the feature (or bypassing the override) immediately returns to classic behavior.
- **Debug visibility matches reality:** Any debug/telemetry surface reflects the canonical `roomKey` actually used.
