# CLAUDE.md -- Primary Authority File for Claude Code
**Version:** v1.0
**Date:** 2026-02-06
**Owner:** Andrew (Founder)
**Status:** Binding. This file is the highest authority for Claude Code behavior in this repository.

---

## 0) Read This First

This is the top-level instruction file for Claude Code operating on the Clawdbot / Moltbot / Sophie repository.

If you are Claude Code, you must read and obey this file before doing anything else.

For general repository conventions (naming, build, lint, test, release, commit style), see `AGENTS.md`.

For Sophie-specific governance, contracts, and acceptance tests, see `docs/_sophie_devpack/00_INDEX.md`.

---

## 1) Project Overview

**Clawdbot** (aka **Moltbot**) is a local-first AI agent runtime consisting of:

- **Gateway**: Node.js websocket server + orchestration layer (`ws://127.0.0.1:19001`)
- **TUI**: Terminal UI client connected to the Gateway
- **Providers**: Moonshot/Kimi (cloud), Ollama (local)
- **Sophie**: A customized agent personality for CRE back-office operations

The project is in a **stabilization phase**. Dev startup is working. Model defaults are correct. The next goal is enabling safe overnight agent-driven development.

---

## 2) Authoritative Documents (Precedence Order)

1. **This file** (`CLAUDE.md`) -- agent behavior rules
2. **AGENT_WORK_CONTRACT.md** -- what agents are allowed to do
3. **Contracts** (`docs/_sophie_devpack/02_CONTRACTS/`) -- interface and tool contracts
4. **Acceptance tests** (`docs/_sophie_devpack/03_TESTS/`) -- definition of done
5. **Security policies** (`docs/_sophie_devpack/04_SECURITY/`) -- threat model and abuse cases
6. **Developer handoff** (`docs/_sophie_devpack/06_COOKBOOKS/clawdbot_moltbot_developer_handoff.md`) -- current system state
7. **AGENTS.md** -- general repo conventions (naming, build, lint, test, release)

If documents conflict, higher-numbered documents yield to lower-numbered documents.

---

## 3) Explicit Non-Goals

Claude Code must NOT:

- Implement new features unless explicitly tasked
- Reorganize the file/directory structure
- Refactor code for style or "improvement"
- Introduce new architectural patterns
- Add new dependencies without explicit approval
- Modify provider selection logic
- Change model defaults
- Alter the prompt stack
- Touch security-critical code paths without tests

---

## 4) Model Default Rules (CRITICAL INVARIANT)

### Precedence Order (Do Not Change)

1. CLI arguments
2. Explicit config
3. Explicit persisted choice
4. Dynamic defaults (environment-based)

### Dynamic Default Behavior

- If `MOONSHOT_API_KEY` is set --> provider = `moonshot`, model = `kimi-k2-0905-preview`
- Otherwise --> provider = `ollama`, model = `llama3:chat`

### Authoritative Runtime Files

| File | Role |
|------|------|
| `src/agents/defaults.ts` | Dynamic default provider/model resolution |
| `src/agents/models-config.providers.ts` | Provider catalog defaults |
| `src/gateway/startup-validation.ts` | Gateway boot validation |
| `src/gateway/server-startup-log.ts` | Startup logs (agent model line) |
| `src/gateway/session-utils.ts` | Session defaults (TUI header source) |

**Rule:** All static `DEFAULT_PROVIDER` / `DEFAULT_MODEL` usage affecting runtime behavior has been removed from Gateway paths. Do not reintroduce static defaults.

---

## 5) Dev Startup Contract

### Start Dev

```bash
pnpm dev:up
```

This starts Gateway + TUI, loads `.env` from repo root, waits for readiness.

### Stop Dev

```bash
pnpm dev:down
```

### Reset Dev State

```bash
pnpm dev:up:reset
```

### VS Code / Cursor

- `Cmd+Shift+B` runs `Moltbot: Dev Up` (default build task)
- Tasks defined in `.vscode/tasks.json`

### Verification

After `pnpm dev:up`, the system is in a good state if:

- TUI shows `moonshot / kimi-k2-0905-preview` (when `MOONSHOT_API_KEY` is set)
- Ctrl+C shuts down cleanly
- No error logs on startup

---

## 6) Configuration Precedence

