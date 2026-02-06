# Clawdbot / Moltbot — Developer Handoff

**Status:** Actively stabilizing dev startup + model defaults

**Audience:** Senior engineer / systems architect taking over implementation

**Mandate:** Maintain evidence‑first, fail‑closed behavior. Minimal diffs. No speculative refactors.

---

## 1. Executive Summary

Clawdbot (aka Moltbot) is a local-first agent runtime consisting of a **Gateway** (websocket server + orchestration layer) and a **TUI** (terminal UI client). The immediate goal of the project is to make **local development boring and deterministic**:

- One command / one click starts Gateway + TUI
- Environment variables load reliably from repo root
- Model selection is correct and consistent across Gateway health, agent sessions, and the TUI
- Shutdown is clean and safe

We have just completed a critical stabilization pass fixing a long‑standing mismatch where the Gateway reported one model provider while the actual agent session used another. This was a code‑level default‑resolution bug, not persisted config.

The system is now in a **known‑good state** with Moonshot/Kimi as the default provider when `MOONSHOT_API_KEY` is present.

---

## 2. Core Goals (Current Phase)

### Primary Goal (Now)

Lock in **reliable local dev startup**:

- `pnpm dev:up` starts everything
- TUI connects automatically
- Correct model provider + model ID are selected by default
- Ctrl+C shuts everything down

### Secondary Goal (Next)

Enable **overnight agent‑driven development (Claude Code)** safely:

- Clear documentation of invariants
- Tight task scoping
- Regression tests guarding critical behavior

No broad refactors. No file re‑organization unless explicitly justified.

---

## 3. System Overview

### Components

**Gateway**
- Node.js process
- Handles model resolution, provider auth, session lifecycle
- Exposes websocket endpoint (`ws://127.0.0.1:19001`)
- Emits health and startup logs

**TUI**
- Node.js terminal UI
- Connects to Gateway
- Displays active session, model, token window

**Agents / Providers**
- Supports multiple LLM providers (Ollama local, Moonshot/Kimi cloud)
- Provider selection is resolved dynamically based on env + config

---

## 4. Model Default Resolution (CRITICAL INVARIANT)

### Precedence Order (Do Not Change)

1. CLI arguments
2. Explicit config
3. Explicit persisted choice
4. Dynamic defaults (environment‑based)

Dynamic default behavior:

- If `MOONSHOT_API_KEY` exists → provider = `moonshot`
- Default Moonshot model = `kimi-k2-0905-preview`
- Otherwise fallback → `ollama / llama3:chat`

### Authoritative Runtime Sources

| File | Role |
|----|----|
| `src/agents/defaults.ts` | Dynamic default provider/model resolution |
| `src/agents/models-config.providers.ts` | Provider catalog defaults |
| `src/gateway/startup-validation.ts` | Gateway boot validation |
| `src/gateway/server-startup-log.ts` | Startup logs (agent model line) |
| `src/gateway/session-utils.ts` | Session defaults (TUI header source) |

**Important:** All static `DEFAULT_PROVIDER` / `DEFAULT_MODEL` usage affecting runtime behavior has been removed from Gateway paths. Do not reintroduce static defaults.

---

## 5. Root Cause of the Previous Bug (Resolved)

### Symptom

- Gateway health reported Moonshot/Kimi
- Agent session + TUI still showed Ollama/Llama

### Root Cause

Several Gateway code paths used **static default constants** (`DEFAULT_PROVIDER`, `DEFAULT_MODEL`) instead of the dynamic resolver functions. As a result:

- Health check (already dynamic) → correct
- Startup log + session defaults (static) → incorrect

### Fix Applied

All relevant code paths now call:

- `resolveDefaultProvider()`
- `resolveDefaultModel(provider)`

This aligns health, agent model, and TUI display.

Persisted dev config (`~/.clawdbot-dev`) was audited and **not** responsible for the issue.

---

## 6. Moonshot Provider Status

### Verified Working Model ID

- **`kimi-k2-0905-preview`**

Confirmed via:

- `pnpm moltbot moonshot:smoke`

```text
✓ PASS moonshot:ping
Moonshot provider reachable (model: kimi-k2-0905-preview)
```

All runtime paths already use this model ID. Remaining references to older IDs exist only in documentation and are non‑blocking.

---

## 7. Dev Startup UX (Implemented)

### `pnpm dev:up`

- Spawns Gateway
- Waits for readiness
- Spawns TUI
- Prints clean READY banner with URLs
- Loads `.env` from repo root explicitly

### `pnpm dev:down`

- Shuts down dev processes
- **NOTE:** Must only kill Gateway dev processes (see pitfalls)

### VS Code / Cursor

- `.vscode/tasks.json` defines:
  - `Clawdbot: Dev Up` (default build task)
  - `Clawdbot: Dev Down`

Cmd+Shift+B = “Start Dev”.

---

## 8. Tests Added / Required

### Regression Coverage (Required)

- `src/gateway/session-utils.test.ts`
  - Asserts Moonshot defaults when `MOONSHOT_API_KEY` is set
  - Asserts fallback provider when unset

These tests prevent future regressions when defaults logic is touched.

---

## 9. What Is Still TODO

### Required (Before Expanding Scope)

1. **Harden `dev:down`**
   - Must filter by command line signature
   - Must fail‑closed if no matching Gateway process is found

2. **Optional Diagnostic Improvement**
   - Log model resolution source: `cli | config | persisted | default(env)`

### Explicitly Deferred

- Broad file re‑organization
- Doc cleanup of older model IDs
- New agent features

These should wait until dev startup is fully boring.

---

## 10. Pitfalls to Avoid

- Reintroducing static defaults in Gateway paths
- Letting agents reorganize the repo structure
- Running overnight agents without task rails
- Treating docs as authoritative over runtime code

---

## 11. How to Work Safely Going Forward

### Overnight / Agent‑Driven Work Rules

- One micro‑task at a time
- Minimal diff
- Tests or build must pass
- Diff + evidence required
- No speculative refactors

Recommended structure:

- `TASK_QUEUE.md` — ordered list of allowed tasks
- `RUNBOOK.md` — how to verify changes

---

## 12. Definition of “Good State”

You are in a good state if:

- `pnpm dev:up` works every time
- TUI shows `moonshot / kimi-k2-0905-preview`
- Smoke test passes
- Ctrl+C shuts down cleanly
- Tests guard defaults

From here, feature work can proceed safely.

---

**End of handoff.**

