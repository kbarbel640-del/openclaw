# Dynamic Model Routing — Manual Test Plan

**Companion to:** [dynamic-model-routing.md](./dynamic-model-routing.md)
**Last updated:** 2026-02-13

## Observation Method

For all tests, monitor the detail log in a separate terminal:

```bash
tail -f /tmp/openclaw/openclaw-$(date '+%Y-%m-%d').log | grep -i "routing\|tier\|classifier\|model"
```

Look for `reason: "classifier"` and the `detail` field in log entries to confirm routing decisions.

---

## A. Basic Routing (Sanity Check)

| #   | Action                                                           | Expected        |
| --- | ---------------------------------------------------------------- | --------------- |
| 1   | Send "hi" or "thanks" via Telegram                               | FAST/Haiku      |
| 2   | Send "how do I set up a Python virtualenv?"                      | STANDARD/Sonnet |
| 3   | Send a complex reasoning question                                | DEEP/Opus       |
| 4   | Verify `reason: "classifier"` and `detail` field in log for each | Present         |

## B. Context-Aware Routing (New Behavior)

| #   | Action                                                                     | Expected                                      |
| --- | -------------------------------------------------------------------------- | --------------------------------------------- |
| 5   | In an existing session, have a deep conversation (debugging, architecture) | DEEP/STANDARD tier                            |
| 6   | Send a short reply like "yes" or "ok"                                      | Stays at DEEP/STANDARD, does NOT drop to FAST |
| 7   | Start a new session (`/new`), send "hi"                                    | FAST (no prior context)                       |
| 8   | Send a short reply in a session where prior messages were all FAST         | Stays FAST                                    |

## C. Explicit `/model` Bypass

| #   | Action                                          | Expected                       |
| --- | ----------------------------------------------- | ------------------------------ |
| 9   | Send `/model sonnet`, then send "hi"            | Uses Sonnet (routing bypassed) |
| 10  | Send `/model` to clear override, then send "hi" | Routing resumes, expect FAST   |
| 11  | Same test on TUI if used                        | Same behavior                  |

## D. Sticky Session Override

| #   | Action                                                           | Expected             |
| --- | ---------------------------------------------------------------- | -------------------- |
| 12  | Send `/model haiku`, then several messages of varying complexity | All stay on Haiku    |
| 13  | Start a new session (`/new`), send "hi"                          | Routing active again |

## E. Classifier Failure Paths

| #   | Action                                                         | Expected                                                 | Cleanup                    |
| --- | -------------------------------------------------------------- | -------------------------------------------------------- | -------------------------- |
| 14  | Set `classifier.timeoutMs` to `1` in config, restart gateway   | Fallback to STANDARD with `reason: "fallback:timeout"`   | Restore timeoutMs, restart |
| 15  | Set `classifier.model` to a nonexistent model, restart gateway | Fallback to STANDARD with `reason: "fallback:error:..."` | Restore model, restart     |

## F. Fallback Tier Configuration

| #   | Action                                                                                | Expected         | Cleanup               |
| --- | ------------------------------------------------------------------------------------- | ---------------- | --------------------- |
| 16  | Change `"fallback": "standard"` to `"fallback": "fast"`, trigger a classifier failure | Fallback to FAST | Restore to "standard" |

## G. Empty / Edge-Case Messages

| #   | Action                                   | Expected                                              |
| --- | ---------------------------------------- | ----------------------------------------------------- |
| 17  | Send an empty or whitespace-only message | Fallback tier with `reason: "fallback:empty-message"` |
| 18  | Send a very long message (2000+ chars)   | Classifies correctly                                  |

## H. Auto-Seeded ROUTER Files

| #   | Action                                                                     | Expected                     | Cleanup                     |
| --- | -------------------------------------------------------------------------- | ---------------------------- | --------------------------- |
| 19  | Check if `ROUTER.md` and `ROUTER-HEURISTICS.md` exist in the workspace     | Present with default content |                             |
| 20  | Edit heuristics to change rules (e.g., make "hi" route to DEEP), send "hi" | Routes to DEEP               | Restore original heuristics |

## I. Passthrough Strategy

| #   | Action                                                                        | Expected                                                           | Cleanup                              |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| 21  | Change `"strategy": "dynamic-tiered"` to `"strategy": "passthrough"`, restart | All messages use primary model (Opus), no classifier calls in logs | Restore to "dynamic-tiered", restart |

---

## Notes

- Tests E, F, H, and I require config changes and gateway restarts. Always restore the original config afterwards.
- The classifier adds ~200-400ms per message (one Haiku call). If latency is higher, check `latencyMs` in the routing log.
- Context-aware routing (section B) reads the last 5 session messages (each truncated to 200 chars). These defaults are configurable via `classifier.contextMessages` and `classifier.contextChars` in the routing options.