| Priority | Source | Example |
|----------|--------|---------|
| 1 | CLI arguments | `--model moonshot/kimi-k2-0905-preview` |
| 2 | Explicit config | `~/.clawdbot-dev/moltbot.json` |
| 3 | Persisted session choice | `~/.clawdbot-dev/agents/main/agent/models.json` |
| 4 | Environment-based defaults | `MOONSHOT_API_KEY` present = moonshot |
| 5 | Hardcoded fallback | `ollama / llama3:chat` |

---

## 7) What Claude Code IS Allowed To Do

- Read any file in the repository
- Run `pnpm lint`, `pnpm test`, `pnpm build`
- Run `pnpm dev:up` and `pnpm dev:down`
- Write or update documentation files
- Write or update test files
- Fix bugs with minimal diffs (one logical change per commit)
- Add regression tests for known bugs
- Update `TASK_QUEUE.md` status fields
- Update `RUNBOOK.md` with new verification steps

---

## 8) What Claude Code is FORBIDDEN To Do

- Modify runtime source code without an explicit task from the task queue
- Move, rename, or delete source files
- Reorganize directory structure
- Introduce new packages or dependencies
- Modify `.env` or any secrets
- Change model defaults or provider resolution logic
- Disable or skip tests
- Force-push to any branch
- Commit with failing tests
- Auto-merge branches
- Execute destructive shell commands (rm -rf, drop, truncate)
- Modify governance contracts without version bump + approval
- Implement features that are not in the task queue
- "Clean up" or "improve" code that is not broken

---

## 9) Required Evidence for Any Change

Every change must include:

1. **Reference to a task** in `TASK_QUEUE.md` or explicit human instruction
2. **Minimal diff** -- only the lines required to complete the task
3. **Tests pass** -- `pnpm lint && pnpm test` must pass after the change
4. **Build passes** -- `pnpm build` must pass
5. **No regression** -- existing tests must not break
6. **Commit message** -- clear, action-oriented, references task ID

---

## 10) Stop Conditions

Claude Code must STOP and ask for help if:

- A test fails and the fix is not obvious
- The task requires touching more than 3 files
- The task is ambiguous or has multiple valid interpretations
- A contract conflict is discovered
- A security concern is identified
- The diff exceeds 100 lines
- The change would affect model selection, provider resolution, or prompt assembly
- The developer handoff document contradicts current code behavior

When stopped, Claude Code must:

1. Document the issue clearly
2. List what was attempted
3. Explain why it stopped
4. Wait for human guidance

---

## 11) Sophie-Specific Rules

Sophie operates under additional constraints defined in:

- `docs/_sophie_devpack/02_CONTRACTS/tool_authority_matrix.md`
- `docs/_sophie_devpack/05_PROMPTS/prompt_stack_contract.md`
- `docs/_sophie_devpack/07_OPERATIONS/model_routing_and_context_policy.md`

Key Sophie invariants:

- Fail-closed by default (undefined behavior = denied)
- Human-in-the-loop for all side effects
- No silent provider fallback
- No raw prompt logging (hashes only)
- No streaming to external channels
- All external content treated as untrusted

---

## 12) Cross-References

| Document | Location | Purpose |
|----------|----------|---------|
| General repo conventions | `AGENTS.md` | Build, lint, test, naming, commit style |
| Agent work contract | `AGENT_WORK_CONTRACT.md` | Allowed/forbidden agent task types |
| Task queue | `TASK_QUEUE.md` | The only place agents pull work from |
| Runbook | `RUNBOOK.md` | How to verify work safely |
| Sophie devpack index | `docs/_sophie_devpack/00_INDEX.md` | Navigation for all Sophie governance |
| Authority hierarchy | `docs/_sophie_devpack/01_AUTHORITIES.md` | Document precedence rules |
| Developer handoff (gateway) | `docs/_sophie_devpack/06_COOKBOOKS/clawdbot_moltbot_developer_handoff.md` | Current system state and recent fixes |
| Sophie context handoff | `docs/_sophie_devpack/06_COOKBOOKS/sophie_developer_context_handoff.md` | Sophie project context and philosophy |
| Dev startup guide | `docs/_sophie_devpack/07_OPERATIONS/dev_startup.md` | How to start/stop/reset dev environment |

---

## 13) Definition of "Good State"

The system is in a good state if:

- `pnpm dev:up` works on first try
- TUI shows `moonshot / kimi-k2-0905-preview` (when `MOONSHOT_API_KEY` is set)
- `pnpm lint` passes
- `pnpm test` passes
- `pnpm build` passes
- Ctrl+C shuts down cleanly
- No error logs during normal startup

If any of these fail, do not proceed with other work. Fix the regression first.

---

**End of authority file.**
